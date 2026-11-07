// before/after proof for the live ICT stream: chained tracker runs, old code vs new code, same stubbed feed and clock.
//   node chain.mjs <oldTracker> <newTracker> <stubDir> <startISO> <endISO> <stepMin> <workDir>
// Every step compares trades.json, snapshot.json, bars.json byte for byte and shadow.json without the new variant 'silver'.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [OLD, NEW, STUB, A, B, STEP, WORK] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const dO = path.join(WORK, 'old'), dN = path.join(WORK, 'new');
for (const d of [dO, dN]) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'trades.json'), '[]'); }
const run = (tr, dir, now) => execFileSync(process.execPath, ['--import', path.join(HERE, 'stub.mjs'), tr, dir], { env: { ...process.env, NOW: now, STUB_DIR: STUB }, stdio: 'pipe' }).toString();
const rd = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
let steps = 0, diffs = 0, last = '';
const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' });
for (let t = Date.parse(A); t <= Date.parse(B); t += +STEP * 60e3) {
  if (ny.format(new Date(t)) === 'Sat') continue;
  const now = new Date(t).toISOString();
  run(OLD, dO, now); last = run(NEW, dN, now); steps++;
  for (const f of ['trades.json', 'snapshot.json', 'bars.json']) if (rd(dO, f) !== rd(dN, f)) { diffs++; console.log('DIFF', now, f); }
  const so = JSON.parse(rd(dO, 'shadow.json')), sn = JSON.parse(rd(dN, 'shadow.json')); delete sn.variants.silver;
  if (JSON.stringify(so) !== JSON.stringify(sn)) { diffs++; console.log('DIFF', now, 'shadow.json (without silver)'); }
}
const T = JSON.parse(rd(dN, 'trades.json')), S = JSON.parse(rd(dN, 'shadow.json')), sv = S.variants.silver;
console.log(JSON.stringify({ steps, diffs, liveTrades: T.length, liveClosed: T.filter((x) => x.closed).length, aset: T.filter((x) => x.aset).length,
  variants: Object.fromEntries(Object.entries(S.variants).map(([k, v]) => [k, v.trades.length])), dip: S.trades.length, silver: sv.totals, silverErrors: sv.errors, lastLog: last.trim() }));
