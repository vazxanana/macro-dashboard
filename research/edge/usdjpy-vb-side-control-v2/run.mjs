// Edge research · usdjpy-vb-side-control-v2: USD/JPY T1's buys against long entries at a random time on EVERY tradable day (and
// its sells against short ones), PREREGISTRATION.md (pushed alone first). Paper research only.
//   node research/edge/usdjpy-vb-side-control-v2/run.mjs <dir with usdjpy-5m-early.json.gz and usdjpy-5m.json.gz>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { buildDays, daySkip, placeboTrade, rng } from '../index-vol-breakout/original.mjs';
import { charge, SEEDS, PLACEBO, K } from '../fx-vol-breakout/run.mjs';
import { trades } from '../usdjpy-vol-breakout-early/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FROM = '2005-01-04', TO = '2026-11-19', SPLIT = '2016-01-01';
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r3 = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
const sg = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d));

// per seed: the long and short control trades on every tradable day ({ day, net })
export function controlsOf(days, seed) {
  const grid = (PLACEBO.to - PLACEBO.from) / 300 + 1, rand = rng(seed), long = [], short = [];
  for (const d of days.filter((x) => !daySkip(x))) {
    for (const [side, out] of [[1, long], [-1, short]]) {
      const startT = d.d0 + PLACEBO.from + 300 * Math.floor(rand() * grid);
      const x = placeboTrade(d.bars, { startT, side, dist: K * d.prevRange, cost: 0 }); if (x) out.push({ day: d.day, net: charge('usdjpy', x).net });
    }
  }
  return { long, short };
}
export function decide(real, perSeed) {
  const pick = (arr, f) => mean(arr.filter(f).map((x) => x.net));
  const buys = real.filter((t) => t.side > 0), sells = real.filter((t) => t.side < 0), b = mean(buys.map((t) => t.net)), s = mean(sells.map((t) => t.net));
  const L = perSeed.map((c) => mean(c.long.map((x) => x.net))), S = perSeed.map((c) => mean(c.short.map((x) => x.net)));
  const half = (w) => { const f = (x) => (w === 'early' ? x.day < SPLIT : x.day >= SPLIT);
    return { buys: r3(pick(buys, f)), long: r3(mean(perSeed.map((c) => pick(c.long, f)))), sells: r3(pick(sells, f)), short: r3(mean(perSeed.map((c) => pick(c.short, f)))) }; };
  const beaten = L.filter((m) => b > m).length;
  return { buys: { n: buys.length, net: r3(b), controlMean: r3(mean(L)), beaten }, sells: { n: sells.length, net: r3(s), controlMean: r3(mean(S)), beaten: S.filter((m) => s > m).length },
    halves: { early: half('early'), late: half('late') }, pass: beaten >= 38 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2], real = [], allDays = [];
  for (const [f, a, b] of [['usdjpy-5m-early.json.gz', FROM, '2015-12-31'], ['usdjpy-5m.json.gz', SPLIT, TO]]) {
    const rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))); rows.sort((p, q) => p[0] - q[0]);
    const days = buildDays(rows).filter((d) => d.day >= a && d.day <= b); allDays.push(...days); real.push(...trades('usdjpy', days));
  }
  const perSeed = []; for (let s = 1; s <= SEEDS; s++) perSeed.push(controlsOf(allDays, s));
  const D = decide(real, perSeed);
  const verdict = `${D.pass ? 'PASS' : 'FAIL'}: USD/JPY T1 buys ${sg(D.buys.net)}R a trade (n ${D.buys.n}) vs long at a random time on every day ${sg(D.buys.controlMean)}R; beats ${D.buys.beaten} of 40 (38 needed). Sells ${sg(D.sells.net)}R vs short ${sg(D.sells.controlMean)}R (beats ${D.sells.beaten} of 40, reported)`;
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify({ study: 'usdjpy-vb-side-control-v2', built: '2026-11-20', verdict, ...D }, null, 1) + '\n');
  const h = D.halves;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), ['# USD/JPY T1: more than being long? (20 Nov 2026)', '',
    'Paper research only. The corrected control (v1 had look-ahead, see `usdjpy-vb-side-control`) and its bar were fixed in `PREREGISTRATION.md` before any control trade was computed. Nothing live changed.', '',
    `**Verdict: ${verdict}**`, '',
    '| | T1 buys | Long, random time, every day | T1 sells | Short, random time, every day |', '|---|---|---|---|---|',
    `| 2005 → 2026-11 | ${sg(D.buys.net)} | ${sg(D.buys.controlMean)} | ${sg(D.sells.net)} | ${sg(D.sells.controlMean)} |`,
    `| 2005-15 | ${sg(h.early.buys)} | ${sg(h.early.long)} | ${sg(h.early.sells)} | ${sg(h.early.short)} |`,
    `| 2016 → | ${sg(h.late.buys)} | ${sg(h.late.long)} | ${sg(h.late.sells)} | ${sg(h.late.short)} |`, '',
    D.pass ? 'Reading: T1\'s buys earn more than being long USD/JPY at a random time on any day; the breakout entry adds something beyond the pair\'s drift.' : 'Reading: T1\'s buys are not shown to beat being long USD/JPY at a random time; the lead may be the pair\'s drift and carry.', ''].join('\n'));
  console.log(verdict);
}
