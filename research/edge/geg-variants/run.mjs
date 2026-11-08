// Edge research · geg-variants: the live Gold daily engulf (geg) entry and eleven one-change entry variants (preregistration.md)
// replayed on OANDA XAU/USD 2006-2026 with #530's harness (research/edge/gold-systems-oos/replay.mjs: one run 4 min after every M5
// close, 719-candle windows, the live block's base search, limit fills on an M5 touch) and the Trader's own "Manage open trades"
// loop as a pure function (council/fills.mjs manageLive: stop before target, time exit, trail 1R behind from +2R, gapped stops at
// the open; shut-market / rollover candles skipped). Costs = fills.mjs tradeCost's model: $0.30 spread + $0.15 slippage on every
// market order (market entry; stop / trail / time exit), x2 doubles; the calibration gate alone uses #530's flat $0.30.
//   CANDLES=<dir from research/edge/gold-systems-oos/fetch.mjs> [GATE_ONLY=1] [OUT=result.json] node run.mjs
// Paper research only: nothing here touches a live rule.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { manageLive, expireOrder, spotSkip } from '../../../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.CANDLES; if (!DIR) throw new Error('CANDLES=<candle dir> is required');
const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const M5 = load('5m'), D1 = load('1d'), NM = M5.length;
console.error('candles', { m5: NM, d1: D1.length, from: new Date(M5[0].time * 1000).toISOString().slice(0, 10), to: new Date(M5[NM - 1].time * 1000).toISOString().slice(0, 10) });
const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;

// ─── the variants: one change each to the live rule (k 3, life 20, hold 240, sma 20, pad 0.3, maxOpen 3) ───
const LIVE = { sma: 20, filt: 'above', zone: 'near', entry: 'top', life: 20, depth: 0, side: 'buy' };
const VARIANTS = [
  { id: 'live', name: 'Live rule (baseline)', ...LIVE },
  { id: 'ma10', name: '10-day average', ...LIVE, sma: 10 },
  { id: 'ma50', name: '50-day average', ...LIVE, sma: 50 },
  { id: 'ma20rise', name: '20-day average rising', ...LIVE, filt: 'rise' },
  { id: 'zoneLow', name: 'Zone = lowest-close red candle', ...LIVE, zone: 'low' },
  { id: 'mkt', name: 'Entry at the daily close (market)', ...LIVE, entry: 'mkt' },
  { id: 'half', name: 'Entry at 50% of the zone', ...LIVE, entry: 'half' },
  { id: 'life1', name: 'Order life 1 day', ...LIVE, life: 1 },
  { id: 'life3', name: 'Order life 3 days', ...LIVE, life: 3 },
  { id: 'life5', name: 'Order life 5 days', ...LIVE, life: 5 },
  { id: 'depth1', name: 'Pullback depth >= 1 ATR', ...LIVE, depth: 1 },
  { id: 'sell', name: 'Mirror: sells (separate hypothesis)', ...LIVE, side: 'sell' },
];
const K = 3, HOLD = 240, PAD = 0.3, MAX_OPEN = 3, dp = 2, fx = (v) => +v.toFixed(dp);

// closed-candle count at time c (#530): a daily candle is closed once its UTC bucket has ended
function counter(A, sec) { let p = 0; return (c) => { while (p < A.length && A[p].time + sec <= c) p++; return p; }; }
const nd1 = counter(D1, 86400);
const tr14 = (i) => Math.max(D1[i].high - D1[i].low, Math.abs(D1[i].high - D1[i - 1].close), Math.abs(D1[i].low - D1[i - 1].close));
const atr14 = (i) => { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); return a / 14; };
const smaAt = (end, n) => { let s = 0; for (let q = end - n; q < end; q++) s += D1[q].close; return s / n; };   // the n closed candles ending at D1[end - 1]

