import type { DigestRow, NightDigest } from '../digest/types.js';

const dash = '—';

function marker(row: DigestRow): string {
  const notes: string[] = [];
  if (row.lastStatus === 'fail') notes.push('fail');
  if (row.retries >= 3) notes.push('≥3 retries');
  return notes.length > 0 ? `! ${notes.join(', ')}` : '';
}

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      {digest.badLines > 0 && (
        <p class="warn">
          {digest.badLines} {digest.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
              <th>flag</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((row) => {
              const bad = row.lastStatus === 'fail' || row.retries >= 3;
              return (
                <tr class={bad ? 'warn' : undefined}>
                  <td>{row.job}</td>
                  <td>{row.owner ?? dash}</td>
                  <td>{row.runs}</td>
                  <td>{row.retries}</td>
                  <td>{row.lastStatus}</td>
                  <td>{row.lastError ?? dash}</td>
                  <td>{row.firstAt}</td>
                  <td>{row.lastAt}</td>
                  <td>{bad ? marker(row) : dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

export function NoRunLog({ night }: { night: string }) {
  return (
    <>
      <h1>digest · {night}</h1>
      <p class="warn">no run log for that night</p>
    </>
  );
}
