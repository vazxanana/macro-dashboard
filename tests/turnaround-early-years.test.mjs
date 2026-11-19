// research/edge/turnaround-early-years: the frozen files (hashes), the floor decision, the availability count on hand-made
// candles, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { FROZEN_SHA256, REPLICATE_SHA256, FLOOR_YEARS, GATE_862, GATE_857, availability, verdictOf } from '../research/edge/turnaround-early-years/run.mjs';
import * as F from '../research/edge/turnaround-early-years/frozen.mjs';

const dir = new URL('../research/edge/turnaround-early-years/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', dir), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(new URL(f, dir))).digest('hex');

test('frozen.mjs and replicate.mjs are the two studies\' run files byte for byte', () => {
  assert.equal(sha('frozen.mjs'), FROZEN_SHA256);
  assert.equal(sha('replicate.mjs'), REPLICATE_SHA256);
  assert.ok(PRE.includes(FROZEN_SHA256) && PRE.includes(REPLICATE_SHA256), 'the pre-registration names both hashes');
  assert.equal(F.RULES.r2.drop, -0.01); assert.equal(F.STOP_ATR, 2); assert.equal(F.ATR_N, 20);
});

test('the floor: under 5 years is NOT MEASURABLE, a gate miss too', () => {
  const ok = { ok: true };
  assert.equal(FLOOR_YEARS, 5);
  assert.equal(verdictOf({ a: { years: 4.69 }, b: { years: 0 } }, ok).verdict, 'NOT MEASURABLE');
  assert.equal(verdictOf({ a: { years: 5.2 } }, ok).verdict, 'RUN');
  assert.match(verdictOf({ a: { years: 9 } }, { ok: false }).why, /gate/);
});

test('availability counts close candles and finds the first entry with 21 closes behind it', () => {
  const days = F.tradingDays('2007-10-01', '2007-12-31');
  const bars = days.map((d) => [F.closeCandle(d), 1, 1, 1, 1]);
  const a = availability('nas100', bars);
  assert.equal(a.closes, days.length);
  assert.equal(a.firstEntry, days[21]);
  const holed = bars.filter((_, i) => i !== 5);
  assert.equal(availability('nas100', holed).firstEntry, days[27], 'a missing close pushes the first entry past it');
});

test('result.json and RESULT.md: gate reproduced exactly, span under the floor, nothing of 2003-07 run', () => {
  assert.equal(R.verdict, 'NOT MEASURABLE');
  assert.ok(R.gate.ok && R.gate.ok862 && R.gate.ok857);
  assert.deepEqual(R.gate.got862.pool, GATE_862.pool);
  assert.deepEqual(R.gate.got857, GATE_857);
  for (const [k, v] of Object.entries(GATE_862.markets)) assert.deepEqual(R.gate.got862.markets[k], v);
  assert.ok(R.span < FLOOR_YEARS && R.span > 4.6);
  assert.equal(R.availability.jp225.closes, 0);
  assert.equal(R.fisher.calendarDisjoint, null);
  assert.ok(MD.startsWith('# Result') && MD.includes('**Verdict: NOT MEASURABLE (inconclusive: about 4.7 years'));
  assert.ok(MD.includes(String(R.availability.nas100.years)) && MD.includes('22 Apr 2003'));
  assert.ok(!/"trades"/.test(JSON.stringify(R.availability)), 'no trades in the availability block');
});
