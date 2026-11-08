// LIT replay (8 Nov 2026, owner: "on the LIT edge fill trades from the last 2 months so I can study them"). The pre-registered LIT
// rule (research/edge/lit, council/lit.mjs: the same detector the paper shadow stream runs) over the last ~2 months of OANDA 5m gold
// candles read through the site's /md/bars proxy in windows, simulated exactly as the study did (fill on a touch past the limit,
// stop first, target, break-even after two swing breaks, closed at the day's end; one order at a time, <= 1 London + 1 NY fill a
// day, stop after a win or -1.5R; costs $0.30 spread + $0.15 slippage on market exits). Paper research only: these are not the
// stream's own records (those live in trades.json, k 'lit'); they say what the rule would have done, so the owner can study them.
//   node council/lit-replay.mjs <dataDir> [--days 63] [--force]     -> <dataDir>/lit/replay.json (skipped while the file is < 20 h old)
import fs from 'node:fs';
import path from 'node:path';
import { cleanBars, agg15, series, fbosCandidates, buildOrder, VARIANT, SESS_TRADE, XAU, funnel, buildCounts } from './lit.mjs';
import { simulateOrder, managePosition, selectTrades, stats, MARKETS, VARIANTS } from '../research/edge/lit/run.mjs';
import { P } from './lit.mjs';

// ─── study sets (8 Nov, owner: "I need trades, find a way"): the same M15 manipulation, then looser execution, each labelled.
// They are for studying the idea on recent candles; none is the pre-registered rule and none trades. ───
export const STUDY_SETS = [
  { id: 'loose-limit', label: 'Loose limit', desc: 'M5 break may come after MX is re-tested (MX re-anchors), no speed / overlap / flip filters, R:R over 1.5, no stop cap, limit at the order block open, fills on a touch, lives 48 M5 bars.',
    mxReanchor: true, quality: false, minRR: 1.5, cap: false, entry: 'limit', touch: true, expiryBars: 48 },
  { id: 'market-break', label: 'Market on the break', desc: 'Same manipulation; entry at market on the close of the bar after the M5 break, stop beyond MX, target the accumulation extreme, R:R over 1.5, no stop cap, no quality filters: every setup with a break becomes a trade.',
    mxReanchor: true, quality: false, minRR: 1.5, cap: false, entry: 'market' },
];
const lowerBound = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo; };
// a study-mode order from an M15 candidate on the (sign-normalised, short-side) M5 series; mirrors council/lit.mjs buildOrder with switches
export function buildStudy(S5, cd, M, set, fun) {
  const { h, l, c, o, t, vec, pivL, atr, body, n } = S5;
  const j0 = lowerBound(t, cd.confEnd), sIdx = lowerBound(t, cd.t), rEnd = lowerBound(t, cd.rEnd);
  if (j0 >= n || sIdx >= rEnd) return null;
  let mxIdx = sIdx; for (let k = sIdx; k < rEnd; k++) if (h[k] > h[mxIdx]) mxIdx = k;
  let MX = h[mxIdx];
  const swingBefore = (upto) => { for (let k = upto - 1; k >= Math.max(0, upto - 288); k--) if (pivL[k] && k + P.pivot < j0) return k; return -1; };
  let p = swingBefore(mxIdx); if (p < 0) { fun.noSwing++; return null; }
  let level = l[p], b = -1;
  for (let k = mxIdx + 1; k <= Math.min(n - 2, mxIdx + P.rbosWait); k++) {
    if (h[k] > MX) { if (!set.mxReanchor) { fun.mxBroken++; return null; } MX = h[k]; mxIdx = k; const p2 = swingBefore(k); if (p2 >= 0) level = l[p2]; continue; }
    if (l[k] <= level) { b = k; break; }
  }
  if (b < 0) { fun.noRbos++; return null; }
  if (set.quality) {
    if (!(vec[b] || b - mxIdx <= P.rbosFast)) { fun.rbosSlow++; return null; }
    let ov = 0, cnt = 0; for (let k = mxIdx + 1; k <= b; k++) { cnt++; const rng = h[k] - l[k], inter = Math.min(h[k], h[k - 1]) - Math.max(l[k], l[k - 1]); if (rng > 0 && inter / rng > P.overlapRatio) ov++; }
    if (cnt && ov / cnt > P.overlapShare) { fun.rbosOverlap++; return null; }
    if (c[b + 1] > level) { fun.rbosFlip++; return null; }
  }
  let d = b; for (let k = mxIdx; k <= b; k++) if (vec[k] && c[k] < o[k]) { d = k; break; }
  let ob = -1; for (let k = d - 1; k >= mxIdx; k--) if (c[k] > o[k]) { ob = k; break; }
  if (ob < 0) for (let k = Math.max(mxIdx, d - 3); k <= d - 1; k++) if (ob < 0 || body[k] < body[ob]) ob = k;
  if (ob < 0) { fun.noOb++; return null; }
  const jA = Math.max(j0, b + 2); if (jA >= n) return null;
  const entry = set.entry === 'market' ? c[Math.min(n - 1, b + 1)] : o[ob];
  const stop = MX + M.stopExtra(atr[jA - 1]), risk = stop - entry; if (!(risk > 0)) { fun.badGeom++; return null; }
  const target = cd.accLow, rr = (entry - target) / risk; if (!(rr > set.minRR)) { fun.lowRR++; return null; }
  const capOK = set.cap ? risk <= P.capFrac * Math.abs(entry) : true; if (!capOK) { fun.capped++; return null; }
  fun.orders++;
  return { jA, entry, stop, target, risk, rr, MX, capOK, level: cd.kind, sess: cd.sess, tSig: cd.t, tJA: t[jA], b, ob, market: set.entry === 'market' };
}
// fills as the study did, with a touch option and a longer life; a market order fills at once on its bar
export function simulateStudy(S5, M, ord, set) {
  const { h, l, o, ny, n } = S5, { entry, stop, target } = ord;
  if (ord.market) { const k = Math.min(n - 1, ord.b + 1); if (ny[k].hm === 930) return { filled: false, end: k, kind: 'open930' }; return managePosition(S5, M, ord, entry, k); }
  const life = set.expiryBars || P.expiryBars;
  for (let k = ord.jA; k < Math.min(n, ord.jA + life); k++) {
    if (ny[k].hm !== 930 && h[k] >= entry + (set.touch ? 0 : S5.tick)) {
      const fp = Math.max(entry, o[k]);
      if (h[k] >= stop) return managePosition(S5, M, { ...ord, stop }, fp, k);   // managePosition closes it at the stop on the next bar check; the fill bar itself is kept simple
      if (l[k] <= target) return { filled: false, end: k, kind: 'ambiguous' };
      return managePosition(S5, M, ord, fp, k);
    }
    if (h[k] > ord.MX) return { filled: false, end: k, kind: 'mxBreak' };
    if (l[k] <= target) return { filled: false, end: k, kind: 'targetFirst' };
  }
  return { filled: false, end: Math.min(n - 1, ord.jA + life - 1), kind: 'expired' };
}

