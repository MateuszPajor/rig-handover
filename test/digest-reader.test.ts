import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const digest = readNight('runs', '2026-10-28');
  const row = (job: string) => digest?.rows.find((r) => r.job === job);

  it('reads five jobs, sorted, and counts the one bad line', () => {
    expect(digest).not.toBeNull();
    expect(digest?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(digest?.badLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('fixtures/refresh retried three times', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('notes/backup failed with quota exceeded', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('digest/render keeps a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps the offset as logged', () => {
    expect(row('lane/sync')).toMatchObject({
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null when the night has no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('gives no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('counts invalid objects as bad lines', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      ['{"at":"x","job":"a","status":"done","owner":null}', '[]', '42', '{"at":"x","job":"a","status":"ok"}', ''].join('\n'),
    );
    expect(readNight(dir, '2026-01-03')).toMatchObject({ rows: [], badLines: 4 });
  });

  it('rejects a night that is not a date', () => {
    expect(readNight(dir, '../2026-01-02')).toBeNull();
    expect(readNight('runs', '2026-10-28/../2026-10-28')).toBeNull();
  });
});
