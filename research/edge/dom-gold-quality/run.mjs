// research/edge/dom-gold-quality/run.mjs - the H1 dominant-zone limit on gold (4R exit, measured costs): can what is known at
// the fill, taken together, separate the better trades from the worse ones? (PREREGISTRATION.md, 26 Nov 2026)
//   EDGE_DATA=<cache> node --max-old-space-size=6000 research/edge/dom-gold-quality/run.mjs <ticks-XAUUSD.json at 0459ec37>
// Writes result.json and RESULT.md next to this file. Paper research only: the trades and costs are dom-gold-hourcost's
// (imported, not edited); nothing here changes a rule.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';
import { medRange } from '../gold-vol-breakout-hourcost/costs.mjs';
import { trades, costR, stat, FROM, SPLIT, COMMISSION, CUTS, GRID_GOLD_4R_B } from '../dom-gold-hourcost/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXIT = '4R', ROUTE = 'C1', SHRINK = 200, SHUFFLES = 40, NEED = 38, SLIP = 0.05, SMA_N = 200, MOVE_N = 20;
export const FEATS = ['side', 'session', 'cost', 'stop', 'sideways', 'trend', 'move20', 'er', 'age', 'weekday'];
export const LEVELS = { side: ['buy', 'sell'], session: ['Asia', 'London', 'New York', 'late'], cost: ['low', 'mid', 'high'], stop: ['low', 'mid', 'high'],
  sideways: ['yes', 'no'], trend: ['with', 'against'], move20: ['with', 'against'], er: ['low', 'mid', 'high'], age: ['0-3', '4-12', 'over 12'], weekday: ['Monday', 'Tuesday-Thursday', 'Friday'] };
const CAP = 2 * 86400, cost0 = COSTS.xau;

