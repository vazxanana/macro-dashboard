// Nearness to the 52-week high on commodities and currencies (pre-registered 14 Nov 2026, PREREGISTRATION.md).
// At each month's last close, within each group (12 commodity CFDs, 35 currency pairs as quoted), rank by close / 252-day
// closing high, long the top third and short the bottom third at the next month's first open, 1R = stop = 3 x ATR(20)
// (inverse-ATR sizing), out at the month's last close; net of assumed round trips and flat financing. Control: the 12-1
// momentum ranking with the same construction. Paper research only: nothing live reads this file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { foldWeekend, nights } from '../../../council/fills.mjs';

export const CMD = ['xau', 'xag', 'xpt', 'xpd', 'xcu', 'bco', 'wtico', 'natgas', 'corn', 'wheat', 'soybn', 'sugar'];
export const FX = ('audcad audchf audjpy audnzd audusd cadchf cadjpy chfjpy euraud eurcad eurchf eurgbp eurjpy eurnzd eurusd '
  + 'gbpaud gbpcad gbpchf gbpjpy gbpnzd gbpusd nzdcad nzdchf nzdjpy nzdusd usdcad usdchf usdjpy usdmxn usdnok usdpln usdsek '
  + 'usdsgd usdtry usdzar').split(' ');
export const EXOTIC = { usdnok: 0.001, usdsek: 0.001, usdpln: 0.001, usdsgd: 0.001, usdmxn: 0.002, usdzar: 0.002, usdtry: 0.002 };
export const P = {
  HIGH_N: 252, LOOK: 12, SKIP: 1, ATR_N: 20, ATR_MULT: 3, MIN: { cmd: 8, fx: 24 },
  CMD_ABS: { xau: 0.30, xag: 0.03 }, CMD_FRAC: 0.0006, CMD_FIN_NIGHT: 0.03 / 365,
  FX_FRAC: 0.00015, FX_FIN_NIGHT: 0.00004, SEEDS: 40, IS_TO: '2016-12', OOS: { from: '2017-01', to: '2026-10' },
};
export const DATA_COMMIT = 'e08b7aeb9';

