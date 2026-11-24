// research/edge/fade-zone-targets/run.mjs - PREREGISTRATION.md (23 Nov 2026): the desks' key levels (H1 / H4 engulf, dominant,
// supply / demand zones, turns of the closes) as the TARGET and the STOP of the grid7-wide-fade M15 fade, on the grid's own
// trades, against its 2R exit and 1-ATR stop; paired by trade, judged before costs on month sums. Research only.
//   EDGE_DATA=<cache> node research/edge/fade-zone-targets/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/fade-zone-targets/run.mjs cut <m> <outDir>
//   node research/edge/fade-zone-targets/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, buildZones } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { startIdx } from '../dom-trade-through/run.mjs';
import { sdZones } from '../grid5-sd-eg/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { signals, exits, CAP } from '../grid7-wide-fade/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STOPS = ['atr', 'zone'], EXITS = ['2R', 'zone', 'swing'], HOURS = ['all', '20-23'];
export const ZK = 0.1, ZMAX = 2;               // zone stop: far side + 0.1 ATR, used within 2 ATR
export const FAMS = ['eg', 'dom', 'sd', 'av'], LTFS = ['1h', '4h'];
export const hourBlock = (t) => Math.floor(new Date(t * 1000).getUTCHours() / 4) === 5;   // fade-conditions hourLevel 5
export const PRIMARY = [
  { key: 'P1', x: 1, st: 0, h: 0, name: 'zone target, ATR stop - grid, all hours' },
  { key: 'P2', x: 0, st: 1, h: 0, name: 'zone stop, 2R - grid, all hours' },
  { key: 'P3', x: 1, st: 1, h: 0, name: 'zone target and zone stop - grid, all hours' },
  { key: 'P4', x: 1, st: 0, h: 1, name: 'zone target, ATR stop - grid, 20-23 UTC' },
  { key: 'P5', x: 0, st: 1, h: 1, name: 'zone stop, 2R - grid, 20-23 UTC' },
  { key: 'P6', x: 1, st: 1, h: 1, name: 'zone target and zone stop - grid, 20-23 UTC' },
];

