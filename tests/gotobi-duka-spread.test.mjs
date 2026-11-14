// gotobi-duka-spread: the frozen rule is byte for byte, the probe asks for the right files on gotobi days, its outcome follows
// the pre-registration (no figure when nothing could be read), and the report is the one result.json gives. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gotobi-duka-spread/run.mjs';
import * as F from '../research/edge/gotobi-duka-spread/frozen.mjs';
import { classify, headlineOf } from '../research/edge/verdict.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'gotobi-duka-spread');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

test('frozen.mjs is the gotobi T2 rule, byte for byte', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(sha, '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32');
  assert.deepEqual(F.legTimes('fade', '2016-02-05'), { entry: Date.parse('2016-02-05T00:55:00Z') / 1000, exit: Date.parse('2016-02-05T06:00:00Z') / 1000 });
});

test('the probe asks for both sides of the five yen pairs on three gotobi days', () => {
  const G = F.gotobiSet(2010, 2026);
  for (const d of S.PROBE_DAYS) { assert.ok(G.has(d), d); assert.ok(F.isTokyoBusinessDay(d), d); }
  assert.deepEqual(S.SYMBOLS, ['USDJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'CHFJPY']);
  assert.equal(S.minuteUrl('USDJPY', 'ASK', '2016-02-05'), 'https://datafeed.dukascopy.com/datafeed/USDJPY/2016/01/05/ASK_candles_min_1.bi5');
  const u = S.probeUrls();
  assert.equal(u.length, 30);
  assert.equal(new Set(u.map((x) => x.url)).size, 30);
});

test('outcome: no file at all is NOT MEASURABLE; one file is reachable and gives no verdict', () => {
  const row = (ok, side = 'BID') => ({ day: '2016-02-05', sym: 'USDJPY', side, ok, tries: ok ? [{ via: 'fetch', status: 200, bytes: 9 }] : [{ via: 'curl', status: null, error: 'CONNECT 403' }] });
  const none = S.classifyProbe([row(false), row(false, 'ASK')]);
  assert.equal(none.reachable, false);
  assert.deepEqual(none.errors, ['CONNECT 403']);
  assert.match(S.verdictOf(none), /^NOT MEASURABLE \(inconclusive: /);
  const one = S.classifyProbe([row(true), row(false, 'ASK')]);
  assert.equal(one.reachable, true);
  assert.equal(S.verdictOf(one), null);
});

test('result.json: nothing was computed from data that was never read, and RESULT.md is its report', () => {
  const o = JSON.parse(read('result.json'));
  assert.match(o.verdict, /^NOT MEASURABLE \(inconclusive: /);
  assert.equal(o.probe.reachable, false);
  assert.equal(o.rows.length, 30);
  assert.ok(o.rows.every((r) => !r.ok));
  assert.deepEqual(o.computed, { measurementA: null, testB: null, feedCheck: null, placebo: null });
  assert.equal(o.frozen.sha256, '645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32');
  assert.equal(o.data.gotobi, true);
  assert.equal(read('RESULT.md'), S.report(o));
  assert.equal(classify(headlineOf(read('RESULT.md'))), 'inc');
});

test('the pre-registration fixes the bar, and the report claims no edge', () => {
  const p = read('PREREGISTRATION.md');
  for (const s of ['month t >= 2', 'Holm', '0.3 pip a side', '2010-01-01 to 2015-12-31', 'USD 22.5 per million', 'NOT MEASURABLE']) assert.ok(p.includes(s), s);
  const r = read('RESULT.md');
  assert.ok(!/\bis an edge\b/i.test(r));
});