// the signal a variant reads off the daily candles once nd candles are closed: { ok, base, bi, sma }
function signal(V, nd) {
  const last = D1[nd - 1], sell = V.side === 'sell';
  const sma = smaAt(nd, V.sma);
  const ok = V.filt === 'rise' ? sma > smaAt(nd - 1, V.sma) : sell ? last.close < sma : last.close > sma;
  const red = (b) => b.open > b.close, green = (b) => b.close > b.open, isBase = sell ? green : red;
  const through = (b) => sell ? last.close < b.low : last.close > b.high;
  let base = null, bi = -1;
  if (sell ? red(last) : green(last)) {
    if (V.zone === 'near') { for (let q = nd - 2; q >= nd - 1 - K && q >= 0; q--) { const b = D1[q]; if (isBase(b)) { if (through(b)) { base = b; bi = q; } break; } } }
    else { for (let q = nd - 2; q >= nd - 1 - K && q >= 0; q--) { const b = D1[q]; if (isBase(b) && (!base || (sell ? b.close > base.close : b.close < base.close))) { base = b; bi = q; } } if (base && !through(base)) { base = null; bi = -1; } }
  }
  let depthOk = true;
  if (base && V.depth) { let hh = -Infinity, ll = Infinity; for (let q = Math.max(0, bi - 9); q <= bi; q++) { hh = Math.max(hh, D1[q].high); ll = Math.min(ll, D1[q].low); } depthOk = (sell ? base.high - ll : hh - base.low) >= V.depth * atr14(nd - 1); }
  return { ok: ok && depthOk, base, bi, sma, last };
}

const isLive = (x) => x.status === 'open' || x.status === 'pending';
const START = Date.parse('2006-03-20T00:00:00Z') / 1000, FIRST_ENTRY = Date.parse('2006-07-01T00:00:00Z') / 1000;
for (const V of VARIANTS) { V.book = []; V.trades = []; V.ids = new Set(); V.sigNd = -1; V.sig = null; }

