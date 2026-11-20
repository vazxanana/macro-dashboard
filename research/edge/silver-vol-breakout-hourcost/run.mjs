// Edge research · silver-vol-breakout-hourcost: silver-vol-breakout's T1 (FAILED), unchanged, charged the demo's measured XAGUSD
// spread of its fill and exit hours (PREREGISTRATION.md). Accounting only; the failed verdict stands.
//   node research/edge/silver-vol-breakout-hourcost/run.mjs <candleDir> <ticks-XAGUSD.json> <symbols.json> [probeCommit]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, runTest, monthT, normP, inW, WINDOWS, quantile } from '../silver-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DAY = 86400;
export const GATE = { IS: [925, -0.135, 0.113, -2.99], OOS: [1090, -0.041, 0.063, -1.23], ALL: [2015, -0.084, 0.086, -3.04] };
export const SLIPS = [0, 0.05, 0.10], EXIT_HOUR = 20, MIN_DAYS = 20, MIN_WIN = 10, GOLD_COMMISSION = 0.000024, MED_K = 12;
export const JUDGED = { OOS: '2021 → data end', ALL: '2016 → data end' }, COND = { C1: ['frac', 0.05], C2: ['frac90', 0.10] };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

export function usable(probe) {
  if (!probe || !Array.isArray(probe.hourProfile)) return { ok: false, why: 'no probe file' };
  const days = new Set((probe.hours || []).map((h) => Math.floor(h.t / DAY))).size;
  if (days < MIN_DAYS) return { ok: false, why: `history covers ${days} weekdays` };
  for (let h = 0; h <= EXIT_HOUR; h++) { const p = probe.hourProfile[h]; if (!p || p.n < MIN_WIN || !(p.frac >= 0) || !(p.frac90 >= 0)) return { ok: false, why: `hour ${h} has ${p ? p.n : 0} windows` }; }
  return { ok: true, days };
}
// M = median high - low of the 12 M5 candles ending with the fill candle (the gold costs study's convention)
export function medRange(bars, fillT) { const i = bars.findIndex((b) => b.t === fillT); const rs = bars.slice(Math.max(0, i - MED_K + 1), i + 1).map((b) => b.h - b.l); return rs.length ? quantile(rs, 0.5) : 0; }
export const costFrac = (prof, h, key, com) => 0.5 * prof[h][key] + 0.5 * prof[EXIT_HOUR][key] + com;
export const chargeOne = (x, prof, key, com, s) => x.R - x.finR - (costFrac(prof, Math.floor(x.fillMin / 60), key, com) * x.entry + s * x.M) / x.r;
function stats(tr, net) { const c = tr.map((x, i) => ({ day: x.day, R: x.R, net: net[i] })), mt = monthT(c); return { n: c.length, netR: r3(mean(net)), grossR: r3(mean(tr.map((x) => x.R))), t: r2(mt.t), total: r2(net.reduce((s, v) => s + v, 0)) }; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [dir, probeFile, symFile, commit] = process.argv.slice(2);
  const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xag-5m.json.gz')))); rows.sort((a, b) => a[0] - b[0]);
  const lastFull = Math.floor(rows.at(-1)[0] / DAY) * DAY, days = buildDays(rows.filter((r) => r[0] < lastFull));
  const dataEnd = new Date((lastFull - DAY) * 1000).toISOString().slice(0, 10);
  const byDay = new Map(days.map((d) => [d.day, d])), { tr } = runTest(days);
  for (const x of tr) x.M = medRange(byDay.get(x.day).bars, x.fillT);
  const W = {}; for (const w of ['IS', 'OOS', 'ALL']) W[w] = tr.filter((x) => inW(x.day, WINDOWS[w]));
  const gate = {}; let gateOk = true;
  for (const [w, want] of Object.entries(GATE)) { const st = stats(W[w], W[w].map((x) => x.net)), got = [st.n, st.netR, st.grossR, st.t], ok = got.every((v, i) => v === want[i]); gateOk &&= ok; gate[w] = { got, want, ok }; }
  console.log('gate', gateOk, JSON.stringify(gate));
  const P = JSON.parse(fs.readFileSync(probeFile, 'utf8')), syms = JSON.parse(fs.readFileSync(symFile, 'utf8')), use = usable(P);
  const listed = syms.symbols && syms.symbols.XAGUSD && Number.isFinite(+syms.symbols.XAGUSD.commissionRT) ? +syms.symbols.XAGUSD.commissionRT : null;
  const com = listed ?? GOLD_COMMISSION;
  const base = { study: 'silver-vol-breakout-hourcost', built: new Date().toISOString().slice(0, 10), dataEnd, gate, gateOk, probe: { at: P.at, commit: commit || null, ...use }, commission: com, commissionSrc: listed != null ? 'XAGUSD' : 'gold figure (XAGUSD not listed)' };
  if (!gateOk) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'STOPPED: the harness gate failed' }, null, 1)); process.exit(2); }
  if (!use.ok) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'NOT MEASURABLE: ' + use.why }, null, 1)); process.exit(0); }
  const prof = P.hourProfile, grid = {};
  for (const key of ['frac', 'frac90']) { grid[key] = {}; for (const s of SLIPS) { grid[key][s] = {}; for (const w of ['IS', 'OOS', 'ALL']) grid[key][s][w] = stats(W[w], W[w].map((x) => chargeOne(x, prof, key, com, s))); } }
  const tests = [];
  for (const [c, [key, s]] of Object.entries(COND)) for (const w of Object.keys(JUDGED)) { const g = grid[key][s][w]; tests.push({ cond: c, window: w, n: g.n, netR: g.netR, t: g.t, p: normP(g.t), holds: g.netR > 0 && g.t >= 2 }); }
  const ps = tests.map((x) => x.p), order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); let m = 0; order.forEach(([p, i], k) => { m = Math.max(m, Math.min(1, (ps.length - k) * p)); tests[i].pHolm = r3(m); tests[i].p = r3(tests[i].p); });
  const costR = r3(mean(W.ALL.map((x) => (costFrac(prof, Math.floor(x.fillMin / 60), 'frac', com) * x.entry + 0.05 * x.M) / x.r)));
  const g1 = grid.frac[0.05], g2 = grid.frac90[0.1];
  const verdict = `ACCOUNTING (the FAILED silver rule, not re-judged): at the demo's measured XAGUSD spreads, C1 (median + 0.05 × M) ${g1.OOS.netR}R a trade on 2021 → ${dataEnd} (t ${g1.OOS.t}) and ${g1.ALL.netR}R on 2016 → (t ${g1.ALL.t}); C2 ${g2.OOS.netR}R (t ${g2.OOS.t}) and ${g2.ALL.netR}R (t ${g2.ALL.t}); cost about ${costR}R a trade against the study's ${r3(mean(W.ALL.map((x) => 0.03 / x.r)))}R; holds in ${tests.filter((x) => x.holds).length} of 4`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, profile: prof, grid, tests, costR, verdict }, null, 1));
  console.log(verdict);
}
