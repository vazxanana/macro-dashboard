// Edge research · usdjpy-vb-manage: break-even, a 1R trailing stop and half at +1R on the USD/JPY T1 breakout's own trades,
// against the rule's own exit (PREREGISTRATION.md, pushed alone first). Paper research only: nothing is adopted.
//   node research/edge/usdjpy-vb-manage/run.mjs        (candles: research/edge/_lib/edgekit.mjs load('usdjpy', '5m'), out of git)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade, placeboTrade, rng, normP, holm, summary, monthT, quantile } from '../index-vol-breakout/original.mjs';
import { charge, PLACEBO } from '../fx-vol-breakout/run.mjs';
import { WIN, GATE, cell } from '../usdjpy-vb-exit/run.mjs';
import { load } from '../_lib/edgekit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ORIG_SHA = 'afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f';
export const K = 0.5, SEEDS = 40;
export const MODES = ['rule', 'BE1', 'TR1', 'PH1'];
export const VARIANTS = ['BE1', 'TR1', 'PH1'];
export const NAME = { rule: 'rule (stop at the open, out 21:00 UTC)', BE1: 'BE1: stop to entry once +1R reached', TR1: 'TR1: trail 1R behind the best price from +1R', PH1: 'PH1: half at +1R, rest to the rule\'s exit' };
const inW = (day, [a, b]) => day >= a && day <= b;
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// One position managed from its fill candle (index fi). The fill candle only checks the rule's stop (worst case), as vbTrade
// does; management starts on the next candle: (a) open beyond the stop -> out at the open, (b) stop touched -> out at the stop,
// (c) PH1: +1R touched -> half out at exactly +1R, (d) best price updated, the stop for the NEXT candle set. The stop only ever
// moves towards the trade (`stops` lists every level it held, for the tests). Returns R per unit of the whole position.
export function manageTrade(bars, fi, side, entry, stop0, mode = 'rule') {
  const r = Math.abs(entry - stop0), t1 = entry + side * r, stops = [stop0];
  const b0 = bars[fi];
  const out = (exit, how, t, half) => {
    const rest = side * (exit - entry) / r;
    return { exit, how, t, half: !!half, R: half ? 0.5 + 0.5 * rest : rest, stops, reached };
  };
  let reached = false;
  if (side > 0 ? b0.l <= stop0 : b0.h >= stop0) return out(stop0, 'stop', b0.t, false);
  let stop = stop0, best = null, half = false;
  for (let i = fi + 1; i < bars.length; i++) {
    const b = bars[i];
    if (side * (b.o - stop) <= 0) return out(b.o, 'stop', b.t, half);
    if (side > 0 ? b.l <= stop : b.h >= stop) return out(stop, 'stop', b.t, half);
    if (mode === 'PH1' && !half && (side > 0 ? b.h >= t1 : b.l <= t1)) half = true;
    const ext = side > 0 ? b.h : b.l;
    best = best == null ? ext : side > 0 ? Math.max(best, ext) : Math.min(best, ext);
    if (side * (best - entry) >= r) reached = true;
    if (reached && (mode === 'BE1' || mode === 'TR1')) {
      const want = mode === 'BE1' ? entry : best - side * r;
      const ns = side > 0 ? Math.max(stop, want) : Math.min(stop, want);
      if (ns !== stop) { stop = ns; stops.push(stop); }
    }
  }
  const last = bars.at(-1);
  return out(last.c, 'time', last.t + 300, half);
}

