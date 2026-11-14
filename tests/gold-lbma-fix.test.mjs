// research/edge/gold-lbma-fix: London time with BST, the bank-holiday list, the two designs on synthetic candles (entry, stop,
// gap, exit, costs), the gap check, the placebo anchors and the report against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../research/edge/gold-lbma-fix/run.mjs';

const iso = (t) => new Date(t * 1000).toISOString();
const DIR = new URL('../research/edge/gold-lbma-fix/', import.meta.url);

test('London time: GMT in winter, BST in summer, the auction times', () => {
  assert.equal(iso(G.londonT('2026-01-15', G.PM)), '2026-01-15T15:00:00.000Z');
  assert.equal(iso(G.londonT('2026-07-01', G.PM)), '2026-07-01T14:00:00.000Z');
  assert.equal(iso(G.londonT('2026-03-27', G.PM)), '2026-03-27T15:00:00.000Z');   // UK clocks go forward 29 Mar 2026
  assert.equal(iso(G.londonT('2026-03-30', G.PM)), '2026-03-30T14:00:00.000Z');
  assert.equal(iso(G.londonT('2026-10-26', G.AM)), '2026-10-26T10:30:00.000Z');   // back on 25 Oct 2026
  assert.equal(iso(G.londonT('2026-03-10', G.PM)), '2026-03-10T15:00:00.000Z');   // US already on summer time, London not
  const d = G.design(G.PM);
  assert.deepEqual([d.T1.m0, d.T1.m1, d.T1.entry, d.T1.exit, d.T1.atrFrom, d.T1.atrTo].map(G.hm), ['13:30', '14:55', '14:55', '15:05', '13:45', '14:50']);
  assert.deepEqual([d.T2.m0, d.T2.m1, d.T2.bar, d.T2.exit].map(G.hm), ['13:30', '15:00', '15:00', '16:30']);
  const a = G.design(G.AM);
  assert.deepEqual([a.T1.m0, a.T1.entry, a.T1.exit, a.T2.exit].map(G.hm), ['09:00', '10:25', '10:35', '12:00']);
});

// Easter Sunday (anonymous Gregorian algorithm)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}
test('bank holidays: every one a weekday, Good Friday and Easter Monday each year, 8 a year plus the moved / extra days', () => {
  for (const d of G.BANK_HOLIDAYS) assert.ok(G.isWeekday(d), d);
  for (let y = 2016; y <= 2026; y++) {
    const e = easter(y);
    assert.ok(G.BANK_HOLIDAYS.has(G.addD(e, -2)) && G.BANK_HOLIDAYS.has(G.addD(e, 1)), `Easter ${y}`);
    const n = [...G.BANK_HOLIDAYS].filter((d) => d.startsWith(String(y))).length;
    assert.equal(n, { 2022: 10, 2023: 9 }[y] || 8, `count ${y}`);
  }
  for (const d of ['2020-05-08', '2022-06-02', '2022-06-03', '2022-09-19', '2023-05-08']) assert.ok(G.BANK_HOLIDAYS.has(d));
  assert.ok(!G.BANK_HOLIDAYS.has('2020-05-04') && !G.BANK_HOLIDAYS.has('2022-05-30'));
});

// a London day of M5 candles 12:00-17:30 at a constant price, with edits
function day(ymd, px = 2000, edits = {}) {
  const bars = [];
  for (let m = 12 * 60; m < 17 * 60 + 30; m += 5) bars.push([G.londonT(ymd, m), px, px + 0.5, px - 0.5, px]);
  for (const [m, b] of Object.entries(edits)) { const i = bars.findIndex((x) => x[0] === G.londonT(ymd, +m)); if (b === null) bars.splice(i, 1); else bars[i] = [bars[i][0], ...b]; }
  return bars;
}
const m = (h, mm) => h * 60 + mm;

test('T1: the sign of 13:30 -> 14:55, entry at the 14:55 open, stop 3 x ATR(14), out at the 15:05 open', () => {
  const ymd = '2026-07-01', bars = day(ymd, 2000, { [m(14, 55)]: [2002, 2003, 2001.5, 2002.5], [m(15, 0)]: [2002.5, 2004, 2002, 2003.8], [m(15, 5)]: [2004, 2004.5, 2003.5, 2004] });
  const ix = G.index(bars);
  assert.ok(G.dayOk(ix, ymd, G.PM));
  assert.equal(G.atr(ix, ymd, G.PM), 1);   // every candle 13:45-14:50 has a range of 1
  const t = G.trades(ix, ymd, G.PM).T1;
  assert.equal(t.side, 1); assert.equal(t.entry, 2002); assert.equal(t.stop, 1999); assert.equal(t.exit, 2004); assert.equal(t.how, 'time');
  assert.equal(t.R, 2 / 3);
  const c = 0.07 + 0.07 + 0.000024 * 2002;
  assert.ok(Math.abs(t.costPx - c) < 1e-12 && Math.abs(t.net - (2 / 3 - c / 3)) < 1e-12 && Math.abs(t.net2 - (2 / 3 - 2 * c / 3)) < 1e-12);
  // a stop inside the 15:00 candle
  const s = G.trades(G.index(day(ymd, 2000, { [m(14, 55)]: [2002, 2002, 2001, 2001.5], [m(15, 0)]: [2001.5, 2001.6, 1998, 1998.5] })), ymd, G.PM).T1;
  assert.equal(s.how, 'stop'); assert.equal(s.exit, 1999); assert.equal(s.R, -1);
});

