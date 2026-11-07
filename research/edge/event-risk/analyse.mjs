// Event risk manager, step 2: the five pre-registered tests (preregistration.md) and the reported cells.
//
//   node research/edge/event-risk/analyse.mjs <council-data checkout> [out dir = this folder]
//
// Reads ict-hist.json and flat.json (build.mjs) from this folder, and from the checkout: ict/replay.json,
// research/replay-2w.json, research/replay-90d.json, backtest.json, trades.json. Writes result.json and tables.md.
// Paper research only: no live rule reads this.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HISTORY, EVENTS } from '../../../council/events.mjs';
import { futCost } from '../costs/costs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CD = process.argv[2] || 'data', OUT = process.argv[3] || HERE;
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(CD, f), 'utf8')); } catch { return null; } };
const own = (f) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'));

// ── pre-registered constants ──
export const TYPES = ['CPI', 'NFP', 'FOMC'], WIN = [-30, 60], FLAT = 300, START = Date.UTC(2022, 0, 1) / 1000, REPLAY_FROM = Date.UTC(2025, 7, 1) / 1000;
export const REL = [...HISTORY, ...EVENTS].filter((e) => TYPES.includes(e.type)).sort((a, b) => a.t - b.t);
// nearest release with -30 <= (e - T) / 60 <= +60
export function inWindow(e) { let best = null;
  for (const r of REL) { const m = (e - r.t) / 60; if (m < WIN[0] || m > WIN[1]) continue; if (!best || Math.abs(m) < Math.abs(best.m)) best = { r, m }; }
  return best; }
const relId = (r) => `${r.type}@${r.at}`;

// ── stats ──
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1)); };
export function stat(R) { const n = R.length; if (!n) return { n: 0 }; const m = mean(R), s = n > 1 ? sd(R) : 0;
  return { n, exp: +m.toFixed(3), R: +(m * n).toFixed(1), wr: +(R.filter((x) => x > 0).length / n).toFixed(3), t: s > 0 ? +(m / (s / Math.sqrt(n))).toFixed(2) : null }; }
export function welch(a, b) { if (a.length < 2 || b.length < 2) return null; const se = Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length); return se > 0 ? +((mean(a) - mean(b)) / se).toFixed(2) : null; }
const halves = (g) => { const s = [...g].sort((a, b) => a.e - b.e), k = Math.floor(s.length / 2); return [s.slice(0, k), s.slice(k)]; };
const clusterT = (g, key, val) => { const by = {}; for (const x of g) (by[key(x)] = by[key(x)] || []).push(val(x)); const ms = Object.values(by).map(mean); return { k: ms.length, ...(ms.length > 1 ? { ct: stat(ms).t } : {}) }; };

// ── H1: skip entries in the window ──
export function h1(rows) {
  const g = rows.filter((x) => x.win), k = rows.filter((x) => !x.win), net = (a) => a.map((x) => x.net);
  const [a1, a2] = halves(g), cl = clusterT(g, (x) => x.rel, (x) => x.net);
  const out = { in: stat(net(g)), inGross: stat(g.map((x) => x.gross)), kept: stat(net(k)), welch: welch(net(g), net(k)), h1: stat(net(a1)), h2: stat(net(a2)), releases: cl.k, clusterT: cl.ct ?? null,
    all: stat(net(rows)), filtered: stat(net(k)) };
  out.pass = { n: g.length >= 30, tOwn: out.in.t != null && out.in.t <= -2, tWelch: out.welch != null && out.welch <= -2, halves: g.length >= 2 && out.h1.exp < 0 && out.h2.exp < 0, netPositive: g.length > 0 && out.in.R < 0, releases: cl.k >= 10 };
  out.verdict = Object.values(out.pass).every(Boolean) ? 'PASS' : 'FAIL';
  return out;
}
// ── H2: flatten at T - 5 min (paired) ──
export function h2(rows) {
  const g = rows.filter((x) => x.flatNet != null), d = g.map((x) => x.net - x.flatNet), [a1, a2] = halves(g), cl = clusterT(g, (x) => x.flatRel, (x) => x.net - x.flatNet);
  const dd = (a) => stat(a.map((x) => x.net - x.flatNet));
  const out = { n: g.length, held: stat(g.map((x) => x.net)), flat: stat(g.map((x) => x.flatNet)), d: stat(d), welch: welch(g.map((x) => x.net), g.map((x) => x.flatNet)), h1: dd(a1), h2: dd(a2), releases: cl.k, clusterT: cl.ct ?? null,
    gainFromFlatten: +(-d.reduce((p, q) => p + q, 0)).toFixed(2), missing: rows.filter((x) => x.flatMissing).length };
  out.pass = { n: g.length >= 30, tPaired: out.d.t != null && out.d.t <= -2, halves: g.length >= 2 && out.h1.exp < 0 && out.h2.exp < 0, netPositive: out.gainFromFlatten > 0, releases: cl.k >= 10 };
  out.verdict = Object.values(out.pass).every(Boolean) ? 'PASS' : 'FAIL';
  return out;
}
const byKey = (rows, f, fn) => { const o = {}; for (const k of [...new Set(rows.map(f))].sort()) o[k] = fn(rows.filter((x) => f(x) === k)); return o; };
export function tagRows(rows) { for (const x of rows) { const w = inWindow(x.e); x.win = !!w; x.rel = w ? relId(w.r) : null; x.type = w ? w.r.type : null; x.side = w ? (w.m < 0 ? 'before' : 'after') : null; } return rows; }