// every T1 trade of the days, with each management (cost: fx-vol-breakout's charge, same for every mode of one trade)
export function tradesAll(days) {
  const out = [];
  for (const d of days) {
    if (daySkip(d)) continue;
    const x = vbTrade(d.bars, { k: K, sides: 'both', prevRange: d.prevRange, cost: 0 });
    if (x.skip) continue;
    const fi = d.bars.findIndex((b) => b.t === x.fillT), rule = charge('usdjpy', x), row = { day: d.day, side: x.side, vb: rule, m: {} };
    for (const mo of MODES) {
      const y = manageTrade(d.bars, fi, x.side, x.entry, x.stop, mo);
      row.m[mo] = { day: d.day, side: x.side, ...charge('usdjpy', { entry: x.entry, r: x.r, R: y.R }), exit: y.exit, how: y.how, t: y.t, half: y.half, reached: y.reached, finR: 0 };
    }
    out.push(row);
  }
  return out;
}
// the parent studies' placebo trades (same rand() order), each managed the same way
export function placeboAll(days, seed) {
  const P = days.filter((x) => !daySkip(x)), grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), out = [];
  for (const d of P) {
    const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid), side = rand() < 0.5 ? 1 : -1;
    const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (!x) continue;
    const i = d.bars.findIndex((b) => b.t >= startT), row = { day: d.day, m: {} };
    for (const mo of MODES) { const y = manageTrade(d.bars, i, side, x.entry, x.stop, mo); row.m[mo] = { day: d.day, ...charge('usdjpy', { entry: x.entry, r: x.r, R: y.R }) }; }
    out.push(row);
  }
  return out;
}
// d = net(V) − net(rule), per trade, dated by the trade's day
export const diffs = (rows, v) => rows.map((x) => ({ day: x.day, d: x.m[v].net - x.m.rule.net }));
export function diffStats(rows, v) {
  const ds = diffs(rows, v), mt = monthT(ds, 'd');
  return { n: ds.length, meanD: r3(mean(ds.map((x) => x.d))), monthT: r2(mt.t), months: mt.months };
}
export function decide(win, v) {
  const e = win.early, l = win.late, de = e.diff[v], dl = l.diff[v], se = e.cell[v], sl = l.cell[v];
  return { c1: de.meanD > 0 && dl.meanD > 0, c2: dl.monthT >= 2, c3: se.netR > 0 && sl.netR > 0 && sl.t >= 2, c4: se.n >= 200 && sl.n >= 200 };
}

