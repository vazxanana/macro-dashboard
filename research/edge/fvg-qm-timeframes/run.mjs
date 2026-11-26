// research/edge/fvg-qm-timeframes/run.mjs - the pre-registered FVG tap after a continuation move, QM or CHoCH, on other
// timeframes, judged on the untouched holdout (PREREGISTRATION.md, 25 Nov 2026). Research only: nothing live reads it.
// Candles: the toolkit cache (research/edge/_lib/edgekit.mjs, EDGE_DATA, kept out of git).
//   node research/edge/fvg-qm-timeframes/run.mjs     runs R1-R5, writes result.json, trades.json, RESULT.md
// The rule (sells; buys mirror), per reading { gap: G seconds, entry: 'qm' | 'choch' | 'qm-any', E timeframe seconds }:
//   Continuation = a structure(G, 3) BO event. FVG = candles a, b, c of G, b in [from, i + 3], c.h < a.l, gap >= 0.25 ATR(14) of G.
//   Tap = first M5 candle at or after max(break close, c close) whose high reaches zone.lo, within 120 G candles of the break.
//   Entry = first E-timeframe QM (head reached the zone, except 'qm-any') or ChoCh closing after the tap, within 48 G candles.
//   Void: a G close beyond the zone's far side between tap and entry. Stop = extreme of M5 highs tap..entry close + one cost.
//   Target = lowest G low from `from` to the last G candle closed at the entry; skip < 1R or stop < 3 costs; out after 240 G candles.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { oneSided, oneAtATime } from '../h4-pullback-end/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { swing: 3, fvgAtr: 0.25, atrN: 14, tapCandles: 120, entryCandles: 48, holdCandles: 240, minR: 1, minStopCosts: 3 };
export const READINGS = [
  { id: 'R1', name: 'H4 gap, H1 QM', G: 14400, kind: 'qm', E: 3600 },
  { id: 'R2', name: 'H4 gap, H1 CHoCH', G: 14400, kind: 'choch', E: 3600 },
  { id: 'R3', name: 'M15 gap, M5 QM', G: 900, kind: 'qm', E: 300 },
  { id: 'R4', name: 'M15 gap, M5 CHoCH', G: 900, kind: 'choch', E: 300 },
  { id: 'R5', name: 'H1 gap, H1 QM (head need dropped)', G: 3600, kind: 'qm-any', E: 3600 },
];
const D = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;
export const SETS = { A: { markets: K.HOLDOUT.early.markets, from: D('2005-01-01'), to: D('2010-01-01') }, B: { markets: K.HOLDOUT_MARKETS, from: D('2005-01-01'), to: Infinity } };

const lowerBound = (arr, t, key = 't') => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m][key] < t) lo = m + 1; else hi = m; } return lo; };
const tf = (bars5, sec) => (sec === 300 ? bars5 : K.resample(bars5, sec));

export function candidates(bars5, market, rd, { cost = K.COSTS[market], swing = P.swing } = {}) {
  const G = tf(bars5, rd.G), E = tf(bars5, rd.E);
  const atr = new Array(G.length).fill(null);
  const tr = G.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - G[i - 1].c), Math.abs(b.l - G[i - 1].c)) : b.h - b.l));
  for (let i = P.atrN; i < G.length; i++) { let s = 0; for (let j = i - P.atrN + 1; j <= i; j++) s += tr[j]; atr[i] = s / P.atrN; }
  const ev = K.structure(G, swing).events.filter((e) => e.kind === 'BO');
  const qmAll = rd.kind === 'choch' ? [] : K.qms(E, swing).sort((a, b) => a.t - b.t);
  const chAll = rd.kind === 'choch' ? K.structure(E, swing).events.filter((e) => e.kind === 'ChoCh').sort((a, b) => a.t - b.t) : [];
  const tapWait = P.tapCandles * rd.G, entryWait = P.entryCandles * rd.G, hold = P.holdCandles * rd.G;
  const out = [];
  for (const e of ev) {
    const s = e.dir;
    for (let b = Math.max(e.from, 1); b <= Math.min(e.i + 3, G.length - 2); b++) {
      const a = b - 1, c = b + 1;
      const zone = s < 0 ? (G[a].l > G[c].h ? { lo: G[c].h, hi: G[a].l } : null) : (G[c].l > G[a].h ? { lo: G[a].h, hi: G[c].l } : null);
      if (!zone || atr[c] == null || zone.hi - zone.lo < P.fvgAtr * atr[c]) continue;
      const start = Math.max(e.t, G[c].e), tapDeadline = e.t + tapWait;
      let tapIdx = -1;
      for (let x = lowerBound(bars5, start); x < bars5.length && bars5[x].t < tapDeadline; x++) {
        if (s < 0 ? bars5[x].h >= zone.lo : bars5[x].l <= zone.hi) { tapIdx = x; break; }
      }
      if (tapIdx < 0) continue;
      const tapT = bars5[tapIdx].t;
      let entryT = null;
      const src = rd.kind === 'choch' ? chAll : qmAll;
      for (let k = lowerBound(src, tapT + 1); k < src.length && src[k].t <= tapT + entryWait; k++) {
        const m = src[k];
        if (rd.kind === 'choch') { if (m.dir !== s) continue; }
        else { if (m.side !== s) continue; if (rd.kind === 'qm' && !(s < 0 ? m.head >= zone.lo : m.head <= zone.hi)) continue; }
        entryT = m.t; break;
      }
      if (entryT == null) continue;
      let inverted = false;
      for (let h = K.closedCount(G, tapT); h < G.length && G[h].e <= entryT; h++) if (s < 0 ? G[h].c > zone.hi : G[h].c < zone.lo) { inverted = true; break; }
      if (inverted) continue;
      let extreme = s < 0 ? -Infinity : Infinity;
      for (let x = tapIdx; x < bars5.length && bars5[x].e <= entryT; x++) extreme = s < 0 ? Math.max(extreme, bars5[x].h) : Math.min(extreme, bars5[x].l);
      const stop = extreme + (s < 0 ? cost : -cost);
      const eIdx = lowerBound(bars5, entryT);
      if (eIdx >= bars5.length) continue;
      const px = bars5[eIdx].o, risk0 = s * (px - stop);
      if (!(risk0 >= P.minStopCosts * cost)) continue;
      let target = s < 0 ? Infinity : -Infinity;
      for (let h = e.from; h < G.length && G[h].e <= entryT; h++) target = s < 0 ? Math.min(target, G[h].l) : Math.max(target, G[h].h);
      if (!Number.isFinite(target) || !(s * (target - px) >= P.minR * risk0)) continue;
      const r = K.simulate({ side: s, entry: px, stop, target, t: entryT, type: 'market', maxHold: hold }, bars5, { cost });
      if (r.status === 'bad' || r.status === 'open' || r.status === 'nofill') continue;
      out.push({ market, rd: rd.id, side: s, signalT: entryT, entryT: r.fillT, entry: r.fill, stop, target, exitT: r.exitT, exit: r.exit, reason: r.reason,
        risk: r.risk, R: r.R, Rnet: r.Rnet, Rnet2: r.R - (2 * cost) / r.risk, tapT, breakT: e.t });
    }
  }
  return out;
}
export const runMarket = (bars5, market, rd) => oneAtATime(candidates(bars5, market, rd));

