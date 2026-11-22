// ltf-structure: H1 + M15 + M5 structure with the trade as an entry permission (condition P). Pre-registered in
// PREREGISTRATION.md (committed first). Paper research: nothing live reads it. One run, no variants.
//   node research/edge/ltf-structure/run.mjs run <trades dir> <candles dir>
// <trades dir> holds partial-<market>.json (research/edge/desk-partial), <candles dir> <market>-5m.json.gz (desk-rigor fetch).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { stats, monthDiff, pOne, NAME, GROUPS, DESKS } from '../desk-exits/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
export const IS = [T('2020-01-01'), T('2024-01-01')], OOS = [T('2024-01-01'), T('2026-01-01')];
export const MARKETS = ['xau', 'eurusd', 'gbpusd'];
export const TF = { h1: 3600, m15: 900, m5: 300 };
export const P = { N: 6, fresh: 6 * 3600, minGroup: 100, minWith: 30, cuts: 200 };

// ─── candles ───
export function group(M5, sec) {
  const o = [];
  for (const b of M5) { const t = b.time - (b.time % sec), q = o[o.length - 1];
    if (q && q.time === t) { if (b.high > q.high) q.high = b.high; if (b.low < q.low) q.low = b.low; q.close = b.close; }
    else o.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); }
  return o;
}

