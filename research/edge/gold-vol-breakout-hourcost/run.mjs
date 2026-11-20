// Edge research · gold-vol-breakout-hourcost: gold-vol-breakout's T1, unchanged, charged the demo broker's quoted spread of
// the hour it filled in and of its 20:55 UTC exit hour (PREREGISTRATION.md). Cost accounting only: no rule is tested.
// Trades and statistics come from costs.mjs (gold-vol-breakout-costs/run.mjs byte for byte) and original.mjs (gold-vol-breakout's
// run.mjs byte for byte).
//   node research/edge/gold-vol-breakout-hourcost/run.mjs <candleDir> <ticks-XAUUSD.json> <symbols.json> [probeCommit]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as O from './original.mjs';
import { tradesIn, stats, daysOf, WINDOWS, WLABEL, sessionOf } from './costs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const COSTS_SHA = 'c753937339a0e5531c011bb4ed6473a1e4f9682e28c203cac20152f7891c922a';
// the costs study's route S ($0.60), no slippage, per window: the harness gate
export const GATE = { W1: [929, 0.12, 0.217, 2.83], W2: [728, 0.1, 0.186, 1.7], W3: [935, 0.009, 0.111, 0.22], W4: [1121, 0.072, 0.121, 1.86], POOLED: [3713, 0.073, 0.155, 3.35] };
export const SLIPS = [0, 0.05, 0.10], EXIT_HOUR = 20, MIN_DAYS = 20, MIN_WIN = 10;
export const COND = { C1: ['H', 0.05], C2: ['H90', 0.10] }, JUDGED = ['POOLED', 'W4'];
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

// is the measurement usable? { ok, why }
export function usable(probe) {
  if (!probe || !Array.isArray(probe.hourProfile)) return { ok: false, why: 'no probe file' };
  const days = new Set((probe.hours || []).map((h) => Math.floor(h.t / 86400))).size;
  if (days < MIN_DAYS) return { ok: false, why: `history covers ${days} weekdays (under ${MIN_DAYS})` };
  for (let h = 0; h <= EXIT_HOUR; h++) { const p = probe.hourProfile[h]; if (!p || p.n < MIN_WIN || !(p.frac >= 0) || !(p.frac90 >= 0)) return { ok: false, why: `hour ${h} has ${p ? p.n : 0} windows` }; }
  return { ok: true, days };
}
// round-trip cost share of the entry price for a trade that filled in hour h
export function costFrac(profile, h, key, commission) { return 0.5 * profile[h][key] + 0.5 * profile[EXIT_HOUR][key] + commission; }
export const hourOf = (x) => Math.floor(x.fillMin / 60);
export function charge(tr, profile, key, commission, s) {
  return tr.map((x) => ({ day: x.day, R: x.R, net: x.R - x.finR - (costFrac(profile, hourOf(x), key, commission) * x.entry + s * x.M) / x.r }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [dir, probePath, symPath, probeCommit] = process.argv.slice(2);
  const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, f))).digest('hex');
  if (sha('original.mjs') !== ORIG_SHA || sha('costs.mjs') !== COSTS_SHA) throw new Error('original.mjs / costs.mjs are not the verbatim copies');
  const { days, dataEnd } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, 'xau-5m.json.gz')))));
  const T = {}; for (const [w, win] of Object.entries(WINDOWS)) T[w] = tradesIn(days, win).tr;
  // gate: route S, no slippage
  const gate = {}; let gateOk = true;
  for (const [w, want] of Object.entries(GATE)) {
    const st = stats(T[w].map((x) => ({ day: x.day, R: x.R, net: x.R - x.finR - 0.6 / x.r })));
    const got = [st.n, st.netR, st.grossR, st.t], ok = got.every((v, i) => v === want[i]); gateOk &&= ok; gate[w] = { got, want, ok };
  }
  console.log('gate', gateOk);
  const probe = JSON.parse(fs.readFileSync(probePath, 'utf8')), syms = JSON.parse(fs.readFileSync(symPath, 'utf8'));
  const use = usable(probe), commission = syms && syms.symbols && syms.symbols.XAUUSD ? +syms.symbols.XAUUSD.commissionRT : NaN;
  const base = { study: 'gold-vol-breakout-hourcost', built: new Date().toISOString().slice(0, 10), dataEnd, gate, gateOk, probe: { at: probe.at, commit: probeCommit || null, reachDays: probe.reachDays, ...use }, commission };
  if (!gateOk) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: 'STOPPED: the harness gate failed' }, null, 1)); process.exit(2); }
  if (!use.ok || !(commission >= 0)) { fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, verdict: `NOT MEASURABLE: ${use.ok ? 'no XAUUSD commission on file' : use.why}` }, null, 1)); process.exit(0); }
  const prof = probe.hourProfile;
  const grid = {};
  for (const key of ['frac', 'frac90']) { const rk = key === 'frac' ? 'H' : 'H90'; grid[rk] = {};
    for (const s of SLIPS) { grid[rk][s] = {}; for (const w of Object.keys(WINDOWS)) { const st = stats(charge(T[w], prof, key, commission, s)); delete st.tRaw; grid[rk][s][w] = st; } } }
  const tests = [];
  for (const [ck, [rk, s]] of Object.entries(COND)) for (const w of JUDGED) { const g = grid[rk][s][w]; tests.push({ cond: ck, route: rk, slip: s, window: w, n: g.n, netR: g.netR, t: g.t, p: O.normP(g.t) }); }
  const adj = O.holm(tests.map((x) => x.p)); tests.forEach((x, i) => { x.p = r3(x.p); x.pHolm = r3(adj[i]); x.holds = x.netR > 0 && x.t >= 2; });
  const sessions = {};
  for (const [name] of [['Asia'], ['London'], ['New York']]) {
    const tr = T.POOLED.filter((x) => sessionOf(x.fillMin) === name), c = charge(tr, prof, 'frac', commission, 0.05);
    sessions[name] = { n: tr.length, grossR: r3(mean(tr.map((x) => x.R))), netC1: r3(mean(c.map((x) => x.net))), costC1R: r3(mean(tr.map((x) => (costFrac(prof, hourOf(x), 'frac', commission) * x.entry + 0.05 * x.M) / x.r))) };
  }
  const hold = (c, w) => tests.find((x) => x.cond === c && x.window === w).holds;
  const verdict = `ACCOUNTING (no rule tested): at the demo's measured hourly spreads T1 ${hold('C1', 'POOLED') ? 'stays' : 'does not stay'} positive with month t ≥ 2 pooled 2007-26 under C1 (H + 0.05 × M: ${grid.H[0.05].POOLED.netR >= 0 ? '+' : ''}${grid.H[0.05].POOLED.netR}R, t ${grid.H[0.05].POOLED.t}) and ${hold('C1', 'W4') ? 'does' : 'does not'} on 2021-26 (${grid.H[0.05].W4.netR}R, t ${grid.H[0.05].W4.t}); under C2 (H90 + 0.10 × M) ${grid.H90[0.1].POOLED.netR}R pooled (t ${grid.H90[0.1].POOLED.t}), ${grid.H90[0.1].W4.netR}R on 2021-26 (t ${grid.H90[0.1].W4.t})`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ ...base, profile: prof, routes: { H: 'half the median quoted spread of the fill hour + half of hour 20 + commission, as a share of the entry', H90: 'the same with the 90th percentile' }, slips: SLIPS, windows: WLABEL, grid, tests, sessions, verdict }, null, 1));
  console.log(verdict);
}