// ---- levels (pure) ---------------------------------------------------------------------------------------------------
// session of the fill hour (UTC): Asia 22-06, London 07-11, New York 12-16, late 17-21
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 22 || h <= 6 ? 'Asia' : h <= 11 ? 'London' : h <= 16 ? 'New York' : 'late'; };
// weekday of the fill (UTC); the Sunday reopen hours belong to Monday's session
export const weekdayOf = (t) => { const d = new Date(t * 1000).getUTCDay(); return d === 0 || d === 1 ? 'Monday' : d === 5 || d === 6 ? 'Friday' : 'Tuesday-Thursday'; };
export const ageBand = (n) => (n <= 3 ? '0-3' : n <= 12 ? '4-12' : 'over 12');
export const terc = (v, c) => (v <= c[0] ? 'low' : v <= c[1] ? 'mid' : 'high');
export const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
export function quant(v, q) { const s = [...v].sort((a, b) => a - b); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
export const tercCuts = (v) => [quant(v, 1 / 3), quant(v, 2 / 3)];
export function levelsOf(x, cuts) {
  return { side: x.side > 0 ? 'buy' : 'sell', session: sessionOf(x.t), cost: terc(x.costShare, cuts.cost), stop: terc(x.stopAtr, cuts.stop), sideways: x.sideways ? 'yes' : 'no',
    trend: x.trend, move20: x.move20, er: terc(x.er, cuts.er), age: ageBand(x.age), weekday: weekdayOf(x.t) };
}

// ---- the score (fitted on window A only) -------------------------------------------------------------------------------
// each level: (mean net R at that level - mean net R of all A trades) x n / (n + 200); a trade's score = the sum over the features
export function fit(A, netOf = (r) => r.net, cuts = null) {
  cuts ||= { cost: tercCuts(A.map((r) => r.costShare)), stop: tercCuts(A.map((r) => r.stopAtr)), er: tercCuts(A.map((r) => r.er)) };
  const all = mean(A.map(netOf)), val = {}, sum = {}, cnt = {};
  for (const f of FEATS) { sum[f] = {}; cnt[f] = {}; }
  const lv = A.map((r) => levelsOf(r, cuts));
  A.forEach((r, i) => { const n = netOf(r); for (const f of FEATS) { const k = lv[i][f]; sum[f][k] = (sum[f][k] || 0) + n; cnt[f][k] = (cnt[f][k] || 0) + 1; } });
  for (const f of FEATS) { val[f] = {}; for (const k of Object.keys(cnt[f])) { const n = cnt[f][k]; val[f][k] = (sum[f][k] / n - all) * n / (n + SHRINK); } }
  const model = { cuts, all, val };
  const sc = lv.map((L) => scoreLevels(L, model));
  model.scoreCuts = tercCuts(sc);
  return model;
}
const scoreLevels = (L, m) => { let s = 0; for (const f of FEATS) s += m.val[f][L[f]] ?? 0; return s; };
export const score = (r, m) => scoreLevels(levelsOf(r, m.cuts), m);
// KEEP = top third of the A scores, AVOID = bottom third, MID = the rest
export const groupOf = (s, m) => (s >= m.scoreCuts[1] ? 'keep' : s <= m.scoreCuts[0] ? 'avoid' : 'mid');

// ---- statistics ------------------------------------------------------------------------------------------------------------
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null; const ma = mean(a), mb = mean(b);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0) / (b.length - 1), se = Math.sqrt(va / a.length + vb / b.length);
  return se > 0 ? (ma - mb) / se : null;
}
const monthKey = (t) => new Date(t * 1000).toISOString().slice(0, 7);
export function monthsBetween(a, b) { const out = []; const d = new Date(a * 1000); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); while (d.getTime() / 1000 < b) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); } return out; }
// t of calendar-month sums over every month of [from, to), empty months as 0 (dom-gold-hourcost stat())
export function monthT(rows, from, to, key = 'net') {
  const ms = new Map(monthsBetween(from, to).map((m) => [m, 0]));
  for (const r of rows) { const k = monthKey(r.t); if (ms.has(k)) ms.set(k, ms.get(k) + r[key]); }
  const v = [...ms.values()], m = v.length; if (m < 2) return null;
  const mu = mean(v), sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (m - 1));
  return sd > 0 ? mu / (sd / Math.sqrt(m)) : null;
}
const r4 = (v) => (v == null ? null : +v.toFixed(4)), r2 = (v) => (v == null ? null : +v.toFixed(2));
export function gstat(rows, from, to) {
  return { n: rows.length, net: r4(mean(rows.map((r) => r.net))), t: r2(monthT(rows, from, to)), before: r4(mean(rows.map((r) => r.R))), tBefore: r2(monthT(rows, from, to, 'R')),
    win: rows.length ? +(100 * rows.filter((r) => r.R > 0).length / rows.length).toFixed(1) : null };
}

// ---- the verdict (PREREGISTRATION.md, "Test (one) and verdict") ------------------------------------------------------------
export function verdictOf(x) {
  const a = x.keepMean > x.allMean && (x.keepWelch ?? -Infinity) >= 2;
  const b = (x.keepMonthT ?? -Infinity) >= 2 && x.keepMean > 0;
  const c = x.beaten >= NEED;
  if (a && b && c) return { verdict: 'PASS', a, b, c };
  const avoid = (x.avoidWelch ?? Infinity) <= -2 && x.avoidMean < 0;
  return { verdict: avoid ? 'USEFUL TO AVOID' : 'FAIL', a, b, c, avoid };
}

