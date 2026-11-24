// Edge research · vb-early-exec: T1's early (fill candle before 06:00 UTC) against late fills, at the demo broker's own fills
// (PREREGISTRATION.md, pushed alone first). The broker result of each trade is the exec studies' own `brokerTrade` (imported,
// not edited) on the same tick-probe files they reported from.
//   node research/edge/vb-early-exec/run.mjs fetch <dir>   (git show of the four probe files at the commits the studies name)
//   node research/edge/vb-early-exec/run.mjs run <dir>     -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as G from '../gold-vol-breakout-exec/run.mjs';
import * as U from '../usdjpy-vol-breakout-exec/run.mjs';
import { pFromT, holm } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const CUT_S = 6 * 3600, MIN_SIDE = 60;
export const PROBES = {
  'xau.json': ['a00d5984d', 'research/probe/ticks-XAUUSD.json'], 'xau-x.json': ['5d2ae2dcd', 'research/probe/ticks-XAUUSD-x.json'],
  'uj-a.json': ['02a36d2f9', 'research/probe/ticks-USDJPY-exec-a.json'], 'uj-b.json': ['00aa6bc59', 'research/probe/ticks-USDJPY-exec-b.json'],
};
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sdOf = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };

// the pre-registered split: the T1 fill candle (OANDA M5) starts before 06:00 UTC of the trade's UTC day
export const isEarly = (tr) => tr.fillT - tr.d0 < CUT_S;
// reported only: the broker's entry tick time (ms) before 06:00 UTC of the day
export const isEarlyBroker = (tr, b) => b.filled && b.tickMs != null && b.tickMs / 1000 - tr.d0 < CUT_S;

export function welch(a, b) {
  const ma = mean(a), mb = mean(b), va = sdOf(a) ** 2 / a.length, vb = sdOf(b) ** 2 / b.length, se = Math.sqrt(va + vb);
  if (!(se > 0)) return { diff: ma - mb, t: null, df: null, p: null };
  const t = (ma - mb) / se, df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  return { diff: ma - mb, t, df, p: pFromT(t, df) };
}
// month sums of net R over the months that hold a trade (the exec studies' monthT)
export function monthT(rows) {
  const m = new Map(); for (const x of rows) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); }
  const v = [...m.values()]; if (v.length < 2) return null; const s = sdOf(v); return s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null;
}
// the month check: per month with both, early mean minus late mean; the t of those differences
export function monthDiff(rows) {
  const m = new Map(); for (const x of rows) { const k = x.day.slice(0, 7), o = m.get(k) || { e: [], l: [] }; (x.early ? o.e : o.l).push(x.net); m.set(k, o); }
  const d = [...m.values()].filter((o) => o.e.length && o.l.length).map((o) => mean(o.e) - mean(o.l));
  const s = sdOf(d); return { months: d.length, mean: r4(mean(d)), t: r4(d.length > 1 && s > 0 ? mean(d) / (s / Math.sqrt(d.length)) : null) };
}