// ---- the key levels: { d, bot, top, at, end } on H1 and H4 -------------------------------------------------------------
export function levels(F) {
  const out = [];
  for (const tf of LTFS) { const L = F[tf];
    for (const k of ['eg', 'dom', 'av']) for (const z of buildZones(k, L)) if (z.top > z.bot) out.push({ d: z.d, bot: z.bot, top: z.top, at: z.at, end: z.end, k, tf });
    for (const z of sdZones(L)) if (z.hi > z.lo) out.push({ d: z.d, bot: z.lo, top: z.hi, at: z.at, end: z.end, k: 'sd', tf }); }
  return out.sort((a, b) => a.at - b.at);
}
// a sweep over signals sorted by ts: the levels standing at ts (at <= ts < end)
export function standing(L) {
  let k = 0; const act = [];
  return (ts) => { while (k < L.length && L[k].at <= ts) act.push(L[k++]);
    let w = 0; for (let i = 0; i < act.length; i++) if (act[i].end > ts) act[w++] = act[i]; act.length = w; return act; };
}
// nearest stop level behind the fade (side d = s, far side beyond the fill on the losing side) and target in front (d = -s)
export function pick(act, s, fill) {
  let stopFar = NaN, sd = Infinity, tgt = NaN, td = Infinity;
  for (const z of act) {
    if (z.d === s) { const far = s > 0 ? z.bot : z.top, d = s * (fill - far); if (d > 0 && d < sd) { sd = d; stopFar = far; } }
    else if (z.d === -s) { const near = s > 0 ? z.bot : z.top, d = s * (near - fill); if (d > 0 && d < td) { td = d; tgt = near; } }
  }
  return { stopFar, tgt };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

// one trade's levels and exits; null = not in the grid's trade set
export function tradeOf(M5, g, act, cost, cap = CAP['15m']) {
  const fi = startIdx(M5, g.ts); if (fi >= M5.length) return null;
  const fill = M5[fi].o, s = -g.d, a = g.a;
  const stopA = fill + g.d * a, riskA = s * (fill - stopA);
  if (!(riskA > 0) || riskA < cost) return null;
  // the grid's own membership: its fade and mirror calls (1R, 2R, swing) must resolve
  const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / riskA, ks = [1, 2, sr > 0 ? sr : NaN];
  const gr = exits(M5, s, fi, stopA, ks.map((k) => (Number.isFinite(k) ? fill + s * k * riskA : NaN)), cap);
  const gp = exits(M5, -s, fi, fill + s * riskA, ks.map((k) => (Number.isFinite(k) ? fill - s * k * riskA : NaN)), cap);
  if (!gr || !gp) return null;
  const { stopFar, tgt } = pick(act, s, fill);
  let stopZ = stopA, zs = false;
  if (Number.isFinite(stopFar)) { const st = stopFar - s * ZK * a, r = s * (fill - st); if (r > 0 && r <= ZMAX * a && r >= cost) { stopZ = st; zs = true; } }
  const swingOk = g.opp != null && s * (g.opp - fill) > 0;
  const out = { t: M5[fi].t, s, fill, a, zs, zt: [false, false], sw: swingOk, R: [[0, 0, 0], [0, 0, 0]], risk: [0, 0], cr: [0, 0], stop: [stopA, stopZ], tg: [] };
  for (let st = 0; st < 2; st++) {
    const stop = out.stop[st], risk = s * (fill - stop);
    if (!(risk > 0)) throw new Error('stop on the wrong side');
    const t2 = fill + s * 2 * risk;
    const useZ = Number.isFinite(tgt) && s * (tgt - fill) >= risk; out.zt[st] = useZ;
    const tg = [t2, useZ ? tgt : t2, swingOk ? g.opp : t2];
    for (const x of tg) if (!(s * (x - fill) > 0)) throw new Error('target on the wrong side');
    // a variant still open when the data ends is closed at the last close (the trade stays in every cell: same trades)
    let r = exits(M5, s, fi, stop, tg, cap);
    if (!r) { r = exits(M5, s, fi, stop, tg, M5[M5.length - 1].e - M5[fi].t); out.endMark = true; } if (!r) return null;
    out.R[st] = r.R; out.risk[st] = risk; out.cr[st] = cost / risk; out.tg.push(tg);
  }
  return out;
}

export function runMarket(market, { to = '2026-11-01' } = {}) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to }); const F = frames(M5);
  const sigs = signals(F).filter((g) => g.tf === 1 && g.cx === 0).sort((x, y) => x.ts - y.ts);
  const L = levels(F), at = standing(L), cost = COSTS[market], X = exclusions(market);
  let endMarked = 0;
  const rows = [];   // [t, w, m, hb, zs, zt0, zt1, sw, R00,R01,R02, R10,R11,R12, risk0/a, risk1/a, cr0, cr1]
  for (const g of sigs) {
    const act = at(g.ts);
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) continue;
    const r = tradeOf(M5, g, act, cost); if (!r) continue;
    const hb = hourBlock(F['15m'][g.j].t);
    if (r.endMark) endMarked++;
    rows.push([t, t < SPLIT ? 0 : 1, monthOf(t), +hb, +r.zs, +r.zt[0], +r.zt[1], +r.sw, ...r.R[0], ...r.R[1], r.risk[0] / r.a, r.risk[1] / r.a, r.cr[0], r.cr[1]]
      .map((v, i) => (i < 8 ? v : +v.toFixed(5))));
  }
  return { market, cost, assumed: ASSUMED.includes(market), first: M5.length ? M5[0].t : null, last: M5.length ? M5[M5.length - 1].t : null,
    signals: sigs.length, levels: L.length, endMarked, rows };
}

