// NAS100 breakout long, focused study (PREREGISTRATION.md). node run.mjs [cacheDir]   -> result.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { toArrays, prep, simulate, summary, atr, sma, rng } from '../auto-researcher/engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), cacheDir = process.argv[2] || '/tmp/nasbrk-cache';
export const RULE = { mk: 'nas100', trig: [{ kind: 'brk', N: 20 }], side: 'long', hours: [14, 22], dows: null, trend: 'with', vol: 'none', volP: 0.3, stop: 1, rr: 4, hold: 96 };
const COST = 6e-5, COST_LO = 2.7e-5, COST_HI = 1.2e-4;

// ---- own per-trade implementation (long only), compared with the engine ----
const hiOf = (D, N, i) => { if (i < N) return NaN; let m = -Infinity; for (let k = i - N; k < i; k++) if (D.h[k] > m) m = D.h[k]; return m; };
const hourOk = (D, hours, i) => { if (!hours) return true; const h = D.hour[i + 1], [a, b] = hours; return a <= b ? h >= a && h < b : h >= a || h < b; };
function walk(D, g, i, cost) {                       // one long trade from the close of bar i; null = not a trade
  const A = atr(D)[i]; if (!(A > 0)) return null;
  const entry = D.o[i + 1], dist = g.stop * A, stop = entry - dist, tgt = g.rr > 0 ? entry + g.rr * dist : null, cst = cost * entry;
  if (!(dist > 0) || cst / dist > 0.5) return null;
  let ex = null, j = i + 1;
  for (; j <= i + g.hold && j < D.n; j++) {
    const o = j === i + 1 ? entry : D.o[j];
    if (o <= stop) { ex = o; break; }
    if (D.l[j] <= stop) { ex = stop; break; }
    if (tgt != null && D.h[j] >= tgt) { ex = tgt; break; }
  }
  if (ex == null) { j = Math.min(i + g.hold, D.n - 1); ex = D.c[j]; }
  return { i, j, R: ((ex - entry) - cst) / dist, m: D.month[i + 1], t: D.t[i + 1] };
}
function passes(D, g, i, trendMA, mode) {
  if (!hourOk(D, g.hours, i)) return false;
  if (trendMA) { const m = trendMA[i]; if (!(m === m) || !(D.c[i] > m)) return false; }
  if (mode === 'brk') { const H = hiOf(D, g.trig[0].N, i); if (!(D.c[i] > H)) return false; }
  return true;
}
const trendOf = (D, g) => g.trend === 'none' ? null : sma(D.c, g.trendN || 200);
// the rule's trades one at a time in [lo, hi)
export function trades(D, g, lo, hi, cost, mode = 'brk') {
  const out = [], trendMA = trendOf(D, g); let free = lo;
  for (let i = Math.max(lo - 1, 210); i < hi - 1; i++) {
    if (i + 1 < free) continue;
    if (!passes(D, g, i, trendMA, mode)) continue;
    const w = walk(D, g, i, cost); if (!w) continue; out.push(w); free = w.j + 1;
  }
  return out;
}
// every qualifying bar on its own (no one-at-a-time rule), for the random draws
function candidates(D, g, lo, hi, cost) {
  const out = [], trendMA = trendOf(D, g);
  for (let i = Math.max(lo - 1, 210); i < hi - 1; i++) { if (!passes(D, g, i, trendMA, 'any')) continue; const w = walk(D, g, i, cost); if (w) out.push(w); }
  return out;
}
export const agg = (tr) => { const o = { n: tr.length, sum: 0, months: new Map(), wins: 0 }; for (const x of tr) { o.sum += x.R; if (x.R > 0) o.wins++; o.months.set(x.m, (o.months.get(x.m) || 0) + x.R); } return o; };
export const sum = (tr) => summary(agg(tr));
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const vari = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1) : 0; };
export const welch = (a, b) => { const se = Math.sqrt(vari(a) / a.length + vari(b) / b.length); return se > 0 ? (mean(a) - mean(b)) / se : 0; };
const yearOf = (t) => new Date(t * 1000).getUTCFullYear();