// ── loaders: { sys, mk, e, x, net, gross, flatNet? } ──
const FUT = { nq: 'NQ', es: 'ES', ym: 'YM', rty: 'RTY', gc: 'GC' };
function ictRows(flatJ) {
  const out = [];
  for (const q of own('ict-hist.json').trades) {   // HistData 2022-01 .. 2025-07
    const s = q.side === 'buy' ? 1 : -1, net = q.size * (q.Rraw - q.costR), row = { part: 'histdata', mk: q.market, e: q.e, x: q.x, net, gross: q.size * q.Rraw };
    if (q.flat) { row.flatRel = `${q.flat.type}@${new Date(q.flat.T * 1000).toISOString().replace('.000', '')}`;
      if (q.flat.px != null) row.flatNet = q.size * ((s * (q.flat.px - q.entry)) / q.r0 - q.costR); else row.flatMissing = true; }
    out.push(row);
  }
  const rep = rd('ict/replay.json');
  for (const q of (rep && rep.trades) || []) {   // futures replay 2025-08 ..
    if (!q.aset || !['win', 'loss', 'be'].includes(q.status) || q.R == null || q.signalAt < REPLAY_FROM) continue;
    const size = q.size || 1, Rraw = q.Rraw ?? q.R, c = futCost(FUT[q.market]), costR = (c.spread + c.comm + c.slipM + c.slipS) / q.r0, s = q.side === 'buy' ? 1 : -1;
    const row = { part: 'replay', mk: q.market, e: q.signalAt, x: q.closed, net: size * (Rraw - costR), gross: size * Rraw };
    const f = flatJ[q.id]; if (f) { row.flatRel = `${f.type}@${new Date(f.T * 1000).toISOString().replace('.000', '')}`;
      if (f.px != null) row.flatNet = size * ((s * (f.px - q.entry)) / q.r0 - costR); else row.flatMissing = true; }
    out.push(row);
  }
  return tagRows(out);
}
const MCOST = { 'nq-open': 0.5, replica: 0.3 };   // the replay's own costs (replay-2w.json note): NQ 0.5 pt, gold 0.30
function msysRows(flatJ) {
  const r = rd('research/replay-2w.json'), out = [];
  for (const q of (r && r.trades) || []) {
    if (q.shadow || !['win', 'loss', 'be'].includes(q.status) || q.R == null) continue;
    const e = q.filled || q.opened; if (e < START) continue;
    const row = { part: e < REPLAY_FROM ? 'before Aug 2025' : 'from Aug 2025', mk: q.market, sys: q.k, e, x: q.closed, net: q.R, gross: q.R };
    const f = flatJ[q.id];
    if (f && MCOST[q.k] != null) { row.flatRel = `${f.type}@${new Date(f.T * 1000).toISOString().replace('.000', '')}`;
      if (q.addOf || (q.size || 1) > 1) row.flatMissing = true;   // add-on units: left out (pre-registered)
      else if (f.px == null) row.flatMissing = true;
      else { const s = q.side === 'buy' ? 1 : -1, r0 = q.t1 != null && q.rr ? Math.abs(q.t1 - q.entry) / q.rr : Math.abs(q.entry - q.stop);
        row.flatNet = (s * (f.px - q.entry)) / r0 - MCOST[q.k] / r0; } }
    out.push(row);
  }
  return tagRows(out);
}
function dumpRows(b, ds) {
  if (!b || !b.trades) return [];
  const c = Object.fromEntries(b.tradeCols.map((k, i) => [k, i]));
  return tagRows(b.trades.filter((x) => x[c.status] === 'closed' && !String(x[c.setup]).endsWith('@mkt') && x[c.R_none] != null)
    .map((x) => ({ part: ds, mk: x[c.market], sys: x[c.setup], e: x[c.filled] || x[c.opened], net: x[c.R_none] - (x[c.cost] || 0), gross: x[c.R_none] })));
}
function liveRows(shadow) {
  const t = rd('trades.json');
  return tagRows((Array.isArray(t) ? t : []).filter((x) => ['win', 'loss', 'be'].includes(x.status) && x.R != null && !!x.shadow === shadow)
    .map((x) => ({ part: shadow ? 'live shadow' : 'live', mk: x.market, sys: x.k, e: x.filled || x.opened, x: x.closed, net: x.R, gross: x.R })));
}

