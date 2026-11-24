import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { tradesExit, exitHourOf, costFrac, priced, early, late, reading, comboHolds, report, EXITS, ALTS, COMBOS, SHA } from '../research/edge/gold-vb-exit/run.mjs';

const dir = new URL('../research/edge/gold-vb-exit/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));
const flat = { profile: Array.from({ length: 24 }, (_, h) => ({ frac: h === 20 ? 4e-5 : 2e-5 })), commission: 2.4e-5 };

// a weekday of 252 M5 candles (00:00-20:55 UTC) at 4000, one break above O + 0.5 × prevRange at candle `at`
function dayWith(at) {
  const d0 = 1700006400, bars = [];
  for (let i = 0; i < 252; i++) bars.push({ t: d0 + i * 300, o: 4000, h: 4001, l: 3999, c: 4000 });
  for (let i = at; i < 252; i++) bars[i] = { t: d0 + i * 300, o: 4012, h: 4014, l: 4011, c: 4013 };
  bars[at] = { t: d0 + at * 300, o: 4000, h: 4015, l: 4001, c: 4012 };
  return { day: { day: '2023-11-15', d0, bars, prevRange: 20 }, full: new Map([[d0, bars]]) };
}

test('the exit hands over the candles that start before it; a break after the exit is no trade', () => {
  const { day, full } = dayWith(200);                                                  // 16:40 UTC
  assert.equal(tradesExit([day], full, flat, EXITS['12:00']).length, 0);
  const [x] = tradesExit([day], full, flat, EXITS['18:00']);
  assert.equal(x.side, 1); assert.equal(x.how, 'time'); assert.equal(x.fillMin, 1000);
  const [y] = tradesExit([day], full, flat), [z] = tradesExit([day], full, flat, EXITS['21:00'] - 1);
  assert.deepEqual(z, y);                                                              // the rule's own candles = the filter path
  assert.ok(y.R > 0 && y.net < y.R && Math.abs(y.net2 - (y.R - 2 * y.cost - 2 * y.finR)) < 1e-12);
});

test('C1: fill hour + exit hour + commission + 0.05 × M, and the exit hour of each window', () => {
  assert.deepEqual(Object.values(EXITS).map(exitHourOf), [11, 14, 17, 20]);
  assert.equal(costFrac(flat.profile, 3, 20, flat.commission), 0.5 * 2e-5 + 0.5 * 4e-5 + 2.4e-5);
  const x = { day: '2020-01-02', side: 1, how: 'stop', fillMin: 185, entry: 4000, r: 10, R: -1, finR: 0, M: 2 };
  const p = priced(x, flat, 20), want = ((0.5 * 2e-5 + 0.5 * 4e-5 + 2.4e-5) * 4000 + 0.05 * 2) / 10;
  assert.ok(Math.abs(p.cost - want) < 1e-12); assert.ok(Math.abs(p.net - (-1 - want)) < 1e-12);
});

test('the early split is the fill candle before 06:00 UTC', () => {
  const tr = [{ fillMin: 0 }, { fillMin: 355 }, { fillMin: 360 }, { fillMin: 1000 }];
  assert.deepEqual(early(tr).map((x) => x.fillMin), [0, 355]); assert.deepEqual(late(tr).map((x) => x.fillMin), [360, 1000]);
  const { day, full } = dayWith(30);                                                   // 02:30 UTC
  assert.equal(early(tradesExit([day], full, flat, EXITS['12:00'])).length, 1);
});

test('the pre-registered reading and the combination rule', () => {
  const ok = { early: { netR: 0.01 }, late: { netR: 0.02 }, pooled: { netR: 0.02, t: 2.1 } };
  assert.equal(reading([ok, ok, ok, { ...ok, pooled: { netR: 0.01, t: 1 } }]).label, 'BROAD');
  assert.equal(reading([ok, ok, { ...ok, pooled: { netR: 0.01, t: 1 } }, { ...ok, pooled: { netR: 0.01, t: 1 } }]).label, 'NARROW');
  assert.equal(reading([ok, ok, ok, { ...ok, late: { netR: -0.001 } }]).label, 'NARROW');
  const neg = { ...ok, pooled: { netR: -0.01, t: -1 } };
  assert.equal(reading([ok, ok, neg, neg]).label, 'FAIL');
  const lo = { ...ok, pooled: { netR: 0.01, t: 1 } };
  assert.equal(reading([lo, lo, lo, lo]).label, 'FAIL');
  assert.equal(comboHolds(ok, 0.04), true); assert.equal(comboHolds(ok, 0.06), false);
  assert.equal(comboHolds({ ...ok, early: { netR: 0 } }, 0.01), false);
  assert.equal(R.reading.label, reading(ALTS.map((n) => R.settings.find((s) => s.name === n).row)).label);
  assert.ok(R.verdict.startsWith(R.reading.label));
  assert.deepEqual(R.combos.map((c) => c.name), COMBOS);
  for (const c of R.combos) assert.equal(c.holds, comboHolds(c.row, c.pHolm));
  assert.equal(R.holm.length, 8);
});

test('gate, frozen inputs, plan hash and report against result.json', () => {
  assert.equal(R.gate.ok, true); assert.equal(R.gate.same, R.gate.of);
  const hc = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-vol-breakout-hourcost/result.json', import.meta.url)));
  for (const [w, g] of Object.entries(R.gate.windows)) assert.deepEqual(g.got, hc.grid.H['0.05'][w]);
  const rule = R.settings.find((s) => s.name === 'exit 21:00 (rule)').row.pooled;
  assert.equal(rule.n, 3713); assert.equal(rule.netR, 0.139); assert.equal(rule.t, 6.47);
  for (const [f, want] of Object.entries(SHA)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/' + f, import.meta.url))).digest('hex'), want);
  assert.equal(R.planSha256, crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(R));
});
