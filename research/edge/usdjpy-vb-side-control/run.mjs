// Edge research · usdjpy-vb-side-control: USD/JPY T1 against same-day, same-side random entries (PREREGISTRATION.md, pushed
// alone first). Paper research only.
//   node research/edge/usdjpy-vb-side-control/run.mjs <dir with usdjpy-5m-early.json.gz and usdjpy-5m.json.gz>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, placeboTrade, rng } from '../index-vol-breakout/original.mjs';
import { charge, SEEDS, PLACEBO } from '../fx-vol-breakout/run.mjs';
import { trades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2005-01-04', TO = '2026-11-19', SPLIT = '2016-01-01';
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// controls[s][i] = net R of seed s's control for real trade i (null when the random candle is missing)
export function controls(real, byDay, seeds = SEEDS) {
  const grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, out = [];
  for (let s = 1; s <= seeds; s++) {
    const rand = rng(s), row = [];
    for (const t of real) {
      const d = byDay.get(t.day), startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid);
      const x = placeboTrade(d.bars, { startT, side: t.side, dist: t.r, cost: 0 }); row.push(x ? charge('usdjpy', x).net : null);
    }
    out.push(row);
  }
  return out;
}
export function monthT(pairs) {
  const m = new Map(); for (const [day, v] of pairs) m.set(day.slice(0, 7), (m.get(day.slice(0, 7)) || 0) + v);
  const v = [...m.values()], a = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - a) ** 2, 0) / (v.length - 1));
  return { months: v.length, t: sd > 0 ? a / (sd / Math.sqrt(v.length)) : 0 };
}
export function decide(real, C) {
  const seedMeans = C.map((row) => mean(row.filter((v) => v != null))), realMean = mean(real.map((t) => t.net));
  const diff = real.map((t, i) => { const c = C.map((row) => row[i]).filter((v) => v != null); return c.length ? [t.day, t.net - mean(c), t.side] : null; }).filter(Boolean);
  const half = (f) => mean(diff.filter(f).map((d) => d[1])), mt = monthT(diff.map(([d, v]) => [d, v]));
  const checks = { beat: seedMeans.filter((m) => realMean > m).length >= 38, t2: mt.t >= 2, halves: half((d) => d[0] < SPLIT) > 0 && half((d) => d[0] >= SPLIT) > 0 };
  const side = (s) => ({ n: diff.filter((d) => d[2] === s).length, real: r3(mean(real.filter((t) => t.side === s).map((t) => t.net))), diff: r3(half((d) => d[2] === s)) });
  return { n: real.length, realMean: r3(realMean), controlMean: r3(mean(seedMeans)), beaten: seedMeans.filter((m) => realMean > m).length, diffMean: r3(mean(diff.map((d) => d[1]))),
    monthT: r3(mt.t), halves: { early: r3(half((d) => d[0] < SPLIT)), late: r3(half((d) => d[0] >= SPLIT)) }, bySide: { buy: side(1), sell: side(-1) }, checks, pass: Object.values(checks).every(Boolean) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2], real = [], byDay = new Map();
  for (const [f, a, b] of [['usdjpy-5m-early.json.gz', FROM, '2015-12-31'], ['usdjpy-5m.json.gz', SPLIT, TO]]) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))); rows.sort((p, q) => p[0] - q[0]);
    const days = buildDays(rows).filter((d) => d.day >= a && d.day <= b); for (const d of days) byDay.set(d.day, d); real.push(...trades('usdjpy', days));
  }
  const D = decide(real, controls(real, byDay));
  const verdict = `INVALID (look-ahead in the pre-registered control; see RESULT.md), computed ${D.pass ? 'PASS' : 'FAIL'}: USD/JPY T1 ${sg(D.realMean)}R a trade vs same-day, same-side random entries ${sg(D.controlMean)}R (n ${D.n}; paired difference ${sg(D.diffMean)}R, month t ${sg(D.monthT, 2)}; beats ${D.beaten} of 40)` +
    (D.pass ? '' : `; fails: ${Object.entries(D.checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'usdjpy-vb-side-control', built: '2026-11-20', verdict, ...D }, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# USD/JPY T1: timing or direction? (20 Nov 2026)', '',
    'Paper research only. The control and bar were fixed in `PREREGISTRATION.md` before any control trade was computed. Nothing live changed.', '',
    `**Verdict: ${verdict}**`, '',
    `| | n | Real R/trade | Paired difference (real − control) |`, '|---|---|---|---|',
    `| all | ${D.n} | ${sg(D.realMean)} | ${sg(D.diffMean)} (month t ${sg(D.monthT, 2)}) |`,
    `| buys | ${D.bySide.buy.n} | ${sg(D.bySide.buy.real)} | ${sg(D.bySide.buy.diff)} |`, `| sells | ${D.bySide.sell.n} | ${sg(D.bySide.sell.real)} | ${sg(D.bySide.sell.diff)} |`,
    `| 2005-15 | | | ${sg(D.halves.early)} |`, `| 2016 → | | | ${sg(D.halves.late)} |`, '',
    '**Why this result is invalid, not a FAIL.** The control takes the side of the real trade, and that side is decided by which way the day\'s breakout fired. A control entry drawn from 01:00-18:00 lands before the breakout on most days, so it is long or short with knowledge of the move that caused the breakout: look-ahead, which is why same-side random entries earn an impossible +0.36R a trade. The pre-registered design cannot answer the question. The corrected control (`usdjpy-vb-side-control-v2`, pre-registered separately) draws entries only after the real fill, when the side is known. No conclusion is drawn from the figures above.', ''].join('\n'));
  console.log(verdict);
}
