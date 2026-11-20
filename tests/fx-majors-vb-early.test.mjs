// fx-majors-vb-early: gold's T1 breakout on the five forex majors other than USD/JPY, 2005-2015
// (research/edge/fx-majors-vb-early). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MARKETS, W, MIN_POOL, MIN_MARKET, judge, holmMarkets, report } from '../research/edge/fx-majors-vb-early/run.mjs';
import { ORIG_SHA } from '../research/edge/fx-vol-breakout/run.mjs';

const DIR = new URL('../research/edge/fx-majors-vb-early/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));

test('fx-majors-vb-early: the pre-registered markets, window and bar; the rule file is the pinned one', () => {
  assert.deepEqual(MARKETS, ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']);
  assert.ok(!MARKETS.includes('usdjpy'));
  assert.deepEqual(W.ALL, ['2005-01-04', '2015-12-31']); assert.equal(W.H1[1], '2010-12-31'); assert.equal(W.H2[0], '2011-01-01');
  assert.equal(MIN_POOL, 5000); assert.equal(MIN_MARKET, 1000);
  const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  assert.match(pre, /2005-01-04 to 2015-12-31/); assert.match(pre, /The one test: the pool/); assert.match(pre, /at least 38 of its 40/);
  assert.match(pre, /Holm over the five/); assert.match(pre, /fewer than 5,000 trades/);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../index-vol-breakout/original.mjs', DIR))).digest('hex');
  assert.equal(sha, ORIG_SHA); assert.ok(pre.includes(ORIG_SHA));
});

const day = (y, i) => `${y}-${String(1 + (i % 12)).padStart(2, '0')}-0${1 + (i % 7)}`;
const mk = (v, n = 600) => [2006, 2008, 2012, 2014].flatMap((y) => Array.from({ length: n }, (_, i) =>
  ({ day: day(y, i), net: v + (i % 3) * 0.01, net2: v / 2, R: v, r: 1, side: 1, how: 'time', nights: 0, finR: 0 })));

test('fx-majors-vb-early: every check is needed, and too few trades is no verdict', () => {
  assert.equal(judge(mk(0.5), Array(40).fill(0), 1000).pass, true);
  assert.equal(judge(mk(0.5), Array(40).fill(1), 1000).pass, false, 'placebo');
  assert.equal(judge(mk(-0.5), Array(40).fill(-1), 1000).pass, false);
  const late = mk(0.5).map((t) => (t.day < '2011' ? { ...t, net: -0.5 } : { ...t, net: 2 }));
  assert.equal(judge(late, Array(40).fill(-9), 1000).checks.bothHalves, false);
  const few = judge(mk(0.5, 10), Array(40).fill(0), 1000);
  assert.equal(few.tooFew, true); assert.equal(few.pass, false);
});

test('fx-majors-vb-early: per market, Holm over the five can take a pass away, never give one', () => {
  const good = judge(mk(0.5), Array(40).fill(0), 1000), flat = () => judge(mk(-0.5), Array(40).fill(-1), 1000);
  const s = holmMarkets({ a: good, b: flat(), c: flat(), d: flat(), e: flat() }, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(s.a.pass, true); assert.equal(s.b.pass, false); assert.ok(s.a.holm < 0.05 && s.b.holm === 1);
  // a t just over 2 passes alone and fails after Holm x5 (p 0.02 -> 0.1)
  const weak = judge(mk(0.5), Array(40).fill(0), 1000); weak.all.t = 2.05; weak.pRaw = 0.02;
  const s2 = holmMarkets({ a: weak, b: flat(), c: flat(), d: flat(), e: flat() }, ['a', 'b', 'c', 'd', 'e']);
  assert.equal(s2.a.checks.t2, false); assert.equal(s2.a.pass, false);
});

test('fx-majors-vb-early: the report matches result.json and the verdict reads the pool only', () => {
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  assert.deepEqual(Object.keys(R.series), ['pool', ...MARKETS]);
  assert.equal(R.verdict.startsWith('PASS'), R.series.pool.pass);
  for (const r of Object.values(R.series)) assert.equal(r.pass, !r.tooFew && Object.values(r.checks).every(Boolean));
  assert.equal(R.series.pool.all.n, MARKETS.reduce((s, k) => s + R.series[k].all.n, 0));
  assert.ok(R.series.pool.all.n >= MIN_POOL);
  for (const d of R.data) { assert.ok(d.window[0] >= W.ALL[0] && d.window[1] <= W.ALL[1]); assert.ok(d.last < '2016-01-09'); }
  assert.equal(R.nights, 0);
  assert.equal(R.placeboPool.length, 40);
  assert.equal(R.placeboPool.filter((v) => R.series.pool.all.netR > v).length, R.series.pool.beaten);
  assert.doesNotMatch(md, /\bis an edge\b|proven/i);
});