// ── run ──
export function run() {
const flatJ = own('flat.json').flat;
const ICT = ictRows(flatJ), MSYS = msysRows(flatJ), MSET = dumpRows(rd('research/replay-90d.json'), 'replay 90d');
const H2SYS = MSYS.filter((x) => MCOST[x.sys] != null);
const span = (rows) => rows.length ? [new Date(Math.min(...rows.map((x) => x.e)) * 1000).toISOString().slice(0, 10), new Date(Math.max(...rows.map((x) => x.e)) * 1000).toISOString().slice(0, 10)] : null;
const res = {
  topic: 'event-risk', at: new Date().toISOString(), prereg: 'research/edge/event-risk/preregistration.md',
  events: { types: TYPES, window: WIN, flattenMin: FLAT / 60, releases: REL.filter((r) => r.t >= START && r.t < Date.now() / 1000).length },
  samples: { ICT: { n: ICT.length, span: span(ICT), parts: byKey(ICT, (x) => x.part, (a) => a.length) }, MSYS: { n: MSYS.length, span: span(MSYS), systems: byKey(MSYS, (x) => x.sys, (a) => a.length) }, MSET: { n: MSET.length, span: span(MSET) } },
  tests: {
    'H1-ICT': h1(ICT), 'H2-ICT': h2(ICT), 'H1-MSYS': h1(MSYS), 'H2-MSYS': h2(H2SYS), 'H1-MSET': h1(MSET),
  },
  reported: {
    'H1-ICT by market': byKey(ICT, (x) => x.mk, h1), 'H1-ICT by part': byKey(ICT, (x) => x.part, h1),
    'H1-ICT by type': byKey(ICT.filter((x) => x.win), (x) => x.type, (a) => stat(a.map((x) => x.net))), 'H1-ICT by side': byKey(ICT.filter((x) => x.win), (x) => x.side, (a) => stat(a.map((x) => x.net))),
    'H2-ICT by market': byKey(ICT.filter((x) => x.flatNet != null), (x) => x.mk, h2), 'H2-ICT by part': byKey(ICT.filter((x) => x.flatNet != null), (x) => x.part, h2),
    'H2-ICT by type': byKey(ICT.filter((x) => x.flatNet != null), (x) => x.flatRel.split('@')[0], h2),
    'H1-MSYS by system': byKey(MSYS, (x) => x.sys, h1), 'H1-MSYS by part': byKey(MSYS, (x) => x.part, h1),
    'H1-MSYS by type': byKey(MSYS.filter((x) => x.win), (x) => x.type, (a) => stat(a.map((x) => x.net))),
    'H2-MSYS by system': byKey(H2SYS.filter((x) => x.flatNet != null), (x) => x.sys, h2), 'H2-MSYS by part': byKey(H2SYS.filter((x) => x.flatNet != null), (x) => x.part, h2),
    'H1-MSET by market': byKey(MSET, (x) => x.mk, h1),
    'H1 backtest 30d': h1(dumpRows(rd('backtest.json'), 'backtest 30d')), 'H1 live': h1(liveRows(false)), 'H1 live shadow': h1(liveRows(true)),
  },
};
res.verdict = Object.values(res.tests).some((t) => t.verdict === 'PASS') ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 1) + '\n');

