// The frozen replication of the vol-spike rebound: the frozen code is #860's file byte for byte, the gate reproduced #860's
// published 10-day block, the week count, the 2x-cost recompute, the reading words, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { weekly, weekOf, twice, reading, NEW, H, WIN } from '../research/edge/vol-spike-replicate/run.mjs';
import { MARKETS as OLD, simulate } from '../research/edge/vol-spike-replicate/frozen.mjs';

const DIR = 'research/edge/vol-spike-replicate/';
const R = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8'));
const DAY = 86400;

test('frozen.mjs is the rule code of #860, byte for byte', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(DIR + 'frozen.mjs')).digest('hex');
  assert.equal(sha, '339077aa9b4193eed610095fd75862195cf259c7ed29f78d4a26ac8f71beb8c1');
  const pre = fs.readFileSync(DIR + 'PREREGISTRATION.md', 'utf8');
  assert.ok(pre.includes(sha), 'the pre-registration pins the same hash');
});

test('new markets: the pre-registered seven, none of #860, hold 10 only', () => {
  assert.deepEqual(Object.keys(NEW).sort(), ['au200', 'de40', 'eu50', 'fr40', 'hk33', 'jp225', 'uk100']);
  for (const k of Object.keys(NEW)) assert.ok(!(k in OLD));
  assert.deepEqual(Object.keys(OLD).sort(), ['nas100', 'spx500', 'us30']);
  assert.equal(H, 10);
  assert.deepEqual(WIN, { R1: ['2016-01-01', '2099-12-31'], R2: ['2005-01-01', '2015-12-31'] });
  const pre = fs.readFileSync(DIR + 'PREREGISTRATION.md', 'utf8');
  for (const [k, m] of Object.entries(NEW)) assert.match(pre, new RegExp(`\\| ${k} \\| [A-Z0-9_]+ \\| ${m.cost.toFixed(1)} \\|`));
});

test('the gate: the frozen study reproduced #860 published 10-day block exactly', () => {
  assert.equal(R.gate.equal, true);
  const p = R.gate.published;
  assert.equal(p.B.n, 165); assert.equal(p.B.avgR, 0.151); assert.equal(p.B.tTrades, 2.53); assert.equal(p.B.holmP, 0.0114);
  assert.equal(p.A.n, 122); assert.equal(p.A.avgR, 0.013); assert.equal(p.B.random.p95, 0.141);
  assert.equal(p.pass, true);
});

test('R3 counts one observation per entry week: the mean of that week', () => {
  const t0 = Date.parse('2024-03-04T00:00:00Z') / 1000; // a Monday
  const tr = [{ tIn: t0, R: 1 }, { tIn: t0 + DAY, R: -0.5 }, { tIn: t0 + 4 * DAY, R: 0.5 }, { tIn: t0 + 7 * DAY, R: 2 }];
  assert.equal(weekOf(t0), weekOf(t0 + 6 * DAY)); assert.notEqual(weekOf(t0), weekOf(t0 + 7 * DAY));
  assert.deepEqual(weekly(tr), [1 / 3, 2]);
});

test('2x costs doubles spread and financing', () => {
  const t = { entry: 100, exit: 103, risk: 4, fin: 0.25, R: (103 - 100 - 1 - 0.25) / 4 };
  assert.equal(twice(t, 1).R, (3 - 2 - 0.5) / 4);
});

test('the reading words, as pre-registered', () => {
  const ok = { avgR: 0.1, t: 2.5, holm: { pass: true } };
  assert.equal(reading(ok, { avgR: 0.01 }, ok), 'REPLICATES');
  assert.equal(reading(ok, { avgR: -0.01 }, ok), 'PARTLY');
  assert.equal(reading({ avgR: 0.05, t: 1.2, holm: { pass: false } }, { avgR: -0.02 }, ok), 'PARTLY');
  assert.equal(reading({ avgR: 0.05, t: 0.9, holm: { pass: false } }, { avgR: 0.02 }, ok), 'DOES NOT REPLICATE');
  assert.equal(reading({ avgR: -0.05, t: -1.5, holm: { pass: false } }, { avgR: 0.02 }, ok), 'DOES NOT REPLICATE');
  assert.equal(R.reading, reading(R.R1, R.R2, R.R3));
});

test('every trade of the frozen rule has a stop below its entry', () => {
  const D = []; let px = 100;
  for (let i = 0; i < 260; i++) { px *= i > 200 && i < 206 ? (i % 2 ? 1.03 : 0.94) : (i % 2 ? 1.003 : 0.999); D.push({ time: 1.6e9 + i * DAY, open: px, high: px * 1.004, low: px * 0.996, close: px }); }
  const tr = simulate(D, 10);
  assert.ok(tr.length > 0);
  for (const t of tr) { assert.ok(t.stop < t.entry && t.risk > 0); assert.ok(t.hold <= 10); }
});

test('RESULT.md states the reading and the figures of result.json', () => {
  const md = fs.readFileSync(DIR + 'RESULT.md', 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${R.reading}\\.\\*\\*`));
  assert.equal(R.verdict, R.reading);
  const f = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(3);
  assert.ok(md.includes(`| R1 trades | 2016-01-01 to ${R.R1.to} | ${R.R1.n} | ${f(R.R1.avgR)} | ${R.R1.t.toFixed(2)} |`));
  assert.ok(md.includes(`| ${R.R2.n} | ${f(R.R2.avgR)} | ${R.R2.t.toFixed(2)} |`));
  assert.ok(md.includes(`| ${R.R3.n} weeks | ${f(R.R3.avgR)} | ${R.R3.t.toFixed(2)} |`));
  assert.ok(md.includes(`Holm p ${R.R1.holm.adj.toFixed(3)}`));
  assert.ok(md.includes(`95th percentile ${f(R.placebo.p95)}R`) && md.includes(`beats ${R.placebo.beats} of 40`));
  assert.ok(md.includes(`R1 ${f(R.costs2x.R1.avgR)}R (t ${R.costs2x.R1.t.toFixed(2)})`));
  for (const [k, m] of Object.entries(R.markets)) assert.ok(md.includes(`| ${m.R1.n} | ${f(m.R1.avgR)} |`), k);
});
