// Edge research · gold-round-numbers: round numbers on spot gold. T1 stall (fade the first touch in the trading day of a
// $100 level approached from 0.5 x daily ATR away), T2 the same at the $50 levels (odd multiples of $50), T3 break (follow the
// first M5 close 0.05 x ATR beyond a $100 level). Rules, costs and the pass bar: PREREGISTRATION.md (committed and pushed
// before this file read any candle). Design and conventions are index-round-numbers' (touch, side, gap fill, stop-first,
// stop-only in the fill candle), with the New York 17:00 trading day and gold's costs. Paper research only.
//   node --use-env-proxy research/edge/gold-round-numbers/fetch.mjs <dir>   -> <dir>/xau-5m.json.gz (kept out of git)
//   node research/edge/gold-round-numbers/run.mjs full <dir>                 -> result.json and RESULT.md beside this file
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export const K = { G: 100, RT: 0.30, SLIP: 0.15, APPROACH: 0.5, T1_STOP: 0.25, T1_TGT: 0.5, T3_BEYOND: 0.05, T3_STOP: 0.1, T3_TGT: 0.5,
  ATR_N: 14, EPS: 1e-9, SEEDS: 40, MIN_N: 100, PL_BEAT: 38,
  IS_FROM: Date.UTC(2016, 0, 1) / 1000, OOS_FROM: Date.UTC(2021, 0, 1) / 1000 };
export const RULES = {
  T1: 'stall at $100: limit at the first touch in the New York day of a $100 level approached from 0.5 x ATR away, against the approach, stop 0.25 x ATR beyond, target 0.5 x ATR, flat before the 17:00 New York rollover',
  T2: 'stall at $50: the same on the odd multiples of $50',
  T3: 'break of $100: first M5 close 0.05 x ATR beyond a $100 level it touched, market at the next open, stop 0.1 x ATR back past the level, target 0.5 x ATR, flat before the rollover',
};
// grid offset (in steps of $100) of each test's real levels
export const TESTS = { T1: { rule: 'stall', off: 0 }, T2: { rule: 'stall', off: 0.5 }, T3: { rule: 'break', off: 0 } };

