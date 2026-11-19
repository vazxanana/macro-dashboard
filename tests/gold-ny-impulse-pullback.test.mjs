// node --test tests/gold-ny-impulse-pullback.test.mjs — research/edge/gold-ny-impulse-pullback (14 Nov 2026): the 50 % pullback
// of gold's 08:30-09:00 New York impulse on hand-made candles (the New York clock, the leg, fills, gaps, stops, targets, costs),
// no look-ahead, the ATR of earlier days only, the placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-ny-impulse-pullback/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-ny-impulse-pullback');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const hm = (h, m) => h * 60 + m;
// a New York day 00:00 → 23:55 flat at 100 (100.1 / 99.9); the impulse 08:30-08:55 rises from 100 to 102 (low 99.8 at 08:30)
const day = (patch = {}) => {
  const imp = { [hm(8, 30)]: [100, 100.4, 99.8, 100.3], [hm(8, 35)]: [100.3, 100.9, 100.2, 100.8], [hm(8, 40)]: [100.8, 101.4, 100.7, 101.3],
    [hm(8, 45)]: [101.3, 102, 101.2, 101.9], [hm(8, 50)]: [101.9, 101.95, 101.6, 101.7], [hm(8, 55)]: [101.7, 101.9, 101.6, 101.8] };
  const out = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    const p = patch[m] || imp[m] || (m >= hm(9, 0) ? [101.6, 101.7, 101.5, 101.6] : [100, 100.1, 99.9, 100]);
    out.push({ t: 1e9 + m * 60, min: m, o: p[0], h: p[1], l: p[2], c: p[3] });
  }
  return out;
};
const flip = (b) => b.map((c) => ({ ...c, o: 200 - c.o, h: 200 - c.l, l: 200 - c.h, c: 200 - c.c }));
const T = (bars, o = {}) => S.impulseTrade(bars, { atr: 4, cost: 0, ...o });

test('the New York clock: 08:30 NY is 12:30 UTC in daylight time, else 13:30 UTC', () => {
  const at = (iso) => S.nyOf(Date.parse(iso) / 1000);
  assert.equal(at('2024-03-08T13:30:00Z').min, hm(8, 30), 'Friday before the 2nd Sunday of March');
  assert.equal(at('2024-03-11T12:30:00Z').min, hm(8, 30), 'Monday after it');
  assert.equal(at('2024-03-29T12:30:00Z').min, hm(8, 30), 'the US-only daylight weeks');
  assert.equal(at('2024-11-01T12:30:00Z').min, hm(8, 30)); assert.equal(at('2024-11-04T13:30:00Z').min, hm(8, 30));
  assert.equal(at('2024-01-15T13:30:00Z').day, '2024-01-15'); assert.equal(at('2024-01-16T03:00:00Z').day, '2024-01-15');
});

test('the impulse leg: direction, extreme, origin up to the extreme; down mirrors', () => {
  const im = S.impulseOf(day());
  assert.equal(im.d, 1); assert.equal(im.E, 102); assert.equal(im.O, 99.8); assert.ok(Math.abs(im.L - 2.2) < 1e-9);
  const dn = S.impulseOf(flip(day()));
  assert.equal(dn.d, -1); assert.equal(dn.E, 98); assert.equal(dn.O, 100.2);
  // a lower low after the extreme is not the origin
  const p = S.impulseOf(day({ [hm(8, 50)]: [101.9, 101.95, 99, 101.7] }));
  assert.equal(p.O, 99.8);
  assert.equal(S.impulseOf(day().filter((b) => b.min < hm(8, 30) || b.min >= hm(8, 45))), null, 'too few candles');
});

test('a buy limit at the 50 % retrace, stop $0.30 under the origin, 1.5R target; a sell mirrors it', () => {
  const p = { [hm(9, 30)]: [101.5, 101.6, 100.8, 101], [hm(9, 35)]: [101, 104.2, 100.95, 104] };
  const x = T(day(p));
  assert.equal(x.side, 1); assert.equal(x.M, 100.9); assert.equal(x.entry, 100.9); assert.equal(x.stop, 99.5); assert.ok(Math.abs(x.r - 1.4) < 1e-9);
  assert.equal(x.fillAt, hm(9, 30)); assert.equal(x.how, 'target'); assert.ok(Math.abs(x.R - 1.5) < 1e-9); assert.equal(x.fin, 0);
  const s = T(flip(day(p)));
  assert.equal(s.side, -1); assert.equal(s.entry, 99.1); assert.equal(s.stop, 100.5); assert.equal(s.how, 'target'); assert.ok(Math.abs(s.R - 1.5) < 1e-9);
  // T2: the target is the impulse extreme
  const e = T(day(p), { tgt: 'ext' });
  assert.equal(e.target, 102); assert.equal(e.how, 'target'); assert.ok(Math.abs(e.R - 1.1 / 1.4) < 1e-9);
});

