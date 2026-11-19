// Previous-week raid and reversal on gold (research/edge/gold-week-raid): weeks, the signal with no look-ahead, the exits, and
// the report against result.json. Offline, hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { place, weeksOf, signal, simulate, trades, holm, rangeOf } from '../research/edge/gold-week-raid/run.mjs';

const H = 3600, U = (y, m, d, h) => Date.UTC(y, m - 1, d, h) / 1000;

test('a week opens at Sunday 17:00 New York and trading stops at Friday 16:00, in summer and in winter', () => {
  // winter (EST, UTC-5): Sunday 8 Nov 2026 22:00 UTC is the reopen
  assert.equal(place(U(2026, 11, 8, 21)), null, 'Sunday 16:00 New York is still the weekend');
  const w = place(U(2026, 11, 8, 22)); assert.equal(w.wd, 1); assert.equal(w.week, place(U(2026, 11, 13, 12)).week);
  assert.equal(place(U(2026, 11, 13, 20)).cut, false); assert.equal(place(U(2026, 11, 13, 21)).cut, true, 'the 16:00 candle is not traded');
  assert.equal(place(U(2026, 11, 13, 22)), null);
  // summer (EDT, UTC-4): one hour earlier in UTC
  assert.equal(place(U(2026, 7, 12, 21)).wd, 1); assert.equal(place(U(2026, 7, 12, 20)), null);
  assert.equal(place(U(2026, 7, 17, 19)).cut, false); assert.equal(place(U(2026, 7, 17, 20)).cut, true); assert.equal(place(U(2026, 7, 17, 21)), null);
  // the March gap week (US on summer time): Sunday 8 Mar 2026 21:00 UTC is 17:00 New York
  assert.equal(place(U(2026, 3, 8, 21)).wd, 1);
  const W = weeksOf([[U(2026, 11, 6, 15), 1, 2, 0, 1], [U(2026, 11, 8, 22), 1, 2, 0, 1], [U(2026, 11, 9, 3), 1, 2, 0, 1]]);
  assert.equal(W.length, 2); assert.equal(W[1].k - W[0].k, 7); assert.equal(W[1].bars.length, 2);
});

const b = (o, h, l, c, wd = 2, cut = false) => ({ t: 0, o, h, l, c, wd, cut });
const prev = { hi: 110, lo: 90, mid: 100 };

test('the raid, the close back within 12 candles, entry at the next open, stop past the raid extreme', () => {
  const bars = [b(105, 108, 104, 107), b(107, 112, 106, 111), b(111, 113, 110, 112), b(112, 112.5, 108, 109), b(109, 109.5, 104, 105)];
  const s = signal(prev, bars, -1);
  assert.equal(s.i, 1); assert.equal(s.j, 3); assert.equal(s.e, 4); assert.equal(s.entry, 109);
  assert.equal(s.stop, 113 + 0.3); assert.equal(s.target, 100);
  // no look-ahead: what happens from the entry candle on never changes the signal
  const later = bars.map((x, k) => (k >= 4 ? { ...x, h: 200, l: 1 } : x));
  assert.deepEqual({ ...signal(prev, later, -1) }, { ...s, entry: later[4].o });
  assert.equal(signal(prev, bars, -1, { far: true }).target, 90);
  assert.equal(signal(prev, bars, -1, { monWed: true }).i, 1);
  assert.deepEqual(signal(prev, bars.map((x) => ({ ...x, wd: 4 })), -1, { monWed: true }), { skip: 'raid Thu-Fri' });
  // only the first raid counts: no close back within 12 candles -> no trade, even if a later one closes back
  const slow = [b(105, 111, 104, 111), ...Array(12).fill(b(111, 112, 110.5, 111)), b(111, 111, 105, 106), b(106, 107, 104, 105)];
  assert.equal(signal(prev, slow, -1), null);
  // buys mirror below last week's low
  const buy = signal(prev, [b(95, 96, 88, 89), b(89, 92, 87, 91), b(91, 93, 90, 92)], 1);
  assert.equal(buy.entry, 91); assert.equal(buy.stop, 87 - 0.3); assert.equal(buy.target, 100);
  // an entry already past the target is not a trade
  assert.deepEqual(signal(prev, [b(105, 112, 104, 111), b(111, 111, 98, 99), b(99, 99, 97, 98)], -1), { skip: 'entry past target' });
});

test('exits: stop first in a candle holding both, a gapped stop at the open, the target, the Friday 16:00 time exit', () => {
  const both = simulate([b(109, 114, 99, 105)], 0, -1, 109, 113.3, 100);
  assert.equal(both.how, 'stop'); assert.equal(both.exit, 113.3); assert.ok(Math.abs(both.R + 1) < 1e-9);
  const gap = simulate([b(109, 109.5, 108, 109), b(115, 116, 114, 115)], 0, -1, 109, 113.3, 100);
  assert.equal(gap.how, 'stop'); assert.equal(gap.exit, 115);
  const tgt = simulate([b(109, 110, 99, 101)], 0, -1, 109, 113, 100);
  assert.equal(tgt.how, 'target'); assert.equal(tgt.R, 9 / 4); assert.ok(Math.abs(tgt.net - (9 / 4 - 0.3 / 4)) < 1e-9, 'sells pay no financing');
  const time = simulate([b(109, 110, 107, 108), b(108, 109, 106, 107, 5), b(107, 99, 90, 95, 5, true)], 0, -1, 109, 113, 100);
  assert.equal(time.how, 'time'); assert.equal(time.exit, 107, 'out at the close of the last candle before Friday 16:00, the 16:00 candle never read');
});

test('buys pay overnight financing; one trade per side per week; a short previous week is skipped', () => {
  const mk = (t0, rows) => rows.map((r, k) => [t0 + k * H, ...r]);
  const w1 = U(2026, 11, 1, 22), w2 = U(2026, 11, 8, 22);
  const prevW = mk(w1, Array.from({ length: 100 }, () => [100, 110, 90, 100]));
  const cur = mk(w2, [[95, 96, 88, 89], [89, 92, 87, 91], [91, 93, 90, 92], [92, 93, 91, 92], ...Array(30).fill([92, 93, 91, 92])]);
  const T = trades(weeksOf([...prevW, ...cur]));
  assert.equal(T.length, 1); assert.equal(T[0].side, 1); assert.ok(T[0].nights >= 1 && T[0].finR > 0); assert.ok(T[0].net < T[0].R - 0.3 / T[0].risk);
  assert.equal(trades(weeksOf([...prevW.slice(0, 40), ...cur])).length, 0, 'under 48 candles last week');
  assert.deepEqual(rangeOf([b(1, 5, 0, 2), b(2, 3, -1, 1)]), { hi: 5, lo: -1, mid: 2 });
});

test('Holm adjusts the smallest p by the number of tests and keeps the order', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-week-raid/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-week-raid/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}`));
  const pass = Object.values(r.rules).filter((x) => x.pass).length; assert.match(md, new RegExp(`${pass} of 3 rules`));
  const f = (v, d = 3) => (v > 0 ? '+' : '') + v.toFixed(d);
  for (const [k, x] of Object.entries(r.rules)) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${k} `)); assert.ok(row, k);
    const cells = row.split('|').slice(2, -1).map((c) => c.trim());
    assert.deepEqual(cells, [String(x.dec.n), f(x.dec.avg), String(x.dec.pf), x.dec.tMonth.toFixed(2), x.holmP.toFixed(4), String(x.rep.n), f(x.rep.avg), x.rep.tMonth.toFixed(2), `${x.placebo.beat} of 40`], k);
  }
});
