// research/edge/fade-zone-complete/run.mjs - PREREGISTRATION.md (24 Nov 2026): the zone fade (fade-zone-targets' zone target and
// zone stop) with fixed hour, level and cost filters, eight candidates, one picked on 2005-14 AFTER costs, confirmed once after
// costs on 2015-26 and on eight markets it was never run on. Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/fade-zone-complete/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-zone-complete/run.mjs cut <m> <outDir>
//   node research/edge/fade-zone-complete/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat } from '../grid7-wide-core/run.mjs';
import { signals, CAP } from '../grid7-wide-fade/run.mjs';
import { A_MARKETS } from '../fade-new-markets/run.mjs';
import { levels, standing, tradeOf } from '../fade-zone-targets/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEN = MARKETS, EIGHT = A_MARKETS, MEASURED = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const COST_MAX = 0.05;
export const CANDS = [
  { key: 'K1', tf: 1, hour: false, level: false, cost: false },
  { key: 'K2', tf: 1, hour: true, level: false, cost: false },
  { key: 'K3', tf: 1, hour: true, level: true, cost: false },
  { key: 'K4', tf: 1, hour: false, level: false, cost: true },
  { key: 'K5', tf: 1, hour: true, level: false, cost: true },
  { key: 'K6', tf: 1, hour: true, level: true, cost: true },
  { key: 'K7', tf: 2, hour: false, level: false, cost: true },
  { key: 'K8', tf: 2, hour: true, level: false, cost: true },
];
export const candName = (c) => `${c.tf === 1 ? 'M15' : 'H1'} ${[c.hour && 'hour', c.level && 'level', c.cost && 'cost'].filter(Boolean).join(' + ') || 'no filter'}`;
// break candle STARTS in 20-23 UTC and the fill is not in 21:00-22:59 UTC
export function hourOk(breakStart, fillT) {
  const h = new Date(breakStart * 1000).getUTCHours(), f = new Date(fillT * 1000).getUTCHours();
  return h >= 20 && h <= 23 && !(f === 21 || f === 22);
}
export const takes = (c, r) => r.tf === c.tf && (!c.hour || r.hour) && (!c.level || r.level) && (!c.cost || r.cr <= COST_MAX);

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// every trade of the base rule on M15 and H1: [t, month, tf, hour, level, R (zone target, zone stop), cost R]
export function tradesOf(M5, market, { cost = COSTS[market], X = exclusions(market) } = {}) {
  const F = frames(M5), at = standing(levels(F)), rows = []; let endMarked = 0, sigN = 0;
  const sigs = signals(F).filter((g) => g.cx === 0 && (g.tf === 1 || g.tf === 2)).sort((a, b) => a.ts - b.ts || a.tf - b.tf);
  for (const g of sigs) {
    const act = at(g.ts); sigN++;
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) continue;
    const r = tradeOf(M5, g, act, cost, g.tf === 1 ? CAP['15m'] : CAP['1h']); if (!r) continue;
    if (r.endMark) endMarked++;
    const bs = F[g.tf === 1 ? '15m' : '1h'][g.j].t;
    rows.push([t, monthOf(t), g.tf, +hourOk(bs, t), +r.zs, +r.R[1][1].toFixed(5), +r.cr[1].toFixed(5)]);
  }
  return { rows, endMarked, signals: sigN };
}
export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const o = tradesOf(M5, market);
  return { market, cost: COSTS[market], assumed: !MEASURED.includes(market), first: M5.length ? M5[0].t : null, ...o };
}

// cut test: every trade's filter values and levels known by a cut, on candles cut there, equal the full run's
export function cutTest(market, cuts = ['2009-06-11', '2017-03-15', '2024-09-18']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (r) => r.slice(0, 5).join('|') + '|' + r[6];
  const full = tradesOf(M5, market).rows; const res = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000, lim = T - 3 * 86400;   // trades closed by the cut
    const cut = tradesOf(M5.filter((b) => b.e <= T), market).rows.filter((r) => r[0] <= lim).map(key);
    const want = full.filter((r) => r[0] <= lim).map(key); const A = new Set(cut), B = new Set(want);
    res.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return res;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const obj = (r) => ({ t: r[0], m: r[1], tf: r[2], hour: r[3] === 1, level: r[4] === 1, R: r[5], cr: r[6] });
export function stats(rows, a, b) {   // rows (objects) with month in [a, b)
  const ms = new Float64Array(NM), msn = new Float64Array(NM), ms2 = new Float64Array(NM), net = []; let g = 0, s = 0, s2 = 0, w = 0, n = 0;
  for (const r of rows) { if (r.m < a || r.m >= b) continue; n++; const x = r.R - r.cr; g += r.R; s += x; s2 += r.R - 2 * r.cr; if (x > 0) w++; net.push(x);
    ms[r.m] += r.R; msn[r.m] += x; ms2[r.m] += r.R - 2 * r.cr; }
  net.sort((p, q) => p - q); const med = n ? (n % 2 ? net[n >> 1] : (net[n / 2 - 1] + net[n / 2]) / 2) : null;
  return { n, gross: n ? g / n : null, tGross: mstat(ms, a, b).t, net: n ? s / n : null, tNet: mstat(msn, a, b).t, net2: n ? s2 / n : null, tNet2: mstat(ms2, a, b).t,
    median: med, win: n ? w / n : null, perYear: n / ((b - a) / 12) };
}
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'number' ? r6(v) : v]));