// the whole judgement from trades that carry t, R, net and their raw features
export function judge(rows, END) {
  const A = rows.filter((r) => r.t >= FROM && r.t < SPLIT), B = rows.filter((r) => r.t >= SPLIT && r.t < END);
  const model = fit(A), W = { A: [FROM, SPLIT], B: [SPLIT, END] };
  const split = (set, m = model) => { const g = { keep: [], mid: [], avoid: [] }; for (const r of set) g[groupOf(score(r, m), m)].push(r); return g; };
  const GA = split(A), GB = split(B), net = (v) => v.map((r) => r.net);
  const keepWelch = welch(net(GB.keep), net([...GB.mid, ...GB.avoid])), avoidWelch = welch(net(GB.avoid), net([...GB.keep, ...GB.mid]));
  const keepMean = mean(net(GB.keep)), allMean = mean(net(B)), avoidMean = mean(net(GB.avoid)), keepMonthT = monthT(GB.keep, ...W.B);
  // placebo: the A outcomes shuffled among the A trades, the score refitted (feature cuts unchanged: they do not read outcomes)
  const shuf = [];
  for (let s = 1; s <= SHUFFLES; s++) { const rnd = K.rng(1000 + s), v = net(A);
    for (let i = v.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
    const idx = new Map(A.map((r, i) => [r, v[i]])), m = fit(A, (r) => idx.get(r), model.cuts);
    const k = B.filter((r) => groupOf(score(r, m), m) === 'keep'); shuf.push({ n: k.length, mean: mean(net(k)) }); }
  const beaten = shuf.filter((x) => x.mean == null || keepMean > x.mean).length;
  const V = verdictOf({ keepMean, allMean, keepWelch, keepMonthT, beaten, avoidWelch, avoidMean });
  const G = (g, w) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, gstat(v, ...W[w])]));
  const levels = [];
  for (const f of FEATS) for (const k of LEVELS[f]) { const pick = (set) => set.filter((r) => levelsOf(r, model.cuts)[f] === k);
    levels.push({ f, k, value: r4(model.val[f][k] ?? 0), A: gstat(pick(A), ...W.A), B: gstat(pick(B), ...W.B) }); }
  const byYear = {};
  for (let yr = new Date(FROM * 1000).getUTCFullYear(); yr <= new Date((END - 1) * 1000).getUTCFullYear(); yr++) { const a = Date.UTC(yr, 0, 1) / 1000, b = Math.min(Date.UTC(yr + 1, 0, 1) / 1000, END);
    const set = rows.filter((r) => r.t >= a && r.t < b), g = split(set); byYear[yr] = { all: gstat(set, a, b), ...Object.fromEntries(Object.entries(g).map(([k, v]) => [k, gstat(v, a, b)])) }; }
  const sm = shuf.map((x) => x.mean).filter((x) => x != null).sort((p, q) => p - q);
  return { ...V, model, n: { A: A.length, B: B.length }, all: { A: gstat(A, ...W.A), B: gstat(B, ...W.B) }, groups: { A: G(GA, 'A'), B: G(GB, 'B') },
    test: { keepMean: r4(keepMean), allMean: r4(allMean), keepWelch: r2(keepWelch), keepMonthT: r2(keepMonthT), avoidMean: r4(avoidMean), avoidWelch: r2(avoidWelch),
      keepWelchA: r2(welch(net(GA.keep), net([...GA.mid, ...GA.avoid]))), avoidWelchA: r2(welch(net(GA.avoid), net([...GA.keep, ...GA.mid]))) },
    placebo: { seeds: SHUFFLES, need: NEED, beaten, min: r4(sm[0]), median: r4(sm[sm.length >> 1]), max: r4(sm[sm.length - 1]) }, levels, byYear };
}

// ---- features of each trade, from candles closed before the fill and the order itself -----------------------------------------
function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }
const firstAt = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };
const keyOf = (r) => [r.t, r.side, r.entry, r.stop].join('|');
export function erAt(D, i, n = MOVE_N) { if (i < n) return null; let p = 0; for (let j = i - n + 1; j <= i; j++) p += Math.abs(D[j].c - D[j - 1].c); return p > 0 ? Math.abs(D[i].c - D[i - n].c) / p : 0; }