test('fills, gaps and stops: open below the limit fills at the open; stop in the fill candle counts; target in it does not', () => {
  const g = T(day({ [hm(9, 30)]: [100.5, 100.6, 100.4, 100.5] }));
  assert.equal(g.entry, 100.5, 'gapped under the buy limit: filled at the open');
  const sf = T(day({ [hm(9, 30)]: [101.5, 101.6, 99.4, 100] }));
  assert.equal(sf.how, 'stop'); assert.equal(sf.R, -1);
  const tf = T(day({ [hm(9, 30)]: [101.5, 104, 100.8, 101.6] }));
  assert.notEqual(tf.how, 'target', 'a target in the fill candle does not count');
  const gs = T(day({ [hm(9, 30)]: [101.5, 101.6, 100.8, 101], [hm(9, 35)]: [99, 99.1, 98.8, 99] }));
  assert.equal(gs.how, 'stop'); assert.equal(gs.exit, 99, 'a gap through the stop fills at the open'); assert.ok(gs.R < -1);
  const both = T(day({ [hm(9, 30)]: [101.5, 101.6, 100.8, 101], [hm(9, 35)]: [101, 104, 99.4, 101] }));
  assert.equal(both.how, 'stop');
  assert.equal(T(day({ [hm(9, 30)]: [99, 99.1, 98.8, 99] })).skip, 'paststop');
});

test('orders live 09:00-10:55 NY; out at the 15:55 close; size filter; costs; financing zero on the day', () => {
  assert.equal(T(day()).skip, 'nofill');
  assert.equal(T(day({ [hm(11, 0)]: [101, 101.1, 100.5, 101] })).skip, 'nofill', 'the 11:00 candle cannot fill');
  const late = T(day({ [hm(10, 55)]: [101, 101.1, 100.5, 101], [hm(15, 55)]: [101.6, 101.7, 101.5, 101.65] }));
  assert.equal(late.fillAt, hm(10, 55)); assert.equal(late.how, 'time'); assert.equal(late.exitAt, hm(15, 55)); assert.equal(late.exit, 101.65);
  assert.equal(T(day(), { atr: 10 }).skip, 'small', '2.2 < 0.25 x 10');
  assert.equal(T(day({ [hm(9, 30)]: [101, 101.1, 100.5, 101] }), { atr: 5, size: S.SIZE3 }).skip, 'small', 'T3: 2.2 < 0.5 x 5');
  assert.equal(T(day(), { atr: undefined }).skip, 'warmup');
  const x = S.impulseTrade(day({ [hm(9, 30)]: [101.5, 101.6, 100.8, 101] }), { atr: 4 });
  assert.ok(Math.abs(x.net - (x.R - 0.6 / x.r)) < 1e-12); assert.ok(Math.abs(x.net2 - (x.R - 1.2 / x.r)) < 1e-12);
});

test('no look-ahead: candles after 16:00 NY change nothing; the ATR reads only earlier UTC weekdays', () => {
  const p = { [hm(9, 30)]: [101.5, 101.6, 100.8, 101] };
  const base = T(day(p));
  assert.deepEqual(T(day({ ...p, [hm(16, 0)]: [100, 500, 1, 2], [hm(20, 0)]: [0, 999, 0, 1] })), base);
  const u = []; for (let i = 1; i <= 16; i++) u.push({ day: `2024-01-${String(i).padStart(2, '0')}`, o: 100, h: 101, l: 99, c: 100 });
  const a = S.atrMap(u, ['2024-01-14', '2024-01-15', '2024-01-16']);
  assert.equal(a.get('2024-01-14'), undefined, 'only 13 earlier days');
  assert.equal(a.get('2024-01-15'), 2);
  const u2 = u.map((x) => (x.day === '2024-01-16' ? { ...x, h: 200 } : x));
  assert.equal(S.atrMap(u2, ['2024-01-16']).get('2024-01-16'), 2, 'the day itself is not read');
});

test('placebo trade and statistics', () => {
  const p = S.placeboTrade(day(), { start: hm(9, 0), side: 1, width: 1, tdist: 1.5, cost: 0 });
  assert.equal(p.R, 0, 'flat after 09:00: out at 16:00 at the entry');
  assert.equal(S.placeboTrade(day(), { start: hm(11, 0), side: 1, width: 1, tdist: 1 }), null);
  const tr = [{ day: '2021-01-04', net: 1 }, { day: '2021-01-05', net: 1 }, { day: '2021-02-01', net: 3 }, { day: '2021-03-01', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
  S.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
  assert.equal(S.rng(7)(), S.rng(7)());
});

test('the report is run.mjs\'s function of result.json; pre-registration hash, verdict line, decision', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  const pl = Object.fromEntries(['T1', 'T2', 'T3'].map((k) => [k, R.placebo[k].means]));
  assert.deepEqual(S.decide(R.tests, pl), R.decision);
  for (const k of ['T1', 'T2', 'T3']) assert.equal(R.placebo[k].means.length, 40);
  assert.equal(R.fin.charged, 0);
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, Object.values(R.decision).some((d) => d.pass) ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: only council/fills.mjs imported, windows as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), ['../../../council/fills.mjs']);
  assert.deepEqual(S.WINDOWS.IS, ['2007-01-01', '2016-12-31']); assert.equal(S.WINDOWS.OOS[0], '2017-01-01');
  assert.equal(S.COST, 0.6);
  assert.match(read('PREREGISTRATION.md'), /not a gate, exit, entry or size of the live gold book/);
});
