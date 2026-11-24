// tests/fade-evening.test.mjs - a tradable evening fade: pre-registration, RESULT.md agrees with result.json, the verdict
// follows the bar, the gate, and the simulator's rollover rule on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sim, inRoll, rollBetween, cellOf, cellName, NC, HOURS } from '../research/edge/fade-evening/run.mjs';

const DIR = new URL('../research/edge/fade-evening/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const u = (d, h, m = 0) => Date.UTC(2020, 0, d, h, m) / 1000;

test('pre-registration fixes the grid, the pick and the three tests', () => {
  for (const w of ['BEFORE any run', '24 cells', 'k = 1, 1.5, 2', 'n >= 1,000', 'P1', 'P2', 'P3', 'Holm over the three', 'gbpjpy audjpy cadjpy eurgbp euraud',
    'No fill between 21:00 and 22:59 UTC', 'AFTER costs']) assert.ok(pre.includes(w), w);
  assert.equal(NC, 24); assert.deepEqual(HOURS.A, [20, 23]);
  const names = new Set(Array.from({ length: NC }, (_, c) => cellName(c).name)); assert.equal(names.size, 24);
  assert.equal(cellName(cellOf(1, 2, 1, 1)).name, 'B 2ATR lim calm');
});

test('line 3 is the verdict line and matches result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line); assert.ok(line.includes(R.headline));
  assert.ok(R.gate.ok); assert.equal(R.gate.simMismatches, 0);
  const disc = R.cells.filter((c) => c.disc.n >= 1000); const best = disc.reduce((a, b) => (b.disc.meanNet > a.disc.meanNet ? b : a));
  assert.equal(R.selected.cell, best.cell, 'the pick is the best after costs in 2005-14');
  for (const p of R.primary) assert.equal(p.pass, p.meanNet > 0 && p.tNet >= 2 && p.holm < 0.05, p.key);
  assert.equal(R.verdict, R.primary.every((p) => p.pass) ? 'PASS' : 'FAIL');
  for (const p of R.primary) { const l = md.split('\n').find((x) => x.startsWith(`| ${p.key} |`)); assert.ok(l && l.includes(f3(p.meanNet)), p.key); }
});

test('the simulator: stop side, rollover flat, gap over the rollover, limit fill candle', () => {
  const c = (t, o, h, l, cl) => ({ t, e: t + 300, o, h, l, c: cl });
  assert.throws(() => sim([c(u(2, 20), 100, 101, 99, 100)], 1, 0, 100, 101, 102, u(3, 20), true, false), /wrong side/);
  // a buy at 20:50 that is still open at 21:00 is closed at 20:55's close
  const M = [c(u(2, 20, 50), 100, 100.5, 99.8, 100.2), c(u(2, 20, 55), 100.2, 100.6, 100, 100.4), c(u(2, 21, 0), 100.4, 103, 100.3, 102.9)];
  const x = sim(M, 1, 0, 100, 99, 102, u(3, 20), true, false); assert.equal(x.how, 'flat'); assert.ok(Math.abs(x.R - 0.4) < 1e-9);
  const y = sim(M, 1, 0, 100, 99, 102, u(3, 20), false, false); assert.equal(y.how, 'target');
  // a feed with no candles in the rollover: 20:55 then 23:00 -> flat at 20:55's close
  const G = [c(u(2, 20, 50), 100, 100.5, 99.8, 100.2), c(u(2, 20, 55), 100.2, 100.6, 100, 100.4), c(u(2, 23, 0), 103, 103, 103, 103)];
  assert.equal(sim(G, 1, 0, 100, 99, 102, u(3, 20), true, false).how, 'flat');
  assert.ok(rollBetween(u(2, 21), u(2, 23)) && !rollBetween(u(2, 10), u(2, 10, 5)) && inRoll(u(2, 22, 55)) && !inRoll(u(2, 23)));
  // a limit's fill candle that also reaches the target does not book it
  const Lm = [c(u(2, 10), 100, 103, 99.5, 102), c(u(2, 10, 5), 102, 102.2, 101.9, 102)];
  const z = sim(Lm, 1, 0, 100, 99, 102, u(3, 10), true, true); assert.equal(z.e, Lm[1].t, 'booked on the next candle, not the fill candle');
  assert.equal(sim(Lm, 1, 0, 100, 99, 102, u(3, 10), true, false).e, Lm[0].e, 'a market entry books it on the fill candle');
});