// ─── New York trading days (17:00 to 17:00, named by the New York date on which they end) ───
const DAY = 86400;
const sundayOf = (y, m, n) => { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((7 - d1) % 7) + 7 * (n - 1)) / 1000; };
export function usDst(t) { const d = Math.floor(t / DAY) * DAY, y = new Date(d * 1000).getUTCFullYear(); return d >= sundayOf(y, 2, 2) && d < sundayOf(y, 10, 1); }
// the day key (UTC midnight of the New York date the trading day ends on) of a candle opening at t
export function dayOf(t) { const local = t - (usDst(t) ? 4 : 5) * 3600; return Math.floor((local + 7 * 3600) / DAY) * DAY; }
// days: { day, A, bars }, only weekday-named days, A = mean true range of the 14 trading days before
export function daysOf(B) {
  const raw = []; let cur = null;
  for (const b of B) { const d = dayOf(b.time), wd = new Date(d * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    if (!cur || cur.day !== d) { cur = { day: d, bars: [], high: -Infinity, low: Infinity, close: null }; raw.push(cur); }
    cur.bars.push(b); cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; }
  const out = [];
  for (let j = K.ATR_N + 1; j <= raw.length - 1; j++) {
    let s = 0; for (let k = j - K.ATR_N; k < j; k++) s += Math.max(raw[k].high, raw[k - 1].close) - Math.min(raw[k].low, raw[k - 1].close);
    const A = s / K.ATR_N; if (A > 0) out.push({ day: raw[j].day, A, bars: raw[j].bars });
  }
  return out;
}

// ─── the grid ───
export const gridOf = (off = 0) => ({ G: K.G, off, at: (k) => (k + off) * K.G });
const kLo = (g, p) => Math.ceil(p / g.G - g.off - 1e-7), kHi = (g, p) => Math.floor(p / g.G - g.off + 1e-7);
export function touched(g, c) { const out = []; for (let k = kLo(g, c.low); k <= kHi(g, c.high); k++) { const L = g.at(k); if (c.low <= L + K.EPS && c.high >= L - K.EPS) out.push(k); } return out; }

// manage from index i (the fill / entry candle); stopOnly = only the stop counts in that candle (stall); later candles:
// gaps at the open, then stop first, then target; time exit at the day's last candle's close
export function manage(S, pos) {
  const { side, stop, target } = pos, E = K.EPS;
  for (let j = pos.i; j < S.length; j++) {
    const c = S[j], first = j === pos.i;
    if (!first) {
      if (side > 0 ? c.open <= stop + E : c.open >= stop - E) return { kind: 'stop', px: c.open, at: c.time };
      if (side > 0 ? c.open >= target - E : c.open <= target + E) return { kind: 'target', px: c.open, at: c.time };
    }
    if (side > 0 ? c.low <= stop + E : c.high >= stop - E) return { kind: 'stop', px: stop, at: c.time };
    if (!(first && pos.stopOnly) && (side > 0 ? c.high >= target - E : c.low <= target + E)) return { kind: 'target', px: target, at: c.time };
  }
  const z = S[S.length - 1]; return { kind: 'time', px: z.close, at: z.time };
}
// cost in dollars: the round trip + half a spread on every market order (a market entry; a stop or time exit)
export const costOf = (marketEntry, exitKind) => K.RT + K.SLIP * ((marketEntry ? 1 : 0) + (exitKind === 'target' ? 0 : 1));
export function book(test, k, side, entry, stop, target, at, ex, A, marketEntry) {
  const r0 = Math.abs(entry - stop), gross = side * (ex.px - entry) / r0, cost = costOf(marketEntry, ex.kind);
  return { test, k, at, side, entry, stop, target, r0, A, exit: ex.kind, exitPx: ex.px, exitAt: ex.at, cost, gross, net: gross - cost / r0, net2: gross - 2 * cost / r0 };
}

// stall: fade the first touch in the day (decided from candles at or before the touch candle only)
export function stallDay(test, d, off) {
  const g = gridOf(off), S = d.bars, A = d.A, seen = new Set(), out = [];
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < S.length; i++) {
    const c = S[i], ks = touched(g, c);
    if (i > 0) for (const k of ks) {
      if (seen.has(k)) continue;
      const L = g.at(k), pc = S[i - 1].close, side = pc < L - K.EPS ? -1 : pc > L + K.EPS ? 1 : 0; // -1 sell (from below)
      if (!side) continue;
      const dist = side < 0 ? L - lo : hi - L; if (!(dist >= K.APPROACH * A - K.EPS)) continue;
      const stop = L - side * K.T1_STOP * A, target = L + side * K.T1_TGT * A;
      if (side < 0 ? c.open >= stop - K.EPS : c.open <= stop + K.EPS) continue;
      const entry = side < 0 ? Math.max(L, c.open) : Math.min(L, c.open);
      const ex = manage(S, { side, stop, target, i, stopOnly: true });
      out.push(book(test, k, side, entry, stop, target, c.time, ex, A, false));
    }
    for (const k of ks) seen.add(k);
    lo = Math.min(lo, c.low); hi = Math.max(hi, c.high);
  }
  return out;
}
// break: the first close 0.05 x ATR beyond a level touched by that candle or the one before; market at the next open
export function breakDay(test, d, off) {
  const g = gridOf(off), S = d.bars, A = d.A, Y = K.T3_BEYOND * A, done = new Set(), out = [], E = K.EPS;
  for (let i = 1; i + 1 < S.length; i++) {
    const c = S[i], pv = S[i - 1], n = S[i + 1], cand = [];
    const ku = kHi(g, c.close - Y), Lu = g.at(ku);
    if (c.close >= Lu + Y - E && pv.close < Lu + Y - E && Math.min(c.low, pv.low) <= Lu + E) cand.push([1, ku, Lu]);
    const kd = kLo(g, c.close + Y), Ld = g.at(kd);
    if (c.close <= Ld - Y + E && pv.close > Ld - Y + E && Math.max(c.high, pv.high) >= Ld - E) cand.push([-1, kd, Ld]);
    for (const [side, k, L] of cand) {
      if (done.has(k)) continue;
      const entry = n.open, stop = L - side * K.T3_STOP * A;
      if (side > 0 ? entry <= stop + E : entry >= stop - E) continue;
      done.add(k);
      const target = entry + side * K.T3_TGT * A, ex = manage(S, { side, stop, target, i: i + 1, stopOnly: false });
      out.push(book(test, k, side, entry, stop, target, n.time, ex, A, true));
    }
  }
  return out;
}
// a test's trades on a grid shifted by `off` steps (the real grid: TESTS[test].off)
export function tradesOf(test, days, off = TESTS[test].off) { const f = TESTS[test].rule === 'stall' ? stallDay : breakDay, out = []; for (const d of days) out.push(...f(test, d, off)); return out; }