// the engine's own fetch skips a window that fails four times and goes on (that left 2019 on only); this one retries hard and stops loudly
// the engine's loadMarket prefers a local 5-minute cache that holds NAS100 only from 2019 here; read the fetched H1 file directly (what a runner without that cache gets)
const loadMarket = async (mk, dir) => prep(toArrays(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, `${mk}-1h.json.gz`))))), mk);
async function ensureCache(mk) {
  const f = path.join(cacheDir, `${mk}-1h.json.gz`); fs.mkdirSync(cacheDir, { recursive: true });
  if (fs.existsSync(f) && fs.statSync(f).size > 0) { const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); if (rows.length && rows[0].t < Date.UTC(2011, 0, 1) / 1000 || mk === 'us2000' && rows.length > 20000) return; }
  const BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', now = Math.floor(Date.now() / 1000), span = 4900 * 3600, map = new Map();
  for (let a = Date.UTC(2005, 0, 1) / 1000; a < now; a += span) {
    let ok = false, lastErr = '';
    for (let k = 0; k < 10 && !ok; k++) {
      try { const r = await fetch(`${BASE}bars?sym=${mk}&tf=1h&from=${a}&to=${Math.min(a + span, now)}`); if (r.ok) { for (const x of (await r.json()).bars || []) if (x.time + 3600 <= now) map.set(x.time, { t: x.time, o: x.open, h: x.high, l: x.low, c: x.close }); ok = true; } else lastErr = 'HTTP ' + r.status; } catch (e) { lastErr = String(e.message || e); }
      if (!ok) await new Promise((q) => setTimeout(q, 2000 * (k + 1)));
    }
    if (!ok) throw new Error(`${mk}: window from ${new Date(a * 1000).toISOString()} failed 10 times (${lastErr})`);
    await new Promise((q) => setTimeout(q, 500));
  }
  const rows = [...map.values()].sort((p, q) => p.t - q.t); fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(rows))); console.log(mk, rows.length, 'H1 bars from', new Date(rows[0].t * 1000).toISOString());
}