// ─── condition P ───
// the events of one timeframe as [{ k: the time the break was known, dir, structure }], oldest first
export const knownEvents = (events, bars, sec) => events.map((e) => ({ k: bars[e.breakIdx].time + sec, dir: e.dir, structure: e.structure === true }));
export function lastKnown(list, t) {                       // the last event known at or before t, else null
  let lo = 0, hi = list.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m].k <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? null : list[r];
}
export function holdsP(side, ev, t) {                      // ev = { h1, m15, m5 } lists of knownEvents
  const s = side > 0 ? 1 : -1, h = lastKnown(ev.h1, t), m = lastKnown(ev.m15, t), l = lastKnown(ev.m5, t);
  return !!(h && m && l && h.dir === s && m.dir === s && m.structure === true && t - m.k <= P.fresh && l.dir === s);
}
export function eventsOf(F, M5) {                          // whole-series reading of the three timeframes
  const out = {}; for (const [k, sec] of Object.entries(TF)) { const bars = sec === 300 ? M5 : group(M5, sec); out[k] = knownEvents(F.msAnalyze(bars, P.N).events, bars, sec); }
  return out;
}
// events known by a random cut on the whole series against the series cut there (candles closed by the cut). Returns the mismatches.
export function causalCheck(F, bars, sec, cuts, rnd) {
  const key = (l, cut) => l.filter((e) => e.k <= cut).map((e) => `${e.k}|${e.dir}|${e.structure}`).join(',');
  const whole = knownEvents(F.msAnalyze(bars, P.N).events, bars, sec); let bad = 0;
  for (let c = 0; c < cuts; c++) {
    const i = Math.min(bars.length - 1, 30 + Math.floor(rnd() * (bars.length - 30))), cut = bars[i].time + Math.floor(rnd() * sec), part = bars.filter((b) => b.time + sec <= cut);
    if (key(whole, cut) !== key(knownEvents(F.msAnalyze(part, P.N).events, part, sec), cut)) bad++;
  }
  return bad;
}
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ─── statistics ───
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(4));
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return { diff: a.length && b.length ? r4(mean(a) - mean(b)) : null, t: null };
  const ma = mean(a), mb = mean(b), va = a.reduce((s, v) => s + (v - ma) ** 2, 0) / (a.length - 1), vb = b.reduce((s, v) => s + (v - mb) ** 2, 0) / (b.length - 1), se = Math.sqrt(va / a.length + vb / b.length);
  return { diff: r4(ma - mb), t: se > 0 ? +((ma - mb) / se).toFixed(2) : null };
}
const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const p2 = (t) => (t == null ? 1 : Math.min(1, 2 * pOne(Math.abs(t))));
export function holm(tests, key) {
  const ord = tests.map((t, i) => [t[key], i]).sort((a, b) => a[0] - b[0]); let run = 0;
  ord.forEach(([p, i], j) => { run = Math.max(run, Math.min(1, p * (ord.length - j))); tests[i][key + 'Holm'] = +run.toFixed(4); });
}
function side(rows, flag) {                                // one group, one window: with / without the flag
  const view = (g) => g.map((r) => ({ t: r.t, net: r.net, gross: r.booked }));
  const w = view(rows.filter((r) => r[flag])), o = view(rows.filter((r) => !r[flag]));
  const cut = (v) => { const n = stats(v, 'net'), g = stats(v, 'gross'); return { n: v.length, mean: n.mean ?? null, gross: g.mean ?? null, win: n.win ?? null, months: n.months ?? 0, tMonth: n.tMonth ?? null }; };
  return { n: rows.length, share: rows.length ? +(100 * w.length / rows.length).toFixed(1) : null, with: cut(w), without: cut(o),
    diff: welch(w.map((r) => r.net), o.map((r) => r.net)), month: monthDiff(w, o) };
}
export function evaluate(rows, flag) {
  const keys = DESKS.flatMap((d) => GROUPS[d]), inW = (r, w) => r.t >= w[0] && r.t < w[1], groups = [];
  for (const k of keys) { const g = rows.filter((r) => r.kind === k); if (g.filter((r) => inW(r, OOS)).length >= P.minGroup) groups.push([k, NAME[k], g]); }
  groups.push(['pool', 'Pool: every trade', rows]);
  const out = groups.map(([k, name, g]) => ({ group: k, name, is: side(g.filter((r) => inW(r, IS)), flag), oos: side(g.filter((r) => inW(r, OOS)), flag) }));
  const tests = []; for (const o of out) { o.pA = p2(o.oos.with.tMonth); o.pB = p2(o.oos.month.t); tests.push({ o, k: 'pA', p: o.pA }, { o, k: 'pB', p: o.pB }); }
  holm(tests, 'p'); for (const t of tests) t.o[t.k + 'Holm'] = t.pHolm;
  for (const o of out) {
    const a = o.oos.with, enough = a.n >= P.minWith;
    o.checks = { oosProfit: enough && a.mean > 0 && a.tMonth != null && a.tMonth >= 2 && o.pAHolm < 0.05, isProfit: o.is.with.n > 0 && o.is.with.mean > 0,
      diffBoth: o.is.diff.diff != null && o.is.diff.diff > 0 && o.oos.diff.diff != null && o.oos.diff.diff > 0, enough };
    o.pass = o.checks.oosProfit && o.checks.isProfit && o.checks.diffBoth && o.checks.enough;
  }
  return out;
}