// seeded uniform draws in [0, 1) (mulberry32): seed = the pre-registered seed number 1-40, nothing else mixed in
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const okOff = (u) => (u >= 0.05 && u <= 0.45) || (u >= 0.55 && u <= 0.95);
export function placeboOff(seed) { const r = rng(seed); let u = r(); while (!okOff(u)) u = r(); return u; }

// ─── statistics ───
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => +x.toFixed(3), r2 = (x) => +x.toFixed(2);
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
export function normSf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; }
const monthKey = (t) => { const x = new Date(t * 1000); return x.getUTCFullYear() * 12 + x.getUTCMonth(); };
export function monthT(trades, from, to, key = 'net') {
  const m0 = monthKey(from), m1 = monthKey(to - 1), sums = new Array(m1 - m0 + 1).fill(0);
  for (const t of trades) if (t.at >= from && t.at < to) sums[monthKey(t.at) - m0] += t[key];
  const s = sd(sums); return { months: sums.length, t: s > 0 ? mean(sums) / (s / Math.sqrt(sums.length)) : 0 };
}
export function summ(trades, from, to) {
  const x = trades.filter((t) => t.at >= from && t.at < to), m = monthT(x, from, to);
  return { n: x.length, net: r3(mean(x.map((t) => t.net))), gross: r3(mean(x.map((t) => t.gross))), net2: r3(mean(x.map((t) => t.net2))),
    total: r2(x.reduce((s, t) => s + t.net, 0)), win: x.length ? r3(x.filter((t) => t.net > 0).length / x.length) : 0,
    months: m.months, t: r2(m.t), tGross: r2(monthT(x, from, to, 'gross').t), t2: r2(monthT(x, from, to, 'net2').t) };
}
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = new Array(ps.length); let top = 0; o.forEach(([p, i], k) => { top = Math.max(top, Math.min(1, p * (ps.length - k))); out[i] = top; }); return out; }

