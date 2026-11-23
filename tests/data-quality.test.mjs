// tests/data-quality.test.mjs - the research candle cache audit (research/edge/data-quality): the shape of quality.json,
// a reason on every exclusion, and the audit's pure helpers. Offline: reads only the committed json and the module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_MARKETS, HIST, INDICES, slidingMedian, slotClass, holidays, holidaysDE, indexClass, KNOWN } from '../research/edge/data-quality/audit.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const Q = JSON.parse(fs.readFileSync(path.join(HERE, '../research/edge/data-quality/quality.json'), 'utf8'));
const KINDS = new Set(['gap', 'spike', 'spike-unchecked', 'feed', 'daily', 'structure']);
const VERDICTS = new Set(['usable', 'usable with exclusions', 'not usable']);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const sec = (s) => Date.parse(s) / 1000;

function checkInterval(e, where) {
  assert.match(e.from, ISO, where); assert.match(e.to, ISO, where);
  assert.equal(sec(e.from), e.fromT, where); assert.equal(sec(e.to), e.toT, where);
  assert.ok(e.toT > e.fromT, where + ': to after from');
  assert.ok(KINDS.has(e.kind), where + ': kind ' + e.kind);
  assert.equal(typeof e.reason, 'string', where); assert.ok(e.reason.trim().length >= 20, where + ': a reason in words');
}

test('quality.json covers every market of the cache with a verdict', () => {
  assert.equal(Q.focusFrom, '2020-01-01');
  assert.deepEqual(Object.keys(Q.markets).sort(), [...ALL_MARKETS].sort());
  for (const m of ALL_MARKETS) {
    const v = Q.markets[m];
    assert.equal(v.market, m);
    assert.ok(VERDICTS.has(v.verdict), m); assert.ok(v.verdictWhy.length > 5, m);
    assert.match(v.first, ISO); assert.match(v.last, ISO); assert.ok(v.n5m > 100000, m);
    assert.ok(v.longestGaps.length <= 20, m);
    for (const g of v.longestGaps) { assert.ok(g.from >= '2020', m); assert.ok(g.minutes > 0, m); }
    for (const [y, Y] of Object.entries(v.years)) {
      assert.match(y, /^\d{4}$/);
      for (const k of ['n5m', 'dup', 'unsorted', 'ohlcBad', 'nonPositive', 'oddMinute', 'saturday', 'rangeSpikes', 'jumpReverts']) assert.ok(Number.isInteger(Y[k]) && Y[k] >= 0, `${m} ${y} ${k}`);
      for (const k of ['over15m', 'over1h', 'over3h']) assert.ok(Number.isInteger(Y.gaps[k]), `${m} ${y} gaps.${k}`);
      assert.ok(Y.gaps.over15m >= Y.gaps.over1h && Y.gaps.over1h >= Y.gaps.over3h, `${m} ${y} gap counts nest`);
      if (Y.coverage != null) assert.ok(Y.coverage > 0 && Y.coverage <= 1, `${m} ${y} coverage`);
    }
    // a second feed where council-data holds one, and said so where it does not
    assert.equal(v.secondFeedAvailable, !!HIST[m], m);
    if (HIST[m]) { assert.ok(v.feed && v.feed.from2020, m); assert.ok(v.feed.from2020.shareBoth > 0.9, m + ' feeds overlap'); }
    else assert.equal(v.feed, null, m);
    if (INDICES[m]) assert.ok(v.index && Object.keys(v.index.openHoursPerWeek).length, m + ' learned hours');
  }
});

test('every exclusion (and every review entry) has an interval, a kind and a reason', () => {
  let n = 0;
  for (const [m, v] of Object.entries(Q.markets)) {
    assert.ok(Array.isArray(v.exclusions) && Array.isArray(v.review), m);
    v.exclusions.forEach((e, i) => { checkInterval(e, `${m} exclusion ${i}`); assert.notEqual(e.kind, 'spike-unchecked', `${m}: an unchecked spike is review, not an exclusion`); n++; });
    v.review.forEach((e, i) => { checkInterval(e, `${m} review ${i}`); assert.equal(e.kind, 'spike-unchecked'); assert.ok(e.toT > sec('2020-01-01'), m); });
    // the verdict's count is the exclusions from 2020 on
    assert.equal(v.focus.exclusions, v.exclusions.filter((e) => e.toT > sec('2020-01-01')).length, m);
    if (v.verdict === 'usable') assert.equal(v.focus.exclusions, 0, m);
  }
  assert.ok(n > 0);
});

test('the clocks of the two feeds agree (best return correlation at lag 0) wherever both exist', () => {
  for (const [m, v] of Object.entries(Q.markets)) if (v.feed) assert.equal(v.feed.from2020.bestLagAllZero, true, m);
});

test('slidingMedian equals a brute-force median', () => {
  const vals = Float64Array.from({ length: 60 }, (_, i) => ((i * 37) % 23) + (i === 20 ? NaN : 0));
  const half = 5, out = slidingMedian(vals, half);
  for (let i = 0; i < vals.length; i++) {
    const w = []; for (let j = Math.max(0, i - half); j < Math.min(vals.length, i + half); j++) if (!Number.isNaN(vals[j])) w.push(vals[j]);
    w.sort((a, b) => a - b); const n = w.length, med = n % 2 ? w[n >> 1] : (w[(n >> 1) - 1] + w[n >> 1]) / 2;
    assert.equal(out[i], med, 'i ' + i);
  }
});

test('slot classes: weekend, the 17:00 New York break, holidays, an ordinary hour', () => {
  const fx = holidays(false), metal = holidays(true);
  assert.equal(slotClass(sec('2024-03-09T12:00:00Z'), fx), 'weekend');            // Saturday
  assert.equal(slotClass(sec('2024-03-08T22:05:00Z'), fx), 'weekend');            // Fri 17:05 New York
  assert.equal(slotClass(sec('2024-03-06T22:05:00Z'), fx), 'break');              // Wed 17:05 New York (winter)
  assert.equal(slotClass(sec('2024-07-10T21:30:00Z'), fx), 'break');              // Wed 17:30 New York (summer)
  assert.equal(slotClass(sec('2024-12-25T15:00:00Z'), fx), 'holiday');
  assert.equal(slotClass(sec('2024-03-29T15:00:00Z'), fx), 'holiday');            // Good Friday
  assert.equal(slotClass(sec('2024-11-28T19:00:00Z'), metal), 'holiday');         // Thanksgiving 14:00 New York, metals
  assert.equal(slotClass(sec('2024-11-28T19:00:00Z'), fx), null);                 // forex trades on
  assert.equal(slotClass(sec('2024-03-06T14:00:00Z'), fx), null);
  const de = holidaysDE(); const sched = new Map([[2024, new Uint8Array(7 * 288).fill(1)]]);
  assert.equal(indexClass(sec('2024-05-01T10:00:00Z'), 'eu', sched, de), 'holiday'); // 1 May, Frankfurt
  assert.equal(indexClass(sec('2024-05-02T10:00:00Z'), 'eu', sched, de), null);
  assert.equal(indexClass(sec('2024-05-02T10:00:00Z'), 'eu', new Map([[2024, new Uint8Array(7 * 288)]]), de), 'break');
  for (const k of KNOWN) { assert.ok(k.why.length > 10); assert.ok(k.from < k.to); }
});