async function main() {
  await ensureCache('nas100');
  const out = { rule: RULE, ran: new Date().toISOString(), checks: {} }, D = await loadMarket('nas100', cacheDir);
  out.bars = D.n; out.first = new Date(D.t[0] * 1000).toISOString(); out.last = new Date(D.t[D.n - 1] * 1000).toISOString();
  const W = { A: D.idx.A, B: D.idx.B, C: D.idx.C };

  // ---- gate: the engine at no cost, and the two implementations equal at 0 and 4e-5 ----
  const eng = {}; D.costRel = 0; D.cost = 0;
  for (const w of ['A', 'B', 'C']) eng[w] = summary(simulate(D, RULE, ...W[w]));
  out.engine = eng;
  const parity = [];
  for (const c of [0, 4e-5]) { D.costRel = c; D.cost = 0; for (const w of ['A', 'B', 'C']) { const e = simulate(D, RULE, ...W[w]), m = agg(trades(D, RULE, ...W[w], c)); parity.push({ c, w, n: [e.n, m.n], sum: [+e.sum.toFixed(6), +m.sum.toFixed(6)], ok: e.n === m.n && Math.abs(e.sum - m.sum) < 1e-6 }); } }
  out.parity = parity;
  const gateA = eng.A.n === 1018 && Math.abs(eng.A.mean - 0.1975) < 0.001, gateB = eng.B.n === 473 && Math.abs(eng.B.mean - 0.3695) < 0.001, gateC = Math.abs(eng.C.n - 645) / 645 <= 0.05 && eng.C.mean > 0;
  out.gate = { A: gateA, B: gateB, C: gateC, parity: parity.every((p) => p.ok), pass: gateA && gateB && gateC && parity.every((p) => p.ok) };
  if (!out.gate.pass) { out.verdict = 'INVALID: the gate failed'; fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out.gate), JSON.stringify(eng)); return; }

  // ---- T1 costs ----
  const T1 = { costs: {} };
  for (const [name, c] of [['2.7e-5', COST_LO], ['6e-5', COST], ['1.2e-4', COST_HI]]) { T1.costs[name] = {}; for (const w of ['A', 'B', 'C']) T1.costs[name][w] = sum(trades(D, RULE, ...W[w], c)); }
  const t1c = T1.costs['6e-5']; T1.pass = t1c.A.mean > 0 && t1c.B.mean > 0 && t1c.C.mean > 0 && t1c.C.t >= 2; out.checks.T1 = T1;

  // ---- T2 against the drift ----
  const ruleC = trades(D, RULE, ...W.C, COST), onlyC = trades(D, RULE, ...W.C, COST, 'any'), cands = candidates(D, RULE, ...W.C, COST), r = rng(20261125), draws = [];
  for (let d = 0; d < 2000; d++) {
    const occ = new Uint8Array(D.n + 2), idx = cands.map((_, k) => k); for (let k = idx.length - 1; k > 0; k--) { const q = Math.floor(r() * (k + 1)); [idx[k], idx[q]] = [idx[q], idx[k]]; }
    let s = 0, n = 0; for (const k of idx) { if (n >= ruleC.length) break; const c = cands[k]; let free = true; for (let b = c.i + 1; b <= c.j; b++) if (occ[b]) { free = false; break; } if (!free) continue; for (let b = c.i + 1; b <= c.j; b++) occ[b] = 1; s += c.R; n++; }
    if (n === ruleC.length) draws.push(s / n);
  }
  draws.sort((a, b) => a - b); const p95 = draws[Math.floor(draws.length * 0.95)] ?? NaN, rm = mean(ruleC.map((x) => x.R)), pos = draws.filter((x) => x >= rm).length / (draws.length || 1);
  const T2 = { rule: sum(ruleC), filterOnly: sum(onlyC), candidates: cands.length, draws: draws.length, drawMean: +mean(draws).toFixed(4), draw95: +p95.toFixed(4), ruleMean: +rm.toFixed(4), pDrawsAtLeastRule: +pos.toFixed(4), welchRuleVsFilter: +welch(ruleC.map((x) => x.R), onlyC.map((x) => x.R)).toFixed(2) };
  T2.pass = rm > p95 && rm > mean(onlyC.map((x) => x.R)) && T2.welchRuleVsFilter >= 2; out.checks.T2 = T2;

  // ---- T3 neighbours ----
  const nb = []; const mk = (label, patch) => { const g = { ...RULE, trig: [{ ...RULE.trig[0] }], ...patch }; if (patch.N) g.trig = [{ kind: 'brk', N: patch.N }]; return { label, g }; };
  for (const N of [10, 15, 30, 50]) nb.push(mk(`N ${N}`, { N }));
  for (const stop of [0.75, 1.5]) nb.push(mk(`stop ${stop}`, { stop }));
  for (const rr of [2, 3, 6]) nb.push(mk(`target ${rr}R`, { rr }));
  for (const hold of [48, 240]) nb.push(mk(`hold ${hold}`, { hold }));
  for (const hours of [[13, 22], [15, 22], [14, 21]]) nb.push(mk(`hours ${hours.join('-')}`, { hours }));
  nb.push(mk('no trend filter', { trend: 'none' })); nb.push(mk('100-bar average', { trendN: 100 }));
  const T3 = { cells: [] }; for (const { label, g } of nb) { const row = { label }; for (const w of ['A', 'B', 'C']) row[w] = sum(trades(D, g, ...W[w], COST)); row.allPositive = row.A.mean > 0 && row.B.mean > 0 && row.C.mean > 0; T3.cells.push(row); }
  T3.share = +(T3.cells.filter((c) => c.allPositive).length / T3.cells.length).toFixed(3); T3.pass = T3.share >= 0.8; out.checks.T3 = T3;

  // ---- T4 other indices ----
  const T4 = { markets: {} }, pooled = new Map(); let pn = 0, ps = 0, positive = 0;
  for (const mk2 of ['spx500', 'us30', 'de40', 'jp225', 'us2000']) {
    try { await ensureCache(mk2); const E = await loadMarket(mk2, cacheDir); E.costRel = COST; E.cost = 0; const tr = trades(E, RULE, ...E.idx.C, COST), s = sum(tr);
      T4.markets[mk2] = { bars: E.n, first: new Date(E.t[0] * 1000).toISOString().slice(0, 10), C: s }; if (s.n && s.mean > 0) positive++;
      for (const x of tr) { pooled.set(x.m, (pooled.get(x.m) || 0) + x.R); } pn += tr.length; ps += tr.reduce((a, x) => a + x.R, 0);
    } catch (e) { T4.markets[mk2] = { error: String(e.message || e) }; }
  }
  T4.pooled = summary({ n: pn, sum: ps, months: pooled, wins: 0 }); T4.marketsPositive = positive; T4.pass = T4.pooled.mean > 0 && T4.pooled.t >= 2 && positive >= 3; out.checks.T4 = T4;

  // ---- T5 where the R comes from ----
  const all = ['A', 'B', 'C'].flatMap((w) => trades(D, RULE, ...W[w], COST)), by = {};
  for (const x of all) { const y = yearOf(x.t); (by[y] ||= []).push(x.R); }
  const years = Object.fromEntries(Object.entries(by).map(([y, v]) => [y, { n: v.length, mean: +mean(v).toFixed(3), sum: +v.reduce((a, b) => a + b, 0).toFixed(1) }]));
  const cYears = {}; for (const x of ruleC) { const y = yearOf(x.t); cYears[y] = (cYears[y] || 0) + x.R; }
  const cTotal = ruleC.reduce((a, x) => a + x.R, 0), bestYear = Object.entries(cYears).sort((a, b) => b[1] - a[1])[0], mo = [...agg(ruleC).months.values()].sort((a, b) => b - a);
  let cum = 0, peak = 0, dd = 0; for (const x of ruleC) { cum += x.R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  const T5 = { years, cTotal: +cTotal.toFixed(1), bestYear: bestYear && { year: bestYear[0], sum: +bestYear[1].toFixed(1), share: cTotal > 0 ? +(bestYear[1] / cTotal).toFixed(3) : null }, best3MonthsShare: cTotal > 0 ? +((mo[0] + mo[1] + mo[2]) / cTotal).toFixed(3) : null, maxDrawdownR: +dd.toFixed(1), y2022: years[2022] };
  T5.pass = cTotal > 0 && T5.bestYear.share <= 0.4; out.checks.T5 = T5;

  out.pass = { T1: T1.pass, T2: T2.pass, T3: T3.pass, T4: T4.pass, T5: T5.pass };
  out.verdict = Object.values(out.pass).every(Boolean) ? 'PASS: a candidate for a forward record, not an edge' : 'DOES NOT HOLD UP: ' + Object.entries(out.pass).filter(([, v]) => !v).map(([k]) => k).join(', ') + ' failed';
  fs.writeFileSync(path.join(here, 'result.json'), JSON.stringify(out, null, 1)); console.log(out.verdict, JSON.stringify(out.pass));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
