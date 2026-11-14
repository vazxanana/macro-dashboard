// research/edge/rsi2-early-years: the frozen RSI(2) pullback before 2008, stopped as NOT MEASURABLE. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOOR_YEARS, FROZEN, ORIGINAL, inventory, measurable, verdict } from '../research/edge/rsi2-early-years/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'rsi2-early-years');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const R = JSON.parse(read('result.json'));
const DAY = 86400;

// daily rows [t, o, h, l, c, v] for every calendar day from `from` (weekend rows included, as OANDA's stubs)
function rows(from, days) {
  const t0 = Date.parse(from + 'T00:00:00Z') / 1000;
  return [...Array(days)].map((_, i) => [t0 + i * DAY, 100, 101, 99, 100, 1]);
}

test('frozen.mjs is the original rule file, byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN.sha256);
  assert.equal(h, 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65');
});

test('the gate reproduced every published figure of the original', () => {
  assert.equal(R.gate.pass, true);
  assert.equal(R.gate.verdict, 'FAIL');
  for (const row of R.gate.rows) {
    assert.equal(row.same, true, row.market);
    assert.deepEqual(row.A, ORIGINAL[row.market].A);
    assert.deepEqual(row.B, ORIGINAL[row.market].B);
    assert.equal(row.holmP, ORIGINAL[row.market].holm);
  }
});

test('inventory: first signal is the 201st weekday candle, years counted to 2007-12-31, weekends dropped', () => {
  const inv = inventory(rows('2003-03-24', 1800));
  assert.equal(inv.first, '2003-03-24');
  assert.equal(inv.firstSignal, '2003-12-29');          // 200 weekdays after Mon 24 Mar 2003 (no holidays here)
  assert.equal(inv.years, 4.01);
  assert.equal(inv.gapsOver4d, 0);
  const holed = rows('2003-03-24', 1800).filter((r, i) => i < 400 || i > 410);
  assert.equal(inventory(holed).gapsOver4d, 1);
  assert.equal(inventory(rows('2007-01-01', 100)).firstSignal, null);
});

test('measurability: under the 5-year floor is NOT MEASURABLE, at or over it is not decided here', () => {
  assert.equal(FLOOR_YEARS, 5);
  const short = { a: { years: 4 }, b: { years: 5.2 } };
  assert.deepEqual(measurable(short), { floorYears: 5, ok: false, short: ['a'] });
  const v = verdict(measurable(short), short, [['2006-01-06', 4.36]]);
  assert.equal(v.verdict, 'NOT MEASURABLE');
  assert.match(v.text, /^NOT MEASURABLE \(inconclusive: /);
  assert.equal(measurable({ a: { years: 5 }, b: { years: 6 } }).ok, true);
});

test('result.json: NOT MEASURABLE from the dates, nothing of 2004-07 computed', () => {
  assert.equal(R.verdict, 'NOT MEASURABLE');
  assert.match(R.verdictText, /4\.00 years/);
  const inv = R.replicationWindow.inventory;
  assert.deepEqual(Object.keys(inv), ['spx500', 'nas100', 'us30']);
  for (const k of Object.keys(inv)) { assert.equal(inv[k].first, '2003-03-24'); assert.ok(inv[k].years < FLOOR_YEARS); }
  assert.equal(R.replicationWindow.financingFrom, '2006-01-06');
  assert.equal(R.fisher.computed, false);
  const s = JSON.stringify(R);
  for (const banned of ['"years":{"2004', '"sumRet"', '"placebo":{"seeds"']) assert.ok(!s.includes(banned), banned);
});

test('RESULT.md: verdict line and the figures match result.json', () => {
  const md = read('RESULT.md');
  assert.ok(md.replace(/\s+/g, ' ').includes('**Verdict: ' + R.verdictText + '.**'), 'verdict line');
  for (const [k, v] of Object.entries(R.replicationWindow.inventory)) {
    assert.ok(md.includes(`| ${v.first} | ${v.firstSignal} | ${v.years.toFixed(2)} | ${v.gapsOver4d} |`), k);
  }
  for (const row of R.gate.rows) {
    const [n, ret] = row.B; assert.ok(md.includes(`${n}, +${ret.toFixed(3)}`), row.market);
  }
  const pre = read('PREREGISTRATION.md');
  assert.match(pre, /at least 5\.0 years of entry window/);
  assert.ok(!/\bedge\b.*\bproven\b/i.test(md));
});