test('T2: against 13:30 -> 15:00, entry at the close of the 15:00 candle, stop its extreme + $0.30, gap fill, out at 16:30', () => {
  const ymd = '2026-01-14';
  const up = { [m(15, 0)]: [2003, 2004, 2002.8, 2003.5] };
  const t = G.trades(G.index(day(ymd, 2000, up)), ymd, G.PM).T2;
  // M = open 15:00 (2003) - open 13:30 (2000) > 0: sell at 2003.5, stop 2004.3, later candles at 2000 gap through nothing
  assert.equal(t.side, -1); assert.equal(t.entry, 2003.5); assert.equal(t.stop, 2004.3); assert.equal(t.how, 'time'); assert.equal(t.exit, 2000);
  assert.ok(Math.abs(t.R - 3.5 / 0.8) < 1e-9);
  // the 15:05 candle opens above the stop: out at that open
  const g = G.trades(G.index(day(ymd, 2000, { ...up, [m(15, 5)]: [2005, 2005, 2004.9, 2005] })), ymd, G.PM).T2;
  assert.equal(g.how, 'gap'); assert.equal(g.exit, 2005);
});

test('the day check: a missing read candle or a step over 15 minutes in 13:30-16:30 drops the day; holidays and 24 / 31 Dec skip PM', () => {
  const ymd = '2026-02-04';
  assert.ok(G.dayOk(G.index(day(ymd)), ymd, G.PM));
  assert.ok(!G.dayOk(G.index(day(ymd, 2000, { [m(14, 55)]: null })), ymd, G.PM));
  const holes = day(ymd).filter((b) => !(b[0] > G.londonT(ymd, m(15, 40)) && b[0] < G.londonT(ymd, m(16, 0))));   // 15:40 -> 16:00
  assert.ok(!G.dayOk(G.index(holes), ymd, G.PM));
  const ok3 = day(ymd).filter((b) => !(b[0] > G.londonT(ymd, m(15, 40)) && b[0] < G.londonT(ymd, m(15, 55))));   // a 15-minute step
  assert.ok(G.dayOk(G.index(ok3), ymd, G.PM));
  const bars = ['2025-12-24', '2025-12-25', '2025-12-29'].flatMap((d) => day(d, 2000, { [m(14, 55)]: [2001, 2001.5, 2000.5, 2001] }));
  const r = G.runAnchor(G.index(bars), ['2025-12-24', '2025-12-25', '2025-12-29'], G.PM);
  assert.equal(r.counts.noAuction, 1); assert.equal(r.counts.holiday, 1); assert.equal(r.T1.length, 1);
});

test('placebo anchors never touch 13:00-16:30 and stay inside 01:30-21:00; Holm', () => {
  for (const F of G.PLACEBO_F) { assert.ok(F - 90 >= 90 && F + 90 <= 21 * 60); assert.ok(F + 90 <= 13 * 60 || F - 90 >= 16 * 60 + 30, G.hm(F)); }
  assert.equal(G.placeboF(7), G.placeboF(7));
  const h = G.holm([0.01, 0.04]); assert.deepEqual(h.ok, [true, true]);
  assert.deepEqual(G.holm([0.03, 0.04]).ok, [false, false]);
});

test('the report against result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(R.verdict, /^(PASS|FAIL|NOT MEASURABLE)/);
  for (const id of ['T1', 'T2']) {
    const c = R.checks[id];
    assert.equal(c.pass, Object.values(c.checks).every(Boolean));
    for (const w of ['is', 'oos']) { const s = R.result[id][w]; assert.ok(s.n > 1000); assert.ok(md.includes(`| ${s.n} |`)); }
  }
  assert.equal(R.verdict.startsWith('PASS'), R.checks.T1.pass || R.checks.T2.pass);
  assert.ok(md.includes(R.verdict));
  assert.equal(R.placebo.length, 40);
  for (const p of R.placebo) assert.ok(G.PLACEBO_F.map(G.hm).includes(p.at));
  // the figures quoted in the reading
  const f = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(3)}R`;
  for (const v of [R.result.T1.is.grossR, R.result.T1.oos.grossR, R.result.T2.is.grossR, R.result.T2.oos.grossR, R.am.T2.is.grossR, R.am.T2.oos.grossR, R.am.T2.oos.netR, R.placeboSummary.T1.median, R.placeboSummary.T2.median])
    assert.ok(R.reading.join(' ').includes(f(v)), f(v));
  assert.ok(!/model|assistant/i.test(md.replace(/cost model/g, '')));
});
