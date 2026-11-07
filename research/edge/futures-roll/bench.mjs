// Before/after proof: chained ict/tracker.mjs runs of one code tree on the stubbed CNBC feed (stub-live.mjs), carrying trades.json,
// shadow.json, bars.json and snapshot.json from run to run (as the live workflow does). Writes per run a digest of what the live desk
// sees, and keeps the final files. node bench.mjs <code root> <state dir> <startIso> <endIso> <stepMin> <dump> <probe> <shifts>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [root, dir, a, b, step, DUMP, PROBE, SHIFTS] = process.argv.slice(2);
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const STUB = path.join(path.dirname(new URL(import.meta.url).pathname), 'stub-live.mjs');
const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const out = [];
for (let T = Date.parse(a) / 1000; T <= Date.parse(b) / 1000; T += +step * 60) {
  const iso = new Date(T * 1000).toISOString();
  let err = null;
  try { execFileSync(process.execPath, ['--import', STUB, path.join(root, 'ict', 'tracker.mjs'), dir], { stdio: 'pipe', env: { ...process.env, ROLL_DUMP: DUMP, ROLL_PROBE: PROBE, ROLL_SHIFTS: SHIFTS, ROLL_NOW: iso } }); }
  catch (e) { err = String(e.stderr || e.message).slice(0, 300); }
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const trades = rd('trades.json'), snap = rd('snapshot.json'), bars = rd('bars.json'), sh = rd('shadow.json');
  delete snap.at; for (const v of Object.values(sh.variants || {})) delete v.since; delete sh.since; delete sh.at;
  const snapCore = JSON.parse(JSON.stringify(snap)); for (const m of Object.values(snapCore.markets)) { delete m.d1Roll; delete m.switched; delete m.pdh; delete m.pdl; }
  out.push({ T, iso, err, trades: hash(trades), snapCore: hash(snapCore), snap: hash(snap), h1m5: hash(Object.fromEntries(Object.entries(bars).map(([k, v]) => [k, [v.h1, v.m5]]))), d1: hash(Object.fromEntries(Object.entries(bars).map(([k, v]) => [k, v.d1]))),
    shadow: hash(sh), n: trades.length, open: trades.filter((x) => x.status === 'open').map((x) => x.id), switched: Object.entries(snap.markets).filter(([, m]) => m.switched).map(([k, m]) => [k, m.switched.by]) });
}
fs.writeFileSync(path.join(dir, 'digest.json'), JSON.stringify(out));
console.log(root, 'runs', out.length, 'errors', out.filter((x) => x.err).length, 'trades', out.at(-1).n);
