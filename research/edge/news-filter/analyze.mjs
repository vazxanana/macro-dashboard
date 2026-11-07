// News-window study: do trades entered around high-impact economic news (CPI, NFP, FOMC, PCE, ISM, jobless claims, ECB,
// BoJ) do worse or better than the rest? Tags every replay / backtest / live trade with council/events.mjs and compares groups.
//
// Usage: node research/edge/news-filter/analyze.mjs <council-data checkout> [out dir = this folder]
// Reads (each optional): ict/replay.json, backtest.json, research/replay-90d.json, research/replay-2w.json, trades.json
// Writes result.json and tables.md next to this script. Paper research only: no live rule reads this.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nearEvent, eventDay, eventsBetween, tradingDay } from '../../../council/events.mjs';

const DATA = process.argv[2] || 'data';
const OUT = process.argv[3] || path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { return null; } };

// event sets: ALL = every type; T1 = CPI/NFP/FOMC/PCE; CB = ECB/BoJ; T2 = ISM + claims
export const SETS = { ALL: {}, T1: { tier: 1 }, CB: { tier: 'cb' }, T2: { tier: 2 } };
export const WINDOWS = [30, 60, 120];

// ─── trade loaders: { sys, ds, mk, t (entry, unix s), x (exit or null), R (per unit, net) } ───
function ictTrades(r) {
  const out = [];
  for (const q of (r && r.trades) || []) {
    if (!['win', 'loss', 'be'].includes(q.status) || q.R == null) continue;
    const R = q.Rraw ?? (q.size ? q.R / q.size : q.R);
    out.push({ sys: 'ICT', ds: 'replay all signals', mk: q.market, t: q.opened || q.signalAt, x: q.closed, R });
    if (q.aset) out.push({ sys: 'ICT', ds: 'replay A-setups', mk: q.market, t: q.opened || q.signalAt, x: q.closed, R });
  }
  return out;
}
function btTrades(b, ds) {
  if (!b || !b.trades) return [];
  const c = Object.fromEntries(b.tradeCols.map((k, i) => [k, i]));
  return b.trades.filter((x) => x[c.status] === 'closed' && !String(x[c.setup]).endsWith('@mkt') && x[c.R_none] != null)
    .map((x) => ({ sys: 'Meridian', ds, mk: x[c.market], setup: x[c.setup], t: x[c.filled] || x[c.opened], x: null, R: x[c.R_none] - (x[c.cost] || 0) }));
}
function liveTrades(t) {
  return (Array.isArray(t) ? t : []).filter((x) => ['win', 'loss', 'be'].includes(x.status) && x.R != null)
    .map((x) => ({ sys: 'Meridian', ds: x.shadow ? 'live shadow' : 'live', mk: x.market, setup: x.k, t: x.filled || x.opened, x: x.closed || null, R: x.R }));
}
function mainReplay(r) {   // council main-system replays (gold replica / trend, NQ open run, pairs), from 1 Aug 2025
  return ((r && r.trades) || []).filter((x) => x.opened >= Date.UTC(2025, 7, 1) / 1000 && x.R != null && ['win', 'loss', 'be'].includes(x.status))
    .map((x) => ({ sys: 'Meridian', ds: 'main-system replay', mk: x.market, setup: x.k, t: x.filled || x.opened, x: x.closed || null, R: x.R }));
}

// ─── tags ───
export function tag(tr, set = {}) {
  const tg = {};
  for (const w of WINDOWS) tg['w' + w] = !!nearEvent(tr.t, w, set);
  tg.day = eventDay(tr.t, set).length > 0;
  tg.held = tr.x ? eventsBetween(tr.t, tr.x, set).length > 0 : null;
  const n = nearEvent(tr.t, 120, set); tg.type = n ? n.type : null; tg.ev = n ? `${n.type}@${n.t}` : null; tg.tday = tradingDay(tr.t);
  return tg;
}

