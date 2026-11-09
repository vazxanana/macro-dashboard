// Safe council-data file I/O (reliability, 9 Nov 2026). The loop runs members under `timeout` (macro 180 s, digest 120 s, data
// check 150 s, ledger 60 s): a kill in the middle of fs.writeFileSync leaves a file cut short, and the next round read it as
// "missing" and started that log again from empty. writeAtomic writes a temporary file next to the target and renames it over
// (a rename is atomic on one file system), so a reader sees the old file or the new one, never half of one. readJson tells a
// missing file (use the default) from one that does not parse (keep it; do not overwrite an append-only log with a fresh one).
import fs from 'node:fs';
import path from 'node:path';

export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try { fs.writeFileSync(tmp, text); fs.renameSync(tmp, file); }
  catch (e) { try { fs.rmSync(tmp, { force: true }); } catch (e2) { /* nothing to clean */ } throw e; }
}
// write only when the text changed; returns true when written
export function writeIfChanged(file, text) {
  let old = null; try { old = fs.readFileSync(file, 'utf8'); } catch (e) { /* new file */ }
  if (old === text) return false;
  writeAtomic(file, text); return true;
}
// { value, state: 'ok' | 'missing' | 'corrupt', error? }; value = dflt unless state is 'ok'
export function readJson(file, dflt = null) {
  let s;
  try { s = fs.readFileSync(file, 'utf8'); } catch (e) { return { value: dflt, state: 'missing' }; }
  try { return { value: JSON.parse(s), state: 'ok' }; } catch (e) { return { value: dflt, state: 'corrupt', error: String(e.message || e).slice(0, 120) }; }
}