// ─── calendar ───
export const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function shiftYm(s, k) { const [y, m] = s.split('-').map(Number), n = y * 12 + (m - 1) + k; return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`; }
export const rowsToBars = (rows) => rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
export function indexMarket(key, bars) {
  const first = new Map(), last = new Map();
  bars.forEach((b, i) => { const k = ym(b.time); if (!first.has(k)) first.set(k, i); last.set(k, i); });
  return { key, bars, first, last };
}

// ─── signals (closes up to and including bar i only) ───
export function nearness(bars, i, n = P.HIGH_N) {
  if (i < n - 1) return null;
  let hi = -Infinity;
  for (let j = i - n + 1; j <= i; j++) hi = Math.max(hi, bars[j].close);
  return bars[i].close / hi;
}
export function momentum(mk, S, look = P.LOOK, skip = P.SKIP) {
  const a = mk.last.get(shiftYm(S, -look)), b = mk.last.get(shiftYm(S, -skip));
  if (a == null || b == null || !mk.last.has(S)) return null;
  return mk.bars[b].close / mk.bars[a].close - 1;
}
export function atr(bars, i, n = P.ATR_N) {
  if (i < n) return null;
  let a = 0;
  for (let j = i - n + 1; j <= i; j++) a += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
  return a / n;
}
// OLS residuals of y on x with an intercept
export function residuals(y, x) {
  const n = y.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return y.map((v, i) => v - my - b * (x[i] - mx));
}

// signals of one group at the end of month S: [{ key, near, mom, res }], only markets with a candle in S and in S+1
export function signalsAt(mks, S) {
  const out = [];
  for (const mk of mks) {
    if (!mk.last.has(S) || !mk.first.has(shiftYm(S, 1))) continue;
    const i = mk.last.get(S), near = nearness(mk.bars, i), mom = momentum(mk, S), a = atr(mk.bars, i);
    if (near == null || mom == null || !a) continue;
    out.push({ key: mk.key, near, mom, atr: a });
  }
  if (out.length >= 3) { const r = residuals(out.map((s) => s.near), out.map((s) => s.mom)); out.forEach((s, j) => { s.res = r[j]; }); }
  return out;
}
// long the top third, short the bottom third by `by` (higher = long); ties broken by key for determinism
export function pick(sigs, by) {
  const k = Math.floor(sigs.length / 3);
  const s = [...sigs].sort((a, b) => (b[by] - a[by]) || (a.key < b.key ? -1 : 1));
  return { long: s.slice(0, k), short: s.slice(s.length - k) };
}

// ─── one leg ───
export function costFrac(key, px) {
  if (CMD.includes(key)) return P.CMD_ABS[key] != null ? P.CMD_ABS[key] / px : P.CMD_FRAC;
  return EXOTIC[key] ?? P.FX_FRAC;
}
export const finNight = (key) => (CMD.includes(key) ? P.CMD_FIN_NIGHT : P.FX_FIN_NIGHT);
// month M = S+1: enter at the first open, stop = 3 ATR(signal day), out at the last close or the stop (gap = open)
export function leg(mk, S, side, atrV, { costX = 1 } = {}) {
  const M = shiftYm(S, 1), e = mk.first.get(M), x = mk.last.get(M), bars = mk.bars;
  const entry = bars[e].open, dist = P.ATR_MULT * atrV, stop = entry - side * dist;
  let exit = bars[x].close, how = 'close', exitTime = bars[x].time + 86400;
  for (let i = e; i <= x; i++) {
    const b = bars[i];
    if (i > e && (side > 0 ? b.open <= stop : b.open >= stop)) { exit = b.open; how = 'gap'; exitTime = b.time; break; }
    if (side > 0 ? b.low <= stop : b.high >= stop) { exit = stop; how = 'stop'; exitTime = b.time + 86400; break; }
  }
  const gross = (side * (exit - entry)) / dist;
  const costR = (costX * costFrac(mk.key, entry) * entry) / dist;
  const n = nights(bars[e].time, exitTime);
  const finR = (costX * n * finNight(mk.key) * entry) / dist;
  return { key: mk.key, side, gross, costR, finR, nights: n, net: gross - costR - finR, how };
}

// ─── books ───
// one group, one ranking: Map month -> { gross, net, legs }
export function groupBook(mks, months, by, { costX = 1, rng = null, min = 0, only = null } = {}) {
  const out = new Map(), byKey = new Map(mks.map((m) => [m.key, m]));
  for (const S of months) {
    let sigs = signalsAt(mks, S);
    if (only) sigs = sigs.filter((s) => only.includes(s.key));
    if (sigs.length < min) continue;
    if (by === 'res' && sigs.some((s) => s.res == null)) continue;
    let pk;
    if (rng) { const a = sigs.map((s) => ({ ...s, z: rng() })); pk = pick(a, 'z'); } else pk = pick(sigs, by);
    const legs = [...pk.long.map((s) => leg(byKey.get(s.key), S, 1, s.atr, { costX })), ...pk.short.map((s) => leg(byKey.get(s.key), S, -1, s.atr, { costX }))];
    if (!legs.length) continue;
    const m = (f) => legs.reduce((a, l) => a + l[f], 0) / legs.length;
    out.set(shiftYm(S, 1), { gross: m('gross'), net: m('net'), legs, long: pk.long.map((s) => s.key), short: pk.short.map((s) => s.key) });
  }
  return out;
}
// equal-weighted mean of the two group books; a month with one group traded takes that one
export function combine(a, b) {
  const out = new Map();
  for (const M of new Set([...a.keys(), ...b.keys()])) {
    const xs = [a.get(M), b.get(M)].filter(Boolean);
    out.set(M, { gross: xs.reduce((s, x) => s + x.gross, 0) / xs.length, net: xs.reduce((s, x) => s + x.net, 0) / xs.length, groups: xs.length });
  }
  return new Map([...out.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
}

// ─── statistics ───
export function stat(xs) {
  const n = xs.length; if (!n) return { n: 0, mean: null, t: null, total: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const x of xs) { eq += x; pk = Math.max(pk, eq); dd = Math.min(dd, eq - pk); }
  return { n, mean: r4(mean), t: sd > 0 ? r2((mean / sd) * Math.sqrt(n)) : null, total: r2(xs.reduce((a, b) => a + b, 0)), dd: r2(dd), pos: r1((100 * xs.filter((x) => x > 0).length) / n) };
}
export function normCdf(z) { // Abramowitz-Stegun 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
export function holm(ps) {
  const idx = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = new Array(ps.length); let run = 0;
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); adj[i] = run; });
  return adj;
}
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r1 = (v) => +v.toFixed(1), r2 = (v) => +v.toFixed(2), r4 = (v) => +v.toFixed(4);
const inW = (M, from, to) => M >= from && M <= to;
export function windows(book, start) {
  const all = [...book.entries()];
  const sel = (from, to, f) => all.filter(([M]) => inW(M, from, to)).map(([, v]) => v[f]);
  return {
    is: { from: start, to: P.IS_TO, gross: stat(sel(start, P.IS_TO, 'gross')), net: stat(sel(start, P.IS_TO, 'net')) },
    oos: { ...P.OOS, gross: stat(sel(P.OOS.from, P.OOS.to, 'gross')), net: stat(sel(P.OOS.from, P.OOS.to, 'net')) },
  };
}

// ─── data ───
export function load(key) {
  const j = JSON.parse(execFileSync('git', ['show', `origin/council-data:research/daily/${key}.json`], { maxBuffer: 1 << 28 }).toString());
  const bars = foldWeekend(rowsToBars(j.rows)).filter((b) => ym(b.time) <= P.OOS.to);
  return indexMarket(key, bars);
}

export function build(L = load) {
  const cmd = CMD.map(L), fx = FX.map(L);
  const months = [];
  for (let M = '2003-01'; M <= shiftYm(P.OOS.to, -1); M = shiftYm(M, 1)) months.push(M);
  const run = (by, opt = {}) => {
    const c = groupBook(cmd, months, by, { min: P.MIN.cmd, ...opt }), f = groupBook(fx, months, by, { min: P.MIN.fx, ...opt });
    return { c, f, both: combine(c, f) };
  };
  const base = { near: run('near'), res: run('res'), mom: run('mom') };
  const x2 = { near: run('near', { costX: 2 }), res: run('res', { costX: 2 }), mom: run('mom', { costX: 2 }) };
  const x0 = { near: run('near', { costX: 0 }) };
  // start = the first month both groups are traded (by the minimums)
  const start = [...base.near.c.keys()].filter((M) => base.near.f.has(M)).sort()[0];
  const trim = (bk) => new Map([...bk].filter(([M]) => M >= start));
  const W = (bk) => windows(trim(bk), start);
  const T = [
    { id: 'T1', name: 'Nearness, combined (primary)', bk: base.near.both, x2: x2.near.both },
    { id: 'T2', name: 'Nearness, commodities alone', bk: base.near.c, x2: x2.near.c },
    { id: 'T3', name: 'Nearness, currencies alone', bk: base.near.f, x2: x2.near.f },
    { id: 'T4', name: 'Residual nearness, combined', bk: base.res.both, x2: x2.res.both },
  ].map((t) => ({ id: t.id, name: t.name, ...W(t.bk), oosX2: W(t.x2).oos.net }));
  const ps = T.map((t) => 1 - normCdf(t.oos.net.t ?? 0)), adj = holm(ps);
  T.forEach((t, i) => {
    t.p = r4(ps[i]); t.holm = r4(adj[i]);
    t.checks = { oosPositive: t.oos.net.mean > 0, oosT2: (t.oos.net.t ?? 0) >= 2, holm05: adj[i] < 0.05, isSameSign: Math.sign(t.is.net.mean) === Math.sign(t.oos.net.mean) && t.oos.net.mean !== 0, x2Positive: t.oosX2.mean > 0 };
    t.pass = Object.values(t.checks).every(Boolean);
  });
  // control: 12-1 momentum, same construction
  const control = { combined: W(base.mom.both), commodities: W(base.mom.c), currencies: W(base.mom.f), combinedX2: W(x2.mom.both).oos.net };
  // placebo: random ordering within each group each month
  const runs = [];
  for (let s = 1; s <= P.SEEDS; s++) {
    const rng = mulberry32(s);
    const c = groupBook(cmd, months, 'near', { min: P.MIN.cmd, rng }), f = groupBook(fx, months, 'near', { min: P.MIN.fx, rng });
    const o = W(combine(c, f)).oos.net; runs.push({ seed: s, mean: o.mean, t: o.t });
  }
  const ts = runs.map((r) => r.t).sort((a, b) => a - b), q = (p) => ts[Math.min(ts.length - 1, Math.floor(p * ts.length))];
  const placebo = { seeds: P.SEEDS, realT: T[0].oos.net.t, p5: q(0.05), p50: q(0.5), p95: q(0.95), max: ts[ts.length - 1], atOrAbove: ts.filter((t) => t >= T[0].oos.net.t).length, runs };
  // descriptive
  const g10 = combine(groupBook(cmd, months, 'near', { min: P.MIN.cmd }), groupBook(fx, months, 'near', { min: 17, only: FX.filter((k) => !EXOTIC[k]) }));
  const costs = { x0: W(x0.near.both), x1: W(base.near.both), x2: W(x2.near.both) };
  const byYear = {};
  for (const [M, v] of trim(base.near.both)) { const y = M.slice(0, 4); byYear[y] = byYear[y] || { months: 0, gross: 0, net: 0, momNet: 0 }; byYear[y].months++; byYear[y].gross += v.gross; byYear[y].net += v.net; byYear[y].momNet += base.mom.both.get(M)?.net ?? 0; }
  for (const y in byYear) for (const k of ['gross', 'net', 'momNet']) byYear[y][k] = r2(byYear[y][k]);
  const legStats = (bk, from, to) => {
    const legs = [...bk].filter(([M]) => inW(M, from, to)).flatMap(([, v]) => v.legs), n = legs.length;
    const m = (f) => r4(legs.reduce((a, l) => a + l[f], 0) / n);
    return { n, win: r1((100 * legs.filter((l) => l.net > 0).length) / n), stopped: r1((100 * legs.filter((l) => l.how !== 'close').length) / n), gross: m('gross'), cost: m('costR'), fin: m('finR'), net: m('net') };
  };
  const legsOOS = { commodities: legStats(base.near.c, P.OOS.from, P.OOS.to), currencies: legStats(base.near.f, P.OOS.from, P.OOS.to) };
  const data = Object.fromEntries([...cmd, ...fx].map((m) => [m.key, { first: ym(m.bars[0].time), candles: m.bars.length }]));
  const corr = (() => { // monthly correlation of the nearness and momentum combined books, OOS
    const Ms = [...base.near.both.keys()].filter((M) => inW(M, P.OOS.from, P.OOS.to) && base.mom.both.has(M));
    const a = Ms.map((M) => base.near.both.get(M).net), b = Ms.map((M) => base.mom.both.get(M).net);
    const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length;
    let sab = 0, saa = 0, sbb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); saa += (x - ma) ** 2; sbb += (b[i] - mb) ** 2; });
    return r2(sab / Math.sqrt(saa * sbb));
  })();
  const verdict = T[0].pass ? 'PASS' : 'FAIL';
  const months_ = [...trim(base.near.both)].map(([M, v]) => ({ month: M, gross: r4(v.gross), net: r4(v.net), cmd: base.near.c.get(M) ? { long: base.near.c.get(M).long, short: base.near.c.get(M).short, net: r4(base.near.c.get(M).net) } : null, fxNet: base.near.f.get(M) ? r4(base.near.f.get(M).net) : null }));
  return {
    study: 'high52-cmdfx', built: '2026-11-14', dataCommit: DATA_COMMIT, verdict,
    title: 'Nearness to the 52-week high on commodities and currencies',
    system: 'Within 12 commodity CFDs and 35 currency pairs (as quoted), each month long the top third and short the bottom third by close / 252-day closing high, 1R = 3 x ATR(20) stop, inverse-ATR sizing, net of costs and flat financing',
    params: P, sets: { commodities: CMD, currencies: FX, exotics: Object.keys(EXOTIC) }, start, data,
    tests: T, placebo, control, corrNearMomOOS: corr, costs, g10Only: W(g10), byYear, legsOOS, months: months_,
  };
}

// ─── report ───
const sg = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function headline(R) {
  const t1 = R.tests[0];
  return `**Verdict: ${R.verdict}: nearness to the 52-week high, combined commodity + FX book, ${sg(t1.oos.net.mean)}R a month net out of sample 2017-26 (n ${t1.oos.net.n}, t ${sg(t1.oos.net.t, 2)}), ${sg(t1.is.net.mean)}R in sample; ${R.tests.filter((t) => t.pass).length} of 4 tests pass.**`;
}
export function report(R) {
  const L = [];
  L.push('# Nearness to the 52-week high on commodities and currencies: result', '', headline(R), '');
  L.push('Paper research only. No live rule, size, filter, council member or page changed. Rule, sets, costs, windows and the four tests were fixed in `PREREGISTRATION.md`, pushed alone before any position was simulated. Data: council-data `research/daily/*.json` (commit `' + R.dataCommit + '`), OANDA mid daily candles, weekend stubs folded into Monday, to 2026-10.', '');
  L.push('**Related.** `high52-rotation` (#853) and `index-52w-high` (#911) tested this ranking on equity indices and failed; `commodity-xs-momentum` and `fx-xs-momentum` tested the past-return ranking on these groups and failed. The 12-1 momentum control below uses this study\'s own construction.', '');
  L.push('## The four tests (R a month, mean of the legs; combined = mean of the two group books)', '');
  L.push('| Test | Window | Months | Gross R | Net R | Net t | Total net R | Worst drawdown R | OOS net at 2x costs | One-sided p | Holm p | Pass |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of R.tests) {
    L.push(`| ${t.id} ${t.name} | IS ${t.is.from} to ${t.is.to} | ${t.is.net.n} | ${sg(t.is.gross.mean)} (t ${sg(t.is.gross.t, 2)}) | ${sg(t.is.net.mean)} | ${sg(t.is.net.t, 2)} | ${sg(t.is.net.total, 2)} | ${sg(t.is.net.dd, 2)} | | | | |`);
    L.push(`| | OOS ${t.oos.from} to ${t.oos.to} | ${t.oos.net.n} | ${sg(t.oos.gross.mean)} (t ${sg(t.oos.gross.t, 2)}) | ${sg(t.oos.net.mean)} | ${sg(t.oos.net.t, 2)} | ${sg(t.oos.net.total, 2)} | ${sg(t.oos.net.dd, 2)} | ${sg(t.oosX2.mean)} (t ${sg(t.oosX2.t, 2)}) | ${t.p} | ${t.holm} | ${t.pass ? 'yes' : 'no'} |`);
  }
  L.push('', 'Pass bar (pre-registered, judged on T1): OOS net mean > 0 with t >= 2 and Holm p < 0.05, the in-sample net mean of the same sign, and the OOS mean > 0 at 2x costs and financing.', '');
  L.push('| Check | ' + R.tests.map((t) => t.id).join(' | ') + ' |', '|---|' + R.tests.map(() => '---|').join(''));
  for (const k of ['oosPositive', 'oosT2', 'holm05', 'isSameSign', 'x2Positive']) L.push(`| ${k} | ` + R.tests.map((t) => (t.checks[k] ? 'yes' : 'no')).join(' | ') + ' |');
  const p = R.placebo;
  L.push('', '## Placebo (40 seeds, random ordering within each group each month, same thirds, stops and costs, combined OOS net t)', '');
  L.push('| p5 | p50 | p95 | max | T1 real | Seeds at or above the real |', '|---|---|---|---|---|---|');
  L.push(`| ${sg(p.p5, 2)} | ${sg(p.p50, 2)} | ${sg(p.p95, 2)} | ${sg(p.max, 2)} | ${sg(p.realT, 2)} | ${p.atOrAbove} of ${p.seeds} |`);
  const c = R.control;
  L.push('', '## Control: 12-1 momentum, same construction (reported, not a test)', '');
  L.push('| Book | IS gross | IS net (t) | OOS gross | OOS net (t) | OOS net at 2x |', '|---|---|---|---|---|---|');
  for (const [name, w] of [['Combined', c.combined], ['Commodities', c.commodities], ['Currencies', c.currencies]])
    L.push(`| ${name} | ${sg(w.is.gross.mean)} | ${sg(w.is.net.mean)} (${sg(w.is.net.t, 2)}) | ${sg(w.oos.gross.mean)} | ${sg(w.oos.net.mean)} (${sg(w.oos.net.t, 2)}) | ${name === 'Combined' ? sg(c.combinedX2.mean) : ''} |`);
  L.push('', `Monthly correlation of the combined nearness and momentum books, OOS net: ${R.corrNearMomOOS}.`, '');
  L.push('## Costs, and the book without the exotic currencies (T1, descriptive)', '');
  L.push('| Variant | IS net (t) | OOS net (t) |', '|---|---|---|');
  for (const [name, w] of [['No costs, no financing', R.costs.x0], ['Base (decides)', R.costs.x1], ['2x costs and financing', R.costs.x2], ['G10 currencies only (no NOK SEK PLN SGD MXN ZAR TRY)', R.g10Only]])
    L.push(`| ${name} | ${sg(w.is.net.mean)} (${sg(w.is.net.t, 2)}) | ${sg(w.oos.net.mean)} (${sg(w.oos.net.t, 2)}) |`);
  L.push('', '## Legs, OOS (nearness)', '');
  L.push('| Group | Legs | Won % | Stopped % | Gross R | Cost R | Financing R | Net R |', '|---|---|---|---|---|---|---|---|');
  for (const [name, s] of [['Commodities', R.legsOOS.commodities], ['Currencies', R.legsOOS.currencies]]) L.push(`| ${name} | ${s.n} | ${s.win} | ${s.stopped} | ${sg(s.gross)} | ${s.cost} | ${s.fin} | ${sg(s.net)} |`);
  L.push('', '## Per year (T1 combined, sum of monthly R; momentum control net beside it)', '');
  L.push('| Year | Months | Gross | Net | Momentum net |', '|---|---|---|---|---|');
  for (const [y, v] of Object.entries(R.byYear)) L.push(`| ${y} | ${v.months} | ${sg(v.gross, 2)} | ${sg(v.net, 2)} | ${sg(v.momNet, 2)} |`);
  L.push('', '## Reading', '');
  L.push(`- Before any cost the combined nearness book made ${sg(R.costs.x0.oos.net.mean)}R a month out of sample (t ${sg(R.costs.x0.oos.net.t, 2)}) and ${sg(R.costs.x0.is.net.mean)}R in sample (t ${sg(R.costs.x0.is.net.t, 2)}): small, and not significant in either window. Costs and financing (mostly financing on the currency legs) take it below zero.`);
  L.push(`- The placebo books are all negative (they pay the same costs). T1's OOS t (${sg(p.realT, 2)}) sits above ${p.seeds - p.atOrAbove} of ${p.seeds} random orderings: the ranking picked better than random markets did, but not by enough to cover the same costs, so the book still loses. Not part of the bar; it does not change the verdict.`);
  L.push(`- Commodities alone (T2) were the best part: ${sg(R.tests[1].is.net.mean)}R in sample, ${sg(R.tests[1].oos.net.mean)}R out of sample (t ${sg(R.tests[1].oos.net.t, 2)}), negative at 2x costs. Currencies (T3) lost in both windows. The residual version (T4) lost out of sample.`);
  L.push(`- Nearness and 12-1 momentum books move together (OOS monthly correlation ${R.corrNearMomOOS}); neither earns net of costs on these groups.`);
  L.push('- No variant (another look-back, other thirds, carry-inclusive financing) is proposed: any would be a new study with its own pre-registration on data it was not chosen on.');
  L.push('', '## What this cannot show', '');
  L.push('- Carry: every currency leg pays a flat 0.004 % a night, long or short; true rate differentials (large on TRY, ZAR, MXN) are not in the test. Commodity CFDs embed their futures roll in the price; financing is a flat 3 % a year.');
  L.push('- Nearness is on the pair as quoted: a cross and its inverse would rank in opposite order, so the currency result depends on OANDA\'s quoting convention. This was fixed in advance, not chosen.');
  L.push('- The published effect is on thousands of stocks; 12 commodities and 35 overlapping pairs are a narrow, correlated cross-section.');
  L.push('- Not an edge in the council and no forward record. Nothing is proposed.', '');
  L.push('To repeat: `node research/edge/high52-cmdfx/run.mjs` (reads council-data with `git show`, writes `result.json` and `RESULT.md`). Tests: `tests/high52-cmdfx.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const R = build();
  fs.writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(new URL('./RESULT.md', import.meta.url), report(R));
  console.log(headline(R));
}
