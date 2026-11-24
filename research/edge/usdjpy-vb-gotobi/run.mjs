// Edge research · usdjpy-vb-gotobi: does USD/JPY T1 (the volatility breakout) behave differently on gotobi days?
// Pre-registered in PREREGISTRATION.md (committed alone first). Paper research only; imports, never edits, the parent studies.
//   node research/edge/usdjpy-vb-gotobi/run.mjs            (reads the shared OANDA M5 cache through edgekit)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { charge, K } from '../fx-vol-breakout/run.mjs';
import { index, trade as gotobiTrade, stopDist, windowMove, draw } from '../gotobi/run.mjs';
import { isGotobi } from '../../../council/gotobi-calendar.mjs';
import { load, pFromT } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const W = { DISC: ['2005-01-01', '2014-12-31'], CONF: ['2015-01-01', '2099-12-31'] };
export const DRAWS = 2000, MIN_N = 200;
const inW = (d, [a, b]) => d >= a && d <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const vr = (a) => { const m = mean(a); return a.length > 1 ? a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1) : NaN; };
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null), r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// T1 trades over every day on file, exactly as usdjpy-vol-breakout-early's `trades`
export function t1Trades(days) {
  const tr = [];
  for (const d of days.filter((x) => !daySkip(x))) {
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    tr.push({ day: d.day, ...charge('usdjpy', x) });
  }
  return tr;
}
export function welch(a, b) {
  const va = vr(a) / a.length, vb = vr(b) / b.length, se = Math.sqrt(va + vb), d = mean(a) - mean(b);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1)), t = d / se;
  return { diff: d, t, df, p: pFromT(t, df) };
}
// month-level t of (mean gotobi net - mean other net) in months holding both
export function monthDiffT(g, o) {
  const by = (tr) => { const m = new Map(); for (const x of tr) { const k = x.day.slice(0, 7); (m.get(k) || m.set(k, []).get(k)).push(x.net); } return m; };
  const G = by(g), O = by(o), v = [];
  for (const [k, a] of G) if (O.has(k)) v.push(mean(a) - mean(O.get(k)));
  const s = Math.sqrt(vr(v));
  return { months: v.length, t: v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null };
}
// one test in one window: tr = the trades in scope (all, or sells only)
export function compare(tr, gotobi, seed) {
  const g = tr.filter((x) => gotobi(x.day)), o = tr.filter((x) => !gotobi(x.day)), w = welch(g.map((x) => x.net), o.map((x) => x.net));
  const days = tr.map((x) => x.day); let beat = 0;
  for (let s = 0; s < DRAWS; s++) {
    const pick = new Set(draw(days, g.length, seed + s));
    const a = [], b = []; for (const x of tr) (pick.has(x.day) ? a : b).push(x.net);
    if (Math.abs(mean(a) - mean(b)) >= Math.abs(w.diff)) beat++;
  }
  return { gotobi: { n: g.length, netR: r3(mean(g.map((x) => x.net))), grossR: r3(mean(g.map((x) => x.R))) },
    other: { n: o.length, netR: r3(mean(o.map((x) => x.net))), grossR: r3(mean(o.map((x) => x.R))) },
    diff: r3(w.diff), welchT: r2(w.t), p: w.p, month: (({ months, t }) => ({ months, t: r2(t) }))(monthDiffT(g, o)),
    placeboShare: r3(beat / DRAWS) };
}
function corr(a, b) { const ma = mean(a), mb = mean(b); let sab = 0, sa = 0, sb = 0; a.forEach((x, i) => { sab += (x - ma) * (b[i] - mb); sa += (x - ma) ** 2; sb += (b[i] - mb) ** 2; }); return sab / Math.sqrt(sa * sb); }
function monthT(rows) {
  const m = new Map(); for (const [d, v] of rows) m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) || 0) + v);
  const v = [...m.values()], s = Math.sqrt(vr(v)); return v.length > 1 && s > 0 ? mean(v) / (s / Math.sqrt(v.length)) : null;
}

