// Edge research · usdjpy-vol-breakout-exec: T1 on USD/JPY filled at the demo broker's own ticks (PREREGISTRATION.md, pushed alone
// first). The method is gold-vol-breakout-exec's, with USD/JPY's commission and stop margin.
//   node research/edge/usdjpy-vol-breakout-exec/run.mjs queries <dir with usdjpy-5m.json.gz>  -> trades.json + queries-a/b.json
//   node research/edge/usdjpy-vol-breakout-exec/run.mjs report <ticks-a.json>,<ticks-b.json> [commit] -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays } from '../index-vol-breakout/original.mjs';
import { trades as t1 } from '../usdjpy-vol-breakout-early/run.mjs';
import { spans } from '../gold-vol-breakout-exec/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2023-11-24', TO = '2026-11-19', NEAR = 0.05, ENTRY_PAD = 300, EXIT_S = 21 * 3600, COMM = 0.0000225, N_MIN = 300, X_AGE = 3600;
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const med = (a) => { const v = [...a].sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = [...a].sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };

export function queriesOf(tr, bars) {
  const dir = tr.side, trigger = dir > 0 ? tr.up : tr.dn, q = [[`${tr.day}|e`, tr.fillT, tr.fillT + 300 + ENTRY_PAD, trigger, dir]];
  const near = bars.filter((b) => b.t >= tr.fillT && b.t < tr.d0 + EXIT_S && (dir > 0 ? b.l <= tr.open + NEAR : b.h >= tr.open - NEAR)).map((b) => b.t);
  spans(near).forEach(([a, b], k) => q.push([`${tr.day}|s${k}`, a, b, tr.open, -dir]));
  return q;
}
export function brokerTrade(tr, F, X) {
  const e = F.get(`${tr.day}|e`); if (!e) return { skip: 'no entry read' }; if (e[1] == null) return { filled: false, R: 0, net: 0 };
  const dir = tr.side, trigger = dir > 0 ? tr.up : tr.dn, r = Math.abs(trigger - tr.open), fill = dir > 0 ? e[3] : e[2];
  let stopHit = null; for (let k = 0; F.has(`${tr.day}|s${k}`); k++) { const s = F.get(`${tr.day}|s${k}`); if (s[1] != null && s[1] >= e[1] && (!stopHit || s[1] < stopHit[1])) stopHit = s; }
  let exit, how;
  if (stopHit) { exit = dir > 0 ? stopHit[2] : stopHit[3]; how = 'stop'; } else if (X) { exit = dir > 0 ? X[0] : X[1]; how = 'time'; } else return { skip: 'no 21:00 quote' };
  const R = (dir * (exit - fill)) / r, cost = (2 * COMM * fill) / r;
  return { filled: true, how, fill, exit, slipE: dir * (fill - trigger), slipX: how === 'stop' ? dir * (tr.open - exit) : null, r, R, net: R - cost };
}
export function monthT(rows) { const m = new Map(); for (const x of rows) { const k = x.day.slice(0, 7); m.set(k, (m.get(k) || 0) + x.net); } const v = [...m.values()]; if (v.length < 2) return null; const a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1)); return sd > 0 ? a / (sd / Math.sqrt(v.length)) : null; }
export function verdictOf(st) { return st.n < N_MIN ? `TOO FEW (${st.n} filled)` : st.net > 0 && st.monthT >= 2 ? 'PASS' : 'FAIL'; }

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [mode, a, commit] = process.argv.slice(2);
  if (mode === 'queries') {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(a, 'usdjpy-5m.json.gz')))); rows.sort((p, q) => p[0] - q[0]);
    const days = buildDays(rows).filter((d) => d.day >= FROM && d.day <= TO), byDay = new Map(days.map((d) => [d.day, d]));
    const trades = [], Q = [], X = [];
    for (const x of t1('usdjpy', days)) {
      const d = byDay.get(x.day), tr = { day: x.day, d0: d.d0, side: x.side, open: x.open, up: x.up, dn: x.dn, fillT: x.fillT, how: x.how, R: x.R, entry: x.entry };
      trades.push(tr); Q.push(...queriesOf(tr, d.bars)); X.push(tr.d0 + EXIT_S);
    }
    fs.writeFileSync(path.join(HERE, 'trades.json'), JSON.stringify(trades));
    // two probe runs (the probe job stops at 120 minutes; gold's 2,275 queries took 55): trades before / from SPLIT
    const SPLIT = '2025-05-20', half = (f) => { const ds = new Set(trades.filter((t) => f(t.day)).map((t) => t.day));
      return { USDJPY: trades.filter((t) => ds.has(t.day)).map((t) => t.d0 + EXIT_S), fills: { USDJPY: Q.filter((q) => ds.has(q[0].split('|')[0])) } }; };
    const A = half((d) => d < SPLIT), B = half((d) => d >= SPLIT);
    fs.writeFileSync(path.join(HERE, 'queries-a.json'), JSON.stringify(A)); fs.writeFileSync(path.join(HERE, 'queries-b.json'), JSON.stringify(B));
    console.log(`${trades.length} trades, ${Q.length} fill queries, ${X.length} exit marks; a: ${A.fills.USDJPY.length} / ${A.USDJPY.length}, b: ${B.fills.USDJPY.length} / ${B.USDJPY.length}`);
  } else if (mode === 'report') {
    const PS = a.split(',').map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))), P = { at: PS.map((x) => x.at).join(', '), fills: PS.flatMap((x) => x.fills || []), marks: PS.flatMap((x) => x.marks || []) }, T = JSON.parse(fs.readFileSync(path.join(HERE, 'trades.json'), 'utf8'));
    const F = new Map((P.fills || []).map((f) => [f[0], f])), M = new Map((P.marks || []).map((m) => [m[0], m]));
    const rows = [], skipped = {};
    for (const tr of T) { const m = M.get(tr.d0 + EXIT_S), X = m && m[1] > 0 && m[3] != null && m[3] <= X_AGE ? [m[1], m[2]] : null;
      const b = brokerTrade(tr, F, X); if (b.skip) { skipped[b.skip] = (skipped[b.skip] || 0) + 1; continue; } rows.push({ ...tr, b, net: b.net }); }
    const filled = rows.filter((x) => x.b.filled), slE = filled.map((x) => x.b.slipE), slX = filled.filter((x) => x.b.how === 'stop').map((x) => x.b.slipX);
    const st = { n: filled.length, notFilled: rows.length - filled.length, net: r4(mean(rows.map((x) => x.net))), monthT: r4(monthT(rows)), oandaGross: r4(mean(rows.map((x) => x.R))),
      stops: filled.filter((x) => x.b.how === 'stop').length, oandaStops: rows.filter((x) => x.how === 'stop').length };
    const slip = { entryYen: { median: r4(med(slE)), mean: r4(mean(slE)), p90: r4(pct(slE, 0.9)) }, entryR: r4(mean(filled.map((x) => x.b.slipE / x.b.r))), stopYen: { median: r4(med(slX)), mean: r4(mean(slX)), p90: r4(pct(slX, 0.9)) } };
    const grp = (f) => { const o = {}; for (const x of filled) (o[f(x)] = o[f(x)] || []).push(x.net); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.length, net: r4(mean(v)) }])); };
    const best = filled.map((x) => x.net).sort((p, q) => q - p), tot = best.reduce((u, v) => u + v, 0);
    const split = { byYear: grp((x) => x.day.slice(0, 4)), bySide: grp((x) => (x.side > 0 ? 'buy' : 'sell')), top10Share: r4(best.slice(0, 10).reduce((u, v) => u + v, 0) / tot) };
    const v = verdictOf(st), verdict = `${v}: USD/JPY T1 at the demo's own ticks ${FROM} → ${TO}, ${st.net >= 0 ? '+' : ''}${st.net}R a trade after commission (n ${st.n} filled, month t ${st.monthT}; OANDA mid before costs ${st.oandaGross >= 0 ? '+' : ''}${st.oandaGross}R; entry slippage ${slip.entryR}R)`;
    const R = { study: 'usdjpy-vol-breakout-exec', built: '2026-11-20', verdict, probe: { at: P.at, commit: commit || null }, stats: st, slippage: slip, split, skipped };
    fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
    fs.writeFileSync(path.join(HERE, 'RESULT.md'), [`# USD/JPY T1 at the demo broker's own ticks (20 Nov 2026)`, '',
      'Paper research only. Method, window and bar fixed in `PREREGISTRATION.md` before any broker tick of these trades was read. Nothing live changed.', '',
      `**Verdict: ${verdict}**`, '', '```json', JSON.stringify({ stats: st, slippage: slip, split, skipped }, null, 1), '```', '',
      'These years are in sample for `fx-vol-breakout`: this prices the rule at real fills, it is not new evidence that it works.', ''].join('\n'));
    console.log(verdict);
  } else console.log('usage: run.mjs queries <dir> | report <ticks.json> [commit]');
}
