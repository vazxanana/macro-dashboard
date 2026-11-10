// Edge research · mosha-select: among the mosha-sweep candidates (a swept H1 swing, the M5 VR, its CF), does a simple condition
// that is visible when the order is placed separate the setups worth taking? Four conditions read from the owner's own example
// trades, nine cells per entry, three periods (discovery 2006-12, validation 2013-19, confirmation 2020 on). Conditions, the
// rule for a cell and the verdict: PREREGISTRATION.md (committed with this file before any number was computed).
// The candidates, stops, targets, fills and cost are mosha-sweep's, unchanged. Paper research only: nothing here trades or
// changes a live rule.
//   CANDLES=<dir> node run.mjs example          -> the conditions on the last three weeks' candidates (no results)
//   CANDLES=<dir> node run.mjs run              -> result.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { K as KS, ENTRIES, agg, detect, book } from '../mosha-sweep/run.mjs';
import { boEvents } from '../mosha-retrace/run.mjs';
import { h4Context, stat } from '../mosha-level/run.mjs';

const D = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
export const K = { W4: 3, LEVEL_AGE: 30 * 86400, FAR: 4, MIN_N: 100, ALPHA: 0.05, H4: 14400, FROM: D(2006, 7, 1), V_FROM: D(2013, 1, 1), C_FROM: D(2020, 1, 1) };
export const PERIODS = { d: 'discovery, 2006-07-01 to 2012-12-31', v: 'validation, 2013-01-01 to 2019-12-31', c: 'confirmation, 2020-01-01 to the end of the file' };
// the nine cells: [condition, value, label]
export const CELLS = [
  ['h4', 'with', 'with the last H4 BO'], ['h4', 'against', 'against the last H4 BO'],
  ['level', 'h4', 'the sweep also took an H4 swing'], ['level', 'h1 only', 'the sweep took an H1 swing only'],
  ['session', 'asia', 'order placed in Asia (21:00-07:00 UTC)'], ['session', 'london', 'order placed in London (07:00-12:00 UTC)'], ['session', 'new york', 'order placed in New York (12:00-21:00 UTC)'],
  ['room', 'far', 'target 4R or more away'], ['room', 'near', 'target under 4R away'],
];
export const sessionOf = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 21 || h < 7 ? 'asia' : h < 12 ? 'london' : 'new york'; };
export const periodOf = (t) => (t < K.FROM ? null : t < K.V_FROM ? 'd' : t < K.C_FROM ? 'v' : 'c');

// the H4 context a condition needs: the BO events (3 a side) and the swing levels with the time an H4 close goes through them
export function h4Info(M5) {
  const H4 = agg(M5, K.H4), bo = boEvents(H4, K.W4, K.H4).sort((a, b) => a.t - b.t), { levels } = h4Context(H4);
  const at = (t) => { let a = 0, b = H4.length; while (a < b) { const m = (a + b) >> 1; if (H4[m].time < t) a = m + 1; else b = m; } return a; };
  for (const l of levels) { l.dead = Infinity; for (let i = at(l.born); i < H4.length && H4[i].time + K.H4 - l.born <= K.LEVEL_AGE; i++) if (l.side < 0 ? H4[i].close > l.p : H4[i].close < l.p) { l.dead = H4[i].time + K.H4; break; } }
  return { bo, levels };
}
// the four conditions of one candidate order, each from what was known when the order was placed
export function conditions(c, info) {
  // 1. the most recent H4 BO that had closed when the order was placed
  let a = 0, b = info.bo.length; while (a < b) { const m = (a + b) >> 1; if (info.bo[m].t <= c.placed) a = m + 1; else b = m; }
  const ev = a > 0 ? info.bo[a - 1] : null;
  // 2. did the episode's extreme go beyond an H4 swing of the trade's side that was live when the sweep started?
  let lvl = 'h1 only';
  for (const l of info.levels) { if (l.born > c.sweep) break; if (l.side !== c.side || c.sweep - l.born > K.LEVEL_AGE || l.dead <= c.sweep) continue; if (c.side < 0 ? c.ext > l.p : c.ext < l.p) { lvl = 'h4'; break; } }
  return { h4: ev ? (ev.dir === c.side ? 'with' : 'against') : null, level: lvl, session: sessionOf(c.placed), room: c.rr >= K.FAR ? 'far' : 'near' };
}

const pOf = (t) => { const x = t / Math.SQRT2, a = 1 / (1 + 0.3275911 * Math.abs(x)), e = 1 - (((((1.061405429 * a - 1.453152027) * a) + 1.421413741) * a - 0.284496736) * a + 0.254829592) * a * Math.exp(-x * x); return +(0.5 * (1 - Math.sign(x) * e)).toFixed(4); };
// Holm over a list of [key, p]: returns { key: adjusted p }
export function holm(list) { const s = [...list].sort((x, y) => x[1] - y[1]), out = {}; let top = 0; s.forEach(([k, p], i) => { top = Math.max(top, Math.min(1, p * (s.length - i))); out[k] = +top.toFixed(4); }); return out; }
// per-period statistics of a stream's closed trades (by the time the order was placed)
export function byPeriod(orders) {
  const tr = orders.filter((o) => o.status === 'closed' && o.exit !== 'end (marked)' && o.placed >= K.FROM).sort((a, b) => a.closed - b.closed || a.placed - b.placed), out = {};
  for (const p of Object.keys(PERIODS)) { const s = stat(tr.filter((o) => periodOf(o.placed) === p).map((o) => o.net)); out[p] = s.n ? { ...s, p: pOf(s.t) } : s; }
  out.all = stat(tr.map((o) => o.net)); return out;
}
// the pre-registered rule for the cells (rows: { key, d, v, c }); fills in selected / pHolm / validated / confirmed / verdict
export function judge(rows) {
  const ok = (s) => s.n >= K.MIN_N && s.avg > 0;
  for (const r of rows) r.selected = ok(r.d);
  const adj = holm(rows.filter((r) => r.selected && r.v.n).map((r) => [r.key, r.v.p]));
  for (const r of rows) {
    r.pHolm = r.selected && r.key in adj ? adj[r.key] : null;
    r.validated = r.selected && ok(r.v) && r.pHolm != null && r.pHolm < K.ALPHA;
    r.confirmed = r.validated && ok(r.c);
    r.state = r.confirmed ? 'confirmed' : r.validated ? 'validated' : r.selected ? 'selected only' : 'not selected';
  }
  return rows.some((r) => r.confirmed) ? 'PASS' : rows.some((r) => r.validated) ? 'INCONCLUSIVE' : 'FAIL';
}