// ─── stats ───
export function stat(R) {
  const n = R.length; if (!n) return { n: 0 };
  const mean = R.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(R.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, exp: +mean.toFixed(3), R: +(mean * n).toFixed(1), wr: +(R.filter((x) => x > 0).length / n).toFixed(3), t: sd > 0 ? +(mean / (sd / Math.sqrt(n))).toFixed(2) : null };
}
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const m = (x) => x.reduce((p, q) => p + q, 0) / x.length, v = (x, mu) => x.reduce((p, q) => p + (q - mu) ** 2, 0) / (x.length - 1);
  const ma = m(a), mb = m(b), se = Math.sqrt(v(a, ma) / a.length + v(b, mb) / b.length);
  return se > 0 ? +((ma - mb) / se).toFixed(2) : null;
}
// one group vs the rest, with both chronological halves (cut at the dataset's median entry time)
// Trades around one release are not independent (many markets, one move), so the in-group is also judged by cluster:
// each cluster (one event, or one trading day) is one observation = its mean R minus the rest's mean; ct = t over clusters.
export function compare(rows, inGroup, cut, clusterOf = null) {
  const g = rows.filter(inGroup), r = rows.filter((x) => !inGroup(x)), R = (a) => a.map((x) => x.R);
  const half = (a, h) => a.filter((x) => (h ? x.t >= cut : x.t < cut));
  const out = { in: stat(R(g)), rest: stat(R(r)), dT: welch(R(g), R(r)),
    h1: stat(R(half(g, 0))), h2: stat(R(half(g, 1))), rest1: stat(R(half(r, 0))), rest2: stat(R(half(r, 1))) };
  if (clusterOf && g.length) { const by = {}; for (const x of g) (by[clusterOf(x)] = by[clusterOf(x)] || []).push(x.R);
    const restMean = r.length ? r.reduce((a, x) => a + x.R, 0) / r.length : 0, cs = stat(Object.values(by).map((a) => a.reduce((p, q) => p + q, 0) / a.length));
    const cd = stat(Object.values(by).map((a) => a.reduce((p, q) => p + q, 0) / a.length - restMean));
    out.k = cs.n; out.ct = cs.t; out.cdt = cd.t; }
  return out;
}
// the brief's bar: n >= 30, t <= -2, negative in both halves (and, to be worth a skip, worse than the trades kept in both halves)
export function clearlyNegative(c) {
  return c.in.n >= 30 && c.in.t != null && c.in.t <= -2 && c.h1.n > 0 && c.h2.n > 0 && c.h1.exp < 0 && c.h2.exp < 0;
}
export const worseThanRest = (c) => c.dT != null && c.dT <= -2 && c.h1.exp < (c.rest1.exp ?? 0) && c.h2.exp < (c.rest2.exp ?? 0);

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