export function judge(ten, eight) {
  const T = ten.flatMap((d) => d.rows.map(obj)), E = eight.flatMap((d) => d.rows.map(obj)), Tm = ten.filter((d) => MEASURED.includes(d.market)).flatMap((d) => d.rows.map(obj));
  const rows = CANDS.map((c) => { const t = T.filter((r) => takes(c, r)), e = E.filter((r) => takes(c, r)), tm = Tm.filter((r) => takes(c, r));
    const sel = stats(t, 0, DM), c1 = stats(t, DM, NM), c2 = stats(e, 0, NM), meas = stats(tm, DM, NM);
    return { ...c, name: candName(c), sel, c1, c2, meas, eligible: sel.n >= 300 && sel.net > 0 && sel.tNet >= 2 }; });
  const el = rows.filter((r) => r.eligible).sort((a, b) => b.sel.tNet - a.sel.tNet);
  const pick = el[0] || null;
  const ok = (s) => s.n >= 300 && s.net > 0 && s.tNet >= 2;
  const conf = pick ? { c1: ok(pick.c1), c2: ok(pick.c2) } : null;
  return { rows, pick, conf };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');
export function report(dir) {
  const rd = (m) => { const f = path.join(dir, m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const ten = TEN.map(rd).filter(Boolean), eight = EIGHT.map(rd).filter(Boolean);
  const cut = [...TEN, ...EIGHT].flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { rows, pick, conf } = judge(ten, eight);
  const Z = JSON.parse(fs.readFileSync(path.join(HERE, '../fade-zone-targets/result.json'), 'utf8')).cells.find((c) => c.cell === 'zone exit, zone stop, all');
  const k1 = rows[0];
  const gate = [{ what: 'K1 2005-14 = fade-zone-targets', ok: k1.sel.n === Z.first.n && Math.abs(k1.sel.gross - Z.first.mean) < 5e-4, n: k1.sel.n, mean: r6(k1.sel.gross), want: { n: Z.first.n, mean: Z.first.mean } },
    { what: 'K1 2015-26 = fade-zone-targets', ok: k1.c1.n === Z.second.n && Math.abs(k1.c1.gross - Z.second.mean) < 5e-4, n: k1.c1.n, mean: r6(k1.c1.gross), want: { n: Z.second.n, mean: Z.second.mean } }];
  const cutBad = cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const gateOk = gate.every((g) => g.ok) && cutBad === 0 && ten.length >= 8 && eight.length >= 6;
  const verdict = !gateOk ? 'INCONCLUSIVE' : pick && conf.c1 && conf.c2 ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.sel.tNet - a.sel.tNet)[0];
  let headline;
  if (verdict === 'INCONCLUSIVE') headline = 'the gate, the cut test or the market count failed, nothing judged';
  else if (!pick) headline = `no candidate is positive after costs on 2005-14 (best ${best.key}, ${best.name}: ${f3(best.sel.net)}R a trade after costs, n ${N(best.sel.n)}, month t ${f2(best.sel.tNet)}; ${f3(best.sel.gross)}R before), so nothing is confirmed`;
  else headline = `${pick.key} (${pick.name}) picked on 2005-14 (${f3(pick.sel.net)}R a trade after costs, n ${N(pick.sel.n)}, month t ${f2(pick.sel.tNet)}); 2015-26 ${f3(pick.c1.net)}R (n ${N(pick.c1.n)}, t ${f2(pick.c1.tNet)}), eight new markets ${f3(pick.c2.net)}R (n ${N(pick.c2.n)}, t ${f2(pick.c2.tNet)})`;
  const out = { study: 'fade-zone-complete', built: '2026-11-24', verdict, headline, basis: 'after costs on calendar-month sums (pre-registered); before costs beside',
    windows: { selection: 'ten markets, fills 2005-01-01 to 2014-12-31', confirm1: 'ten markets, fills 2015-01-01 to 2026-10-31', confirm2: 'eight markets, all fills 2005-01-01 to 2026-10-31 on file' },
    ten: ten.map((d) => d.market), eight: eight.map((d) => d.market), measured: MEASURED, costs: Object.fromEntries([...ten, ...eight].map((d) => [d.market, d.cost])),
    gate, cut, cutBad, pick: pick ? pick.key : null, confirm: conf,
    meta: [...ten, ...eight].map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), signals: d.signals, trades: d.rows.length, endMarked: d.endMarked, assumed: d.assumed })),
    candidates: rows.map((r) => ({ key: r.key, name: r.name, eligible: r.eligible, selection: slim(r.sel), confirm1: slim(r.c1), confirm2: slim(r.c2), measuredMarkets2015: slim(r.meas) })),
    perMarket: pick ? [...ten, ...eight].map((d) => { const x = d.rows.map(obj).filter((r) => takes(pick, r)); const a = stats(x, 0, DM), b = stats(x, DM, NM);
      return { market: d.market, n1: a.n, net1: r6(a.net), n2: b.n, net2: r6(b.net) }; }) : [] };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const L = [];
  L.push('# The zone fade with cost, hour and level filters, after costs (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The structure-break fade (`grid7-wide-fade`, its own code) closed at the nearest H1 / H4 key level in front and stopped past',
    'the nearest level behind (`fade-zone-targets`), on M15 or H1 breaks, with three fixed filters: **hour** (break candle starts',
    '20-23 UTC, fill not in 21:00-22:59 UTC), **level** (a level behind the fill was used as the stop), **cost** (round trip at',
    'most 5 % of the risk). Eight candidates; the one with the best month t AFTER costs on 2005-14 (positive, t >= 2, n >= 300) is',
    'confirmed once after costs on 2015-26 and on eight markets this rule was never run on.',
    `Costs: measured for ${o.measured.join(', ')}; **ASSUMED, not measured** for every other market.`, '',
    '## Gate and cut test', '');
  for (const g of o.gate) L.push(`- ${g.what}: n ${N(g.n)}, ${f3(g.mean)} (wanted n ${N(g.want.n)}, ${f3(g.want.mean)}): ${g.ok ? 'equal' : 'NOT EQUAL'}.`);
  L.push(`- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(o.cut.reduce((a, x) => a + x.n, 0))} trades with their filters and levels known by the cut dates, ${o.cutBad} missing or extra when the candles are cut there.`,
    `- Trades whose exit was still open when the data ends (closed at the last close): ${o.meta.reduce((a, m) => a + m.endMarked, 0)}.`, '',
    '## Every candidate', '', 'R a trade after costs (month-sum t); before costs and at 2 x costs beside. "Measured" = the five markets with measured costs, 2015-26.', '',
    '| Key | Candidate | 2005-14 n | net (t) | gross | 2015-26 n | net (t) | gross | 2x cost | eight markets n | net (t) | gross | measured 15-26 net (t) | eligible |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of o.candidates) L.push(`| ${c.key} | ${c.name} | ${N(c.selection.n)} | ${f3(c.selection.net)} (${f2(c.selection.tNet)}) | ${f3(c.selection.gross)} | ${N(c.confirm1.n)} | ${f3(c.confirm1.net)} (${f2(c.confirm1.tNet)}) | ${f3(c.confirm1.gross)} | ${f3(c.confirm1.net2)} | ${N(c.confirm2.n)} | ${f3(c.confirm2.net)} (${f2(c.confirm2.tNet)}) | ${f3(c.confirm2.gross)} | ${f3(c.measuredMarkets2015.net)} (${f2(c.measuredMarkets2015.tNet)}) | ${c.eligible ? 'yes' : 'no'} |`);
  L.push('', '## Median and wins', '', '| Key | 2015-26 median net | wins | trades a year (ten markets) | eight markets median net | wins |', '|---|---:|---:|---:|---:|---:|');
  for (const c of o.candidates) L.push(`| ${c.key} | ${f3(c.confirm1.median)} | ${c.confirm1.win == null ? 'n/a' : (100 * c.confirm1.win).toFixed(1) + '%'} | ${N(c.confirm1.perYear)} | ${f3(c.confirm2.median)} | ${c.confirm2.win == null ? 'n/a' : (100 * c.confirm2.win).toFixed(1) + '%'} |`);
  if (o.perMarket.length) { L.push('', `## Per market, ${o.pick} after costs`, '', '| Market | n 05-14 | net 05-14 | n 15-26 | net 15-26 |', '|---|---:|---:|---:|---:|');
    for (const m of o.perMarket) L.push(`| ${m.market}${o.measured.includes(m.market) ? '' : '*'} | ${N(m.n1)} | ${f3(m.net1)} | ${N(m.n2)} | ${f3(m.net2)} |`);
    L.push('', '\\* cost ASSUMED.'); }
  L.push('', '## Markets', '', '| Market | candles from | signals | trades | cost |', '|---|---|---:|---:|---|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.trades)} | ${o.costs[m.market]}${m.assumed ? ' (assumed)' : ''} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push(`${o.pick} holds after costs in the second decade and on eight new markets. That makes it a candidate for a forward paper`,
    'record and a check at the broker\'s own bid / ask ticks, not an edge: these are mid candles, and most costs are assumed. Nothing',
    'is adopted; nothing live changed.');
  else if (o.verdict === 'FAIL') L.push('None of the fixed combinations makes the zone fade pay after costs in a way that holds out of sample. The hour, level and',
    'cost filters change how much of the before-cost tilt is kept and how much the round trip takes, but not enough to leave a',
    'positive, confirmed figure after costs. Not an edge. Do not re-test variants of these filters on these years or markets.',
    'Nothing live changed; no rule is proposed.');
  else L.push('The gate, the cut test or the market count did not hold, so nothing is judged.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'trades', r.rows.length, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
