// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  /** null in the log; views show it as `—`. */
  owner: string | null;
  /** lines for this job, any status */
  runs: number;
  /** lines with status `retry` */
  retries: number;
  lastStatus: RunStatus;
  /** error of the last line that had one; null if none */
  lastError: string | null;
  /** `at` of the first and last line, offset kept as logged */
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  /** sorted by job */
  rows: DigestRow[];
  /** lines that did not parse: counted, never thrown */
  badLines: number;
  /** lines per status, for the board */
  counts: Record<RunStatus, number>;
};

/**
 * Reads runs/<night>.jsonl. Returns null when the night has no file (→ 404);
 * an empty file gives `rows: []` ("nothing ran").
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
