// research/edge/msnr-direction-wide/run.mjs - the MSNR direction call (council/eg-methods.mjs direction(), imported, never
// edited) as a predictor of direction on ten markets and three ladders (PREREGISTRATION.md, 23 Nov 2026). Research only:
// nothing live imports it, nothing is placed, no entry, stop or cost is simulated.
//   EDGE_DATA=<cache> node --use-env-proxy research/edge/msnr-direction-wide/run.mjs fetch <m>   OANDA H1 into the cache
//   EDGE_DATA=<cache> node research/edge/msnr-direction-wide/run.mjs market <m> <outDir>         one market (+ its cut test)
//   node research/edge/msnr-direction-wide/run.mjs report <outDir>                               result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { exclusions } from '../combo-grid-2/run.mjs';
import { dayKey, weekKey, neweyWestT, normP, holm } from '../msnr-direction/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (Y, M = 0) => Date.UTC(Y, M, 1) / 1000;
export const MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const LADDERS = { LH: 'working H1, key levels on H4', L4: 'working H4, key levels on the Daily', LD: 'working Daily, key levels on the Weekly' };
export const HS = [1, 5, 20], MEAS = ['x', 's', 'g'], SD_N = 100;
export const WIN = { a: [y(2005), y(2015)], b: [y(2015), y(2026, 10)] };   // discovery, confirmation: [from, to)
export const NM = 262;                                                       // months 2005-01 .. 2026-10
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const MI = { a: [0, 120], b: [120, NM] };

// ---- frames and calls (closed candles only) ----------------------------------------------------------------------------
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));
export function framesOf(H1) { return { '1h': H1, '4h': K.resample(H1, 14400), '1d': K.dailyNY(H1) }; }
// { work (edgekit bars), call, events } of one ladder
export function ladder(F, L) {
  if (L === 'LH') { const w = F['1h']; const D = direction(conv(w), (t) => Math.floor(t / 14400) * 14400, 14400); return { work: w, ...D }; }
  if (L === 'L4') { const w = F['4h']; const D = direction(conv(w), dayKey, 86400); return { work: w, ...D }; }
  const w = F['1d'], wk = new Map(w.map((b) => [b.t, weekKey(b.e - 1)]));
  const D = direction(conv(w), (t) => wk.get(t), 604800); return { work: w, ...D };
}

// ---- measures ------------------------------------------------------------------------------------------------------
const inBad = (X, a, b) => { for (const [p, q] of X) if (p <= b && q >= a) return true; return false; };
// one market, one ladder: per window, per h, per measure { ms: Float64Array(NM) month sums, n, sum, obs (for NW) } + descriptive
export function measure(lad, bad = []) {
  const { work: W, call, events } = lad, n = W.length, lr = new Float64Array(n), sd = new Float64Array(n).fill(NaN);
  for (let i = 1; i < n; i++) lr[i] = Math.log(W[i].c / W[i - 1].c);
  let s1 = 0, s2 = 0;
  for (let i = 1; i < n; i++) { s1 += lr[i]; s2 += lr[i] * lr[i]; if (i > SD_N) { s1 -= lr[i - SD_N]; s2 -= lr[i - SD_N] ** 2; }
    if (i >= SD_N) { const m = s1 / SD_N, v = (s2 - SD_N * m * m) / (SD_N - 1); sd[i] = v > 0 ? Math.sqrt(v) : NaN; } }
  const sw = new Set(events.map((e) => e.i)), badSet = bad.length ? new Uint8Array(n) : null;
  const out = {};
  for (const w of Object.keys(WIN)) { out[w] = {}; const [A, B] = WIN[w];
    for (const h of HS) {
      const idx = [];
      for (let i = SD_N; i + h < n; i++) { if (W[i].e < A || W[i].e >= B || W[i + h].e >= B || !(sd[i] > 0)) continue;
        if (bad.length && inBad(bad, W[i].e, W[i + h].e)) continue; idx.push(i); }
      const r = idx.map((i) => Math.log(W[i + h].c / W[i].c)), m = r.reduce((s, x) => s + x, 0) / (r.length || 1);
      const pUp = r.filter((x) => x > 0).length / (r.length || 1), pDn = r.filter((x) => x < 0).length / (r.length || 1);
      const cell = { days: idx.length, m, pUp, pDn };
      for (const k of MEAS) cell[k] = { ms: new Float64Array(NM), n: 0, sum: 0, obs: [] };
      let nBuy = 0, nSell = 0, hits = 0, base = 0, pct = 0, rawSw = 0, nSw = 0;
      idx.forEach((i, j) => { const c = call[i]; if (!c) return; const mo = monthOf(W[i].e), sc = sd[i] * Math.sqrt(h), x = c * (r[j] - m) / sc;
        const add = (k, v) => { const z = cell[k]; z.ms[mo] += v; z.n++; z.sum += v; z.obs.push(v); };
        add('x', x); const g = c * r[j] > 0 ? 1 : 0, b = c > 0 ? pUp : pDn; add('g', g - b);
        if (sw.has(i)) { add('s', x); rawSw += c * r[j]; nSw++; }
        if (c > 0) nBuy++; else nSell++; hits += g; base += b; pct += c * (r[j] - m); });
      Object.assign(cell, { nBuy, nSell, hit: hits / (nBuy + nSell || 1), base: base / (nBuy + nSell || 1), pct: pct / (nBuy + nSell || 1),
        swRaw: nSw ? rawSw / nSw : null, nSw });
      out[w][h] = cell; } }
  void badSet;
  return out;
}

