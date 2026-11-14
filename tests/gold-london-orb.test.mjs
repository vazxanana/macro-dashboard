// node --test tests/gold-london-orb.test.mjs — research/edge/gold-london-orb (14 Nov 2026): the first London hour range
// breakout on hand-made candles (fills, gaps, stops, the 1.5R target, costs, the London clock), no look-ahead, the narrow
// flag, the placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-london-orb/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-london-orb');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const hm = (h, m) => h * 60 + m;
// a UTC day 00:00 → 23:55, flat at 100 (high 100.4, low 99.6); the range hour (08:00 UTC here) is 99.5 → 100.5 (width 1)
const day = (patch = {}, rh = 8) => {
  const out = [];
  for (let m = 0; m < 24 * 60; m += 5) {
    const inR = m >= rh * 60 && m < rh * 60 + 60;
    const p = patch[m] || (inR ? [100, m === rh * 60 ? 100.5 : 100.2, m === rh * 60 + 5 ? 99.5 : 99.8, 100] : [100, 100.4, 99.6, 100]);
    out.push({ t: m * 60, min: m, o: p[0], h: p[1], l: p[2], c: p[3] });
  }
  return out;
};
const T = (bars, o = {}) => S.londonTrade(bars, { rh: 8, cost: 0, ...o });

test('the London clock: 08:00 London is 07:00 UTC in British Summer Time, else 08:00 UTC', () => {
  assert.equal(S.rangeHour('2024-03-29'), 8, 'Friday before the last Sunday of March');
  assert.equal(S.rangeHour('2024-04-01'), 7, 'Monday after it');
  assert.equal(S.rangeHour('2024-03-31'), 7, 'the switch Sunday itself (01:00 UTC, before 07:00)');
  assert.equal(S.rangeHour('2024-10-25'), 7); assert.equal(S.rangeHour('2024-10-28'), 8);
  assert.equal(S.rangeHour('2024-07-15'), 7); assert.equal(S.rangeHour('2024-01-15'), 8);
  // the US-only daylight weeks (2nd Sunday of March to the last) are still winter in London
  assert.equal(S.rangeHour('2024-03-12'), 8);
  assert.equal(S.weekday('2024-03-30'), false); assert.equal(S.weekday('2024-03-29'), true);
});

test('a buy stop at the range high, stop at the low, out at the 19:55 close; a sell mirrors it', () => {
  const p = { [hm(10, 0)]: [100.3, 100.8, 100.2, 100.7] };
  for (let m = hm(10, 5); m < 24 * 60; m += 5) p[m] = [100.7, 100.9, 100.6, 100.8];
  p[hm(19, 55)] = [100.8, 101, 100.7, 101];
  const x = T(day(p));
  assert.equal(x.side, 1); assert.equal(x.fillAt, hm(10, 0)); assert.equal(x.entry, 100.5); assert.equal(x.stop, 99.5); assert.equal(x.r, 1);
  assert.equal(x.how, 'time'); assert.equal(x.exitAt, hm(19, 55)); assert.ok(Math.abs(x.R - 0.5) < 1e-12); assert.equal(x.rangeUtcHour, 8);
  const flip = (b) => b.map((c) => ({ ...c, o: 200 - c.o, h: 200 - c.l, l: 200 - c.h, c: 200 - c.c }));
  const s = T(flip(day(p)));
  assert.equal(s.side, -1); assert.equal(s.entry, 99.5); assert.equal(s.stop, 100.5); assert.ok(Math.abs(s.R - 0.5) < 1e-12);
});

test('gaps fill at the open; a candle touching both levels is a stop; the stop wins over the target', () => {
  const g = T(day({ [hm(10, 0)]: [100.9, 101, 100.8, 100.9] }));
  assert.equal(g.entry, 100.9, 'gapped above the buy stop: filled at the open'); assert.ok(Math.abs(g.r - 1.4) < 1e-12);
  const both = T(day({ [hm(10, 0)]: [100.3, 100.6, 99.4, 100] }));
  assert.equal(both.side, 1, 'open nearer the high'); assert.equal(both.how, 'stop'); assert.equal(both.R, -1);
  const gs = T(day({ [hm(10, 0)]: [100.3, 100.6, 100.2, 100.5], [hm(10, 5)]: [99, 99.2, 98.8, 99] }));
  assert.equal(gs.how, 'stop'); assert.equal(gs.exit, 99, 'a gap through the stop fills at the open'); assert.ok(gs.R < -1);
  const st = T(day({ [hm(10, 0)]: [100.3, 100.6, 100.2, 100.5], [hm(10, 5)]: [100.5, 102.5, 99.4, 100] }), { tgt: 1.5 });
  assert.equal(st.how, 'stop');
  const tg = T(day({ [hm(10, 0)]: [100.3, 100.6, 100.2, 100.5], [hm(10, 5)]: [100.5, 102.1, 100.4, 102] }), { tgt: 1.5 });
  assert.equal(tg.how, 'target'); assert.equal(tg.target, 102); assert.equal(tg.R, 1.5);
});