if (process.argv[1] && process.argv[1].endsWith('analyze.mjs')) {
  const all = [...ictTrades(rd('ict/replay.json')), ...btTrades(rd('backtest.json'), 'backtest 30d'), ...btTrades(rd('research/replay-90d.json'), 'replay 90d'),
    ...mainReplay(rd('research/replay-2w.json')), ...liveTrades(rd('trades.json'))];
  for (const tr of all) tr.tags = Object.fromEntries(Object.entries(SETS).map(([k, s]) => [k, tag(tr, s)]));
  const dsets = [...new Set(all.map((x) => x.sys + '|' + x.ds))];
  const res = { at: new Date().toISOString(), data: {}, rows: [], flags: [] };
  const groups = (k) => [['w30', (x) => x.tags[k].w30], ['w60', (x) => x.tags[k].w60], ['w120', (x) => x.tags[k].w120], ['day', (x) => x.tags[k].day],
    ['held', (x) => x.tags[k].held === true]];
  const clusterFn = (set, g) => (g === 'day' || g === 'held' ? (x) => x.tags[set].tday : (x) => x.tags[set].ev || x.tags[set].tday);
  for (const key of dsets) {
    const [sys, ds] = key.split('|'), rows = all.filter((x) => x.sys === sys && x.ds === ds), cut = median(rows.map((x) => x.t));
    res.data[key] = { n: rows.length, from: new Date(Math.min(...rows.map((x) => x.t)) * 1000).toISOString().slice(0, 10), to: new Date(Math.max(...rows.map((x) => x.t)) * 1000).toISOString().slice(0, 10),
      cut: new Date(cut * 1000).toISOString().slice(0, 10), all: stat(rows.map((x) => x.R)) };
    const mks = ['ALL', ...[...new Set(rows.map((x) => x.mk))].sort()];
    for (const mk of mks) {
      const sub = mk === 'ALL' ? rows : rows.filter((x) => x.mk === mk);
      for (const set of Object.keys(SETS)) for (const [g, fn] of groups(set)) {
        if (g === 'held' && !sub.some((x) => x.x)) continue;
        const c = compare(sub, fn, cut, clusterFn(set, g)), row = { sys, ds, mk, set, g, ...c, neg: clearlyNegative(c), worse: worseThanRest(c) };
        res.rows.push(row); if (row.neg) res.flags.push({ sys, ds, mk, set, g, n: c.in.n, exp: c.in.exp, t: c.in.t, h1: c.h1.exp, h2: c.h2.exp, dT: c.dT, worse: row.worse, k: c.k, ct: c.ct, cdt: c.cdt });
      }
    }
    // by event type (ALL set, +-120 min), whole dataset
    for (const ty of ['CPI', 'NFP', 'FOMC', 'PCE', 'ISM_M', 'ISM_S', 'CLAIMS', 'ECB', 'BOJ']) {
      const c = compare(rows, (x) => x.tags.ALL.type === ty, cut, (x) => x.tags.ALL.ev);
      res.rows.push({ sys, ds, mk: 'ALL', set: 'type', g: ty, ...c, neg: clearlyNegative(c), worse: worseThanRest(c) });
    }
  }
  // result.json keeps the rows with trades in the group: every market for ALL / T1, the whole data set for CB / T2 / by type
  const slim = (o) => (o && o.n ? { n: o.n, exp: o.exp, wr: o.wr, t: o.t } : { n: 0 });
  const kept = res.rows.filter((r) => r.in.n > 0 && (['ALL', 'T1'].includes(r.set) || r.mk === 'ALL'))
    .map((r) => ({ ...r, in: slim(r.in), rest: slim(r.rest), h1: slim(r.h1), h2: slim(r.h2), rest1: slim(r.rest1), rest2: slim(r.rest2) }));
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ topic: 'news-filter', system: 'ICT desk replay (ict/replay.json) and Meridian (backtest.json, research/replay-90d.json, research/replay-2w.json, live trades.json) vs the calendar in council/events.mjs',
    ...res, rows: kept }));
  // markdown tables
  const f = (s) => (s && s.n ? `${s.exp >= 0 ? '+' : ''}${s.exp.toFixed(3)}` : '–'), lines = [];
  const head = '| system / data | market | group | n | R/trade | win% | t | half 1 | half 2 | rest n | rest R/trade | t (in − rest) | events/days | t by event (in − rest) |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  for (const set of ['ALL', 'T1', 'CB', 'T2', 'type']) {
    lines.push(`\n### Event set ${set}\n`, head);
    for (const r of res.rows.filter((x) => x.set === set && (set === 'type' || x.mk === 'ALL' || set === 'ALL')))
      lines.push(`| ${r.sys} ${r.ds} | ${r.mk} | ${r.g} | ${r.in.n} | ${f(r.in)} | ${r.in.n ? Math.round(r.in.wr * 100) + '%' : '–'} | ${r.in.t ?? '–'} | ${f(r.h1)} (${r.h1.n}) | ${f(r.h2)} (${r.h2.n}) | ${r.rest.n} | ${f(r.rest)} | ${r.dT ?? '–'}${r.neg ? ' **NEG**' : ''}${r.worse ? ' **WORSE**' : ''} | ${r.k ?? '–'} | ${r.cdt ?? '–'} |`);
  }
  fs.writeFileSync(path.join(OUT, 'tables.md'), `# News-window tables (generated ${res.at})\n\nGroups are cumulative windows around the entry: w30 / w60 / w120 = within ±30 / ±60 / ±120 min of an event; day = same New York trading day; held = an event fell between entry and exit. "rest" = every other trade of that market and data set. Halves split each data set at its median entry date. NEG = n ≥ 30, t ≤ −2, negative in both halves; WORSE = also below the rest (Welch t ≤ −2, both halves).\n\nData: ${Object.entries(res.data).map(([k, v]) => `${k} n=${v.n} ${v.from}→${v.to} (cut ${v.cut}, all ${f(v.all)} t ${v.all.t})`).join('; ')}\n${lines.join('\n')}\n`);
  console.log(JSON.stringify(res.data, null, 1));
  console.log('flags', JSON.stringify(res.flags, null, 1));
}
