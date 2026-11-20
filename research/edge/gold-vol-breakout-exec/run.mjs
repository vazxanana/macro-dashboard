// Edge research · gold-vol-breakout-exec: T1 (unchanged, ../gold-vol-breakout-hourcost/original.mjs) filled at the demo broker's
// own ticks (PREREGISTRATION.md).
//   node research/edge/gold-vol-breakout-exec/run.mjs queries <candleDir>        -> trades.json + queries.json (probe "fills")
//   node research/edge/gold-vol-breakout-exec/run.mjs report <ticks-XAUUSD.json> [commit] -> result.json
// The stop query: every M5 candle from the fill candle to 20:55 UTC whose OANDA extreme came within NEAR ($) of the stop is read
// on the broker's ticks (a broker tick cannot cross the stop while the OANDA mid stayed further away than the basis); the first
// crossing among them is the stop exit.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as O from '../gold-vol-breakout-hourcost/original.mjs';
import { daysOf } from '../gold-vol-breakout-hourcost/costs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2023-11-24', TO = '2026-11-12', NEAR = 0.5, ENTRY_PAD = 300, EXIT_S = 21 * 3600, COMM = 0.000024, N_MIN = 300, SPAN = 1800;
export const X_AGE = 3600; // the time-exit quote may be up to an hour old (the last quote before a 21:00 UTC break)
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };

// merge candle starts into spans of at most SPAN seconds: [[t0, t1], ...]
export function spans(starts) {
  const o = []; for (const t of [...starts].sort((a, b) => a - b)) { const last = o[o.length - 1];
    if (last && t <= last[1] && t + 300 - last[0] <= SPAN) last[1] = t + 300; else o.push([t, t + 300]); }
  return o;
}
// the queries of one trade: entry crossing, and the stop crossing windows
export function queriesOf(tr, bars) {
  const dir = tr.side, trigger = dir > 0 ? tr.up : tr.dn, q = [[`${tr.day}|e`, tr.fillT, tr.fillT + 300 + ENTRY_PAD, trigger, dir]];
  const near = bars.filter((b) => b.t >= tr.fillT && b.t < tr.d0 + EXIT_S && (dir > 0 ? b.l <= tr.open + NEAR : b.h >= tr.open - NEAR)).map((b) => b.t);
  spans(near).forEach(([a, b], k) => q.push([`${tr.day}|s${k}`, a, b, tr.open, -dir]));
  return q;
}
// one trade on the broker's ticks; F: Map id -> [id, ms, bid, ask] | [id, null]; X: the 21:00 quote [bid, ask] or null
export function brokerTrade(tr, F, X) {
  const e = F.get(`${tr.day}|e`); if (!e) return { skip: 'no entry read' }; if (e[1] == null) return { filled: false, R: 0, net: 0 };
  const dir = tr.side, trigger = dir > 0 ? tr.up : tr.dn, r = Math.abs(trigger - tr.open), fill = dir > 0 ? e[3] : e[2];
  let stopHit = null; for (let k = 0; F.has(`${tr.day}|s${k}`); k++) { const s = F.get(`${tr.day}|s${k}`); if (s[1] != null && s[1] >= e[1] && (!stopHit || s[1] < stopHit[1])) stopHit = s; }
  let exit, how;
  if (stopHit) { exit = dir > 0 ? stopHit[2] : stopHit[3]; how = 'stop'; } else if (X) { exit = dir > 0 ? X[0] : X[1]; how = 'time'; } else return { skip: 'no 21:00 quote' };
  const R = (dir * (exit - fill)) / r, cost = (2 * COMM * fill) / r;
  return { filled: true, how, fill, exit, slipE: dir * (fill - trigger), slipX: how === 'stop' ? dir * (tr.open - exit) : null, r, R, net: R - cost };
}
function monthT(rows) { const m = new Map(); for (const x of rows) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); } const v = [...m.values()]; if (v.length < 2) return null; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1)); return sd > 0 ? a / (sd / Math.sqrt(v.length)) : null; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, a, commit, ...more] = process.argv.slice(2);
  if (mode === 'queries') {
    const { days } = daysOf(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(a, 'xau-5m.json.gz')))));
    const trades = [], Q = [], X = [];
    for (const d of days) {
      if (d.day < FROM || d.day > TO || O.daySkip(d)) continue;
      const x = O.vbTrade(d.bars, { ...O.TESTS.T1, prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
      const tr = { day: d.day, d0: Math.floor(d.bars[0].t / 86400) * 86400, side: x.side, open: x.open, up: x.up, dn: x.dn, fillT: x.fillT, how: x.how, R: x.R, entry: x.entry };
      trades.push(tr); Q.push(...queriesOf(tr, d.bars)); X.push(tr.d0 + EXIT_S);
    }
    fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(trades));
    fs.writeFileSync(path.join(HERE, 'queries.json'), JSON.stringify({ XAUUSD: X, fills: { XAUUSD: Q } }));
    console.log(`${trades.length} trades, ${Q.length} fill queries, ${X.length} exit marks`);
  } else if (mode === 'report') {
    const P = JSON.parse(fs.readFileSync(a, 'utf8')), T = JSON.parse(fs.readFileSync(path.join(HERE, 'trades.json'), 'utf8'));
    const F = new Map((P.fills || []).map((f) => [f[0], f])), M = new Map((P.marks || []).map((m) => [m[0], m]));
    // a second read of the exit marks with a one-hour look-back (21:00 UTC is gold's daily break on US summer-time days):
    // a quote found there replaces an empty one; the quote is the last one at or before 21:00, as pre-registered
    for (const f of more) for (const m of JSON.parse(fs.readFileSync(f, 'utf8')).marks || []) if (m[1] > 0 && !(M.get(m[0]) && M.get(m[0])[1] > 0 && M.get(m[0])[3] <= X_AGE)) M.set(m[0], m);
    const ages = [...M.values()].filter((m) => m[1] > 0).map((m) => m[3]);
    const rows = [], skipped = {};
    for (const tr of T) { const m = M.get(tr.d0 + EXIT_S), X = m && m[1] > 0 && m[3] != null && m[3] <= X_AGE ? [m[1], m[2]] : null;
      const b = brokerTrade(tr, F, X); if (b.skip) { skipped[b.skip] = (skipped[b.skip] || 0) + 1; continue; } rows.push({ ...tr, b, net: b.net }); }
    const filled = rows.filter((x) => x.b.filled), slE = filled.map((x) => x.b.slipE), slX = filled.filter((x) => x.b.how === 'stop').map((x) => x.b.slipX);
    const st = { n: filled.length, notFilled: rows.length - filled.length, net: r4(mean(rows.map((x) => x.net))), netFilled: r4(mean(filled.map((x) => x.net))), monthT: r4(monthT(rows)),
      oandaGross: r4(mean(rows.map((x) => x.R))), stops: filled.filter((x) => x.b.how === 'stop').length, oandaStops: rows.filter((x) => x.how === 'stop').length };
    const slip = { entry$: { median: r4(med(slE)), mean: r4(mean(slE)), p90: r4(pct(slE, 0.9)) }, entryR: r4(mean(filled.map((x) => x.b.slipE / x.b.r))), stop$: { median: r4(med(slX)), mean: r4(mean(slX)), p90: r4(pct(slX, 0.9)) } };
    // descriptive, reported beside the verdict (not part of the bar): by year, by side, and how much the ten best trades carry
    const grp = (f) => { const o = {}; for (const x of filled) (o[f(x)] = o[f(x)] || []).push(x.net); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.length, net: r4(mean(v)) }])); };
    const best = filled.map((x) => x.net).sort((p, q) => q - p), tot = best.reduce((u, v) => u + v, 0);
    const split = { byYear: grp((x) => x.day.slice(0, 4)), bySide: grp((x) => (x.side > 0 ? 'buy' : 'sell')), top10Share: r4(best.slice(0, 10).reduce((u, v) => u + v, 0) / tot), netWithoutTop10: r4(mean(best.slice(10))) };
    const verdict = st.n < N_MIN ? `TOO FEW (${st.n} filled)` : st.net > 0 && st.monthT >= 2 ? 'PASS' : 'FAIL';
    const out = { study: 'gold-vol-breakout-exec', built: new Date().toISOString().slice(0, 10), probe: { at: P.at, commit: commit || null }, window: [FROM, TO], exitAge: { max: X_AGE, median: r4(med(ages)), p90: r4(pct(ages, 0.9)), over120: ages.filter((x) => x > 120).length }, skipped, stats: st, slip, split,
      verdict: `${verdict}: T1 filled at the demo broker's ticks, ${FROM} → ${TO}: ${st.net}R a trade net (n ${rows.length}, ${st.n} filled; month t ${st.monthT}); entry slippage $${slip.entry$.median} median ($${slip.entry$.mean} mean), ${slip.entryR}R` };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
    console.log(out.verdict); console.log(JSON.stringify({ st, slip, skipped }));
  } else throw new Error('usage: run.mjs queries <candleDir> | report <ticks-XAUUSD.json> [commit] [more ticks files]');
}
