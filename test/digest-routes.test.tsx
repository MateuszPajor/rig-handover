import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/reader.js';
import type { NightDigest } from '../src/digest/types.js';
import { lane } from '../src/lane.js';

const NORMAL = '2026-11-01';
const EMPTY = '2026-11-02';
const BAD = '2026-11-03';
const MISSING = '2026-11-04';

const line = (job: string, status: string, owner: string | null, at: string, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

// Lines are deliberately not in job order, so the sort is tested, not inherited from the file.
const NORMAL_LINES = [
  line('notes/backup', 'fail', 'ana', '2026-11-01T23:00:02+01:00', 'quota exceeded'),
  line('lane/sync', 'ok', 'mateusz', '2026-11-01T23:00:06+01:00'),
  line('digest/render', 'ok', null, '2026-11-01T23:10:00+01:00'),
  line('fixtures/refresh', 'retry', 'ana', '2026-11-01T23:20:00+01:00', 'upstream 503'),
  line('fixtures/refresh', 'ok', 'ana', '2026-11-01T23:25:00+01:00'),
  line('rig/rotate-logs', 'ok', null, '2026-11-01T23:30:00+01:00'),
];

const BAD_LINES = [
  line('lane/sync', 'ok', 'mateusz', '2026-11-03T23:00:06+01:00'),
  '{"at":"2026-11-03T23:05:00+01:00","job":',
  line('digest/render', 'retry', null, '2026-11-03T23:10:00+01:00', 'timeout'),
  line('notes/backup', 'ok', 'ana', '2026-11-03T23:15:00+01:00'),
];

describe('digest routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    writeFileSync(join(dir, `${NORMAL}.jsonl`), NORMAL_LINES.join('\n') + '\n');
    writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
    writeFileSync(join(dir, `${BAD}.jsonl`), BAD_LINES.join('\n') + '\n');
    app = createApp({
      adapter: 'shim',
      installed: '2026-10-29T14:06:00+01:00',
      beatEverySeconds: 60,
      runsDir: dir,
    });
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  describe('GET /digest/:night', () => {
    it('answers 200 with the layout and the lane banner for a normal night', async () => {
      const res = await app.request(`/digest/${NORMAL}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain(lane().id);
    });

    it('lists each job of the night once, sorted by job, with a null owner as a dash', async () => {
      const html = await (await app.request(`/digest/${NORMAL}`)).text();
      for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']) {
        expect(html.split(job).length - 1).toBe(1);
      }
      expect(html).toContain('—');
    });

    it('answers 404 when the night has no file', async () => {
      const res = await app.request(`/digest/${MISSING}`);
      expect(res.status).toBe(404);
    });

    it('says "nothing ran" for an empty night', async () => {
      const res = await app.request(`/digest/${EMPTY}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('nothing ran');
    });

    it('answers 200 for a night with a bad line and still renders the good rows', async () => {
      const res = await app.request(`/digest/${BAD}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('lane/sync');
      expect(html).toContain('digest/render');
      expect(html).toContain('notes/backup');
    });

    it('lists jobs in the same order as the JSON rows', async () => {
      const html = await (await app.request(`/digest/${NORMAL}`)).text();
      const json = (await (await app.request(`/api/digest/${NORMAL}`)).json()) as NightDigest;
      const positions = json.rows.map((row) => html.indexOf(row.job));
      expect(positions).not.toContain(-1);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
  });

  describe('GET /api/digest/:night', () => {
    it('answers 200 with the NightDigest object from readNight', async () => {
      const res = await app.request(`/api/digest/${NORMAL}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(readNight(dir, NORMAL));
    });

    it('returns rows sorted by job, with a null owner kept as null', async () => {
      const body = (await (await app.request(`/api/digest/${NORMAL}`)).json()) as NightDigest;
      expect(body.night).toBe(NORMAL);
      expect(body.rows.map((r) => r.job)).toEqual([
        'digest/render',
        'fixtures/refresh',
        'lane/sync',
        'notes/backup',
        'rig/rotate-logs',
      ]);
      expect(body.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
    });

    it('answers 404 when the night has no file', async () => {
      const res = await app.request(`/api/digest/${MISSING}`);
      expect(res.status).toBe(404);
    });

    it('returns empty rows for an empty night', async () => {
      const res = await app.request(`/api/digest/${EMPTY}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as NightDigest;
      expect(body.rows).toEqual([]);
    });

    it('answers 200 for a night with a bad line and counts it in badLines', async () => {
      const res = await app.request(`/api/digest/${BAD}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as NightDigest;
      expect(body.badLines).toBe(1);
      expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync', 'notes/backup']);
    });
  });
});
