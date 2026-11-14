// gold-round-numbers: the rules on hand-made candles (offline), New York trading days, no look-ahead, costs, the placebo
// draw and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  K, TESTS, usDst, dayOf, daysOf, touched, gridOf, stallDay, breakDay, costOf, placeboOff, okOff, holm, monthT, report,
} from '../research/edge/gold-round-numbers/run.mjs';

const DIR = new URL('../research/edge/gold-round-numbers/', import.meta.url);
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const T0 = Date.UTC(2024, 0, 10, 14, 30) / 1000; // a Wednesday, 09:30 New York (winter)
const day = (bars, A = 20) => ({ day: dayOf(bars[0].time), A, bars });

test('trading days run 17:00 to 17:00 New York, named by the date they end on, weekends dropped', () => {
  assert.equal(usDst(Date.UTC(2024, 0, 10) / 1000), false); assert.equal(usDst(Date.UTC(2024, 6, 10) / 1000), true);
  const wedJan = Date.UTC(2024, 0, 10) / 1000;
  assert.equal(dayOf(Date.UTC(2024, 0, 9, 21, 55) / 1000), Date.UTC(2024, 0, 9) / 1000); // 16:55 NY Tue: Tuesday's day
  assert.equal(dayOf(Date.UTC(2024, 0, 9, 22, 0) / 1000), wedJan);                      // 17:00 NY Tue: Wednesday's day
  assert.equal(dayOf(Date.UTC(2024, 6, 9, 21, 0) / 1000), Date.UTC(2024, 6, 10) / 1000); // 17:00 NY in summer
  // Sunday 17:00 reopen belongs to Monday; a Sunday-named day never exists in daysOf
  assert.equal(dayOf(Date.UTC(2024, 0, 7, 22, 0) / 1000), Date.UTC(2024, 0, 8) / 1000);
  const B = []; let t = Date.UTC(2023, 11, 1, 12) / 1000;
  for (let i = 0; i < 40 * 24; i++, t += 3600) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue; B.push(bar(t, 2000, 2010, 2000, 2005)); }
  const D = daysOf(B); assert.ok(D.length > 10);
  assert.ok(D.every((d) => ![0, 6].includes(new Date(d.day * 1000).getUTCDay())));
});