// month-sum t over the window's months (empty months count 0)
export function monthT(ms, w) { const [a, b] = MI[w], v = Array.from(ms.slice(a, b)), k = v.length, mu = v.reduce((s, x) => s + x, 0) / k;
  const s2 = v.reduce((s, x) => s + (x - mu) ** 2, 0) / (k - 1); return s2 > 0 ? mu / Math.sqrt(s2 / k) : null; }
export const lagOf = (h) => Math.max(5, 2 * (h - 1));

// ---- verdict -------------------------------------------------------------------------------------------------------
// tests: { key: { a: { mean, t }, b: { mean, t } } } -> pass flags, Holm p, verdict
export function judge(tests) {
  const adj = holm(Object.keys(tests).map((k) => [k, normP(tests[k].b.t)]));
  for (const k of Object.keys(tests)) { const T = tests[k]; T.pHolm = adj[k];
    T.raw = T.a.mean > 0 && T.a.t >= 2 && T.b.mean > 0 && T.b.t >= 2; T.pass = T.raw && T.pHolm < 0.05; }
  const v = Object.values(tests);
  if (v.some((T) => T.pass)) return 'PASS';
  if (v.some((T) => T.b.t != null && T.b.t >= 2 && T.a.mean > 0)) return 'INCONCLUSIVE';
  return 'FAIL';
}

// ---- cut test: calls of candles closed by a cut equal the full series' ---------------------------------------------
export function cutCheck(H1, cuts) {
  const F = framesOf(H1), full = {}; for (const L of Object.keys(LADDERS)) full[L] = ladder(F, L);
  let checked = 0, bad = 0;
  for (const T of cuts) { const Fc = framesOf(H1.filter((b) => b.t < T).map((b) => (b.e > T ? { ...b } : b)));
    for (const L of Object.keys(LADDERS)) { const c = ladder(Fc, L), fw = full[L];
      for (let i = 0; i < c.work.length; i++) { if (c.work[i].e > T) break; if (c.work[i].t !== fw.work[i].t) { bad++; continue; } checked++; if (c.call[i] !== fw.call[i]) bad++; } } }
  return { cuts: cuts.length, checked, mismatches: bad };
}

