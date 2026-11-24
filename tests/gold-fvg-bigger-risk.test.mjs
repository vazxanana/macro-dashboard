// tests/gold-fvg-bigger-risk.test.mjs - gold's FVG return on H4 / D1 gaps at measured costs (research/edge/gold-fvg-bigger-risk).
// Offline: the stored result, the cost of a hand-made trade, the harness checks recorded by the run (gate, walk, cut test).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { costOf, HOURS, COMM, TESTS } from '../research/edge/gold-fvg-bigger-risk/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-fvg-bigger-risk/result.json', import.meta.url), 'utf8'));
const G7 = JSON.parse(fs.readFileSync(new URL('../research/edge/grid7-fvg-wide/result.json', import.meta.url), 'utf8'));

test('verdict and both tests as stored', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.ok(R.headline.startsWith('FAIL.'));
  assert.equal(R.tests.length, TESTS.length);
  assert.equal(R.tests.filter((x) => x.pass).length, 0);
  const [t1, t2] = R.tests;
  assert.deepEqual([t1.tf, t2.tf], ['4h', '1d']);
  assert.deepEqual([t1.disc.n, t1.conf.n, t2.disc.n, t2.conf.n], [1249, 1697, 241, 312]);
  assert.ok(t1.conf.mean < 0 && t1.conf.t < 1 && t2.disc.mean < 0 && t2.conf.t < 1);
  for (const x of R.tests) assert.ok(x.conf.gross > x.conf.mean, 'cost is charged');
});

test('harness checks: gate against grid7, exit walk, no look-ahead', () => {
  const ref = G7.perMarket['4h mkt large 1R'].find((x) => x.market === 'xau');
  const g = R.gate.find((x) => x.tf === '4h');
  assert.ok(g.ok); assert.deepEqual(g.n, [ref.d.n, ref.c.n]);
  assert.ok(Math.abs(g.mean[1] - ref.c.mean) < 0.005);
  assert.ok(R.gate.every((x) => x.ok) && R.walkOk && R.counts.mism === 0);
  assert.ok(R.cut.length === 5 && R.cut.every((c) => c.missing === 0 && c.extra === 0 && c.n > 0));
});

test('cost of a hand-made trade: spread by hour, commission, half spread more on a stop, financing on a buy only', () => {
  const t = Date.UTC(2024, 0, 8, 10, 0) / 1000, at = Date.UTC(2024, 0, 10, 14, 0) / 1000; // Mon 10:00 -> Wed 14:00 UTC
  const fill = 2000, risk = 10;
  const buyStop = costOf(['1d', 0, t, 1, fill, risk, -1, at, 0]);
  const want = (0.5 * HOURS[10].frac + HOURS[14].frac + COMM) * fill / risk;
  assert.ok(Math.abs(buyStop.spread + buyStop.comm - want) < 1e-12);
  assert.equal(buyStop.nights, nights(t, at)); assert.equal(buyStop.nights, 2);
  assert.ok(Math.abs(buyStop.fin - 2 * FIN.xau.long * fill / risk) < 1e-12);
  const sellTgt = costOf(['1d', 0, t, -1, fill, risk, 1, at, 1]);
  assert.equal(sellTgt.fin, 0);
  assert.ok(Math.abs(sellTgt.total - (0.5 * HOURS[10].frac + 0.5 * HOURS[14].frac + COMM) * fill / risk) < 1e-12);
  assert.ok(Math.abs(costOf(['1d', 0, t, 1, fill, risk, -1, at, 0], { mult: 2 }).total - 2 * buyStop.total) < 1e-12);
});
