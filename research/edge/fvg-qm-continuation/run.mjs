// research/edge/fvg-qm-continuation/run.mjs - the pre-registered H1 fair value gap tapped after a continuation move, then an
// H1 QM (entry A) or an M15 CHoCH (entry B), target the low of the move (PREREGISTRATION.md, 25 Nov 2026). Research only:
// nothing live reads it. Candles from the overnight toolkit's cache (research/edge/_lib/edgekit.mjs).
//   node research/edge/fvg-qm-continuation/run.mjs      runs T1-T2, writes result.json, trades.json, RESULT.md
// The rule, as pre-registered (sells; buys mirror; no other setting is tried):
//   H1, M15 = edgekit.resample of the 5m candles. Continuation = an H1 structure() event of kind BO (from = broken swing, i = break).
//   FVG = candles a, b, c with b in [from, i + 3] and c.h < a.l; zone [c.h, a.l]; gap >= 0.25 x ATR(14) of H1 at c.
//   Tap = first M5 candle at or after max(break close, c close) with high >= zone.lo, within 120 H1 candles of the break close.
//   Entry A = first H1 qms() sell closing after the tap whose head reached zone.lo. Entry B = first M15 ChoCh sell closing after the tap.
//   Void: an H1 close above zone.hi after the tap; no entry within 48 H1 candles of the tap.
//   Stop = highest M5 high from the tap to the entry close + one cost. Target = lowest H1 low from `from` to the entry.
//   Skip target < 1R or stop < 3 costs. Out after 10 days. One position at a time per market and mode.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { W, block, oneSided, verdictOf, oneAtATime } from '../h4-pullback-end/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const P = { swing: 3, fvgAtr: 0.25, atrN: 14, tapWait: 120 * 3600, entryWait: 48 * 3600, minR: 1, minStopCosts: 3, hold: 864000 };
const WNAME = { rep: '2010-2019 (replication)', is: '2020-2023 (IS)', oos: '2024 - end of cache (OOS)' };

const lowerBound = (bars, t) => { let lo = 0, hi = bars.length; while (lo < hi) { const m = (lo + hi) >> 1; if (bars[m].t < t) lo = m + 1; else hi = m; } return lo; };