// ─── the report, written from result.json ───
export function report(R) {
  const f = (x, d = 3) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}`, ts = Object.keys(R.tests), L = [], W = { is: 'IS 2016-20', oos: 'OOS 2021 on' };
  L.push('# Round numbers on spot gold ($100 and $50 levels: stall and break): result', '');
  L.push(`**Verdict: ${R.verdict}**`, '');
  L.push(`Pre-registered in PREREGISTRATION.md (committed and pushed before any candle was read). Spot gold (xau), OANDA mid M5, New York`,
    `17:00 trading days, in sample ${R.window.is}, out of sample ${R.window.oos}. Levels: multiples of $100 (T1, T3) and the odd multiples`,
    `of $50 (T2); the placebo shifts the $100-spaced grid by a random fraction of a step (40 seeds, never within $5 of a real level).`,
    `Distances scale with the daily ATR(14). Costs: ${R.costs}. No financing (every trade closed before the rollover). t on calendar-month`,
    'sums; Holm over the three tests. The comparable studies are `fx-round-numbers` and `index-round-numbers` (both FAIL, 0 of 2).',
    'A standalone intraday rule, not a change to the live gold book. Paper research only: nothing live changed.', '');
  L.push('## The three tests', '', '| Test | Window | n | Gross R a trade | Net R a trade | t (months, net) | t (months, gross) | Total net R | Win rate | Net at 2x costs | t at 2x |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) for (const w of ['is', 'oos']) { const s = R.tests[k][w]; L.push(`| ${k} | ${W[w]} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.t.toFixed(2)} | ${s.tGross.toFixed(2)} | ${f(s.total, 1)} | ${(s.win * 100).toFixed(1)} % | ${f(s.net2)} | ${s.t2.toFixed(2)} |`); }
  L.push('', ...ts.map((k) => `- ${k}: ${RULES[k]}.`));
  L.push('', '## The pass bar', '', '| Test | Verdict | ' + Object.keys(R.tests[ts[0]].bar).join(' | ') + ' | p (one-sided, OOS) | Holm p |', '|---|---|' + Object.keys(R.tests[ts[0]].bar).map(() => '---').join('|') + '|---|---|');
  for (const k of ts) { const V = R.tests[k]; L.push(`| ${k} | ${V.verdict} | ` + Object.values(V.bar).map((x) => (x ? 'yes' : 'no')).join(' | ') + ` | ${V.p} | ${V.pHolm} |`); }
  L.push('', '## Placebo: the grid shifted by a random fraction of a step (OOS, 40 seeds)', '', '| Test | Real net R a trade | Placebo mean | Placebo range | Grids the real one beats (of 40) | Real gross | Placebo gross mean | Real rank among 41 |', '|---|---|---|---|---|---|---|---|');
  for (const k of ts) { const V = R.tests[k], P = V.placebo; L.push(`| ${k} | ${f(V.oos.net)} | ${f(P.mean)} | ${f(P.min)} to ${f(P.max)} | ${P.beaten} | ${f(V.oos.gross)} | ${f(P.grossMean)} | ${P.rank} |`); }
  L.push('', 'T1 and T2 are the same stall rule, so they share the 40 placebo grids and the same placebo figures: the real $100 and $50 levels are two of the grids that rule could be run on. A real grid beating 38 of 40 would mean the level itself matters; neither does.');
  L.push('', '## By side (net R a trade, n, t on months)', '', '| Test | Side | OOS net | n | gross | t | IS net | n | gross | t |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ts) for (const s of ['buy', 'sell']) { const a = R.tests[k].bySide[s].oos, b = R.tests[k].bySide[s].is; L.push(`| ${k} | ${s} | ${f(a.net)} | ${a.n} | ${f(a.gross)} | ${a.t.toFixed(2)} | ${f(b.net)} | ${b.n} | ${f(b.gross)} | ${b.t.toFixed(2)} |`); }
  L.push('', '## By year (net R a trade / total, n)', '', '| Year | ' + ts.join(' | ') + ' |', '|---|' + ts.map(() => '---').join('|') + '|');
  for (const y of Object.keys(R.tests[ts[0]].years)) L.push(`| ${y} | ` + ts.map((k) => { const s = R.tests[k].years[y]; return `${f(s.net)} / ${f(s.total, 1)} (n ${s.n})`; }).join(' | ') + ' |');
  L.push('', '## Exits and risk, OOS', '', ...ts.map((k) => `- ${k}: ` + Object.entries(R.tests[k].exits).map(([e, n]) => `${e} ${n}`).join(', ') + `; median cost ${R.tests[k].costR} R a trade; median stop $${R.tests[k].r0}`));
  L.push('', '## Data', '', `xau: ${R.funnel.candles} M5 candles, ${R.funnel.from} to ${R.funnel.to} UTC; ${R.funnel.days} trading days with an ATR.`);
  L.push('', 'To repeat: `node --use-env-proxy research/edge/gold-round-numbers/fetch.mjs <dir>` (candles outside git), then `node research/edge/gold-round-numbers/run.mjs full <dir>`. Tests: `tests/gold-round-numbers.test.mjs`.', '');
  return L.join('\n');
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
export const toBars = (rows) => rows.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));

if (MODE === 'full') {
  const B = toBars(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.argv[3], 'xau-5m.json.gz')))));
  const days = daysOf(B), lastDay = dayOf(B.at(-1).time);
  const use = days.filter((d) => d.day < lastDay); // the last (possibly incomplete) trading day is left out
  const endT = use.at(-1).bars.at(-1).time + 300;
  const funnel = { candles: B.length, from: iso(B[0].time), to: iso(B.at(-1).time), days: use.length };
  const run = (test, off) => tradesOf(test, use, off).filter((t) => t.at >= K.IS_FROM).sort((a, b) => a.at - b.at);
  const out = { topic: 'gold-round-numbers', built: '2026-11-14', at: new Date().toISOString(),
    system: 'Round-number stall (fade the first touch of $100 and $50 levels) and break (follow the close beyond a $100 level), spot gold, OANDA mid M5, New York trading days',
    window: { is: '2016-01-01 to 2020-12-31', oos: `2021-01-01 to ${iso(endT).slice(0, 10)}` }, params: K, markets: ['xau'], funnel,
    costs: '$0.30 a round trip + $0.15 (half the $0.30 spread) of slippage on every market order (the break entry, stop and time exits)', tests: {} };
  const plOffs = Array.from({ length: K.SEEDS }, (_, s) => placeboOff(s + 1));
  for (const test of Object.keys(TESTS)) {
    const x = run(test, TESTS[test].off), is = summ(x, K.IS_FROM, K.OOS_FROM), oos = summ(x, K.OOS_FROM, endT);
    const bySide = Object.fromEntries([['buy', 1], ['sell', -1]].map(([s, v]) => [s, { is: summ(x.filter((t) => t.side === v), K.IS_FROM, K.OOS_FROM), oos: summ(x.filter((t) => t.side === v), K.OOS_FROM, endT) }]));
    const years = {}; for (let y = 2016; y <= new Date(endT * 1000).getUTCFullYear(); y++) { const s = summ(x, Date.UTC(y, 0, 1) / 1000, Math.min(Date.UTC(y + 1, 0, 1) / 1000, endT)); years[y] = { n: s.n, net: s.net, total: s.total }; }
    const oT = x.filter((t) => t.at >= K.OOS_FROM), exits = {}; for (const t of oT) exits[t.exit] = (exits[t.exit] || 0) + 1;
    const pl = [], plG = [];
    for (const o of plOffs) { const y = run(test, o).filter((t) => t.at >= K.OOS_FROM && t.at < endT); pl.push(mean(y.map((t) => t.net))); plG.push(mean(y.map((t) => t.gross))); }
    const realNet = mean(oT.map((t) => t.net)), beaten = pl.filter((v) => realNet > v).length;
    out.tests[test] = { rule: TESTS[test].rule, levels: TESTS[test].off ? '$50 (odd multiples)' : '$100', is, oos, bySide, years, exits,
      costR: r3(median(oT.map((t) => t.gross - t.net))), r0: r2(median(oT.map((t) => t.r0))), p: +normSf(oos.t).toFixed(5),
      placebo: { seeds: K.SEEDS, offsets: plOffs.map((o) => +o.toFixed(4)), means: pl.map(r3), mean: r3(mean(pl)), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)),
        grossMean: r3(mean(plG)), beaten, rank: 1 + pl.filter((v) => v > realNet).length } };
  }
  const ts = Object.keys(out.tests), ph = holm(ts.map((k) => out.tests[k].p));
  for (const [i, k] of ts.entries()) { const V = out.tests[k]; V.pHolm = +ph[i].toFixed(5);
    V.bar = { 'OOS n >= 100': V.oos.n >= K.MIN_N, 'OOS month-sum t >= 2': V.oos.t >= 2, 'Holm p < 0.05': V.pHolm < 0.05, 'IS net R a trade > 0': V.is.net > 0,
      'OOS net at 2x costs > 0': V.oos.net2 > 0, 'beats 38 of 40 placebo grids': V.placebo.beaten >= K.PL_BEAT };
    V.verdict = Object.values(V.bar).every(Boolean) ? 'PASS' : 'FAIL'; }
  const nPass = ts.filter((k) => out.tests[k].verdict === 'PASS').length, sg = (z) => `${z >= 0 ? '+' : ''}${z}`;
  out.verdict = `${nPass ? 'PASS' : 'FAIL'}, ${nPass} of 3: ` + ts.map((k) => { const V = out.tests[k]; return `${k} OOS ${sg(V.oos.net)}R net (n ${V.oos.n}, t ${V.oos.t}), IS ${sg(V.is.net)}R`; }).join('; ');
  out.candidates = ts.map((k) => ({ rule: `${k}: ${RULES[k]}`, verdict: out.tests[k].verdict, is: out.tests[k].is, oos: out.tests[k].oos }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(out));
  for (const k of ts) console.log(k, JSON.stringify(out.tests[k].is), JSON.stringify(out.tests[k].oos), JSON.stringify({ ...out.tests[k].placebo, offsets: undefined, means: undefined }), out.tests[k].pHolm, out.tests[k].verdict);
  console.log(out.verdict, out.verdict.length);
}