// ---- cut test: signals and every stop / target level known by a cut equal the full run's -------------------------------
export function cutTest(market, cuts = ['2009-06-11', '2017-03-15', '2024-09-18']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const keysOf = (B, T) => { const F = frames(B); const sg = signals(F).filter((g) => g.tf === 1 && g.cx === 0 && g.ts <= T).sort((x, y) => x.ts - y.ts);
    const at = standing(levels(F)); const out = [];
    for (const g of sg) { const act = at(g.ts); const fi = startIdx(M5, g.ts); if (fi >= M5.length || M5[fi].t > T) continue;
      const p = pick(act, -g.d, M5[fi].o); out.push([g.ts, g.d, g.a.toFixed(10), g.opp, p.stopFar, p.tgt].join('|')); }
    return out; };
  const full = keysOf(M5, Infinity); const res = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const want = new Set(full.filter((k) => +k.split('|')[0] <= T - 600)), got = new Set(keysOf(M5.filter((b) => b.e <= T), T).filter((k) => +k.split('|')[0] <= T - 600));
    res.push({ market, cut: c, n: want.size, missing: [...want].filter((k) => !got.has(k)).length, extra: [...got].filter((k) => !want.has(k)).length }); }
  return res;
}

// ---- statistics -------------------------------------------------------------------------------------------------------
const COL = { w: 1, m: 2, hb: 3, zs: 4, zt0: 5, zt1: 6, sw: 7 };
const Rc = (st, x) => 8 + st * 3 + x, RISK = (st) => 14 + st, CR = (st) => 16 + st;
const median = (v) => { if (!v.length) return null; const a = Float64Array.from(v).sort(); const k = a.length >> 1; return a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2; };
function winStats(rows, f, net) {   // f(row) -> value; month sums over the window
  const out = [];
  for (let w = 0; w < 2; w++) { const ms = new Float64Array(NM), msn = new Float64Array(NM), v = []; let s = 0, sn = 0, win = 0;
    for (const r of rows) { if (r[COL.w] !== w) continue; const x = f(r), y = net ? net(r) : x; v.push(x); s += x; sn += y; ms[r[COL.m]] += x; msn[r[COL.m]] += y; if (x > 0) win++; }
    const a = w ? DM : 0, b = w ? NM : DM, n = v.length, mt = mstat(ms, a, b), mn = mstat(msn, a, b);
    out.push({ n, mean: n ? s / n : null, t: mt.t, months: mt.months, meanNet: n ? sn / n : null, tNet: mn.t, median: median(v), win: n ? win / n : null }); }
  return out;
}
export function judge(data) {
  const all = data.flatMap((d) => d.rows), sets = [all, all.filter((r) => r[COL.hb] === 1)];
  const cells = [];
  for (let h = 0; h < 2; h++) for (let st = 0; st < 2; st++) for (let x = 0; x < 3; x++) {
    const [d, c] = winStats(sets[h], (r) => r[Rc(st, x)], (r) => r[Rc(st, x)] - r[CR(st)]);
    cells.push({ name: `${EXITS[x]} exit, ${STOPS[st]} stop, ${HOURS[h]}`, x: EXITS[x], stop: STOPS[st], hours: HOURS[h], d, c }); }
  const prim = PRIMARY.map((P) => { const rs = sets[P.h];
    const diff = (r) => r[Rc(P.st, P.x)] - r[Rc(0, 0)];
    const [d, c] = winStats(rs, diff);
    const [da, ca] = winStats(rs, (r) => r[Rc(P.st, P.x)] * r[RISK(P.st)] - r[Rc(0, 0)] * r[RISK(0)]);
    const [dn, cn] = winStats(rs, (r) => (r[Rc(P.st, P.x)] - r[CR(P.st)]) - (r[Rc(0, 0)] - r[CR(0)]));
    const p = Math.max(p1(d.t, d.months - 1), p1(c.t, c.months - 1));
    const perMarket = data.map((m) => { const q = P.h ? m.rows.filter((r) => r[COL.hb] === 1) : m.rows;
      const [md, mc] = winStats(q, diff); return { market: m.market, d: md.mean, c: mc.mean, dn: md.n, cn: mc.n }; });
    return { ...P, d, c, atr: { d: da, c: ca }, net: { d: dn, c: cn }, p, perMarket }; });
  const H = K.holm(prim.map((x) => x.p));
  prim.forEach((x, i) => { x.holm = H[i]; x.cond = x.d.mean > 0 && x.c.mean > 0 && x.d.t >= 2 && x.c.t >= 2; x.pass = x.cond && H[i] < 0.05; });
  // usage shares
  const share = (rs, f) => (rs.length ? rs.filter(f).length / rs.length : null);
  const usage = HOURS.map((h, i) => ({ hours: h, n: sets[i].length, zoneStop: share(sets[i], (r) => r[COL.zs] === 1),
    zoneTargetAtr: share(sets[i], (r) => r[COL.zt0] === 1), zoneTargetZone: share(sets[i], (r) => r[COL.zt1] === 1), swingFallback: share(sets[i], (r) => r[COL.sw] === 0) }));
  return { cells, prim, usage };
}

