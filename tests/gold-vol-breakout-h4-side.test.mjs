// node --test tests/gold-vol-breakout-h4-side.test.mjs — research/edge/gold-vol-breakout-h4-side (14 Nov 2026): the H4
// candles on the 17:00 New York grid, the 20-close break state with no look-ahead, the side filter on hand-made trades, the
// decision, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-vol-breakout-h4-side/run.mjs';
import * as O from '../research/edge/gold-vol-breakout-h4-side/original.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-vol-breakout-h4-side');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const R = JSON.parse(read('result.json'));
const at = (s) => Date.parse(s) / 1000;

test('original.mjs is the verbatim copy and the base rule is its T1', () => {
  assert.equal(sha(read('original.mjs')), S.ORIG_SHA);
  assert.deepEqual(S.BASE, { name: 'k 0.5, both sides', k: 0.5, sides: 'both' });
  assert.equal(O.COST, 0.6);
});

test('H4 blocks start at 17:00 New York, summer and winter', () => {
  // July: New York UTC-4, so 17:00 New York = 21:00 UTC; January: UTC-5, 22:00 UTC
  assert.equal(S.blockKey(at('2020-07-07T21:00:00Z')), at('2020-07-07T21:00:00Z'));
  assert.equal(S.blockKey(at('2020-07-08T00:55:00Z')), at('2020-07-07T21:00:00Z'));
  assert.equal(S.blockKey(at('2020-07-08T01:00:00Z')), at('2020-07-08T01:00:00Z'));
  assert.equal(S.blockKey(at('2020-01-07T22:00:00Z')), at('2020-01-07T22:00:00Z'));
  assert.equal(S.blockKey(at('2020-01-08T01:55:00Z')), at('2020-01-07T22:00:00Z'));
  assert.equal(S.blockKey(at('2020-01-08T02:00:00Z')), at('2020-01-08T02:00:00Z'));
  // a stub block (under 12 M5 candles) is dropped
  const t0 = at('2020-07-08T01:00:00Z'), rows = [];
  for (let i = 0; i < 48; i++) rows.push([t0 + i * 300, 1, 1, 1, 10 + i]);
  for (let i = 0; i < 5; i++) rows.push([t0 + 4 * 3600 + i * 300, 1, 1, 1, 99]);
  const h4 = S.buildH4(rows);
  assert.equal(h4.length, 1); assert.equal(h4[0].close, 57); assert.equal(h4[0].n, 48);
});

function series(closes, start = at('2020-07-06T01:00:00Z')) { return closes.map((c, i) => ({ time: start + i * S.H4, close: c, n: 48 })); }

test('break state: latest 20-close break, none after 60 quiet candles, only closed candles', () => {
  const up = [...Array(20).fill(100), 101];                              // candle 20 breaks up
  assert.deepEqual(S.breaks(series(up)).slice(19), [0, 1]);
  const h = series([...up, ...Array(5).fill(100.5), 99]);               // candle 26 below the lowest of the prior 20 (100)
  assert.equal(S.breaks(h)[26], -1);
  const endOf = (i) => h[i].time + S.H4;
  const st = S.stateAt(h, [endOf(19), endOf(20), endOf(25), endOf(26), endOf(26) - 1]);
  assert.equal(st.get(endOf(19)), 0, 'no break yet');
  assert.equal(st.get(endOf(20)), 1);
  assert.equal(st.get(endOf(25)), 1);
  assert.equal(st.get(endOf(26)), -1);
  assert.equal(st.get(endOf(26) - 1), 1, 'candle 26 not ended yet: not read');
  // no look-ahead: candles after a day's 00:00 never change its state
  const d0 = endOf(22), a = S.stateAt(h, [d0]).get(d0), b = S.stateAt(series([...up, 100.5, 100.5, 0, 0, 0, 0]), [d0]).get(d0);
  assert.equal(a, b);
  // 60 used candles after the last break: none
  const quiet = series([...up, ...Array(S.LOOK).fill(100.5)]);
  assert.equal(S.stateAt(quiet, [quiet[20 + S.LOOK - 1].time + S.H4]).get(quiet[20 + S.LOOK - 1].time + S.H4), 1);
  assert.equal(S.stateAt(quiet, [quiet[20 + S.LOOK].time + S.H4]).get(quiet[20 + S.LOOK].time + S.H4), 0);
});

test('the side filter and the placebo', () => {
  const tr = [{ side: 1, h4: 1 }, { side: -1, h4: 1 }, { side: -1, h4: -1 }, { side: 1, h4: 0 }];
  assert.deepEqual(tr.map(S.keepT1), [true, false, true, false]);
  assert.deepEqual(tr.map(S.keepT2), [true, false, true, true]);
  assert.deepEqual(tr.map(S.against), [false, true, false, false]);
  const base = Array.from({ length: 50 }, (_, i) => ({ net: i / 50 }));
  const p = S.placebo(base, 10);
  assert.equal(p.length, 40); assert.deepEqual(p, S.placebo(base, 10), 'seeded');
  assert.ok(S.placebo(base, 50).every((v) => v === 0.49), 'the whole set drawn: its mean');
});

test('result.json and RESULT.md agree with the code', () => {
  assert.equal(R.planSha256, sha(read('PREREGISTRATION.md')));
  assert.equal(R.original.runSha256, S.ORIG_SHA);
  assert.equal(R.gate.ok, true);
  assert.deepEqual(R.decision, S.decide(R.tests, Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.means]))));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.ok(read('RESULT.md').includes(`**Verdict: ${R.verdict}**`));
  assert.equal(studyVerdict(R, read('RESULT.md')).verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(R.verdict.length < 220);
  for (const k of ['base', 'T1', 'T2', 'against']) assert.equal(R.tests[k].all.n, R.tests[k].H1.n + R.tests[k].H2.n);
  assert.equal(R.counts.base, R.counts.T1 + R.counts.against + R.counts.none);
  assert.equal(R.placebo.T1.means.length, 40);
});
