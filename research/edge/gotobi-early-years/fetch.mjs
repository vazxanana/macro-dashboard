// Edge research · gotobi-early-years: OANDA mid M5 through the site's keyless /md/bars proxy, the gotobi-replicate fetch.mjs
// pattern (pages of 4,999 candles, paced, progress saved per file). Only candles that start 00:00-06:55 UTC are kept (the fade
// leg and its lookback read 00:40-06:00 UTC).
//   node --use-env-proxy research/edge/gotobi-early-years/fetch.mjs <outDir> [set]   set = early | nzd | gate | all (default)
// Writes <outDir>/<sym>-<set>.json.gz. Keep the output out of git.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [OUT, SET = 'all'] = process.argv.slice(2);
if (!OUT) throw new Error('usage: node fetch.mjs <outDir> [early|nzd|gate|all]');
const BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (s) => Date.parse(s.length > 10 ? s : s + 'T00:00:00Z') / 1000;
const SEC = 300;
export const CROSSES = ['eurjpy', 'gbpjpy', 'audjpy', 'cadjpy', 'chfjpy', 'nzdjpy'];
export const JOBS = {
  early: CROSSES.map((sym) => ({ sym, file: `${sym}-early.json.gz`, from: T('2004-12-01'), to: T('2010-01-01') })),
  nzd: [{ sym: 'nzdjpy', file: 'nzdjpy-late.json.gz', from: T('2009-11-01'), to: T('2026-11-12T07:00:00Z') }],
  gate: [{ sym: 'usdjpy', file: 'usdjpy-gate.json.gz', from: T('2015-11-01'), to: T('2026-11-12T07:00:00Z') }],
};
const keep = (t) => (t % 86400) < 7 * 3600;

async function page(sym, a, b) {
  let err = null;
  for (let k = 0; k < 6; k++) {
    try {
      const r = await fetch(`${BASE}bars?sym=${sym}&tf=5m&from=${a}&to=${b}`, { signal: AbortSignal.timeout(30000) });
      const x = r.ok ? await r.json() : null;
      if (x && Array.isArray(x.bars)) return x.bars.filter((q) => !q.live && q.time >= a && q.time < b && keep(q.time)).map((q) => [+q.time, +q.open, +q.high, +q.low, +q.close]);
      err = x && x.error ? String(x.error) : `HTTP ${r.status}`;
    } catch (e) { err = String(e.message || e); }
    await sleep(2000 * (k + 1));
  }
  throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: ${err}`);
}

async function job(J) {
  const f = path.join(OUT, J.file);
  if (fs.existsSync(f)) { console.log(`${f} exists`); return; }
  const part = path.join(OUT, `${J.file}.part.json`);
  let st = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : { next: J.from, rows: [] };
  while (st.next < J.to) {
    const b = Math.min(J.to, st.next + 4999 * SEC);
    const rows = await page(J.sym, st.next, b);
    st = { next: b, rows: st.rows.concat(rows) };
    fs.writeFileSync(part, JSON.stringify(st));
    console.log(`${J.file}: through ${new Date(b * 1000).toISOString().slice(0, 10)} (${st.rows.length} candles)`);
    await sleep(400);
  }
  const all = new Map(); for (const r of st.rows) all.set(r[0], r);
  const bars = [...all.values()].sort((p, q) => p[0] - q[0]);
  fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(bars)));
  fs.rmSync(part, { force: true });
  console.log(`${J.file}: ${bars.length} candles ${new Date(bars[0][0] * 1000).toISOString().slice(0, 10)} -> ${new Date(bars.at(-1)[0] * 1000).toISOString().slice(0, 16)}`);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = SET === 'all' ? Object.values(JOBS).flat() : JOBS[SET];
if (!jobs) throw new Error(`unknown set ${SET}`);
for (const J of jobs) await job(J);