// ─── the report ───
const f3 = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const tt = (v) => (v == null ? 'n/a' : String(v));
export function report(res) {
  const L = ['# Lower-timeframe structure as an entry permission (22 Nov 2026)', '',
    `**Verdict: ${res.verdict}.** ${res.headline}`, '',
    'Pre-registered (PREREGISTRATION.md, committed before any result). Condition P: at the entry, the last H1 break known is with the trade, the last M15 break known is a structure shift with the trade made known at most 6 hours before, and the last M5 break known is with the trade (the page\'s own structure function, 6 candles a side, candles closed by the entry only). The desks\' own trades on gold, EUR/USD and GBP/USD, taken as booked; R a trade AFTER the desk-rigor costs; in sample 2020-2023, out of sample 2024-2025; t on calendar-month sums. Paper research only.', '',
    `Trades: ${res.n} (${res.left} left out by the trade builder). P holds on ${res.kept.all} % of them (in sample ${res.kept.is} %, out of sample ${res.kept.oos} %). No-look-ahead check: ${res.causal.cuts} random cuts, ${res.causal.mismatches} mismatches; structure read ${res.causal.method}.`, '',
    '## Out of sample 2024-2025 (the verdict)', '',
    '| Group | n | P keeps | With P: n | net R | month t | Holm p | Without P: n | net R | month t | Difference | Welch t | Paired months (t) | Holm p | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const o of res.groups) { const s = o.oos;
    L.push(`| ${o.name} | ${s.n} | ${s.share} % | ${s.with.n} | ${f3(s.with.mean)} | ${tt(s.with.tMonth)} | ${o.pAHolm} | ${s.without.n} | ${f3(s.without.mean)} | ${tt(s.without.tMonth)} | ${f3(s.diff.diff)} | ${tt(s.diff.t)} | ${f3(s.month.diff)} (${tt(s.month.t)}) | ${o.pBHolm} | ${o.pass ? 'PASS' : 'FAIL'}${o.checks.enough ? '' : ' (too few)'} |`); }
  L.push('', '## In sample 2020-2023', '', '| Group | n | P keeps | With P: n | net R | month t | Without P: n | net R | month t | Difference | Welch t | Paired months (t) |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const o of res.groups) { const s = o.is;
    L.push(`| ${o.name} | ${s.n} | ${s.share} % | ${s.with.n} | ${f3(s.with.mean)} | ${tt(s.with.tMonth)} | ${s.without.n} | ${f3(s.without.mean)} | ${tt(s.without.tMonth)} | ${f3(s.diff.diff)} | ${tt(s.diff.t)} | ${f3(s.month.diff)} (${tt(s.month.t)}) |`); }
  L.push('', '## Before costs, with P (reported, no verdict)', '', '| Group | IS n | IS R before costs | OOS n | OOS R before costs |', '|---|---|---|---|---|');
  for (const o of res.groups) L.push(`| ${o.name} | ${o.is.with.n} | ${f3(o.is.with.gross)} | ${o.oos.with.n} | ${f3(o.oos.with.gross)} |`);
  L.push('', '## Placebo: the structure AGAINST the trade', '',
    `The same condition for the opposite side (H1, a fresh M15 structure shift and M5 all against the trade), same groups and bar. Passing groups: ${res.placeboPass.length ? res.placeboPass.join(', ') : 'none'}.`, '',
    '| Group | IS n | IS net R | IS difference | OOS n | OOS net R | month t | Holm p | OOS difference | Welch t | Verdict |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const o of res.placebo) L.push(`| ${o.name} | ${o.is.with.n} | ${f3(o.is.with.mean)} | ${f3(o.is.diff.diff)} | ${o.oos.with.n} | ${f3(o.oos.with.mean)} | ${tt(o.oos.with.tMonth)} | ${o.pAHolm} | ${f3(o.oos.diff.diff)} | ${tt(o.oos.diff.t)} | ${o.pass ? 'PASS' : 'FAIL'} |`);
  L.push('', '## Reading it', '', ...res.reading.map((x) => '- ' + x), '',
    '## Limits', '',
    '- The trades are each desk\'s reading as its code stood on 21 Nov 2026 (the desk-partial run); the desks have changed since.',
    '- Each trade is taken as booked, alone: a desk that skipped the trades without P would have held other positions.',
    '- Groups share months and markets, and the pool is mostly Mosha barrier entries.',
    '- Three markets, OANDA mid 5-minute candles (M15 and H1 built from them); today\'s cost model charged on every year.',
    '- One run, no variants: by the pre-registration no other timeframes, look-backs or freshness windows are tried on 2020-2025.',
    '- Nothing live changed. A pass would only have been a candidate for a forward paper record.', '');
  return L.join('\n');
}

async function main() {
  const [cmd, tdir, cdir] = process.argv.slice(2);
  if (cmd !== 'run' || !tdir || !cdir) throw new Error('usage: run.mjs run <trades dir> <candles dir>');
  const { loadFns } = await import('../../../council/mosha-desk.mjs'), F = loadFns(), rnd = rng(20261122);
  let rows = [], left = 0, mismatches = 0, cuts = 0;
  for (const mk of MARKETS) {
    const M5 = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(cdir, `${mk}-5m.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    for (const sec of Object.values(TF)) { mismatches += causalCheck(F, sec === 300 ? M5 : group(M5, sec), sec, P.cuts, rnd); cuts += P.cuts; }
    if (mismatches) throw new Error(`no-look-ahead check failed (${mismatches}): the whole-series reading cannot be used`);
    const ev = eventsOf(F, M5), j = JSON.parse(fs.readFileSync(path.join(tdir, `partial-${mk}.json`), 'utf8')); left += j.left;
    for (const r of j.rows) { if (!(r.t >= IS[0] && r.t < OOS[1])) continue;
      rows.push({ kind: r.kind, market: mk, t: r.t, booked: r.booked, net: r.booked - r.costR, p: holdsP(r.side, ev, r.t), q: holdsP(-r.side, ev, r.t) }); }
    console.log(mk, 'events', ev.h1.length, ev.m15.length, ev.m5.length, 'trades', j.rows.length);
  }
  const groups = evaluate(rows, 'p'), placebo = evaluate(rows, 'q'), placeboPass = placebo.filter((o) => o.pass).map((o) => o.name);
  const passing = groups.filter((o) => o.pass && !placeboPass.includes(o.name)), pct = (g) => +(100 * g.filter((r) => r.p).length / g.length).toFixed(1);
  const pool = groups.find((o) => o.group === 'pool'), posOos = groups.filter((o) => o.oos.with.mean > 0).length, betterBoth = groups.filter((o) => o.checks.diffBoth).length;
  const res = { study: 'ltf-structure', built: '2026-11-22',
    system: 'Lower-timeframe structure (H1, a fresh M15 structure shift and M5 all with the trade) as an entry permission on the paper desks\' own trades; gold, EUR/USD, GBP/USD 2020-2025 (out of sample 2024-2025); OANDA mid 5m; after the desk-rigor costs.',
    verdict: passing.length ? 'PASS' : 'FAIL',
    headline: `${passing.length} of ${groups.length} groups pass. Pool out of sample with the condition: ${f3(pool.oos.with.mean)}R a trade after costs (n ${pool.oos.with.n}, month t ${tt(pool.oos.with.tMonth)}); without it ${f3(pool.oos.without.mean)}R (n ${pool.oos.without.n}); difference ${f3(pool.oos.diff.diff)}R (Welch t ${tt(pool.oos.diff.t)}).`,
    n: rows.length, left, kept: { all: pct(rows), is: pct(rows.filter((r) => r.t < IS[1])), oos: pct(rows.filter((r) => r.t >= OOS[0])) },
    causal: { cuts, mismatches, method: 'once over each whole series (the check passed)' },
    groups, placebo, placeboPass };
  res.reading = [
    `Out of sample the trades with P are net positive in ${posOos} of ${groups.length} groups; ${groups.filter((o) => o.checks.oosProfit).length} reach month t >= 2 after Holm.`,
    `With P beats without P in both windows in ${betterBoth} of ${groups.length} groups (trade-level difference of means); the largest out-of-sample Welch t is ${Math.max(...groups.map((o) => o.oos.diff.t ?? -Infinity))}.`,
    `Mosha barrier entry, the group the 2026 split pointed at: out of sample ${f3(groups.find((o) => o.group === 'barrier').oos.with.mean)}R with P (n ${groups.find((o) => o.group === 'barrier').oos.with.n}) against ${f3(groups.find((o) => o.group === 'barrier').oos.without.mean)}R without.`,
    passing.length ? 'A pass is a candidate for a forward paper record, never a live rule without the owner.' : 'The question is closed on these years: no variant of the condition is run on 2020-2025.'];
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(res.verdict, res.headline);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch((e) => { console.error(e); process.exit(1); });
