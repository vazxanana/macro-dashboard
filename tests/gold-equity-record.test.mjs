// research/edge/gold-equity-record: the rule on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordDays, jointDays, tradeAt, simulate, entryIndex, sameMonth, rng, holm, monthly, DAY, RT, K_ATR, HOLD, SIDE } from '../research/edge/gold-equity-record/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-equity-record');
const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const bar = (i, c, o = c, h = Math.max(o, c) + 1, l = Math.min(o, c) - 1) => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c });

test('record day: the close is at or above every close of the look-1 candles before it', () => {
  const b = [100, 98, 101, 101, 99, 102, 97, 96].map((c, i) => bar(i, c));
  // look 3: index 2 (101 >= 100, 98) yes; 3 (101 >= 98, 101) yes (a tie counts); 4 (99) no; 5 (102) yes; 6 no; 7 no
  assert.deepEqual(recordDays(b, 3).map((d) => d.ev), [true, true, false, true, false, false]);
  // joint: a day counts only when every index has a record that day
  const a = [{ t: 1, ev: true }, { t: 2, ev: true }, { t: 3, ev: false }], c = [{ t: 1, ev: true }, { t: 2, ev: false }, { t: 3, ev: false }];
  assert.deepEqual(jointDays([a, c]).map((d) => d.ev), [true, false, false]);
});

test('no look-ahead: a day\'s flag does not change when later candles change', () => {
  const r = rng(7), b = [];
  let px = 100;
  for (let i = 0; i < 400; i++) { px *= 1 + (r() - 0.48) * 0.03; b.push(bar(i, px)); }
  const a = recordDays(b, 252);
  const c = b.slice(0, 330).concat(b.slice(330).map((x) => ({ ...x, close: x.close * 3, high: x.high * 3, low: x.low * 3, open: x.open * 3 })));
  const a2 = recordDays(c, 252);
  for (let i = 0; i < 330 - 251; i++) assert.deepEqual(a2[i], a[i]);
});

test('the trade: a sell after the signal day, 5-day hold, stop 2 x ATR above, no financing on a sell', () => {
  assert.equal(SIDE, -1);
  assert.equal(HOLD, 5);
  const g = [];
  for (let i = 0; i < 30; i++) g.push(bar(i, 2000, 2000, 2005, 1995));   // true range 10 -> ATR 10, risk 20
  for (let i = 30; i < 35; i++) g.push(bar(i, 1995, 2000, 2004, 1990));
  const j = entryIndex(g, g[29].time);
  assert.equal(j, 30);
  const tr = tradeAt(g, j);
  assert.equal(tr.risk, K_ATR * 10);
  assert.equal(tr.stop, 2020);
  assert.equal(tr.kind, 'time');
  assert.equal(tr.k, 34);
  assert.equal(tr.gross, 5 / 20);              // sold 2000, out 1995
  assert.equal(tr.fin, 0);
  assert.ok(Math.abs(tr.cost - RT / 20) < 1e-12);
  // a candle that trades up through the stop exits at the stop: -1R gross
  const g2 = g.slice(0, 31).concat([bar(31, 2010, 2001, 2025, 1999)], g.slice(32));
  const t2 = tradeAt(g2, 30);
  assert.equal(t2.kind, 'stop');
  assert.equal(t2.gross, -1);
  // a buy pays financing (the rule in council/fills.mjs), a sell does not
  assert.ok(tradeAt(g, 30, HOLD, 1, 1).fin > 0);
  // one position at a time: a signal inside an open trade is skipped
  assert.equal(simulate([{ t: g[29].time }, { t: g[30].time }], g).length, 1);
});

test('control keeps the calendar month and avoids event days', () => {
  const days = [];
  for (let i = 0; i < 60; i++) days.push({ t: T0 + i * DAY, ev: i % 10 === 0 });
  const c = sameMonth(days, rng(1));
  assert.equal(c.length, days.filter((d) => d.ev).length);
  for (const x of c) assert.equal(x.ev, false);
  const ym = (t) => new Date(t * 1000).toISOString().slice(0, 7);
  assert.deepEqual(c.map((x) => ym(x.t)).sort(), days.filter((d) => d.ev).map((x) => ym(x.t)).sort());
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => Math.round(x * 1000) / 1000), [0.03, 0.08, 0.5]);
  const m = monthly([{ c: T0, v: 1 }, { c: T0 + 40 * DAY, v: 3 }], T0, T0 + 40 * DAY, 'v');
  assert.equal(m.months, 2);
});

test('result.json: three tests, FAIL, figures the report quotes', () => {
  assert.equal(res.verdict, 'FAIL');
  assert.equal(res.tests.length, 3);
  assert.ok(res.headline.length < 220);
  for (const t of res.tests) {
    assert.ok(t.is.n >= 100 && t.oos.n >= 100, `${t.id} has 100+ trades a window`);
    assert.equal(t.placebo.ts.length, 40);
    assert.equal(t.control.excess.length, 40);
    assert.equal(t.pass, false);
  }
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  const t1 = res.tests[0];
  const v = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(v.includes('FAIL, 0 of 3'));
  assert.ok(v.length < 260);
  assert.ok(v.includes(`n ${t1.oos.n}`));
  assert.ok(v.includes(t1.oos.excess.toFixed(3)));
  assert.ok(v.includes(t1.oos.tMonth.toFixed(2)));
  const fmt = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  for (const t of res.tests) {
    assert.ok(md.includes(fmt(t.oos.excess)) && md.includes(fmt(t.is.excess)), `${t.id} excess in the report`);
    assert.ok(md.includes(`| ${t.id} | ${t.placebo.beaten} | ${t.control.beaten} |`), `${t.id} placebo / control row`);
  }
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  for (const k of ['xau', 'spx500', 'nas100', 'us30']) assert.ok(pre.includes(k));
});