export function candidates(bars5, market, mode, { cost = K.COSTS[market], swing = P.swing } = {}) {
  const H1 = K.resample(bars5, 3600), M15 = K.resample(bars5, 900);
  const atr = new Array(H1.length).fill(null);
  const tr = H1.map((b, i) => (i ? Math.max(b.h - b.l, Math.abs(b.h - H1[i - 1].c), Math.abs(b.l - H1[i - 1].c)) : b.h - b.l));
  for (let i = P.atrN; i < H1.length; i++) { let s = 0; for (let j = i - P.atrN + 1; j <= i; j++) s += tr[j]; atr[i] = s / P.atrN; }
  const ev = K.structure(H1, swing).events.filter((e) => e.kind === 'BO');
  const qmAll = K.qms(H1, swing);
  const ev15 = K.structure(M15, swing).events.filter((e) => e.kind === 'ChoCh');
  const out = [];
  for (const e of ev) {
    const s = e.dir;
    for (let b = Math.max(e.from, 1); b <= Math.min(e.i + 3, H1.length - 2); b++) {
      const a = b - 1, c = b + 1;
      const zone = s < 0 ? (H1[a].l > H1[c].h ? { lo: H1[c].h, hi: H1[a].l } : null) : (H1[c].l > H1[a].h ? { lo: H1[a].h, hi: H1[c].l } : null);
      if (!zone || atr[c] == null || zone.hi - zone.lo < P.fvgAtr * atr[c]) continue;
      const start = Math.max(e.t, H1[c].e), tapDeadline = e.t + P.tapWait;
      let tapIdx = -1;
      for (let x = lowerBound(bars5, start); x < bars5.length && bars5[x].t < tapDeadline; x++) {
        if (s < 0 ? bars5[x].h >= zone.lo : bars5[x].l <= zone.hi) { tapIdx = x; break; }
      }
      if (tapIdx < 0) continue;
      const tapT = bars5[tapIdx].t;
      let entryT = null;
      if (mode === 'A') {
        const q = qmAll.find((m) => m.side === s && m.t > tapT && m.t <= tapT + P.entryWait && (s < 0 ? m.head >= zone.lo : m.head <= zone.hi));
        if (q) entryT = q.t;
      } else {
        const q = ev15.find((m) => m.dir === s && m.t > tapT && m.t <= tapT + P.entryWait);
        if (q) entryT = q.t;
      }
      if (entryT == null) continue;
      // void: an H1 close beyond the zone's far side between the tap and the entry
      let inverted = false;
      for (let h = K.closedCount(H1, tapT); h < H1.length && H1[h].e <= entryT; h++) if (s < 0 ? H1[h].c > zone.hi : H1[h].c < zone.lo) { inverted = true; break; }
      if (inverted) continue;
      let extreme = s < 0 ? -Infinity : Infinity;
      for (let x = tapIdx; x < bars5.length && bars5[x].e <= entryT; x++) extreme = s < 0 ? Math.max(extreme, bars5[x].h) : Math.min(extreme, bars5[x].l);
      const stop = extreme + (s < 0 ? cost : -cost);
      const eIdx = lowerBound(bars5, entryT);
      if (eIdx >= bars5.length) continue;
      const px = bars5[eIdx].o;
      const risk0 = s * (px - stop);
      if (!(risk0 >= P.minStopCosts * cost)) continue;
      let target = s < 0 ? Infinity : -Infinity;
      for (let h = e.from; h < H1.length && H1[h].e <= entryT; h++) target = s < 0 ? Math.min(target, H1[h].l) : Math.max(target, H1[h].h);
      if (!Number.isFinite(target) || !(s * (target - px) >= P.minR * risk0)) continue;
      const r = K.simulate({ side: s, entry: px, stop, target, t: entryT, type: 'market', maxHold: P.hold }, bars5, { cost });
      if (r.status === 'bad' || r.status === 'open' || r.status === 'nofill') continue;
      out.push({ market, mode, side: s, signalT: entryT, entryT: r.fillT, entry: r.fill, stop, target, exitT: r.exitT, exit: r.exit, reason: r.reason,
        risk: r.risk, R: r.R, Rnet: r.Rnet, Rnet2: r.R - (2 * cost) / r.risk, tapT, breakT: e.t, gapAtr: (zone.hi - zone.lo) / atr[c] });
    }
  }
  return out;
}

export const runMarket = (bars5, market, mode) => oneAtATime(candidates(bars5, market, mode));

const inW = (x, w) => x.entryT >= w[0] && x.entryT < w[1];
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1e4) / 1e4);
const med = (a) => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : null; };
function detail(trades) {
  const byMarket = {}, bySide = {}, byReason = {}, byYear = {};
  for (const m of new Set(trades.map((x) => x.market))) byMarket[m] = block(trades.filter((x) => x.market === m));
  for (const s of [1, -1]) bySide[s > 0 ? 'buy' : 'sell'] = block(trades.filter((x) => x.side === s));
  for (const x of trades) { const g = (byReason[x.reason] ||= { n: 0, R: 0, Rnet: 0 }); g.n++; g.R += x.R; g.Rnet += x.Rnet; }
  for (const g of Object.values(byReason)) { g.meanR = r4(g.R / g.n); g.meanRnet = r4(g.Rnet / g.n); g.R = r4(g.R); g.Rnet = r4(g.Rnet); }
  for (const x of trades) { const y = new Date(x.entryT * 1000).getUTCFullYear(); const g = (byYear[y] ||= { n: 0, Rnet: 0, R: 0 }); g.n++; g.Rnet += x.Rnet; g.R += x.R; }
  for (const g of Object.values(byYear)) { g.meanRnet = r4(g.Rnet / g.n); g.meanR = r4(g.R / g.n); g.Rnet = r4(g.Rnet); g.R = r4(g.R); }
  return { byMarket, bySide, byReason, byYear, medianTargetR: r4(med(trades.map((x) => Math.abs(x.target - x.entry) / x.risk))),
    medianCostR: r4(med(trades.map((x) => x.R - x.Rnet))) };
}

