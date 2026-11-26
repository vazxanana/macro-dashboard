// Is there a fresh desk fill for the demo mirror to copy? (26 Nov 2026, owner: "We need to fix these delays and late entries",
// then "More speed".) Read only: it looks at the desk files of the Equinox desks the mirror copies and answers yes (exit 0)
// when one holds an OPEN record the tracker first wrote in the last FRESH_S seconds. council.yml then runs the mirror at once,
// between the one-minute quick passes and between a round's heavy members, so a copy goes out about 20 seconds after the
// desk's fill instead of waiting for the next pass. Not sure (a file that does not parse, none there) = no. It places nothing.
//   node council/copy-due.mjs <council-data dir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DESKS = ['fade', 'bigfade', 'boxfade', 'fvg', 'goldvb'];   // the desks council/ctrader-mirror.mjs copies (EQX.desks + bigfade + boxfade)
export const FRESH_S = 180;

export function due(read, now = Math.floor(Date.now() / 1000)) {
  const hits = [];
  for (const k of DESKS) {
    let j; try { j = read(k); } catch { continue; }
    for (const r of (j && Array.isArray(j.records) ? j.records : [])) if (r && r.status === 'open' && now - (+r.first || 0) <= FRESH_S && now - (+r.first || 0) >= -60) hits.push(k + ':' + r.id);
  }
  return hits;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2] || 'data';
  const hits = due((k) => JSON.parse(fs.readFileSync(path.join(dir, k, 'desk.json'), 'utf8')));
  if (hits.length) { console.log('fresh desk fills: ' + hits.join(', ')); process.exit(0); }
  process.exit(1);
}
