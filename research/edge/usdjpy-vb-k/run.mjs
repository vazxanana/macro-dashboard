// Edge research · usdjpy-vb-k: USD/JPY T1 at k 0.3-0.7 (PREREGISTRATION.md, pushed alone first). Paper research only.
//   node research/edge/usdjpy-vb-k/run.mjs <dir with usdjpy-5m-early.json.gz> <dir with usdjpy-5m.json.gz>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, vbTrade } from '../index-vol-breakout/original.mjs';
import { charge } from '../fx-vol-breakout/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const KS = [0.3, 0.4, 0.5, 0.6, 0.7], WIN = { early: ['2005-01-04', '2015-12-31'], late: ['2016-01-01', '2026-11-19'] };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
// the calls of usdjpy-vol-breakout-early `trades`, with k as the only change
export function tradesK(days, k) {
  const tr = [];
  for (const d of days.filter((x) => !daySkip(x))) { const x = vbTrade(d.bars, { k, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue; tr.push({ day: d.day, ...charge('usdjpy', x) }); }
  return tr;
}
export function monthT(tr) {
  const m = new Map(); for (const x of tr) m.set(x.day.slice(0, 7), (m.get(x.day.slice(0, 7)) || 0) + x.net);
  const v = [...m.values()], a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1)); return sd > 0 ? a / (sd / Math.sqrt(v.length)) : null;
}
const st = (tr) => ({ n: tr.length, net: r3(mean(tr.map((t) => t.net))), gross: r3(mean(tr.map((t) => t.R))), monthT: r3(monthT(tr)) });
export function reading(rows) {
  const off = rows.filter((r) => r.k !== 0.5), pos = off.every((r) => r.all.net > 0), t2 = off.filter((r) => r.all.monthT >= 2).length;
  return { broad: pos && t2 >= 3, pos, t2 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2), load = (f) => { const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(f))); r.sort((p, q) => p[0] - q[0]); return buildDays(r); };
  const E = load(path.join(a, 'usdjpy-5m-early.json.gz')).filter((d) => d.day >= WIN.early[0] && d.day <= WIN.early[1]);
  const L = load(path.join(b, 'usdjpy-5m.json.gz')).filter((d) => d.day >= WIN.late[0] && d.day <= WIN.late[1]);
  const rows = KS.map((k) => { const e = tradesK(E, k), l = tradesK(L, k); return { k, early: st(e), late: st(l), all: st([...e, ...l]) }; });
  const g = rows.find((r) => r.k === 0.5), gate = g.early.n === 2089 && g.early.net === 0.079 && g.late.n === 2079 && g.late.net === 0.063;
  if (!gate) { console.log('GATE FAILED', JSON.stringify(g)); process.exit(1); }
  const R = reading(rows), sg = (v, d = 3) => (v == null ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));
  const verdict = `${R.broad ? 'BROAD' : 'NARROW'}: USD/JPY T1 pooled 2005 → 2026 net R ${R.pos ? 'positive at every k of 0.3, 0.4, 0.6, 0.7' : 'not positive at every other k'}, month t ≥ 2 at ${R.t2} of 4; k 0.5 ${sg(g.all.net)}R (n ${g.all.n}, t ${sg(g.all.monthT, 2)}); k stays 0.5`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'usdjpy-vb-k', built: '2026-11-20', verdict, gate, rows }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# USD/JPY T1 across k (20 Nov 2026)', '',
    'Paper research only. Grid, gate and reading fixed in `PREREGISTRATION.md` before any figure at a k other than 0.5 was computed. The gate (k 0.5 reproduces both published studies) passed. Nothing live changed; the rule stays k 0.5.', '',
    `**Verdict: ${verdict}**`, '',
    '| k | 2005-15 n / net / t | 2016 → n / net / t | Pooled n / net (gross) / month t |', '|---|---|---|---|',
    ...rows.map((r) => `| ${r.k} | ${r.early.n} / ${sg(r.early.net)} / ${sg(r.early.monthT, 2)} | ${r.late.n} / ${sg(r.late.net)} / ${sg(r.late.monthT, 2)} | ${r.all.n} / ${sg(r.all.net)} (${sg(r.all.gross)}) / ${sg(r.all.monthT, 2)} |`), ''].join('\n'));
  console.log(verdict); console.log(fs.readFileSync(path.join(HERE, 'RESULT.md'), 'utf8').split('\n').slice(6).join('\n'));
}