// ─── modes ───
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) ? process.argv[2] : null;
const iso = (t) => (t == null ? '-' : new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' '));
const load = () => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.env.CANDLES, 'xau-5m.json.gz')))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
if (MODE === 'example') {
  const all = load(), from = all.at(-1).time - 60 * 86400, M5 = all.filter((b) => b.time >= from), { cand } = detect(M5), info = h4Info(M5), show = all.at(-1).time - 21 * 86400;
  for (const kind of Object.keys(cand)) { console.log(`\n${kind}`);
    for (const c of cand[kind]) if (c.placed >= show) { const f = conditions(c, info); console.log(`  ${iso(c.placed)} ${c.side < 0 ? 'SELL' : 'BUY '} entry ${c.entry} stop ${c.stop} target ${c.target} (${c.rr}R) ext ${c.ext} | H4 ${f.h4} · level ${f.level} · ${f.session} · ${f.room}`); } }
}
if (MODE === 'run') {
  const M5 = load(), end = M5.at(-1).time + KS.M5; console.error(`M5 ${M5.length} (${iso(M5[0].time)} → ${iso(M5.at(-1).time)})`);
  const { cand } = detect(M5), info = h4Info(M5), rows = [], base = {}, counts = {};
  for (const kind of Object.keys(cand)) {
    for (const c of cand[kind]) c.f = conditions(c, info);
    base[kind] = byPeriod(book(M5, { [kind]: cand[kind] })[kind].orders);
    counts[kind] = { candidates: cand[kind].length };
    for (const [cond, val, label] of CELLS) {
      const sub = cand[kind].filter((c) => c.f[cond] === val), bk = book(M5, { [kind]: sub })[kind];
      rows.push({ key: `${kind}:${cond}=${val}`, entry: kind, cond, val, label, candidates: sub.length, busy: bk.busy, ...byPeriod(bk.orders), orders: bk.orders });
      console.error(rows.at(-1).key, sub.length);
    }
  }
  const verdict = judge(rows), sg = (x) => `${x >= 0 ? '+' : ''}${x}`;
  const sel = rows.filter((r) => r.selected), val = rows.filter((r) => r.validated), conf = rows.filter((r) => r.confirmed);
  const out = { topic: 'mosha-select', built: '2026-11-10', at: new Date().toISOString(),
    system: 'Mosha selection: the mosha-sweep candidates (a swept H1 swing, the M5 VR, its CF; entry at the CF or at the zone of the next break) split by four conditions known when the order is placed, spot gold OANDA M5',
    window: { ...PERIODS, end: iso(end).slice(0, 10) }, params: { ...K, sweep: { ...KS } }, candles: { m5: M5.length, from: iso(M5[0].time), to: iso(M5.at(-1).time) },
    baseline: Object.fromEntries(Object.keys(base).map((k) => [k, { rule: ENTRIES[k], candidates: counts[k].candidates, ...base[k] }])),
    cells: rows.map(({ orders, ...r }) => r), selected: sel.map((r) => r.key), validated: val.map((r) => r.key), confirmed: conf.map((r) => r.key), variantsTried: rows.length };
  out.verdict = `${verdict}: ${sel.length} of ${rows.length} cells positive on discovery, ${val.length} validated, ${conf.length} confirmed` + (sel.length ? ` (selected: ${sel.map((r) => `${r.key} ${sg(r.d.avg)}R → ${r.v.n ? sg(r.v.avg) + 'R' : 'no trades'} on validation, Holm p ${r.pHolm}`).join('; ')})` : '');
  out.candidates = rows.map((r) => ({ rule: `${r.entry === 'CF' ? 'At the CF' : 'At the zone'}, ${r.label}`, verdict: r.confirmed ? 'PASS' : r.validated ? 'INCONCLUSIVE' : 'FAIL', is: r.d, oos: r.v, conf: r.c }));
  const best = conf[0] || val[0] || [...rows].sort((x, y) => (y.all.t ?? -99) - (x.all.t ?? -99))[0];
  out.tradesOf = best.key; out.trades = best.orders.filter((o) => o.status === 'closed' && o.exit !== 'end (marked)' && o.placed >= K.FROM).sort((x, y) => x.closed - y.closed).map((o) => ({ d: new Date(o.closed * 1000).toISOString().slice(0, 10), side: o.side < 0 ? 'sell' : 'buy', R: o.net }));
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  for (const r of rows) console.error(r.key.padEnd(28), 'D', r.d.n, r.d.avg, '| V', r.v.n, r.v.avg, r.v.t, '| C', r.c.n, r.c.avg, r.c.t, '|', r.state, r.pHolm ?? '');
  console.error(out.verdict);
}