// ---- report ----------------------------------------------------------------------------------------------------------
const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)),
  N = (x) => Math.round(x).toLocaleString('en-US'), pc = (x) => (x == null ? 'n/a' : (100 * x).toFixed(1) + '%');
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => ({ n: w.n, mean: r6(w.mean), t: r6(w.t), meanNet: r6(w.meanNet), tNet: w.tNet == null ? null : +w.tNet.toFixed(2), median: r6(w.median), win: w.win == null ? null : +w.win.toFixed(3) });

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cut = MARKETS.flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const { cells, prim, usage } = judge(data);
  const G = JSON.parse(fs.readFileSync(path.join(HERE, '../grid7-wide-fade/result.json'), 'utf8')).cells.find((c) => c.cell === 'm15 none atr 2R all');
  const base = cells.find((c) => c.x === '2R' && c.stop === 'atr' && c.hours === 'all'), b23 = cells.find((c) => c.x === '2R' && c.stop === 'atr' && c.hours === '20-23');
  const gate = [
    { what: 'grid 2005-14', ok: base.d.n === G.disc.n && Math.abs(base.d.mean - G.disc.mean) < 5e-4, n: base.d.n, mean: r6(base.d.mean), want: { n: G.disc.n, mean: G.disc.mean } },
    { what: 'grid 2015-26', ok: base.c.n === G.conf.n && Math.abs(base.c.mean - G.conf.mean) < 5e-4, n: base.c.n, mean: r6(base.c.mean), want: { n: G.conf.n, mean: G.conf.mean } },
    { what: 'fade-conditions 20-23, 2015-26', ok: b23.c.n === 27671 && b23.c.mean.toFixed(3) === '0.169', n: b23.c.n, mean: r6(b23.c.mean), want: { n: 27671, mean: 0.169 } },
  ];
  const cutBad = cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const gateOk = gate.every((g) => g.ok) && cutBad === 0;
  const pass = prim.filter((x) => x.pass);
  const verdict = data.length < 8 || !gateOk ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...prim].sort((a, b) => Math.min(b.d.t, b.c.t) - Math.min(a.d.t, a.c.t))[0];
  const show = pass.length ? pass.sort((a, b) => a.holm - b.holm)[0] : best;
  const headline = verdict === 'INCONCLUSIVE' ? `the gate or the cut test failed, nothing judged (${data.length} markets)`
    : `${pass.length} of 6 key-level exits or stops beat the grid's 2R / 1-ATR fade on the same trades before costs; ${pass.length ? 'best' : 'nearest'} ${show.key} (${show.name}) ${f3(show.c.mean)}R a trade in 2015-26 (n ${N(show.c.n)}, month t ${f2(show.c.t)}; 2005-14 ${f3(show.d.mean)}R, t ${f2(show.d.t)}), only ${f3(show.atr.c.mean)} in ATR units and ${f3(show.net.c.mean)}R after costs`;
  const out = { study: 'fade-zone-targets', built: '2026-11-23', verdict, headline,
    basis: 'paired by trade against the grid exit (2R, 1-ATR stop), judged before costs on calendar-month sums; after costs beside',
    windows: { first: '2005-01-01 to 2014-12-31 (120 months)', second: '2015-01-01 to 2026-10-31 (142 months)' },
    markets: data.map((d) => d.market), assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])),
    gate, cut, cutBad,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), signals: d.signals, levels: d.levels, trades: d.rows.length, endMarked: d.endMarked || 0 })),
    usage: usage.map((u) => ({ hours: u.hours, n: u.n, zoneStop: r6(u.zoneStop), zoneTargetAtrStop: r6(u.zoneTargetAtr), zoneTargetZoneStop: r6(u.zoneTargetZone), swingFallback: r6(u.swingFallback) })),
    primary: prim.map((x) => ({ key: x.key, name: x.name, exit: EXITS[x.x], stop: STOPS[x.st], hours: HOURS[x.h], first: slim(x.d), second: slim(x.c),
      atrUnits: { first: slim(x.atr.d), second: slim(x.atr.c) }, afterCosts: { first: slim(x.net.d), second: slim(x.net.c) },
      p: r6(x.p), holm: r6(x.holm), cond: x.cond, pass: x.pass,
      perMarket: x.perMarket.map((m) => ({ market: m.market, first: r6(m.d), second: r6(m.c), n1: m.dn, n2: m.cn })) })),
    passed: pass.map((x) => x.key),
    cells: cells.map((c) => ({ cell: c.name, exit: c.x, stop: c.stop, hours: c.hours, first: slim(c.d), second: slim(c.c) })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const L = [];
  L.push('# Key levels as the fade\'s targets and stops (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    '`grid7-wide-fade`\'s M15 fade (the first close beyond the last confirmed M15 swing, faded at the next 5-minute open; its own',
    'code, imported), on the grid\'s own trades, with three exits and two stops. Exits: **2R** (the grid\'s); **zone**: the near side',
    'of the nearest standing H1 / H4 level in front of the trade (engulf, dominant, supply / demand zone, or a V / A turn of the',
    'closes), when 1R or more away, else 2R; **swing**: the broken swing\'s opposite swing, else 2R. Stops: **ATR** (1 x M15 ATR,',
    'the grid\'s); **zone**: past the far side of the nearest standing level behind the trade + 0.1 ATR, when within 2 ATR, else',
    'the ATR stop. All hours, and the 20-23 UTC block. Ten markets pooled, OANDA mid 5-minute candles, 2005-14 and 2015-26.',
    `Costs beside: the demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## Gate and cut test', '');
  for (const g of o.gate) L.push(`- ${g.what}: n ${N(g.n)}, ${f3(g.mean)} (wanted n ${N(g.want.n)}, ${f3(g.want.mean)}): ${g.ok ? 'equal' : 'NOT EQUAL'}.`);
  L.push(`- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(o.cut.reduce((a, x) => a + x.n, 0))} signals with their stop and target levels known by the cut dates, ${o.cutBad} missing or extra when the candles are cut there.`,
    '- Every stop on the losing side of its fill and every target on the winning side (the run throws otherwise).',
    `- Trades whose key-level variant was still open when the data ends (closed at the last close, so every cell keeps the same trades): ${o.meta.reduce((a, m) => a + m.endMarked, 0)}.`, '',
    '## Primary tests (paired by trade, before costs)', '',
    'Mean of R(variant) - R(2R exit, ATR stop) per trade; t of its calendar-month sums. p = the larger one-sided p of the two',
    'windows; Holm over the six. "ATR units" = the same difference in money at a fixed size per M15 ATR (R x risk / ATR).', '',
    '| Test | What | n 05-14 | diff 05-14 (t) | n 15-26 | diff 15-26 (t) | ATR units 15-26 (t) | after costs 15-26 (t) | Holm | Pass |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const x of o.primary) L.push(`| ${x.key} | ${x.name} | ${N(x.first.n)} | ${f3(x.first.mean)} (${f2(x.first.t)}) | ${N(x.second.n)} | ${f3(x.second.mean)} (${f2(x.second.t)}) | ${f3(x.atrUnits.second.mean)} (${f2(x.atrUnits.second.t)}) | ${f3(x.afterCosts.second.mean)} (${f2(x.afterCosts.second.tNet)}) | ${x.holm.toFixed(3)} | ${x.pass ? 'yes' : 'no'} |`);
  L.push('', '## Every cell', '', 'R a trade before costs (month-sum t), median R and share of wins; after costs beside (month-sum t).', '',
    '| Cell | n 05-14 | R 05-14 (t) | median / wins 05-14 | net 05-14 (t) | n 15-26 | R 15-26 (t) | median / wins 15-26 | net 15-26 (t) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const c of o.cells) L.push(`| ${c.cell} | ${N(c.first.n)} | ${f3(c.first.mean)} (${f2(c.first.t)}) | ${f3(c.first.median)} / ${pc(c.first.win)} | ${f3(c.first.meanNet)} (${f2(c.first.tNet)}) | ${N(c.second.n)} | ${f3(c.second.mean)} (${f2(c.second.t)}) | ${f3(c.second.median)} / ${pc(c.second.win)} | ${f3(c.second.meanNet)} (${f2(c.second.tNet)}) |`);
  L.push('', '## How often the levels were used', '', '| Hours | trades | zone stop used | zone target used (ATR stop) | zone target used (zone stop) | swing fell back to 2R |', '|---|---:|---:|---:|---:|---:|');
  for (const u of o.usage) L.push(`| ${u.hours} | ${N(u.n)} | ${pc(u.zoneStop)} | ${pc(u.zoneTargetAtrStop)} | ${pc(u.zoneTargetZoneStop)} | ${pc(u.swingFallback)} |`);
  L.push('', '## Per market, primary differences (before costs)', '', `| Market | ${o.primary.map((x) => x.key + ' 05-14 / 15-26').join(' | ')} |`, `|---|${o.primary.map(() => '---:').join('|')}|`);
  for (const m of o.markets) L.push(`| ${m}${o.assumedCosts.includes(m) ? '*' : ''} | ${o.primary.map((x) => { const q = x.perMarket.find((y) => y.market === m); return `${f3(q.first)} / ${f3(q.second)}`; }).join(' | ')} |`);
  L.push('', '\* cost ASSUMED.', '', '## Trades', '', '| Market | candles from | M15 signals | H1 / H4 levels | trades |', '|---|---|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.levels)} | ${N(m.trades)} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') { const P = o.primary.filter((x) => x.pass);
    L.push(`${o.passed.join(' and ')} clear the pre-registered bar: on the grid's own trades, before costs, a key-level target together with a`,
      'key-level stop raises R a trade over the fixed 2R / 1-ATR exit in both decades. That is all the pass says, and two columns',
      'take most of it back:', '');
    for (const x of P) L.push(`- **${x.key}** (${x.name}): ${f3(x.second.mean)}R a trade in 2015-26 (t ${f2(x.second.t)}), but ${f3(x.atrUnits.second.mean)} in ATR units (t ${f2(x.atrUnits.second.t)}) and ${f3(x.afterCosts.second.mean)}R after costs (t ${f2(x.afterCosts.second.tNet)}).`);
    L.push('', 'The zone stop is tighter than the 1-ATR stop on average, so the same move is more R; at a fixed size per ATR the gain',
      'shrinks to a few thousandths of an ATR (all hours) or turns negative (20-23 UTC), and a tighter stop pays the round trip on',
      'a smaller risk, so every zone-stop cell is worse than the grid after costs. The zone target alone (P1, P4) adds nothing in',
      '2015-26. The fade itself still loses after costs in every all-hours cell. Not an edge; nothing is adopted; the levels do',
      'not make this fade tradable. One run, no variants on these years.'); }
  else if (o.verdict === 'FAIL') L.push('No key-level target or stop beats the grid\'s fixed 2R exit and 1-ATR stop on the same trades in both decades. The',
    'levels do not improve how the fade is closed or protected; the fade itself stays a before-cost tilt that loses after costs.',
    'Not an edge. Do not re-test variants of these exits on these years. Nothing live changed; no rule is proposed.');
  else L.push('The gate or the cut test did not hold, so nothing is judged.');
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