// the studies' rows, rebuilt exactly as their report modes build them
export function goldRows(P, X2, T) {
  const F = new Map((P.fills || []).map((f) => [f[0], f])), M = new Map((P.marks || []).map((m) => [m[0], m]));
  for (const m of X2.marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0 && M.get(m[0])[3] <= G.X_AGE)) M.set(m[0], m);
  return rowsOf(T, F, M, G.brokerTrade, G.X_AGE, 'xau');
}
export function yenRows(PS, T) {
  const F = new Map(PS.flatMap((x) => x.fills || []).map((f) => [f[0], f])), M = new Map(PS.flatMap((x) => x.marks || []).map((m) => [m[0], m]));
  return rowsOf(T, F, M, U.brokerTrade, U.X_AGE, 'usdjpy');
}
function rowsOf(T, F, M, brokerTrade, xAge, mk) {
  const rows = [];
  for (const tr of T) {
    const m = M.get(tr.d0 + 21 * 3600), X = m && m[1] > 0 && m[3] != null && m[3] <= xAge ? [m[1], m[2]] : null;
    const b = brokerTrade(tr, F, X); if (b.skip) continue;
    const e = F.get(`${tr.day}|e`);
    rows.push({ mk, day: tr.day, d0: tr.d0, fillT: tr.fillT, side: tr.side, net: b.net, filled: !!b.filled, early: isEarly(tr),
      earlyBroker: isEarlyBroker(tr, { ...b, tickMs: e && e[1] }) });
  }
  return rows;
}
function side(rows) { const v = rows.map((x) => x.net); return { n: rows.length, filled: rows.filter((x) => x.filled).length, net: r4(mean(v)), monthT: r4(monthT(rows)) }; }
function test(rows) {
  const E = rows.filter((x) => x.early), L = rows.filter((x) => !x.early), w = welch(E.map((x) => x.net), L.map((x) => x.net));
  const years = {}; for (const x of rows) { const y = x.day.slice(0, 4), o = years[y] || (years[y] = { e: [], l: [] }); (x.early ? o.e : o.l).push(x.net); }
  return { early: side(E), late: side(L), diff: r4(w.diff), t: r4(w.t), p: w.p, month: monthDiff(rows), thin: E.length < MIN_SIDE || L.length < MIN_SIDE,
    byYear: Object.fromEntries(Object.entries(years).map(([y, o]) => [y, { early: { n: o.e.length, net: r4(mean(o.e)) }, late: { n: o.l.length, net: r4(mean(o.l)) } }])) };
}
function brokerSplit(rows) {
  const f = rows.filter((x) => x.filled), E = f.filter((x) => x.earlyBroker), L = f.filter((x) => !x.earlyBroker), w = welch(E.map((x) => x.net), L.map((x) => x.net));
  return { early: side(E), late: side(L), diff: r4(w.diff), t: r4(w.t), moved: f.filter((x) => x.early !== x.earlyBroker).length };
}
export function verdictOf(T) {
  const { pooled, xau, usdjpy } = T;
  if (xau.thin || usdjpy.thin) return 'INCONCLUSIVE';
  return pooled.diff > 0 && pooled.t >= 2 && pooled.holm < 0.05 && xau.diff > 0 && usdjpy.diff > 0 && pooled.month.t > 0 ? 'PASS' : 'FAIL';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, dir] = process.argv.slice(2);
  if (mode === 'fetch') {
    fs.mkdirSync(dir, { recursive: true });
    for (const [f, [c, p]] of Object.entries(PROBES)) fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', `${c}:${p}`], { maxBuffer: 1 << 28 }));
    console.log('fetched', Object.keys(PROBES).join(', '));
  } else if (mode === 'run') {
    const gT = J(path.join(HERE, '../gold-vol-breakout-exec/trades.json')), uT = J(path.join(HERE, '../usdjpy-vol-breakout-exec/trades.json'));
    const gold = goldRows(J(path.join(dir, 'xau.json')), J(path.join(dir, 'xau-x.json')), gT);
    const yen = yenRows([J(path.join(dir, 'uj-a.json')), J(path.join(dir, 'uj-b.json'))], uT);
    // gate: each study's published n filled, net and month t
    const pub = { xau: J(path.join(HERE, '../gold-vol-breakout-exec/result.json')).stats, usdjpy: J(path.join(HERE, '../usdjpy-vol-breakout-exec/result.json')).stats };
    const got = { xau: side(gold), usdjpy: side(yen) };
    const gate = Object.fromEntries(Object.entries(got).map(([k, s]) => [k, { n: s.filled, net: s.net, monthT: s.monthT, published: { n: pub[k].n, net: pub[k].net, monthT: pub[k].monthT },
      ok: s.filled === pub[k].n && s.net === pub[k].net && s.monthT === pub[k].monthT }]));
    const gateOk = gate.xau.ok && gate.usdjpy.ok;
    const T = { pooled: test([...gold, ...yen]), xau: test(gold), usdjpy: test(yen) };
    const H = holm([T.pooled.p, T.xau.p, T.usdjpy.p]); ['pooled', 'xau', 'usdjpy'].forEach((k, i) => { T[k].holm = r4(H[i]); T[k].p = r4(T[k].p); });
    const v = gateOk ? verdictOf(T) : 'INCONCLUSIVE (gate missed)';
    const sg = (x) => (x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x}`);
    const line = (k) => `${k === 'xau' ? 'gold' : k === 'usdjpy' ? 'USD/JPY' : 'pooled'} early ${sg(T[k].early.net)}R (n ${T[k].early.n}) vs late ${sg(T[k].late.net)}R (n ${T[k].late.n}), difference ${sg(T[k].diff)}R, Welch t ${T[k].t}`;
    const verdict = `${v}: T1 at the demo broker's own fills, 24 Nov 2023 → Nov 2026, early (fill candle before 06:00 UTC) minus late: ${line('pooled')}, Holm p ${T.pooled.holm}; month t ${T.pooled.month.t}`;
    const R = { study: 'vb-early-exec', built: '2026-11-24', verdict, cut: '06:00 UTC', gate, tests: T, brokerTime: { xau: brokerSplit(gold), usdjpy: brokerSplit(yen), pooled: brokerSplit([...gold, ...yen]) },
      probes: Object.fromEntries(Object.entries(PROBES).map(([f, [c, p]]) => [f, `${p}@${c}`])) };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    const yr = (k) => Object.entries(T[k].byYear).map(([y, o]) => `| ${k === 'xau' ? 'gold' : 'USD/JPY'} | ${y} | ${o.early.n} | ${sg(o.early.net)} | ${o.late.n} | ${sg(o.late.net)} |`);
    const row = (k) => `| ${k === 'xau' ? 'gold' : k === 'usdjpy' ? 'USD/JPY' : 'pooled'} | ${T[k].early.n} | ${sg(T[k].early.net)} | ${T[k].early.monthT} | ${T[k].late.n} | ${sg(T[k].late.net)} | ${T[k].late.monthT} | ${sg(T[k].diff)} | ${T[k].t} | ${T[k].holm} | ${T[k].month.t} (${T[k].month.months} mo) |`;
    const bt = R.brokerTime;
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), [`# Early against late fills of the volatility breakout, at the broker's own fills (vb-early-exec, 24 Nov 2026)`, '',
      `**Verdict: ${verdict}**`, '',
      'Paper research only; nothing live changed. Method, split and bar fixed in `PREREGISTRATION.md`, pushed alone before the split was computed.', '',
      `Gate (each exec study's published figures reproduced from its own code and probe files): gold n ${gate.xau.n} / ${sg(gate.xau.net)}R / month t ${gate.xau.monthT} (${gate.xau.ok ? 'equal' : 'MISSED'}), USD/JPY n ${gate.usdjpy.n} / ${sg(gate.usdjpy.net)}R / month t ${gate.usdjpy.monthT} (${gate.usdjpy.ok ? 'equal' : 'MISSED'}).`, '',
      'R a trade after the broker\'s commission; a trade the broker never filled counts 0 in its group (as the exec studies counted it). Month t of early / late alone = t of their month sums; "month t" of the difference = t of (early month mean minus late month mean) over months with both.', '',
      '| Market | Early n | Early R | Early month t | Late n | Late R | Late month t | Early − late | Welch t | Holm p | Month t |', '|---|---|---|---|---|---|---|---|---|---|---|',
      row('pooled'), row('xau'), row('usdjpy'), '',
      `Reported only, the split on the broker's own entry tick time (filled trades): gold early ${sg(bt.xau.early.net)}R (n ${bt.xau.early.n}) vs late ${sg(bt.xau.late.net)}R (n ${bt.xau.late.n}), t ${bt.xau.t}; USD/JPY early ${sg(bt.usdjpy.early.net)}R (n ${bt.usdjpy.early.n}) vs late ${sg(bt.usdjpy.late.net)}R (n ${bt.usdjpy.late.n}), t ${bt.usdjpy.t}; ${bt.pooled.moved} trades change side between the two clocks.`, '',
      '| Market | Year | Early n | Early R | Late n | Late R |', '|---|---|---|---|---|---|', ...yr('xau'), ...yr('usdjpy'), '',
      `**What carries it.** The pooled bar is cleared just (Holm p ${T.pooled.holm}); gold's difference is ${sg(T.xau.diff)}R (t ${T.xau.t}) and USD/JPY's has the same sign but is small against its noise (${sg(T.usdjpy.diff)}R, t ${T.usdjpy.t}, month t ${T.usdjpy.month.t}). Late fills are still positive on both markets.`, '',
      '**Read with care.** These years are in sample for T1 (both exec studies read them, and the hour split was first seen on OANDA mid candles that include them). This measures the split at real execution; a PASS is a hypothesis for the forward records, never an edge or a rule change. Nothing live changed.', '',
      'To repeat: `node research/edge/vb-early-exec/run.mjs fetch <dir>`, then `node research/edge/vb-early-exec/run.mjs run <dir>`.', ''].join('\n'));
    console.log(verdict); console.log(JSON.stringify(gate));
  } else console.log('usage: run.mjs fetch <dir> | run <dir>');
}