const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
export function report(R) {
  const W = R.windows, L = ['# USD/JPY T1: break-even, trailing stop or half at +1R? (24 Nov 2026)', '',
    `**Verdict: ${R.verdict}**`, '',
    'Paper research only. Variants, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any managed figure was computed; sha256 in `result.json`). The rule\'s functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge` (0.000045 of the entry + 0.5 pip a round trip; 2x reported), the windows from `usdjpy-vb-exit`. No variant ever moves the stop away from the entry. **Nothing is adopted and nothing live changed.**', '',
    `Gates: the rule from the candle cache reproduces both published figures (2005-15 n ${R.gate.got.early.n}, ${sg(R.gate.got.early.netR)}R; 2016 → n ${R.gate.got.late.n}, ${sg(R.gate.got.late.netR)}R): ${R.gate.ok ? 'yes' : 'no'}; the management walker with no management matches \`vbTrade\` on ${R.gate.same} of ${R.gate.of} trades.`, '',
    '| Management | Window | n | Win | Gross R | Net R | Net 2x cost | Month t (net) | Max DD R | Reached +1R | d vs rule (R a trade) | Month t of d |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const mo of MODES) for (const w of ['early', 'late']) {
    const c = R.byWindow[w].cell[mo], dd = R.byWindow[w].diff[mo];
    L.push(`| ${NAME[mo]} | ${w === 'early' ? W.early.join(' → ') : W.late.join(' → ')} | ${c.n} | ${(c.win * 100).toFixed(1)} % | ${sg(c.grossR)} | ${sg(c.netR)} | ${sg(c.net2R)} | ${sg(c.t, 2)} | ${sg(c.maxDD, 1)} | ${R.byWindow[w].reached} | ${mo === 'rule' ? '—' : sg(dd.meanD)} | ${mo === 'rule' ? '—' : sg(dd.monthT, 2)} |`);
  }
  L.push('', '**Tests (Holm over three, one-sided p of the confirmation month t of d):**', '',
    '| Variant | d 2005-15 | d 2016 → | Month t of d, 2016 → | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | Reading |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const v of VARIANTS) {
    const t = R.tests[v];
    L.push(`| ${v} | ${sg(R.byWindow.early.diff[v].meanD)} | ${sg(R.byWindow.late.diff[v].meanD)} | ${sg(R.byWindow.late.diff[v].monthT, 2)} | ${t.p} | ${t.pHolm} | ${t.c1 ? 'yes' : 'no'} | ${t.c2 && t.pHolm < 0.05 ? 'yes' : 'no'} | ${t.c3 ? 'yes' : 'no'} | **${t.label}** |`);
  }
  L.push('', '**Control (reported, not in the verdict):** the same managements on the parent studies\' placebo trades (a random 5-minute entry 01:00-18:00 UTC and a random side every tradable day, stop 0.5 x the previous range, out 21:00 UTC; 40 seeds), mean d a trade over 2005 → 2026-11-19:', '',
    '| Variant | T1 d (pooled) | Placebo d, median over seeds | 5-95 % over seeds | T1 inside the band |', '|---|---|---|---|---|');
  for (const v of VARIANTS) { const p = R.placebo[v]; L.push(`| ${v} | ${sg(R.pooledD[v])} | ${sg(p.median)} | ${sg(p.q05)} … ${sg(p.q95)} | ${p.inside ? 'yes' : 'no'} |`); }
  L.push('', '**What it says.** ' + R.text, '', 'Net R by year (rule / BE1 / TR1 / PH1):', '', '| Year | Rule | BE1 | TR1 | PH1 |', '|---|---|---|---|---|');
  for (const y of Object.keys(R.byYear)) L.push(`| ${y} | ${MODES.map((m) => sg(R.byYear[y][m], 2)).join(' | ')} |`);
  L.push('', `Data: ${R.data}. No financing: nothing is held over the 17:00 New York rollover. The fill candle never moves a stop or takes a partial (its favourable extreme may have printed before the fill); a stop moved by a candle's extreme applies from the next candle; when one candle reaches both the stop and +1R the stop is taken. These choices are conservative for the managed variants.`, '');
  return L.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, '..', 'index-vol-breakout', 'original.mjs'))).digest('hex') !== ORIG_SHA) throw new Error('original.mjs changed');
  const rowsOf = (from, to) => load('usdjpy', '5m', { from, to }).map((b) => [b.t, b.o, b.h, b.l, b.c]);
  const RE = rowsOf('2004-12-01', '2016-01-08'), E = buildDays(RE).filter((d) => inW(d.day, WIN.early));
  const RL = rowsOf('2015-12-01', '2026-11-20'), Ld = buildDays(RL).filter((d) => inW(d.day, WIN.late));
  const data = `OANDA mid M5 USD/JPY from the shared candle cache (edgekit), ${new Date(RE[0][0] * 1000).toISOString().slice(0, 10)} → ${new Date(RL.at(-1)[0] * 1000).toISOString().slice(0, 10)} (${RE.length + RL.length} candles read); windows ${WIN.early.join(' → ')} and ${WIN.late.join(' → ')}`;
  const TE = tradesAll(E), TL = tradesAll(Ld);
  // gates
  const got = { early: cell(TE.map((x) => ({ day: x.day, ...x.vb }))), late: cell(TL.map((x) => ({ day: x.day, ...x.vb }))) };
  const ok = ['early', 'late'].every((w) => got[w].n === GATE[w].n && got[w].netR === GATE[w].netR);
  const all = [...TE, ...TL], same = all.filter((x) => Math.abs(x.m.rule.R - x.vb.R) < 1e-12 && x.m.rule.exit === x.vb.exit && x.m.rule.how === x.vb.how).length;
  console.log('gate', ok, got.early.n, got.early.netR, got.late.n, got.late.netR, same, all.length);
  if (!ok || same !== all.length) { console.log('GATE FAILED: stop'); process.exit(2); }
  const winOf = (rows) => ({ cell: Object.fromEntries(MODES.map((m) => [m, cell(rows.map((x) => x.m[m]))])), diff: Object.fromEntries(MODES.map((m) => [m, diffStats(rows, m)])), reached: rows.filter((x) => x.m.BE1.reached).length });
  const byWindow = { early: winOf(TE), late: winOf(TL) };
  const ps = VARIANTS.map((v) => normP(byWindow.late.diff[v].monthT)), adj = holm(ps), tests = {};
  VARIANTS.forEach((v, i) => {
    const c = decide(byWindow, v), imp = c.c1 && c.c2 && adj[i] < 0.05 && c.c3 && c.c4;
    tests[v] = { ...c, p: r3(ps[i]), pHolm: r3(adj[i]), improves: imp, label: imp ? 'IMPROVES' : byWindow.late.diff[v].monthT <= -2 ? 'WORSE' : 'NO BETTER' };
  });
  // control
  const pooledD = Object.fromEntries(VARIANTS.map((v) => [v, r3(mean(diffs(all, v).map((x) => x.d)))]));
  const per = Object.fromEntries(VARIANTS.map((v) => [v, []]));
  for (let s = 1; s <= SEEDS; s++) { const P = [...placeboAll(E, s), ...placeboAll(Ld, s)]; for (const v of VARIANTS) per[v].push(mean(diffs(P, v).map((x) => x.d))); }
  const placebo = Object.fromEntries(VARIANTS.map((v) => { const q05 = quantile(per[v], 0.05), q95 = quantile(per[v], 0.95); return [v, { median: r3(quantile(per[v], 0.5)), q05: r3(q05), q95: r3(q95), inside: pooledD[v] >= q05 && pooledD[v] <= q95, seeds: per[v].map(r3) }]; }));
  const byYear = {};
  for (const x of all) { const y = x.day.slice(0, 4); byYear[y] ||= Object.fromEntries(MODES.map((m) => [m, 0])); for (const m of MODES) byYear[y][m] += x.m[m].net; }
  for (const y in byYear) for (const m of MODES) byYear[y][m] = r2(byYear[y][m]);
  const imp = VARIANTS.filter((v) => tests[v].improves), L = byWindow.late, Ee = byWindow.early;
  const verdict = `${imp.length ? 'PASS' : 'FAIL'}: ${imp.length} of 3 managements improve USD/JPY T1 after costs; d vs the rule's exit a trade (2005-15 / 2016 → now, month t of d 2016 →): `
    + VARIANTS.map((v) => `${v} ${sg(Ee.diff[v].meanD)} / ${sg(L.diff[v].meanD)} (t ${sg(L.diff[v].monthT, 2)}, ${tests[v].label})`).join('; ')
    + `; rule ${sg(Ee.cell.rule.netR)} / ${sg(L.cell.rule.netR)}R net (n ${Ee.cell.rule.n} / ${L.cell.rule.n})`;
  const text = `The rule's own exit nets ${sg(Ee.cell.rule.netR)}R a trade in 2005-15 (month t ${sg(Ee.cell.rule.t, 2)}) and ${sg(L.cell.rule.netR)}R in 2016 → now (t ${sg(L.cell.rule.t, 2)}). `
    + VARIANTS.map((v) => `${NAME[v]}: ${sg(Ee.cell[v].netR)}R / ${sg(L.cell[v].netR)}R net (t ${sg(Ee.cell[v].t, 2)} / ${sg(L.cell[v].t, 2)}), max drawdown ${sg(Ee.cell[v].maxDD, 1)} / ${sg(L.cell[v].maxDD, 1)}R against the rule's ${sg(Ee.cell.rule.maxDD, 1)} / ${sg(L.cell.rule.maxDD, 1)}R`).join('. ')
    + `. About ${Math.round(100 * (byWindow.early.reached + byWindow.late.reached) / all.length)} % of trades reach +1R after their fill candle. `
    + `The difference with the rule is the same before and after costs (the cost depends on entry and risk only). `
    + `Control: on the random-entry placebo trades the same managements change little (median d ${VARIANTS.map((v) => `${v} ${sg(placebo[v].median)}`).join(', ')}), while on T1 each costs more than the placebo's 5-95 % band (${VARIANTS.map((v) => `${v} ${sg(pooledD[v])}`).join(', ')}): cutting or locking in at +1R takes away the days the breakout runs to 21:00, which is where its result comes from. TR1 and PH1 lower the drawdown a little; they also about halve the net R in 2016 → now. `
    + (imp.length ? `By the pre-registered bar ${imp.join(', ')} improve the rule on these years, which are already in sample for the rule itself: a candidate for the owner and a forward record, not a change made here. ` : 'No management meets the pre-registered bar: the rule keeps its own exit (stop at the open, out at 21:00 UTC). ')
    + 'Paper research; nothing live changes and no proposal is written.';
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'PREREGISTRATION.md'))).digest('hex');
  const R = { study: 'usdjpy-vb-manage', title: 'USD/JPY T1: trade management', built: '2026-11-24', preregistration: 'research/edge/usdjpy-vb-manage/PREREGISTRATION.md', planSha256: sha,
    verdict, pass: imp.length > 0, gate: { want: GATE, got, ok, same, of: all.length }, windows: WIN, k: K, byWindow, tests, pooledD, placebo, byYear, text, data };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(R));
  console.log(verdict);
}