// trades(M5) of dom-gold-hourcost with their features attached; throws when a trade has no signal behind it
export function withFeatures(M5, prof) {
  const { rows, walkMismatch } = trades(M5);
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), X = exclusions('xau'), D = K.resample(M5, 86400);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const pre = new Float64Array(H.length + 1); for (let i = 0; i < H.length; i++) pre[i + 1] = pre[i] + H[i].c;
  // the same walk as trades(): each signal's order and fill, so a trade is tied to its zone and touch
  const sig = new Map();
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, FROM)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost0 / 2 - 0.25 * A[li] : z.top + cost0 / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost0)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, CAP, null);
    if (!r || r.risk < cost0 || r.t < FROM || bad(r.t)) continue;
    const k = keyOf({ t: r.t, side: d, entry, stop }), q = sig.get(k) || []; q.push({ z, ts }); sig.set(k, q);
  }
  const out = []; let twins = 0;
  for (const row of rows) {
    const q = sig.get(keyOf(row)); if (!q || !q.length) throw new Error('a trade has no signal: ' + keyOf(row));
    const fs_ = q.map(({ z, ts }) => featuresOf(row, z, ts, { M5, H, D, A, pre, prof }));
    if (q.length > 1) { twins++; if (!fs_.every((x) => JSON.stringify(x) === JSON.stringify(fs_[0]))) throw new Error('two signals with one order and different features: ' + keyOf(row)); }
    q.shift();
    if (!row.ex[EXIT]) continue;
    out.push({ t: row.t, side: row.side, entry: row.entry, stop: row.stop, risk: row.risk, R: row.ex[EXIT].R, te: row.ex[EXIT].te, net: row.ex[EXIT].R - costR(row, EXIT, prof, ROUTE), ...fs_[0] });
  }
  return { rows: out, raw: rows, walkMismatch, twins };
}
export function featuresOf(row, z, ts, { M5, H, D, A, pre, prof }) {
  const t = row.t, d = row.side, fi = firstAt(M5, t), li = K.closedCount(H, t) - 1, di = K.closedCount(D, t) - 1;
  if (li < SMA_N - 1 || di < MOVE_N || !(A[li] > 0)) throw new Error('not enough candles before ' + t);
  const M = medRange(M5, fi - 1);                                  // the 12 five-minute candles CLOSED before the fill candle
  const hour = new Date(t * 1000).getUTCHours();
  const sma = (pre[li + 1] - pre[li + 1 - SMA_N]) / SMA_N;
  // combo-grid-3: the two H1 candles after the zone formed did not touch it (known when the order was placed, at the touch)
  const sideways = z.i + 2 < H.length && H[z.i + 2].e <= ts && !(H[z.i + 1].l <= z.top && H[z.i + 1].h >= z.bot) && !(H[z.i + 2].l <= z.top && H[z.i + 2].h >= z.bot);
  return { costShare: ((prof[hour].frac + COMMISSION) * row.fill + SLIP * M) / row.risk, stopAtr: row.risk / A[li], sideways,
    trend: Math.sign(H[li].c - sma) === d ? 'with' : 'against', move20: Math.sign(D[di].c - D[di - MOVE_N].c) === d ? 'with' : 'against', er: erAt(D, di), age: li - z.i };
}