for (let j = 0; j < NM - 1; j++) {
  const c = M5[j].time + 300, now = c + 240;
  for (const V of VARIANTS) {
    // 1. manage this variant's book through the candles closed by c (each trade from its own pointer), then expire resting orders
    for (const tr of V.book) { for (let i = tr.ptr; i <= j && isLive(tr); i++) { if (!SKIP[i]) manageLive(tr, M5[i]); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
    for (const tr of V.book) expireOrder(tr, now);
    V.book = V.book.filter(isLive);
  }
  if (M5[j].time < START) continue;
  const nd = nd1(c);
  if (nd < 60) continue;
  const hasEntry = M5[j + 1].time === c, price = hasEntry ? M5[j + 1].close : M5[j].close, k0 = j + 2;
  const canEnter = hasEntry && now >= FIRST_ENTRY;
  const last = D1[nd - 1];
  for (const V of VARIANTS) {
    const sell = V.side === 'sell', mine = V.book;
    // cancel waiting orders whose zone was body-closed through on a newly closed day (live)
    for (const tr of mine) if (tr.status === 'pending' && tr.zone && last.time > (tr.lastD || 0) && (sell ? last.close > tr.zone[1] : last.close < tr.zone[0])) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }
    for (const tr of mine) if (tr.status === 'pending') tr.lastD = last.time;
    if (!(now - (last.time + 86400) < 86400)) continue;
    if (V.sigNd !== nd) { V.sigNd = nd; V.sig = signal(V, nd); }
    const S = V.sig; if (!S.base || !S.ok) continue;
    const base = S.base, id = `xau-${V.id}-${base.time}`;
    const openCnt = mine.filter(isLive).length;
    if (V.ids.has(id) || openCnt >= MAX_OPEN || !canEnter) continue;
    const mkt = V.entry === 'mkt';
    const entry = mkt ? fx(price) : V.entry === 'half' ? fx((base.high + base.low) / 2) : fx(sell ? base.low : base.high);
    const stop = fx(sell ? base.high + PAD : base.low - PAD), r0 = Math.abs(entry - stop);
    if (!(r0 > 0)) continue;
    if (!mkt && !(sell ? price < entry : price > entry)) continue;
    const tr = { id, k: V.id, side: V.side, dec: 1, entry, stop, t1: fx(entry + (sell ? -1 : 1) * 10 * r0), rr: 10, trail: [2, 1], opened: now, status: mkt ? 'open' : 'pending', R: null, r0,
      maxHold: HOLD * 3600, noBe: true, entryMode: mkt ? 'market' : 'limit', zone: [fx(base.low), fx(base.high)], lastD: last.time, feat: { sma: fx(S.sma), conf: last.close, baseDay: new Date(base.time * 1000).toISOString().slice(0, 10) }, ptr: k0 };
    if (mkt) tr.filled = now; else tr.validFor = V.life * 86400;
    V.book.push(tr); V.trades.push(tr); V.ids.add(id);
  }
}
// still open at the end of the data: marked at the last M5 close (2018-26 only); waiting orders expire
const lastBar = M5[NM - 1];
for (const V of VARIANTS) for (const tr of V.book) { if (tr.status === 'pending') { tr.status = 'expired'; tr.R = 0; } else { tr.R = +(((tr.side === 'sell' ? tr.entry - lastBar.close : lastBar.close - tr.entry)) / tr.r0).toFixed(2); tr.exit = 'end (marked)'; tr.exitKind = 'end'; tr.status = tr.R > 0 ? 'win' : 'loss'; } tr.closed = lastBar.time; tr.atEnd = true; }

// ─── positions and costs ───
// fills.mjs tradeCost: spread 0.30 a round trip + 0.15 slippage on every market order (a market entry; any exit but the target)
const SPREAD = 0.30, SLIP = 0.15;
const costOf = (tr, m) => m * (SPREAD + (tr.entryMode === 'market' ? SLIP : 0) + (tr.exitKind !== 'target' ? SLIP : 0)) / tr.r0;
function positions(V, flat = false) {
  return V.trades.filter((x) => x.status !== 'expired' && x.status !== 'missed').map((x) => ({
    id: x.id, t: x.filled ?? x.opened, c: x.closed, r0: x.r0, exit: x.exitKind || x.exit, g: x.R,
    n: x.R - (flat ? 0.30 / x.r0 : costOf(x, 1)), n2: x.R - (flat ? 0.60 / x.r0 : costOf(x, 2)) })).sort((a, b) => a.t - b.t);
}
const D = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const P = { oos: [D('2006-07-01'), D('2018-01-01')], h1: [D('2006-07-01'), D('2012-01-01')], h2: [D('2012-01-01'), D('2018-01-01')], cal: [D('2018-01-01'), D('2026-11-07')] };
const inP = (rows, [a, b]) => rows.filter((x) => x.t >= a && x.t < b);
const yearOf = (t) => new Date(t * 1000).getUTCFullYear(), monthOf = (t) => new Date(t * 1000).toISOString().slice(0, 7);
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
function stats(rows, key = 'n') {
  const a = rows.slice().sort((x, y) => x.c - y.c), v = a.map((x) => x[key]), n = v.length;
  if (!n) return { n: 0, win: null, mean: null, R: 0, t: null, maxDD: 0, ratio: null };
  const R = v.reduce((p, x) => p + x, 0), mean = R / n, sd = Math.sqrt(v.reduce((p, x) => p + (x - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, peak = 0, dd = 0; for (const x of v) { eq += x; peak = Math.max(peak, eq); dd = Math.min(dd, eq - peak); }
  return { n, win: r3(v.filter((x) => x > 0).length / n), mean: r3(mean), R: r2(R), t: n > 1 && sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, maxDD: r2(dd), ratio: dd < 0 ? r2(R / -dd) : null };
}
// month-by-month net R (by close month, clipped to the window) over every calendar month of a window
function monthly(rows, [a, b], key = 'n') {
  const months = []; for (let t = a; t < b;) { const s = monthOf(t); months.push(s); const d = new Date(t * 1000); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000; }
  const m = new Map(months.map((x) => [x, 0]));
  for (const p of inP(rows, [a, b])) { const mo = monthOf(Math.min(p.c, b - 1)); if (m.has(mo)) m.set(mo, m.get(mo) + p[key]); }
  return months.map((x) => m.get(x));
}
// paired difference variant - baseline: sum, t over months, 10,000-resample month bootstrap of the sum (deterministic LCG)
function paired(a, b) {
  const d = a.map((x, i) => x - b[i]), n = d.length, sum = d.reduce((p, x) => p + x, 0), mean = sum / n, sd = Math.sqrt(d.reduce((p, x) => p + (x - mean) ** 2, 0) / (n - 1));
  let s = 987654321; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const B = 10000, sums = []; for (let k = 0; k < B; k++) { let z = 0; for (let i = 0; i < n; i++) z += d[Math.floor(rnd() * n)]; sums.push(z); } sums.sort((x, y) => x - y);
  return { diffR: r2(sum), t: sd > 0 ? r2(mean / sd * Math.sqrt(n)) : null, lo: r2(sums[Math.floor(0.025 * B)]), hi: r2(sums[Math.floor(0.975 * B)]), pLE0: r3(sums.filter((x) => x <= 0).length / B), months: n };
}

// ─── calibration gate: the baseline under #530's flat $0.30 must reproduce gold-systems-oos result.json geg ───
const REF = JSON.parse(fs.readFileSync(path.join(HERE, '../gold-systems-oos/result.json'), 'utf8')).systems.geg;
const base = VARIANTS[0], baseFlat = positions(base, true);
const gate = { pass: true, windows: {} };
for (const w of ['oos', 'h1', 'h2', 'cal']) {
  const rows = inP(baseFlat, P[w]);
  gate.windows[w] = {};
  for (const [key, ck] of [['n', 'x1'], ['n2', 'x2'], ['g', 'gross']]) {
    const s = stats(rows, key), r = REF.periods[w][ck];
    const same = s.n === r.n && s.mean === r.mean && s.R === r.R && s.t === r.t && s.maxDD === r.maxDD;
    gate.windows[w][ck] = { here: { n: s.n, mean: s.mean, R: s.R, t: s.t, maxDD: s.maxDD }, ref: { n: r.n, mean: r.mean, R: r.R, t: r.t, maxDD: r.maxDD }, same };
    if (!same) gate.pass = false;
  }
}
console.error('calibration gate', gate.pass ? 'PASS' : 'FAIL', JSON.stringify(Object.fromEntries(Object.entries(gate.windows).map(([w, v]) => [w, v.x1]))));
if (process.env.GATE_ONLY) process.exit(gate.pass ? 0 : 1);
if (!gate.pass) { console.error('the baseline does not reproduce #530; the study stops (preregistration.md)'); fs.writeFileSync(process.env.OUT || path.join(HERE, 'result.json'), JSON.stringify({ topic: 'geg-variants', at: new Date().toISOString(), verdict: 'INCONCLUSIVE: calibration gate failed, no variant was read', gate }, null, 1)); process.exit(1); }

// ─── every variant against the baseline (fills.mjs costs) ───
const out = { topic: 'geg-variants', system: 'Meridian Gold daily engulf (geg), OANDA XAU/USD 2006-2026', at: new Date().toISOString(), verdict: '',
  note: 'net R a position; x1 = 0.30 spread + 0.15 slippage per market order (market entry; stop / trail / time exit), x2 doubles; 2006-17 = fills 2006-07-01..2017-12-31 (H1 to 2011-12, H2 from 2012-01); 2018-26 = fills 2018-01-01..2026-11-06; ratio = total R / |max DD|',
  gate, variants: {}, passing: [], withinNoise: [] };
const basePos = positions(base), baseStats = {}, baseMonthly = {};
for (const w of Object.keys(P)) { const rows = inP(basePos, P[w]); baseStats[w] = { x1: stats(rows), x2: stats(rows, 'n2'), gross: stats(rows, 'g') }; baseMonthly[w] = { x1: monthly(basePos, P[w]), x2: monthly(basePos, P[w], 'n2') }; }
for (const V of VARIANTS) {
  const pos = positions(V), S = { name: V.name, change: Object.fromEntries(Object.entries(V).filter(([k, v]) => k in LIVE && v !== LIVE[k])), windows: {}, years: {}, orders: { placed: V.trades.length, filled: pos.length, expired: V.trades.filter((x) => x.status === 'expired' && x.exit !== 'zone failed').length, zoneFailed: V.trades.filter((x) => x.exit === 'zone failed').length, missed: V.trades.filter((x) => x.status === 'missed').length } };
  for (const w of Object.keys(P)) { const rows = inP(pos, P[w]); S.windows[w] = { x1: stats(rows), x2: stats(rows, 'n2'), gross: stats(rows, 'g') };
    if (V !== base) S.windows[w].paired = { x1: paired(monthly(pos, P[w]), baseMonthly[w].x1), x2: paired(monthly(pos, P[w], 'n2'), baseMonthly[w].x2) }; }
  for (let y = 2006; y <= 2026; y++) { const r = pos.filter((x) => yearOf(x.t) === y); S.years[y] = { n: r.length, R: r2(r.reduce((p, x) => p + x.n, 0)) }; }
  S.medianStop = { oos: r2(inP(pos, P.oos).map((x) => x.r0).sort((a, b) => a - b)[Math.floor(inP(pos, P.oos).length / 2)] || 0), cal: r2(inP(pos, P.cal).map((x) => x.r0).sort((a, b) => a - b)[Math.floor(inP(pos, P.cal).length / 2)] || 0) };
  S.exits = Object.fromEntries(['stop', 'target', 'time', 'end'].map((e) => [e, inP(pos, P.oos).filter((x) => x.exit === e).length]));
  // ── pre-registered bar ──
  if (V.side === 'sell') {
    const o = S.windows.oos, tests = {};
    for (const ck of ['x1', 'x2']) { tests[`${ck} 2006-17 mean > 0`] = (o[ck].mean ?? 0) > 0; tests[`${ck} 2006-17 t >= 2`] = (o[ck].t ?? 0) >= 2; tests[`${ck} H1 mean > 0`] = (S.windows.h1[ck].mean ?? 0) > 0; tests[`${ck} H2 mean > 0`] = (S.windows.h2[ck].mean ?? 0) > 0; tests[`${ck} 2018-26 mean > 0`] = (S.windows.cal[ck].mean ?? 0) > 0; }
    const fails = !(tests['x1 2006-17 mean > 0'] && tests['x2 2006-17 mean > 0']);
    S.verdict = { tests, verdict: fails ? 'FAILS' : Object.values(tests).every(Boolean) ? 'PASSES' : 'NOT ROBUST', missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t) };
  } else if (V !== base) {
    const tests = {};
    for (const ck of ['x1', 'x2']) {
      const b = (w) => baseStats[w][ck], v = (w) => S.windows[w][ck];
      tests[`${ck} 1 2006-17 return/DD higher`] = (v('oos').ratio ?? -1) > (b('oos').ratio ?? -1);
      tests[`${ck} 2 2006-17 total R higher`] = v('oos').R > b('oos').R;
      tests[`${ck} 3 H1 total R higher`] = v('h1').R > b('h1').R;
      tests[`${ck} 4 H2 total R higher`] = v('h2').R > b('h2').R;
      tests[`${ck} 5 2018-26 return/DD and total R higher`] = (v('cal').ratio ?? -1) > (b('cal').ratio ?? -1) && v('cal').R > b('cal').R;
    }
    const untouched = Object.entries(tests).filter(([t]) => !/ 5 /.test(t)).every(([, v]) => v), confirmed = untouched && Object.values(tests).every(Boolean);
    const noise = confirmed && Math.abs(S.windows.oos.paired.x1.t ?? 0) < 1 && Math.abs(S.windows.cal.paired.x1.t ?? 0) < 1;
    S.verdict = { tests, untouchedWindow: untouched ? 'beats' : 'not better', verdict: confirmed ? (noise ? 'BEATS the live rule (within noise)' : 'BEATS the live rule') : untouched ? 'NOT BETTER (2006-17 pass not confirmed on 2018-26)' : 'NOT BETTER', missed: Object.entries(tests).filter(([, v]) => !v).map(([t]) => t) };
    if (confirmed) { out.passing.push(V.id); if (noise) out.withinNoise.push(V.id); }
  } else S.verdict = { verdict: 'baseline' };
  out.variants[V.id] = S;
}
const sellV = out.variants.sell.verdict.verdict;
out.verdict = (out.passing.length ? `${out.passing.length} of 10 entry variants beat${out.passing.length === 1 ? 's' : ''} the live rule on the pre-registered bar (${out.passing.join(', ')}${out.withinNoise.length ? `; within noise: ${out.withinNoise.join(', ')}` : ''})` : 'NOT BETTER: no entry variant beats the live rule on the pre-registered bar')
  + `; the mirror sell rule ${sellV}.`;
out.positions = Object.fromEntries(VARIANTS.map((V) => [V.id, positions(V).map((p) => ({ id: p.id, t: p.t, c: p.c, r0: r2(p.r0), exit: p.exit, g: r2(p.g), x1: r2(p.n), x2: r2(p.n2) }))]));
// tables indented, the position lists compact (one line each) to keep the file small
const { positions: POS, ...head } = out;
fs.writeFileSync(process.env.OUT || path.join(HERE, 'result.json'), JSON.stringify(head, null, 1).replace(/\n}$/, ',\n "positions": {\n' + Object.entries(POS).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n }\n}'));
console.error(out.verdict);
for (const [id, S] of Object.entries(out.variants)) { const o = S.windows.oos, c = S.windows.cal; console.error(id.padEnd(9), `2006-17 n${o.x1.n} ${o.x1.mean} R${o.x1.R} DD${o.x1.maxDD} ratio${o.x1.ratio} | H1 ${S.windows.h1.x1.R} H2 ${S.windows.h2.x1.R} | 2018-26 n${c.x1.n} ${c.x1.mean} R${c.x1.R} DD${c.x1.maxDD} ratio${c.x1.ratio} | x2 ${o.x2.R}/${c.x2.R} |`, S.verdict.verdict); }