// ---- modes ---------------------------------------------------------------------------------------------------------
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const rd = (x, k = 4) => (x == null || !isFinite(x) ? null : +x.toFixed(k));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (MODE === 'fetch') {
  // OANDA H1 directly (2 requests a year instead of about 23 for 5-minute candles); same file format as fetch-cache.mjs
  const mk = process.argv[3], BASE = process.env.MD_BASE || 'https://aureumdesk.co.uk/md/', OUT = K.DATA_DIR, now = Math.floor(Date.now() / 1000);
  fs.mkdirSync(`${OUT}/${mk}`, { recursive: true });
  for (let Y = 2004; Y <= 2026; Y++) { const file = `${OUT}/${mk}/1h-${Y}.json.gz`; if (fs.existsSync(file) && Y < 2026) continue;
    const a = y(Y), b = Math.min(y(Y + 1), now), map = new Map();
    for (let f = a; f < b; f += 4000 * 3600) { const t = Math.min(f + 4000 * 3600, b); let bars = null;
      for (let k = 0; k < 12 && !bars; k++) { try { const r = await fetch(`${BASE}bars?sym=${mk}&tf=1h&from=${f}&to=${t}`); if (r.ok) bars = (await r.json()).bars || []; else console.error(mk, Y, 'HTTP', r.status); } catch (e) { console.error(mk, Y, e.message); } if (!bars) await sleep(2000 * (k + 1)); }
      if (!bars) throw new Error(`${mk} ${Y} failed`);
      for (const x of bars) if (x.time >= a && x.time < b) map.set(x.time, [x.time, x.open, x.high, x.low, x.close]); await sleep(300); }
    const rows = [...map.values()].sort((p, q) => p[0] - q[0]).filter((r) => r[0] + 3600 <= now);
    if (!rows.length) { console.log(mk, Y, 'empty'); continue; }
    fs.writeFileSync(file + '.tmp', zlib.gzipSync(JSON.stringify(rows))); fs.renameSync(file + '.tmp', file); console.log(mk, Y, rows.length); }
}

if (MODE === 'market') {
  const mk = process.argv[3], OUT = process.argv[4]; fs.mkdirSync(OUT, { recursive: true });
  const H1 = K.load(mk, '1h', { from: '2004-01-01' });
  // cut test first: ten moments, fixed seed per market
  const R = K.rng(17 + MARKETS.indexOf(mk)), lo = y(2006), hi = H1.at(-1).t, cuts = Array.from({ length: 10 }, () => Math.floor(lo + R() * (hi - lo)));
  const cut = cutCheck(H1, cuts); if (cut.mismatches) { console.error(mk, 'CUT TEST FAILED', cut); process.exit(2); }
  const F = framesOf(H1), bad = exclusions(mk), res = { market: mk, first: H1[0].t, last: H1.at(-1).t, h1: H1.length, cut, ladders: {} };
  for (const L of Object.keys(LADDERS)) { const lad = ladder(F, L), M = measure(lad, bad), o = { candles: lad.work.length, switches: {} , cells: {} };
    for (const w of Object.keys(WIN)) { const [A, B] = WIN[w], ix = lad.work.map((b, i) => i).filter((i) => lad.work[i].e >= A && lad.work[i].e < B);
      const c = lad.call, ev = lad.events.filter((e) => lad.work[e.i].e >= A && lad.work[e.i].e < B);
      o.switches[w] = { n: ev.length, years: (B - A) / (365.25 * 86400), buy: rd(ix.filter((i) => c[i] > 0).length / ix.length, 4), sell: rd(ix.filter((i) => c[i] < 0).length / ix.length, 4),
        byKind: ev.reduce((q, e) => { q[e.kind] = (q[e.kind] || 0) + 1; return q; }, {}) };
      for (const h of HS) { const z = M[w][h], key = `${w}-h${h}`;
        o.cells[key] = { days: z.days, nBuy: z.nBuy, nSell: z.nSell, hit: rd(z.hit), base: rd(z.base), pctExcess: rd(z.pct * 100, 5), swRawPct: rd(z.swRaw == null ? null : z.swRaw * 100, 5), nSw: z.nSw };
        for (const k of MEAS) { const q = z[k]; o.cells[key][k] = { n: q.n, mean: rd(q.n ? q.sum / q.n : null, 5), tMonth: rd(monthT(q.ms, w), 2), tNW: rd(neweyWestT(q.obs, lagOf(h)), 2), ms: Array.from(q.ms.slice(...MI[w]), (v) => rd(v, 6)) }; } } }
    res.ladders[L] = o; }
  fs.writeFileSync(path.join(OUT, `${mk}.json`), JSON.stringify(res));
  console.log(mk, 'ok', JSON.stringify(cut), Object.fromEntries(Object.entries(res.ladders).map(([L, o]) => [L, o.cells['b-h5'].x.tMonth])));
}