const MD_BASE = process.env.MD_BASE || 'https://meridianx.dev/md/';
const DAYS = 90, WINDOW = 15 * 86400, FRESH = 20 * 3600, VERSION = 2;   // VERSION: a new shape or set re-runs the replay at once

export async function fetchBars(days = DAYS, fetchFn = fetch, now = Math.floor(Date.now() / 1000)) {
  // the week before the window warms the levels (previous week, accumulation) so the first days are judged like the rest
  const from0 = now - (days + 9) * 86400, seen = new Map();
  for (let from = from0; from < now; from += WINDOW) {
    const to = Math.min(now, from + WINDOW);
    const r = await fetchFn(`${MD_BASE}bars?sym=xau&tf=5m&from=${from}&to=${to}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`bars ${from}-${to}: ${r.status}`);
    const j = await r.json(), rows = Array.isArray(j) ? j : j.bars || [];
    for (const b of rows) if (!b.live && b.time + 300 <= now) seen.set(b.time, b);
  }
  return cleanBars([...seen.values()].sort((a, b) => a.time - b.time));
}

// the study's pipeline on one block of candles: candidates on M15, orders on M5, simulated, the trader's gates applied
export function replay(bars, { days = DAYS, now = Math.floor(Date.now() / 1000), M = MARKETS.xau } = {}) {
  const m15 = agg15(bars), since = now - days * 86400;
  const S5 = { short: series(bars, false, M.tick), long: series(bars, true, M.tick) }, S15 = { short: series(m15, false, M.tick), long: series(m15, true, M.tick) };
  const fun = funnel(), bc = buildCounts(), all = [], setups = [], byVariant = {};
  // the short series is the plain one, the long series is mirrored (negated), so prices come back with these signs
  const sgn = (dir) => (dir === 'short' ? 1 : -1), px = (dir, v) => +(sgn(dir) * v).toFixed(2);
  const WHY = { noSwing: 'no M5 swing before MX', mxBroken: 'MX broken before the break', noRbos: 'no M5 real break', rbosSlow: 'break too slow', rbosOverlap: 'break overlaps', rbosFlip: 'break flipped back', noOb: 'no order block', badGeom: 'bad geometry', lowRR: 'R:R under 3', capped: 'stop over 0.08% of price' };
  const candsByDir = {};
  for (const dir of ['short', 'long']) {
    const cands = fbosCandidates(S15[dir], fun); candsByDir[dir] = cands;
    for (const cd of cands) { cd.confEnd = S15[dir].t[cd.conf] + 900; cd.rEnd = S15[dir].t[cd.r] + 900; cd.dir = dir;
      // the primary variant, with the reason a setup produced no order (a fresh counter per candidate tells which gate dropped it)
      const one = buildCounts(), od = buildOrder(S5[dir], cd, M, VARIANT, one);
      for (const k of Object.keys(one)) bc[k] += one[k];
      const why = od ? (od.capOK ? null : 'capped') : Object.keys(one).find((k) => k !== 'orders' && one[k]) || 'noSwing';
      const setup = { t: cd.t, date: new Date(cd.t * 1000).toISOString().slice(0, 16), dir, side: dir === 'short' ? 'sell' : 'buy', sess: cd.sess, level: cd.kind, levelPx: px(dir, cd.L), accLow: px(dir, dir === 'short' ? cd.accLow : cd.accHigh), accHigh: px(dir, dir === 'short' ? cd.accHigh : cd.accLow), accBars: cd.accN, why: why ? WHY[why] || why : null, order: null };
      if (od) { od.dir = dir; od.sim = simulateOrder(S5[dir], M, od); if (od.capOK) all.push(od);
        setup.order = { tJA: od.tJA, entry: px(dir, od.entry), stop: px(dir, od.stop), target: px(dir, od.target), rr: od.rr != null ? +(+od.rr).toFixed(2) : null, capOK: !!od.capOK, outcome: od.sim.filled ? `filled · ${od.sim.kind} ${od.sim.Rnet > 0 ? '+' : ''}${od.sim.Rnet}R` : od.sim.kind }; }
      setups.push(setup);
      // the study's other variants (close trigger, entry at the order block's 50%), for comparison only
      for (const V of VARIANTS) { if (V.id === VARIANT.id) continue; const o2 = buildOrder(S5[dir], cd, M, V, buildCounts()); if (o2 && o2.capOK) { o2.dir = dir; o2.sim = simulateOrder(S5[dir], M, o2); (byVariant[V.id] = byVariant[V.id] || []).push(o2); } }
    }
  }
  const ny = S5.short.ny, taken = selectTrades(all.map((od) => ({ ...od })), ny);
  // finish() in the harness multiplies the fill and exit by the series' sign; the detector's series may not carry one, so the
  // sign is applied here from the direction when it is missing
  const fix = (S, dir, v) => (S.sign != null ? v : sgn(dir) * v);
  const row = (od) => { const s = od.sim, S = S5[od.dir]; return { id: `xau-lit-${od.dir === 'short' ? 's' : 'b'}-${S.t[od.jA]}`, t: s.t, date: new Date(s.t * 1000).toISOString().slice(0, 16), tExit: s.tExit, dir: od.dir, side: od.dir === 'short' ? 'sell' : 'buy', sess: od.sess, level: od.level,
    entry: +fix(S, od.dir, s.fp).toFixed(2), exit: +fix(S, od.dir, s.exit).toFixed(2), stop: px(od.dir, od.stop), target: px(od.dir, od.target), rr: od.rr != null ? +(+od.rr).toFixed(2) : null, kind: s.kind, R: s.R, Rnet: s.Rnet, Rnet2: s.Rnet2, year: new Date(s.t * 1000).getUTCFullYear() }; };
  const trades = taken.filter((od) => od.sim.t >= since).map(row).sort((a, b) => a.t - b.t);
  const orders = all.filter((od) => S5[od.dir].t[od.jA] >= since);
  const unfilled = {}; for (const od of orders) if (!od.sim.filled) unfilled[od.sim.kind] = (unfilled[od.sim.kind] || 0) + 1;
  const notTaken = {}; for (const od of taken.length ? all : []) if (od.why) notTaken[od.why] = (notTaken[od.why] || 0) + 1;
  const st = stats(trades);
  const bySess = {}, byLevel = {}, byKind = {};
  for (const x of trades) { (bySess[x.sess] = bySess[x.sess] || []).push(x); (byLevel[x.level] = byLevel[x.level] || []).push(x); byKind[x.kind] = (byKind[x.kind] || 0) + 1; }
  const sub = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, { n: v.length, net: +v.reduce((a, x) => a + x.Rnet, 0).toFixed(2), win: +(v.filter((x) => x.R > 0).length / v.length).toFixed(2) }]));
  // the study sets: every candidate, looser execution; gated trades (one at a time, one per session, day stop) and every fill
  const study = {};
  for (const set of STUDY_SETS) {
    const cnt = buildCounts(), ods = [];
    for (const dir of ['short', 'long']) for (const cd of candsByDir[dir]) { const od = buildStudy(S5[dir], cd, M, set, cnt); if (od) { od.dir = dir; od.sim = simulateStudy(S5[dir], M, od, set); ods.push(od); } }
    const fills = ods.filter((od) => od.sim.filled && od.sim.t >= since).map(row).sort((a, b) => a.t - b.t);
    const gated = selectTrades(ods.map((od) => ({ ...od })), ny).filter((od) => od.sim.t >= since).map(row).sort((a, b) => a.t - b.t);
    const unf = {}; for (const od of ods) if (!od.sim.filled) unf[od.sim.kind] = (unf[od.sim.kind] || 0) + 1;
    study[set.id] = { label: set.label, desc: set.desc, build: cnt, orders: ods.filter((od) => S5[od.dir].t[od.jA] >= since).length, unfilled: unf, fills: { n: fills.length, stats: stats(fills), trades: fills }, gated: { n: gated.length, stats: stats(gated), trades: gated } };
  }
  const variants = {}; for (const [id, ods] of Object.entries(byVariant)) { const tk = selectTrades(ods.map((od) => ({ ...od })), ny).filter((od) => od.sim.t >= since).map(row); variants[id] = { orders: ods.filter((od) => S5[od.dir].t[od.jA] >= since).length, taken: tk.length, stats: stats(tk), trades: tk }; }
  return { version: VERSION, at: new Date(now * 1000).toISOString(), from: new Date(since * 1000).toISOString().slice(0, 10), to: new Date(now * 1000).toISOString().slice(0, 10), days,
    bars: bars.length, m15: m15.length, funnel: fun, build: bc, orders: orders.length, filled: orders.filter((od) => od.sim.filled).length, unfilled, notTaken,
    stats: st, bySession: sub(bySess), byLevel: sub(byLevel), byExit: byKind, trades, setups: setups.filter((x) => x.t >= since).sort((a, b) => a.t - b.t), variants, study,
    note: 'What the pre-registered LIT rule would have done on OANDA 5m gold over this window, simulated as the study did (costs $0.30 spread + $0.15 slippage on market exits in Rnet; Rnet2 doubles them). Paper research, not the live shadow stream\'s records. The study\'s verdict (inconclusive, 2008-2026) stands.' };
}

if (process.argv[1] && process.argv[1].endsWith('lit-replay.mjs')) {
  const argv = process.argv.slice(2), flags = {}; for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; }
  const DIR = argv.find((a) => !a.startsWith('--') && !/^\d+$/.test(a)) || 'data', OUT = path.join(DIR, 'lit', 'replay.json'), days = +flags.days || DAYS;
  try {
    let prev = null; try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
    if (prev && !flags.force && prev.version === VERSION && Date.now() - Date.parse(prev.at) < FRESH * 1000) { console.log(`LIT replay: fresh (${prev.trades.length} trades, ${prev.at})`); process.exit(0); }
    const bars = await fetchBars(days);
    if (bars.length < 2000) throw new Error(`only ${bars.length} candles`);
    const out = replay(bars, { days });
    fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(`LIT replay: ${out.from} → ${out.to}, ${out.bars} candles, ${out.setups.length} setups, ${out.orders} orders, ${out.filled} filled, ${out.trades.length} taken, net ${out.stats.total ?? 0}R; variants ${Object.entries(out.variants).map(([k, v]) => `${k} ${v.taken}`).join(', ')}; study ${Object.entries(out.study).map(([k, v]) => `${k} fills ${v.fills.n} (${v.fills.stats.total ?? 0}R) gated ${v.gated.n} (${v.gated.stats.total ?? 0}R)`).join(', ')}`);
  } catch (e) { console.log(`LIT replay failed: ${e.message}`); }
}