test('orders live until 16:00 UTC only; a range hour short of candles is skipped; costs in R', () => {
  assert.equal(T(day()).skip, 'nofill');
  assert.equal(T(day({ [hm(16, 0)]: [100.3, 101, 100.2, 100.9] })).skip, 'nofill', 'the 16:00 candle cannot fill');
  assert.equal(T(day({ [hm(15, 55)]: [100.3, 101, 100.2, 100.9] })).fillAt, hm(15, 55));
  assert.equal(T(day().filter((b) => b.min < hm(8, 0) || b.min >= hm(8, 15))).skip, 'range');
  const x = S.londonTrade(day({ [hm(10, 0)]: [100.3, 100.6, 100.2, 100.5] }), { rh: 8 });
  assert.ok(Math.abs(x.net - (x.R - 0.6)) < 1e-12); assert.ok(Math.abs(x.net2 - (x.R - 1.2)) < 1e-12);
  // the summer clock reads the 07:00 UTC hour
  const sx = S.londonTrade(day({ [hm(9, 0)]: [100.3, 100.6, 100.2, 100.5] }, 7), { rh: 7, cost: 0 });
  assert.equal(sx.rangeUtcHour, 7); assert.equal(sx.fillAt, hm(9, 0));
});

test('no look-ahead: candles from 20:00 UTC change nothing; the narrow flag reads only earlier days', () => {
  const p = { [hm(10, 0)]: [100.3, 100.6, 100.2, 100.5] };
  const base = T(day(p));
  assert.deepEqual(T(day({ ...p, [hm(20, 0)]: [100, 500, 1, 2], [hm(23, 0)]: [0, 999, 0, 1] })), base);
  const w = (lo, hi) => { const q = {}; for (let m = hm(8, 0); m < hm(9, 0); m += 5) q[m] = [100, hi, lo, 100]; return day(q); };
  const days = []; for (let i = 0; i < 21; i++) days.push({ day: `d${String(i).padStart(2, '0')}`, rh: 8, bars: w(99.5, 100.5) });
  days.push({ day: 'd21', rh: 8, bars: w(99.8, 100.3) }, { day: 'd22', rh: 8, bars: w(99, 101) });
  const f = S.narrowFlags(days);
  assert.equal(f.get('d19'), undefined); assert.equal(f.get('d20'), false); assert.equal(f.get('d21'), true); assert.equal(f.get('d22'), false);
  assert.equal(S.narrowFlags([...days, { day: 'd23', rh: 8, bars: w(90, 110) }]).get('d21'), true);
});

test('placebo trade and statistics', () => {
  const p = S.placeboTrade(day({ [hm(12, 0)]: [100, 100.2, 99.9, 100.1] }), { start: hm(12, 0), side: 1, width: 1, cost: 0 });
  assert.equal(p.R, 0, 'flat day, 99.6 low never reaches the 99 stop: out at 20:00 at 100');
  assert.equal(S.placeboTrade(day(), { start: hm(16, 0), side: 1, width: 1 }), null);
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
  for (const k of ['T1', 'T2', 'T3']) { assert.equal(R.placebo[k].means.length, 40); assert.ok(R.tests[k].OOS.n >= 30); }
  const v = studyVerdict(R, read('RESULT.md'));
  assert.equal(v.verdict, Object.values(R.decision).some((d) => d.pass) ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
});

test('stand-alone: no repository import, windows as pre-registered, not a rule of the gold book', () => {
  const src = read('run.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.')), []);
  assert.deepEqual(S.WINDOWS.IS, ['2008-01-01', '2016-12-31']); assert.equal(S.WINDOWS.OOS[0], '2017-01-01');
  assert.equal(S.COST, 0.6);
  assert.match(read('PREREGISTRATION.md'), /not a gate, exit, entry or size of the live gold book/);
});