const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
function summ(trades, key) {
  const s = K.stats(trades, { key, time: 'exitT' });
  return { n: s.n, wins: s.wins, meanR: r4(s.meanR), total: r4(s.total), tTrade: r4(s.tTrade), months: s.months, tMonth: r4(s.tMonth), pMonth: r4(s.pMonth), maxDD: r4(s.maxDD) };
}
export const block = (trades) => ({ net: summ(trades, 'Rnet'), net2x: summ(trades, 'Rnet2'), gross: summ(trades, 'R') });
const mean = (xs, k) => (xs.length ? xs.reduce((s, x) => s + x[k], 0) / xs.length : null);
export function judge(t, holmP) {
  const xs = [...t.trades].sort((a, b) => a.entryT - b.entryT), h = xs.length >> 1;
  const A = t.trades.filter((x) => x.set === 'A'), B = t.trades.filter((x) => x.set === 'B');
  const lines = {
    mean: t.pooled.net.meanR > 0, t: t.pooled.net.tMonth >= 2, holm: holmP < 0.05,
    setA: mean(A, 'Rnet') > 0, setB: mean(B, 'Rnet') > 0, x2: t.pooled.net2x.meanR > 0, n100: t.pooled.net.n >= 100,
    halves: xs.length >= 2 && mean(xs.slice(0, h), 'Rnet') > 0 && mean(xs.slice(h), 'Rnet') > 0,
  };
  return { lines, pass: Object.values(lines).every(Boolean) };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
export function report(res) {
  const L = [];
  L.push('# The FVG tap after a continuation move on other timeframes, judged on the untouched holdout: result (25 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any code); run by `run.mjs` on the toolkit\'s OANDA mid 5m cache, holdout only',
    '(Set A: gold, EUR/USD, GBP/USD, USD/JPY, AUD/USD 2005-2009; Set B: NZD/USD, USD/CAD, USD/CHF, EUR/JPY, silver 2005 to now). **Set B costs are',
    'assumed, not measured.** R after the toolkit\'s round-trip costs unless said; t on calendar-month sums; p one-sided; Holm across R1-R5.', '');
  L.push('| Reading | Sample | n | R a trade after costs | month t | at 2x costs | before costs | Holm p | passes |', '|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) {
    L.push(`| ${t.id} ${t.name} | pooled | ${t.pooled.net.n} | ${f(t.pooled.net.meanR)} | ${ft(t.pooled.net.tMonth)} | ${f(t.pooled.net2x.meanR)} | ${f(t.pooled.gross.meanR)} | ${ft(t.holmP)} | ${t.pass ? 'yes' : 'no'} |`);
    for (const k of ['A', 'B']) L.push(`| | Set ${k} | ${t.sets[k].net.n} | ${f(t.sets[k].net.meanR)} | ${ft(t.sets[k].net.tMonth)} | ${f(t.sets[k].net2x.meanR)} | ${f(t.sets[k].gross.meanR)} | | |`);
  }
  for (const t of res.tests) L.push('', `${t.id}: lines missed: ${Object.entries(t.lines).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}; buys ${f(t.bySide.buy?.net.meanR)}R (n ${t.bySide.buy?.net.n}), sells ${f(t.bySide.sell?.net.meanR)}R (n ${t.bySide.sell?.net.n}); median target ${f(t.medianTargetR, 2)}R, median cost ${f(t.medianCostR)}R; exits ${Object.entries(t.byReason).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  L.push('', '## In plain words', '', ...res.plain.map((s) => '- ' + s), '', '## What it does NOT show', '');
  L.push('- Only five fixed readings of the owner\'s idea on 2005-2009 (five markets) and 2005 to now (five more); 2010 onward on the first five markets was spent by `fvg-qm-continuation` and not loaded.',
    '- No FVG size, tap rule, stop, target or hold was varied. Set B costs are assumed; financing is not charged; stop slippage beyond a gap is not modelled.',
    '- A FAIL judges this mechanical reading, not the owner\'s own marking.', '', 'Nothing live changed. Files: result.json, trades.json, tests/fvg-qm-timeframes.test.mjs.');
  return L.join('\n') + '\n';
}

export function main() {
  const per = {}; for (const rd of READINGS) per[rd.id] = [];
  for (const [set, S] of Object.entries(SETS)) for (const m of S.markets) {
    let bars5; try { bars5 = K.load(m, '5m', { from: S.from, to: S.to === Infinity ? undefined : S.to }); } catch (e) { console.error('skip', m, e.message); continue; }
    if (!bars5.length) { console.error('no bars', m); continue; }
    if (set === 'A' && bars5.some((b) => b.t >= SETS.A.to)) throw new Error('Set A must not load 2010 or later');
    for (const rd of READINGS) { const r = runMarket(bars5, m, rd).map((x) => ({ ...x, set })); per[rd.id].push(...r); console.error(m, rd.id, r.length); }
  }
  const tests = READINGS.map((rd) => {
    const trades = per[rd.id].sort((a, b) => a.entryT - b.entryT);
    const sets = { A: block(trades.filter((x) => x.set === 'A')), B: block(trades.filter((x) => x.set === 'B')) };
    const byReason = {}; for (const x of trades) byReason[x.reason] = (byReason[x.reason] || 0) + 1;
    const bySide = { buy: block(trades.filter((x) => x.side > 0)), sell: block(trades.filter((x) => x.side < 0)) };
    const byMarket = {}; for (const m of new Set(trades.map((x) => x.market))) byMarket[m] = block(trades.filter((x) => x.market === m));
    const med = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
    return { id: rd.id, name: rd.name, reading: rd, trades, pooled: block(trades), sets, bySide, byMarket, byReason,
      medianTargetR: r4(med(trades.map((x) => Math.abs(x.target - x.entry) / x.risk))), medianCostR: r4(med(trades.map((x) => x.R - x.Rnet))) };
  });
  const praw = tests.map((t) => oneSided(t.pooled.net.tMonth, t.pooled.net.pMonth)), hp = K.holm(praw);
  tests.forEach((t, i) => { t.pRaw = r4(praw[i]); t.holmP = r4(hp[i]); const v = judge(t, hp[i]); t.lines = v.lines; t.pass = v.pass; });
  const verdict = tests.some((t) => t.pass) ? 'PASS' : tests.some((t) => t.pooled.net.n >= 100) ? 'FAIL' : 'INCONCLUSIVE';
  const line = (t) => `${t.id} ${f(t.pooled.net.meanR)} (n ${t.pooled.net.n})`;
  const headline = `Holdout R a trade after costs: ${tests.map(line).join(', ')}; ${verdict === 'PASS' ? 'a reading passes' : 'none passes'}.`;
  const plain = tests.map((t) => `${t.id} ${t.name}: before costs ${f(t.pooled.gross.meanR)}R, after ${f(t.pooled.net.meanR)}R; Set A ${f(t.sets.A.net.meanR)}R (n ${t.sets.A.net.n}), Set B ${f(t.sets.B.net.meanR)}R (n ${t.sets.B.net.n}).`);
  const res = { study: 'fvg-qm-timeframes', built: '2026-11-25', verdict, headline, params: P, sets: Object.fromEntries(Object.entries(SETS).map(([k, v]) => [k, { markets: v.markets, from: v.from, to: v.to === Infinity ? null : v.to }])), costs: K.COSTS, plain,
    tests: tests.map(({ trades, ...t }) => t) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const cols = ['rd', 'set', 'market', 'side', 'entryT', 'entry', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet'];
  const rows = []; for (const t of tests) for (const x of t.trades) rows.push([x.rd, x.set, x.market, x.side, x.entryT, +x.entry.toPrecision(7), +x.stop.toPrecision(7), +x.target.toPrecision(7), x.exitT, +x.exit.toPrecision(7), x.reason, +x.R.toFixed(3), +x.Rnet.toFixed(3)]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols, note: 'times unix s UTC; R before costs, Rnet after 1x costs', rows }).replace(/\],\[/g, '],\n[') + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(headline);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