// ── tables.md ──
const f3 = (v) => (v == null ? '–' : (v >= 0 ? '+' : '') + v.toFixed(3)), ft = (v) => (v == null ? '–' : v.toFixed(2));
const L = [`# Event risk tables (generated ${res.at})`, '', 'Net R (costs included). H1 = entries within [−30, +60] min of a CPI / NFP / FOMC release vs the rest. H2 = trades open 5 min before a release, held vs flattened at T − 5 min (d = held − flattened, paired). Halves: the group sorted by entry time, split by count.', ''];
L.push('## H1 (skip)', '', '| test / cell | n in | R/trade in | t in | n kept | R/trade kept | Welch t | half 1 | half 2 | releases | cluster t | in total R | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const h1row = (name, o) => L.push(`| ${name} | ${o.in.n} | ${f3(o.in.exp)} | ${ft(o.in.t)} | ${o.kept.n} | ${f3(o.kept.exp)} | ${ft(o.welch)} | ${f3(o.h1.exp)} (${o.h1.n}) | ${f3(o.h2.exp)} (${o.h2.n || 0}) | ${o.releases} | ${ft(o.clusterT)} | ${o.in.R ?? '–'} | ${o.verdict} |`);
for (const k of ['H1-ICT', 'H1-MSYS', 'H1-MSET']) h1row(`**${k}**`, res.tests[k]);
for (const sec of ['H1-ICT by market', 'H1-ICT by part', 'H1-MSYS by system', 'H1-MSYS by part', 'H1-MSET by market']) for (const [k, o] of Object.entries(res.reported[sec])) h1row(`${sec.replace(' by ', ' · ')}: ${k}`, o);
for (const k of ['H1 backtest 30d', 'H1 live', 'H1 live shadow']) h1row(k, res.reported[k]);
L.push('', '### H1 in-window trades by release type and side', '', '| cell | n | R/trade | t |', '|---|---|---|---|');
for (const sec of ['H1-ICT by type', 'H1-ICT by side', 'H1-MSYS by type']) for (const [k, o] of Object.entries(res.reported[sec])) L.push(`| ${sec}: ${k} | ${o.n} | ${f3(o.exp)} | ${ft(o.t)} |`);
L.push('', '## H2 (flatten 5 min before)', '', '| test / cell | n | held R/trade | flattened R/trade | d (held − flat) | paired t | Welch t | half 1 d | half 2 d | releases | cluster t | R gained by flattening | left out | verdict |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const h2row = (name, o) => L.push(`| ${name} | ${o.n} | ${f3(o.held.exp)} | ${f3(o.flat.exp)} | ${f3(o.d.exp)} | ${ft(o.d.t)} | ${ft(o.welch)} | ${f3(o.h1.exp)} | ${f3(o.h2.exp)} | ${o.releases} | ${ft(o.clusterT)} | ${o.gainFromFlatten} | ${o.missing} | ${o.verdict} |`);
for (const k of ['H2-ICT', 'H2-MSYS']) h2row(`**${k}**`, res.tests[k]);
for (const sec of ['H2-ICT by market', 'H2-ICT by part', 'H2-ICT by type', 'H2-MSYS by system', 'H2-MSYS by part']) for (const [k, o] of Object.entries(res.reported[sec])) h2row(`${sec.replace(' by ', ' · ')}: ${k}`, o);
fs.writeFileSync(path.join(OUT, 'tables.md'), L.join('\n') + '\n');
console.log('verdict', res.verdict, Object.fromEntries(Object.entries(res.tests).map(([k, o]) => [k, `${o.verdict} n=${o.in ? o.in.n : o.n} ${o.in ? `exp ${o.in.exp} t ${o.in.t} welch ${o.welch}` : `d ${o.d.exp} t ${o.d.t}`} halves ${o.h1.exp}/${o.h2.exp} rel ${o.releases}`])));
return res;
}

if (process.argv[1] && process.argv[1].endsWith(path.join('event-risk', 'analyse.mjs'))) run();