// ---- the run -----------------------------------------------------------------------------------------------------------------
const f = (v, d = 3) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
const cell = (s) => `${s.n} / ${f(s.net)} (${s.t ?? 'n/a'}) / ${f(s.before)}`;
export function verdictLine(res) {
  const k = res.groups.B.keep, a = res.groups.B.avoid, T = res.test;
  const tail = res.verdict === 'PASS' ? `better than the rest by Welch t ${T.keepWelch}, and it beat ${res.placebo.beaten} of ${res.placebo.seeds} shuffled refits`
    : res.verdict === 'USEFUL TO AVOID' ? `not a better set (against the rest Welch t ${T.keepWelch}; ${res.placebo.beaten} of ${res.placebo.seeds} shuffled refits beaten), but the avoided third lost ${f(a.net)}R (n ${a.n}) and is worse than the rest by Welch t ${T.avoidWelch}`
    : `against the rest Welch t ${T.keepWelch}, ${res.placebo.beaten} of ${res.placebo.seeds} shuffled refits beaten; the avoided third made ${f(a.net)}R (n ${a.n}, against the rest Welch t ${T.avoidWelch})`;
  return `**Verdict: ${res.verdict}. On 2024 to now the kept third made ${f(k.net)}R a trade after costs (n ${k.n}, month t ${k.t}) against ${f(res.all.B.net)}R for all trades; ${tail}.**`;
}
function writeReport(res) {
  const { A, B } = res.groups, T = res.test, yrs = Object.keys(res.byYear);
  const same = (x) => (x.A.net != null && x.B.net != null && Math.sign(x.A.net - res.all.A.net) === Math.sign(x.B.net - res.all.B.net) ? 'yes' : 'no');
  const L = ['# DOM zone on gold: can the better trades be told apart at the fill? (result)', '', verdictLine(res), '',
    `Built ${res.built}. Pre-registered (PREREGISTRATION.md, committed alone before any figure). Paper research only; nothing live changed, no rule is proposed.`, '',
    '## What was run', '',
    `The trades are \`dom-gold-hourcost\`'s own list (the H1 dominant-zone limit on gold, OANDA mid 5-minute candles to ${res.dataEnd.slice(0, 10)}), 4R exit, R after costs = R less the demo broker's measured spread of the fill and exit hours, commission, 0.05 x M stop slippage and long financing (route C1). Ten features known at the fill were turned into levels; on window A (fills 2021-23, ${res.n.A} trades) each level got the value (its mean R after costs less the mean of all A trades) x n / (n + 200), and a trade's score is the sum of its ten values. The terciles of the A scores (${res.model.scoreCuts.map((x) => x.toFixed(4)).join(' and ')}) split window B (fills 2024 to now, ${res.n.B} trades) with nothing refitted: KEEP = top third, AVOID = bottom third, MID = the rest.`, '',
    `Gates: the exit walk agrees with the grid's on every trade (${res.gates.G1 ? 'yes' : 'NO'}); the trade list is the hourcost study's (${res.all.A.n} and ${res.all.B.n} trades, ${f(res.all.A.net)}R and ${f(res.all.B.net)}R after costs; that study published ${res.gates.hourcost.publishedA.n} and ${res.gates.hourcost.publishedB.n} on candles to ${res.gates.hourcost.dataEnd.slice(0, 16).replace('T', ' ')} UTC, this cache ends ${res.dataEnd.slice(0, 16).replace('T', ' ')} UTC; gate G2 ${res.gates.G2 ? 'holds' : 'FAILS'}); the cost profile is the probe file of that study (${res.gates.probe ? 'yes' : 'NO'}).`, '',
    '## The three groups', '', 'n / R a trade after costs (month t) / R before costs', '', '| Group | 2021-23 (where the score was fitted) | 2024-now (the test) |', '|---|---|---|',
    `| all | ${cell(res.all.A)} | ${cell(res.all.B)} |`, ...['keep', 'mid', 'avoid'].map((k) => `| ${k.toUpperCase()} | ${cell(A[k])} | ${cell(B[k])} |`), '',
    '## The test on 2024-now', '', '| Condition | Result | Met |', '|---|---|---|',
    `| (a) KEEP above all trades, and KEEP minus the rest Welch t >= 2 | ${f(T.keepMean)}R against ${f(T.allMean)}R; Welch t ${T.keepWelch} | ${res.a ? 'yes' : 'no'} |`,
    `| (b) KEEP month-sum t >= 2 and mean > 0 | t ${T.keepMonthT}, ${f(T.keepMean)}R | ${res.b ? 'yes' : 'no'} |`,
    `| (c) placebo: beats at least ${res.placebo.need} of ${res.placebo.seeds} shuffled refits | ${res.placebo.beaten} of ${res.placebo.seeds} | ${res.c ? 'yes' : 'no'} |`,
    `| USEFUL TO AVOID: AVOID minus the rest Welch t <= -2 and AVOID mean < 0 | ${f(T.avoidMean)}R; Welch t ${T.avoidWelch} | ${(T.avoidWelch ?? 0) <= -2 && T.avoidMean < 0 ? 'yes' : 'no'} |`, '',
    `Placebo: with the 2021-23 outcomes shuffled among the 2021-23 trades and the score refitted, the "kept" third of 2024-now made between ${f(res.placebo.min)}R and ${f(res.placebo.max)}R a trade (median ${f(res.placebo.median)}R) over ${res.placebo.seeds} seeds; the real kept third (${f(T.keepMean)}R) beat ${res.placebo.beaten} of them. In sample (2021-23, descriptive): KEEP against the rest Welch t ${T.keepWelchA}, AVOID against the rest ${T.avoidWelchA}.`, '',
    '## By year (R a trade after costs, n)', '', '| Year | all | KEEP | MID | AVOID |', '|---|---|---|---|---|',
    ...yrs.map((y) => `| ${y} | ${['all', 'keep', 'mid', 'avoid'].map((k) => `${f(res.byYear[y][k].net)} (${res.byYear[y][k].n})`).join(' | ')} |`), '',
    '## Every feature level, both windows (descriptive)', '', 'n / R after costs (month t) / R before costs. "Value" is the level\'s fitted share of the score. "Same side" = the level sits on the same side of its window\'s average in both windows.', '',
    '| Feature | Level | Value | 2021-23 | 2024-now | Same side |', '|---|---|---|---|---|---|',
    ...res.levels.map((x) => `| ${x.f} | ${x.k} | ${f(x.value, 4)} | ${cell(x.A)} | ${cell(x.B)} | ${same(x)} |`), '',
    `Tercile cuts from 2021-23: cost share ${res.model.cuts.cost.map((x) => x.toFixed(4)).join(' and ')}; stop / ATR ${res.model.cuts.stop.map((x) => x.toFixed(3)).join(' and ')}; efficiency ratio ${res.model.cuts.er.map((x) => x.toFixed(3)).join(' and ')}.`, '',
    '## Cut test', '',
    ...res.cut.map((c) => `- Candles cut at ${c.cut}: ${c.compared} trades that ended before it, with their exits and all their features, ${c.same ? 'identical' : 'DIFFERENT'} when later candles are removed.`), '',
    '## How the pre-registration was read', '',
    '- Cost share: M is the median range of the 12 five-minute candles closed before the fill candle (the cost itself uses 12 candles ending with the fill candle, which is not closed at the fill).',
    '- Sideways: combo-grid-3\'s definition, read when the order was placed (the start of the candle that touched the zone), which is at or before the fill.',
    '- Daily candles are UTC calendar days built from the 5-minute candles, the short Sunday reopen candle included as a day (as written: "UTC daily").',
    '- Weekday: a fill in the Sunday reopen hours (22:00-24:00 UTC) counts as Monday.',
    '- H1 trend and the 20-day move: "with" needs the sign to equal the side; an exact tie counts as against.',
    '- Month-sum t: every calendar month of the window (or year), empty months as zero.',
    `- Every trade was tied to its zone by fill time, side, entry and stop; ${res.twins ? res.twins + ' trades share those with another signal, with identical features' : 'no two signals share them'}.`, '',
    '## What it means', '',
    ...meaning(res), ''];
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), L.join('\n'));
}
function meaning(res) {
  const { B } = res.groups, T = res.test, out = [];
  if (res.verdict === 'PASS') out.push(`The score fitted on 2021-23 picked a better third on 2024-now: ${f(B.keep.net)}R a trade after costs against ${f(B.mid.net)}R and ${f(B.avoid.net)}R for the other two thirds. That meets the pre-registered bar, and it is a hypothesis for the forward demo record, nothing more.`,
    ...(B.avoid.net > B.mid.net ? ['', `Read it with care: the score does not order the trades. The third it said to avoid made ${f(B.avoid.net)}R a trade on 2024-now, more than the middle third (${f(B.mid.net)}R) and above zero, while in 2021-23 it was the worst (${f(res.groups.A.avoid.net)}R). So the bottom of the score did not carry over at all; only the top did. A score that works at one end and is upside down at the other is weaker evidence than the verdict word suggests.`] : []));
  else if (res.verdict === 'USEFUL TO AVOID') out.push(`The filter does not find a better set of trades: the kept third (${f(B.keep.net)}R) is not reliably above the rest. It does name a worse third: the avoided trades lost ${f(B.avoid.net)}R a trade after costs on 2024-now, below the rest by Welch t ${T.avoidWelch}. That is a hypothesis about which trades to skip, for the forward demo record to check.`);
  else out.push(`The filter fails. What is known at the fill, taken together and fitted on 2021-23, does not separate the better gold trades from the worse ones on 2024-now: KEEP ${f(B.keep.net)}R, MID ${f(B.mid.net)}R, AVOID ${f(B.avoid.net)}R a trade after costs (KEEP against the rest Welch t ${T.keepWelch}; AVOID against the rest ${T.avoidWelch}).`);
  out.push('', `All trades made ${f(res.all.A.net)}R a trade after costs in 2021-23 and ${f(res.all.B.net)}R in 2024-now, so most of what any group shows on 2024-now is the window itself, not the selection.`,
    '', 'These are in-sample years: 2020-26 has been read by the grids that chose this family, and the costs are one demo broker\'s quotes on mid candles (at the broker\'s own ticks the limit filled worse). Whatever the verdict, this is not an edge and no rule follows from it. One run; no feature, level, shrinkage or cut is changed after it, and no variant is tried on these years.');
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const prof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).hourProfile;
  for (let h = 0; h < 24; h++) if (!(prof[h] && prof[h].frac > 0 && prof[h].frac90 > 0)) throw new Error('hour ' + h + ' has no measured spread');
  const hc = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'dom-gold-hourcost', 'result.json'), 'utf8'));
  const M5 = K.load('xau', '5m', { from: FROM - 200 * 86400 }); const END = M5[M5.length - 1].e;
  const full = withFeatures(M5, prof);
  const g2 = stat(full.raw, EXIT, prof, null, SPLIT, END), cA = stat(full.raw, EXIT, prof, ROUTE, FROM, SPLIT), cB = stat(full.raw, EXIT, prof, ROUTE, SPLIT, END);
  const gates = { G1: full.walkMismatch === 0, probe: JSON.stringify(prof.map((p) => p.frac)) === JSON.stringify(hc.probe.frac),
    G2: Math.abs(g2.n - GRID_GOLD_4R_B.n) / GRID_GOLD_4R_B.n <= 0.02 && Math.abs(g2.gross - GRID_GOLD_4R_B.before) <= 0.01,
    hourcost: { A: cA, B: cB, publishedA: hc.table[EXIT].A.C1, publishedB: hc.table[EXIT].B.C1, dataEnd: hc.dataEnd } };
  // cut test: G3 of dom-gold-hourcost (the trades and their exits) and, with it, every feature
  const key = (r) => JSON.stringify(r);
  const cut = CUTS.map((c) => { const C = Date.parse(c + 'T00:00:00Z') / 1000; const part = withFeatures(M5.filter((b) => b.e <= C), prof).rows;
    const a = full.rows.filter((r) => r.t + CAP + 600 <= C).map(key), b = new Set(part.filter((r) => r.t + CAP + 600 <= C).map(key));
    return { cut: c, compared: a.length, same: a.length === b.size && a.every((k) => b.has(k)) }; });
  gates.G3 = cut.every((x) => x.same);
  console.log(JSON.stringify({ gates, cut, twins: full.twins, n: full.rows.length }, null, 1));
  if (!(gates.G1 && gates.G2 && gates.G3 && gates.probe)) { console.error('STOPPED: a gate failed; nothing written'); process.exit(2); }
  const J = judge(full.rows, END);
  const res = { study: 'dom-gold-quality', built: '2026-11-26', verdict: J.verdict, a: J.a, b: J.b, c: J.c, avoid: J.avoid ?? null, dataEnd: new Date(END * 1000).toISOString(), exit: EXIT, route: ROUTE,
    shrink: SHRINK, gates, cut, twins: full.twins, n: J.n, all: J.all, groups: J.groups, test: J.test, placebo: J.placebo, model: J.model, levels: J.levels, byYear: J.byYear,
    caution: '2020-26 has been read by the grids that chose this family; even a pass is a hypothesis for the forward demo record, never an edge.' };
  res.line = verdictLine(res);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  writeReport(res);
  console.log(res.line);
  console.log(JSON.stringify({ groups: J.groups, test: J.test, placebo: J.placebo }, null, 1));
}