test('daily ATR uses only the 14 trading days before the day (a huge candle on the day changes nothing)', () => {
  const B = []; let t = Date.UTC(2024, 0, 1, 23) / 1000;
  for (let i = 0; i < 30 * 24 * 12; i++, t += 300) { const wd = new Date(dayOf(t) * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; B.push(bar(t, 2000, 2010, 2000, 2000)); }
  assert.ok(daysOf(B).every((d) => Math.abs(d.A - 10) < 1e-9));
  const D1 = daysOf(B), target = D1[5].day, idx = B.findIndex((b) => dayOf(b.time) === target); B[idx + 3] = bar(B[idx + 3].time, 2000, 2500, 2000, 2000);
  const D2 = daysOf(B); assert.equal(D2.find((d) => d.day === target).A, D1[5].A);
  assert.ok(D2.find((d) => d.day > target).A > D1.find((d) => d.day > target).A);
});

test('grids: $100 levels for T1 / T3, odd $50 for T2, disjoint', () => {
  assert.deepEqual(touched(gridOf(TESTS.T1.off), bar(0, 1990, 2110, 1940, 2100)), [20, 21]);
  const g2 = gridOf(TESTS.T2.off); assert.deepEqual(touched(g2, bar(0, 1990, 2110, 1940, 2100)).map(g2.at), [1950, 2050]);
  assert.equal(TESTS.T3.off, 0);
});

test('T1 fades the first touch after a 0.5 x ATR approach, limit at the level, stop first; costs per the pre-registration', () => {
  // A 20: approach 10, stop 5, target 10. Price comes up from 1988 to touch 2000.
  const S = [bar(T0, 1989, 1990, 1988, 1989), bar(T0 + 300, 1989, 1997, 1989, 1996), bar(T0 + 600, 1996, 2001, 1995, 1998),
    bar(T0 + 900, 1998, 1999, 1992, 1993), bar(T0 + 1200, 1993, 1994, 1989, 1990)];
  const tr = stallDay('T1', day(S), 0); assert.equal(tr.length, 1); const x = tr[0];
  assert.equal(x.side, -1); assert.equal(x.entry, 2000); assert.equal(x.stop, 2005); assert.equal(x.target, 1990);
  assert.equal(x.exit, 'target'); assert.equal(x.gross, 2); assert.ok(Math.abs(x.net - (2 - 0.30 / 5)) < 1e-12);
  assert.ok(Math.abs(x.net2 - (2 - 0.60 / 5)) < 1e-12);
  // approach too short (lowest low 1992 = 0.4 x ATR): no trade
  const S2 = [bar(T0, 1993, 1994, 1992, 1993), ...S.slice(1)].map((b, i) => (i === 1 ? bar(T0 + 300, 1993, 1997, 1993, 1996) : b));
  assert.equal(stallDay('T1', day(S2), 0).length, 0);
  // the fill candle: only the stop counts; a stop exit pays the slippage
  const S3 = [S[0], S[1], bar(T0 + 600, 1996, 2001, 1985, 1990), bar(T0 + 900, 1999, 2006, 1998, 2004)];
  const y = stallDay('T1', day(S3), 0)[0]; assert.equal(y.exit, 'stop'); assert.ok(Math.abs(y.cost - 0.45) < 1e-12);
  // a second touch in the same day is not traded
  const S4 = [...S.slice(0, 4), bar(T0 + 1200, 1993, 2002, 1993, 1999)];
  assert.equal(stallDay('T1', day(S4), 0).length, 1);
  // T2 does not trade 2000 at all
  assert.equal(stallDay('T2', day(S), 0.5).length, 0);
});

test('T3 follows the first close 0.05 x ATR beyond, next open, stop 0.1 x ATR back, target 0.5 x ATR; market entry costs', () => {
  const S = [bar(T0, 1995, 1999, 1994, 1998), bar(T0 + 300, 1998, 2002, 1997, 2001.5), bar(T0 + 600, 2001.6, 2004, 2001, 2003),
    bar(T0 + 900, 2003, 2012, 2002.5, 2011), bar(T0 + 1200, 2011, 2012, 2009, 2010)];
  const tr = breakDay('T3', day(S), 0); assert.equal(tr.length, 1); const x = tr[0];
  assert.equal(x.side, 1); assert.equal(x.entry, 2001.6); assert.equal(x.stop, 1998); assert.ok(Math.abs(x.target - 2011.6) < 1e-9);
  assert.equal(x.exit, 'target'); assert.ok(Math.abs(x.cost - 0.45) < 1e-12); // round trip + market entry slippage, target exit none
  // a close under 0.05 x ATR beyond (2000.9) is no break
  const S2 = [S[0], bar(T0 + 300, 1998, 2002, 1997, 2000.9), bar(T0 + 600, 2000.9, 2001, 2000.5, 2000.8)];
  assert.equal(breakDay('T3', day(S2), 0).length, 0);
  // no next candle in the day: no trade; time exit at the last candle, paying entry and exit slippage
  assert.equal(breakDay('T3', day(S.slice(0, 2)), 0).length, 0);
  const y = breakDay('T3', day([S[0], S[1], bar(T0 + 600, 2001.6, 2005, 2000, 2004)]), 0)[0];
  assert.equal(y.exit, 'time'); assert.equal(y.exitPx, 2004); assert.ok(Math.abs(y.cost - 0.6) < 1e-12);
  assert.ok(Math.abs(costOf(false, 'target') - 0.3) < 1e-12); assert.ok(Math.abs(costOf(false, 'time') - 0.45) < 1e-12);
});

test('no look-ahead: a trade is decided by candles up to its entry; changing later candles never adds or drops one', () => {
  const S = [bar(T0, 1989, 1990, 1988, 1989), bar(T0 + 300, 1989, 1997, 1989, 1996), bar(T0 + 600, 1996, 2001, 1995, 1998),
    bar(T0 + 900, 1998, 1999, 1992, 1993), bar(T0 + 1200, 1993, 1994, 1989, 1990)];
  const a = stallDay('T1', day(S), 0), b = stallDay('T1', day([...S.slice(0, 3), bar(T0 + 900, 1998, 2004, 1997, 2003), bar(T0 + 1200, 2003, 2050, 2003, 2040)]), 0);
  assert.deepEqual(a.map((t) => [t.at, t.side, t.entry, t.stop]), b.map((t) => [t.at, t.side, t.entry, t.stop]));
});

test('placebo shifts: seeded, never within 5 % of a step of a real level; Holm; month t', () => {
  for (let s = 1; s <= 40; s++) { const u = placeboOff(s); assert.ok(okOff(u)); assert.equal(u, placeboOff(s)); }
  assert.equal(okOff(0.02), false); assert.equal(okOff(0.5), false); assert.equal(okOff(0.3), true);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const from = Date.UTC(2021, 0, 1) / 1000, to = Date.UTC(2021, 3, 1) / 1000;
  assert.equal(monthT([{ at: from + 10, net: 1 }], from, to).months, 3);
});

test('the report and the verdict match result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(R));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`)); assert.ok(R.verdict.length < 220);
  for (const k of Object.keys(TESTS)) { const V = R.tests[k];
    assert.equal(V.verdict, Object.values(V.bar).every(Boolean) ? 'PASS' : 'FAIL');
    assert.equal(V.bar['OOS month-sum t >= 2'], V.oos.t >= 2); assert.equal(V.placebo.means.length, 40);
    assert.ok(V.placebo.beaten >= 0 && V.placebo.beaten <= 40);
    assert.equal(V.bar['beats 38 of 40 placebo grids'], V.placebo.beaten >= 38); }
  const nPass = Object.values(R.tests).filter((V) => V.verdict === 'PASS').length;
  assert.ok(R.verdict.startsWith(nPass ? 'PASS' : 'FAIL'));
  assert.ok(new Date(R.window.oos.slice(-10)) <= new Date('2026-11-14'));
});