export function study(rows) {
  const days = buildDays(rows), last = days.at(-1).day, tr = t1Trades(days);
  const ix = index(rows), moves = new Map(), moveOf = (d) => { if (!moves.has(d)) moves.set(d, windowMove(ix, 'fade', d)); return moves.get(d); };
  const out = { tests: {}, book: {} };
  for (const [wk, win] of Object.entries(W)) {
    const inw = tr.filter((x) => inW(x.day, win));
    out.tests[wk] = { G1: compare(inw, isGotobi, 1000), G2: compare(inw.filter((x) => x.side === -1), isGotobi, 5000) };
    // G3, descriptive: T1 and the gotobi fade on gotobi days with both trades
    const pairs = [];
    for (const x of inw.filter((y) => isGotobi(y.day))) { const f = gotobiTrade(ix, 'fade', x.day, stopDist(moveOf, x.day)); if (f) pairs.push([x.day, x.net, f.net]); }
    out.book[wk] = { days: pairs.length, corr: r3(corr(pairs.map((p) => p[1]), pairs.map((p) => p[2]))),
      t1NetR: r3(mean(pairs.map((p) => p[1]))), fadeNetR: r3(mean(pairs.map((p) => p[2]))),
      bookNetR: r3(mean(pairs.map((p) => p[1] + p[2]))), bookMonthT: r2(monthT(pairs.map((p) => [p[0], p[1] + p[2]]))) };
  }
  // Holm over G1, G2 confirmation p values
  const ps = ['G1', 'G2'].map((k) => out.tests.CONF[k].p), o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), adj = [];
  let run = 0; o.forEach(([p, i], k) => { run = Math.max(run, Math.min(1, (ps.length - k) * p)); adj[i] = run; });
  out.decision = {};
  ['G1', 'G2'].forEach((k, i) => {
    const D = out.tests.DISC[k], C = out.tests.CONF[k];
    const checks = { sameSign: Math.sign(D.diff) === Math.sign(C.diff) && C.diff !== 0, t2: Math.abs(C.welchT) >= 2, holm: adj[i] < 0.05,
      n200: C.gotobi.n >= MIN_N, placebo: C.placeboShare <= 0.05 };
    if (C.diff > 0) checks.gotobiPositive = D.gotobi.netR > 0 && C.gotobi.netR > 0;
    out.decision[k] = { holmP: r3(adj[i]), checks, pass: Object.values(checks).every(Boolean) };
  });
  for (const w of Object.values(out.tests)) for (const k of ['G1', 'G2']) w[k].p = r3(w[k].p);
  out.data = { first: days[0].day, last, trades: tr.length, candles: rows.length };
  return out;
}

const sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function verdictOf(R) {
  const passed = ['G1', 'G2'].filter((k) => R.decision[k].pass), C = R.tests.CONF;
  return (passed.length ? `DIFFERENT (${passed.join(', ')})` : 'NO DIFFERENCE, 0 of 2') +
    `: T1 on gotobi days minus other days ${sg(C.G1.diff)}R a trade in 2015 on (Welch t ${sg(C.G1.welchT, 2)}, n ${C.G1.gotobi.n} vs ${C.G1.other.n}), sells ${sg(C.G2.diff)}R (t ${sg(C.G2.welchT, 2)}, n ${C.G2.gotobi.n} vs ${C.G2.other.n})`;
}
export function report(R) {
  const row = (name, wk, k) => { const x = R.tests[wk][k];
    return `| ${name} | ${wk === 'DISC' ? '2005-2014' : '2015 → ' + R.data.last} | ${x.gotobi.n} | ${sg(x.gotobi.grossR)} / ${sg(x.gotobi.netR)} | ${x.other.n} | ${sg(x.other.grossR)} / ${sg(x.other.netR)} | ${sg(x.diff)} | ${sg(x.welchT, 2)} | ${x.month.months} / ${sg(x.month.t, 2)} | ${x.placeboShare} |`; };
  const b = (wk) => { const x = R.book[wk]; return `| ${wk === 'DISC' ? '2005-2014' : '2015 → now'} | ${x.days} | ${x.corr} | ${sg(x.t1NetR)} | ${sg(x.fadeNetR)} | ${sg(x.bookNetR)} | ${sg(x.bookMonthT, 2)} |`; };
  return [`# USD/JPY T1 breakout on gotobi days (24 Nov 2026)`, '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only, pre-registered in `PREREGISTRATION.md` (committed alone first). Rule, days and cost imported unchanged from `index-vol-breakout/original.mjs` and `fx-vol-breakout` (`charge`: 0.000045 of the entry + 0.5 pip); calendar `council/gotobi-calendar.mjs`; OANDA mid M5. Nothing live changed.', '',
    '| Test | Window | Gotobi n | Gotobi R before / after costs | Other n | Other R before / after | Difference (after) | Welch t | Months / month t of the difference | Placebo share ≥ |diff| |',
    '|---|---|---|---|---|---|---|---|---|---|',
    row('G1 all trades', 'DISC', 'G1'), row('G1 all trades', 'CONF', 'G1'), row('G2 sell fills', 'DISC', 'G2'), row('G2 sell fills', 'CONF', 'G2'), '',
    `Holm p (confirmation): G1 ${R.decision.G1.holmP}, G2 ${R.decision.G2.holmP}. Checks: ` +
      ['G1', 'G2'].map((k) => `${k} ` + Object.entries(R.decision[k].checks).map(([c, v]) => `${c} ${v ? 'yes' : 'no'}`).join(', ')).join('; ') + '.', '',
    '## G3, descriptive: T1 and the gotobi fade (T2) on the same gotobi days', '',
    '| Window | Days with both | Correlation of daily net R | T1 net R | Fade net R | Book (sum) net R a day | Book month t |', '|---|---|---|---|---|---|---|', b('DISC'), b('CONF'), '',
    `**Reading.** ${R.reading}`, '',
    `Data: OANDA mid M5 usdjpy ${R.data.first} → ${R.data.last}, ${R.data.candles} candles, ${R.data.trades} T1 trades.`, ''].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const bars = load('usdjpy', '5m', { from: '2004-12-01' }), rows = bars.map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const R = { study: 'usdjpy-vb-gotobi', title: 'USD/JPY T1 breakout on gotobi days', built: '2026-11-24', ...study(rows) };
  R.verdict = verdictOf(R);
  R.reading = process.env.READING || '(to be written)';
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(R.verdict); console.log(JSON.stringify({ tests: R.tests, book: R.book, decision: R.decision, data: R.data }, null, 1));
}