if (MODE === 'report') {
  const OUT = process.argv[3], per = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(OUT, `${m}.json`), 'utf8')));
  const pooled = {};
  for (const L of Object.keys(LADDERS)) { pooled[L] = {};
    for (const h of HS) for (const k of MEAS) for (const w of Object.keys(WIN)) {
      const key = `${w}-h${h}`, ms = new Float64Array(NM); let n = 0, sum = 0;
      for (const p of per) { const c = p.ladders[L].cells[key][k]; c.ms.forEach((v, j) => { ms[MI[w][0] + j] += v; }); n += c.n; sum += c.mean * c.n; }
      pooled[L][`${k}-${key}`] = { n, mean: rd(n ? sum / n : null, 5), t: rd(monthT(ms, w), 2) }; }
    for (const h of HS) for (const w of Object.keys(WIN)) { const key = `${w}-h${h}`; let nb = 0, hit = 0, base = 0, pct = 0, swr = 0, nsw = 0;
      for (const p of per) { const c = p.ladders[L].cells[key], m = c.nBuy + c.nSell; nb += m; hit += c.hit * m; base += c.base * m; pct += c.pctExcess * m; if (c.nSw) { swr += c.swRawPct * c.nSw; nsw += c.nSw; } }
      pooled[L][`hit-${key}`] = { n: nb, hit: rd(hit / nb), base: rd(base / nb), pctExcess: rd(pct / nb, 5), swRawPct: rd(nsw ? swr / nsw : null, 5), nSw: nsw }; } }
  const tests = {};
  for (const L of Object.keys(LADDERS)) for (const k of MEAS) { const A = pooled[L][`${k}-a-h5`], B = pooled[L][`${k}-b-h5`]; tests[`${L}-${k}`] = { a: { n: A.n, mean: A.mean, t: A.t }, b: { n: B.n, mean: B.mean, t: B.t } }; }
  const verdict = judge(tests), keys = Object.keys(tests), best = keys.slice().sort((p, q) => (tests[q].b.t ?? -9) - (tests[p].b.t ?? -9))[0], nPass = keys.filter((k) => tests[k].pass).length;
  const TB = tests[best], sg = (x, d = 2) => (x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`);
  const NAME = { x: 'call-weighted excess', s: 'switch event study', g: 'hit rate against base' };
  const headline = `${nPass} of 9 primary tests pass; the strongest in confirmation, ${best} (${NAME[best.split('-')[1]]}, h 5), ${sg(TB.b.mean, 3)} (n ${TB.b.n.toLocaleString('en-GB')}, month t ${sg(TB.b.t)}; discovery ${sg(TB.a.mean, 3)}, t ${sg(TB.a.t)}).`;
  const cut = per.reduce((q, p) => ({ cuts: q.cuts + p.cut.cuts, checked: q.checked + p.cut.checked, mismatches: q.mismatches + p.cut.mismatches }), { cuts: 0, checked: 0, mismatches: 0 });
  const result = { topic: 'msnr-direction-wide', built: '2026-11-23', verdict, headline,
    system: 'MSNR direction call (council/eg-methods.mjs direction, imported) as a direction predictor, three ladders, ten markets, OANDA mid H1 2004-2026: no trades',
    window: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, markets: MARKETS, ladders: LADDERS,
    tests, cut, pooled,
    perMarket: Object.fromEntries(per.map((p) => [p.market, { first: new Date(p.first * 1000).toISOString().slice(0, 10), last: new Date(p.last * 1000).toISOString().slice(0, 10),
      ladders: Object.fromEntries(Object.entries(p.ladders).map(([L, o]) => [L, { switches: o.switches, cells: Object.fromEntries(Object.entries(o.cells).map(([k, c]) => [k,
        { days: c.days, nBuy: c.nBuy, nSell: c.nSell, hit: c.hit, base: c.base, pctExcess: c.pctExcess, swRawPct: c.swRawPct, nSw: c.nSw,
          x: { n: c.x.n, mean: c.x.mean, tMonth: c.x.tMonth, tNW: c.x.tNW }, s: { n: c.s.n, mean: c.s.mean, tMonth: c.s.tMonth, tNW: c.s.tNW }, g: { n: c.g.n, mean: c.g.mean, tMonth: c.g.tMonth, tNW: c.g.tNW } }])) }])) }])) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(result));
  console.log(verdict, headline);
}

function f2(x, d = 2) { return x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`; }
function pc(x, d = 1) { return x == null ? 'n/a' : `${(x * 100).toFixed(d)}%`; }
function nn(x) { return x.toLocaleString('en-GB'); }
export function resultMd(R) {
  const T = R.tests, P = R.pooled, L = [];
  const NAME = { x: 'call-weighted excess (vol units)', s: 'switch event study (vol units)', g: 'hit rate minus base' };
  L.push('# MSNR direction call on ten markets (result)', '', `**Verdict: ${R.verdict}. ${R.headline}**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. A direction test: no entry, stop, exit or cost was simulated, so no figure here is an R or a',
    'trade. One run, no variants.', '',
    '## What was run', '',
    'The desk\'s own direction call (`council/eg-methods.mjs` `direction()`, imported unchanged: key levels one timeframe up, a',
    'switch only after a tapped level and a close beyond the external A / V level that stood before the tap) on three ladders:',
    '**LH** working H1 with H4 levels, **L4** working H4 with Daily levels, **LD** working Daily (17:00 New York) with Weekly',
    'levels. Ten markets: ' + R.markets.join(', ') + '. Discovery 2005-2014, confirmation 2015 to October 2026.', '',
    'At each close with a call, three measures over the next h working candles: the **call-weighted excess** (call x (forward',
    'log return − the window\'s mean forward return), divided by the market\'s own 100-candle volatility x √h), the same at',
    'each **switch** only, and the **hit rate** against its base (the share of up / down windows). Pooled over the ten markets',
    'by calendar-month sums; t over every month of the window.', '',
    '## The nine primary tests (h = 5, pooled)', '',
    '| Test | Measure | Discovery n | mean | month t | Confirmation n | mean | month t | Holm p | Pass |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, t] of Object.entries(T)) L.push(`| ${k} | ${NAME[k.split('-')[1]]} | ${nn(t.a.n)} | ${f2(t.a.mean, 4)} | ${f2(t.a.t)} | ${nn(t.b.n)} | ${f2(t.b.mean, 4)} | ${f2(t.b.t)} | ${t.pHolm.toFixed(3)} | ${t.pass ? 'yes' : 'no'} |`);
  L.push('', 'The bar: positive with month t >= 2 in BOTH windows and Holm p < 0.05 over the nine (one-sided, from the',
    `confirmation t). ${Object.values(T).filter((t) => t.pass).length} of 9 pass.`, '',
    '## Hit rate against base, every horizon (pooled)', '',
    '| Ladder | h | Discovery calls | hit | base | Confirmation calls | hit | base | Excess, % (confirmation) | Switches (conf.) | After a switch, % in the call\'s direction |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const lad of Object.keys(R.ladders)) for (const h of HS) { const a = P[lad][`hit-a-h${h}`], b = P[lad][`hit-b-h${h}`];
    L.push(`| ${lad} | ${h} | ${nn(a.n)} | ${pc(a.hit)} | ${pc(a.base)} | ${nn(b.n)} | ${pc(b.hit)} | ${pc(b.base)} | ${f2(b.pctExcess, 4)} | ${nn(b.nSw)} | ${f2(b.swRawPct, 4)} |`); }
  L.push('', '## Every measure and horizon, pooled (month t; descriptive except h = 5)', '',
    '| Ladder | Measure | h 1 disc. | h 1 conf. | h 5 disc. | h 5 conf. | h 20 disc. | h 20 conf. |', '|---|---|---|---|---|---|---|---|');
  for (const lad of Object.keys(R.ladders)) for (const k of MEAS) L.push(`| ${lad} | ${k} | ${HS.map((h) => `${f2(P[lad][`${k}-a-h${h}`].t)} | ${f2(P[lad][`${k}-b-h${h}`].t)}`).join(' | ')} |`);
  L.push('', '## Per market, h = 5 (confirmation 2015-26; discovery in brackets)', '',
    '| Market | Ladder | Calls | Buy / sell | Hit | Base | Excess, % | Excess t (month / NW) | Switches | Switch t | Hit t |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [m, p] of Object.entries(R.perMarket)) for (const lad of Object.keys(R.ladders)) { const b = p.ladders[lad].cells['b-h5'], a = p.ladders[lad].cells['a-h5'];
    L.push(`| ${m} | ${lad} | ${nn(b.nBuy + b.nSell)} | ${nn(b.nBuy)} / ${nn(b.nSell)} | ${pc(b.hit)} (${pc(a.hit)}) | ${pc(b.base)} (${pc(a.base)}) | ${f2(b.pctExcess, 4)} (${f2(a.pctExcess, 4)}) | ${f2(b.x.tMonth)} / ${f2(b.x.tNW)} (${f2(a.x.tMonth)}) | ${b.nSw} | ${f2(b.s.tMonth)} (${f2(a.s.tMonth)}) | ${f2(b.g.tMonth)} (${f2(a.g.tMonth)}) |`); }
  L.push('', '## Data and checks', '',
    '- OANDA mid candles through the site\'s candle proxy, cache files outside git. ' + Object.entries(R.perMarket).map(([m, p]) => `${m} ${p.first} to ${p.last}`).join('; ') + '.',
    '- **Declared deviation**: the H1 candles were fetched directly from OANDA (`run.mjs fetch`) instead of being resampled from',
    '  5-minute candles (the 5-minute fetch would have taken about two hours). H4 (UTC 4-hour buckets) and the 17:00 New York',
    '  Daily are built from them as pre-registered; both boundaries fall on whole hours, so the buckets are the same. Where a',
    '  5-minute file existed (gbpusd 2004, a thin year: 315 hours on file) the H1 candles resampled from it equalled the fetched',
    '  ones exactly.',
    `- **Cut test** (no look-ahead): ${R.cut.cuts} cuts, ${nn(R.cut.checked)} calls of closed candles compared, ${R.cut.mismatches} mismatches.`,
    '- Exclusions: the data-quality audit\'s bad intervals (`combo-grid-2` `exclusions`); an observation whose span touches one is dropped.',
    '- The Daily ladder has few switches per market (a few a year); its switch test is thin by nature and its call-weighted',
    '  test carries most of its weight.', '',
    '## What it means', '');
  if (R.verdict === 'PASS') L.push('At least one test passed the pre-registered bar: the call carries some direction on these markets. A paper result',
    'on mid candles, before costs; any use as a filter needs its own test on trades.');
  else if (R.verdict === 'INCONCLUSIVE') L.push('No test passed the bar, but at least one reached t >= 2 in confirmation with a positive discovery mean: a',
    'hint, not evidence. The call is not a valid filter on this test; a further look needs its own pre-registration on other data.');
  else L.push('The call, computed by fixed rules with no look-ahead, does not predict the next 5 candles\' direction on these ten',
    'markets beyond what the market does anyway, on any of the three ladders, in either decade. It extends',
    '`research/edge/msnr-direction` (gold alone, 0 of 6) to ten markets: as a mechanical direction filter it carries no',
    'measurable direction. It does not judge a person reading the same levels by eye. Never call it an edge or use it as a',
    'filter on the strength of the desks\' records; do not re-test variants on these years.', '',
    `Two readings worth naming, neither evidence: the nearest miss is L4-s, the H4 switch (discovery t ${f2(T['L4-s'].a.t)}, confirmation`,
    `t ${f2(T['L4-s'].b.t)}, Holm p ${T['L4-s'].pHolm.toFixed(2)}), a tilt of a few hundredths of a volatility unit over five H4 candles; and the call\'s`,
    `side is right slightly LESS often than the base rate on H1 (month t ${f2(T['LH-g'].a.t)} and ${f2(T['LH-g'].b.t)}) and on H4 in confirmation`,
    `(${f2(T['L4-g'].b.t)}), by about half a percentage point: if anything a small tilt against the call, never toward it.`);
  return L.join('\n') + '\n';
}