const f = (v, d = 3) => (v == null ? '-' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d));
const ft = (v) => (v == null ? '-' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
export function report(res) {
  const L = [];
  L.push('# The H1 fair value gap tapped after a continuation move, then an H1 QM or an M15 CHoCH, target the move\'s low: result (25 Nov 2026)', '');
  L.push(`**Verdict: ${res.verdict}.** ${res.headline}`, '');
  L.push('Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit\'s OANDA mid 5m',
    'cache. R after the toolkit\'s round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time;',
    'p one-sided (mean > 0); Holm across T1-T2.', '');
  L.push('| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | passes |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tests) for (const k of ['rep', 'is', 'oos']) {
    const b = t.windows[k];
    L.push(`| ${t.id} ${t.name} | ${WNAME[k]} | ${b.net.n} | ${f(b.net.meanR)} | ${ft(b.net.tMonth)} | ${f(b.net2x.meanR)} | ${f(b.gross.meanR)} | ${k === 'oos' ? ft(t.holmP) : ''} | ${k === 'oos' ? (t.pass ? 'yes' : 'no') : ''} |`);
  }
  for (const t of res.tests) {
    L.push('', `## Per market, ${t.id} ${t.name}: R a trade after costs (n)`, '', '| Market | 2010-2019 | 2020-2023 | 2024 on | before costs 2024 on |', '|---|---|---|---|---|');
    for (const [m, b] of Object.entries(t.detail.byMarket))
      L.push(`| ${m} | ${f(b.rep.net.meanR)} (${b.rep.net.n}) | ${f(b.is.net.meanR)} (${b.is.net.n}) | ${f(b.oos.net.meanR)} (${b.oos.net.n}) | ${f(b.oos.gross.meanR)} |`);
    L.push('', `By year: ` + Object.entries(t.detail.byYear).map(([y, g]) => `${y} ${f(g.meanRnet)} (${g.n})`).join(' · '));
  }
  L.push('', '## In plain words', '');
  L.push(...res.plain.map((s) => '- ' + s));
  L.push('', '## What it does NOT show', '');
  L.push('- It tests one mechanical reading of the owner\'s chart idea (3-candle swings, 0.25 ATR gaps, the toolkit\'s QM), not his own marking.',
    '- No other FVG size, tap rule, stop, target or timeframe was tried, before or after the result (pre-registered).',
    '- Costs are today\'s demo figures charged on every year; financing is not charged; stop slippage beyond a gap is not modelled.',
    '- A FAIL is about this rule on these five markets; it does not judge discretionary trades.', '');
  L.push('Nothing live changed. Files: result.json (every number), trades.json (every trade), tests/fvg-qm-continuation.test.mjs.');
  return L.join('\n') + '\n';
}

export function main() {
  const per = { A: {}, B: {} };
  for (const m of K.MARKETS) {
    const bars5 = K.load(m, '5m', { from: '2010-01-01' });
    for (const mode of ['A', 'B']) { per[mode][m] = runMarket(bars5, m, mode); console.error(m, mode, per[mode][m].length); }
  }
  const pick = (mode, ms) => ms.flatMap((m) => per[mode][m]).filter((x) => x.entryT >= W.rep[0]).sort((a, b) => a.entryT - b.entryT);
  const tests = [
    { id: 'T1', name: 'entry A (H1 QM), five markets pooled', trades: pick('A', K.MARKETS) },
    { id: 'T2', name: 'entry B (M15 CHoCH), five markets pooled', trades: pick('B', K.MARKETS) },
    { id: 'D1', name: 'entry A, gold alone (not tested)', trades: pick('A', ['xau']) },
    { id: 'D2', name: 'entry B, gold alone (not tested)', trades: pick('B', ['xau']) },
  ];
  for (const t of tests) t.windows = block(t.trades);
  const praw = tests.slice(0, 2).map((t) => oneSided(t.windows.oos.net.tMonth, t.windows.oos.net.pMonth));
  const hp = K.holm(praw);
  tests.forEach((t, i) => {
    if (i < 2) { t.pRaw = r4(praw[i]); t.holmP = r4(hp[i]); const v = verdictOf(t.windows, hp[i]); t.lines = v.lines; t.pass = v.pass; }
    else { t.holmP = null; t.pass = false; }
    t.detail = detail(t.trades);
  });
  const n30 = tests.slice(0, 2).some((t) => t.windows.oos.net.n >= 30);
  const verdict = tests.slice(0, 2).some((t) => t.pass) ? 'PASS' : n30 ? 'FAIL' : 'INCONCLUSIVE';
  const line = (t) => { const o = t.windows.oos.net, i = t.windows.is.net, r = t.windows.rep.net;
    return `${t.id}: ${f(o.meanR)}R a trade after costs out of sample (n ${o.n}, month t ${ft(o.tMonth)}), ${f(i.meanR)}R in sample (n ${i.n}), ${f(r.meanR)}R on 2010-2019 (n ${r.n}, month t ${ft(r.tMonth)})`
      + (t.lines ? `; lines missed: ${Object.entries(t.lines).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}` : ''); };
  const headline = `${line(tests[0])}. ${line(tests[1])}.`;
  const plain = tests.slice(0, 2).map((t) => `${t.id}: before costs ${f(t.windows.oos.gross.meanR)}R out of sample, ${f(t.windows.is.gross.meanR)}R in sample, ${f(t.windows.rep.gross.meanR)}R on 2010-2019; median cost ${f(t.detail.medianCostR)}R a trade, median target ${f(t.detail.medianTargetR, 2)}R away; buys ${f(t.detail.bySide.buy?.oos.net.meanR)}R, sells ${f(t.detail.bySide.sell?.oos.net.meanR)}R after costs out of sample; exits ` + Object.entries(t.detail.byReason).map(([k, v]) => `${k} ${v.n}`).join(', ') + '.')
    .concat([`Gold alone out of sample after costs: entry A ${f(tests[2].windows.oos.net.meanR)}R (n ${tests[2].windows.oos.net.n}), entry B ${f(tests[3].windows.oos.net.meanR)}R (n ${tests[3].windows.oos.net.n}); not tested, said for reading only.`]);
  const res = { study: 'fvg-qm-continuation', built: '2026-11-25', verdict, headline, params: P, windows: W, costs: K.COSTS, plain,
    tests: tests.map(({ trades, ...t }) => t) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(res, null, 1) + '\n');
  const cols = ['mode', 'market', 'side', 'entryT', 'entry', 'stop', 'target', 'exitT', 'exit', 'reason', 'R', 'Rnet'];
  const rows = [];
  for (const t of tests.slice(0, 2)) for (const x of t.trades)
    rows.push([x.mode, x.market, x.side, x.entryT, +x.entry.toPrecision(7), +x.stop.toPrecision(7), +x.target.toPrecision(7), x.exitT, +x.exit.toPrecision(7), x.reason, +x.R.toFixed(3), +x.Rnet.toFixed(3)]);
  fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify({ cols, note: 'times unix s UTC; entry = filled price; R before costs, Rnet after 1x costs', rows }).replace(/\],\[/g, '],\n[') + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), report(res));
  console.log(headline);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
