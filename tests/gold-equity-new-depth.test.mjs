// research/edge/gold-equity-new-depth: the rule on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { depthDays, tradeAt, simulate, entryIndex, sameMonth, rng, holm, monthly, DAY, RT, K_ATR } from '../research/edge/gold-equity-new-depth/run.mjs';
import { FIN } from '../council/fills.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/gold-equity-new-depth');
const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
const bar = (i, c, o = c, h = Math.max(o, c) + 1, l = Math.min(o, c) - 1) => ({ time: T0 + i * DAY, open: o, high: h, low: l, close: c });

test('new-depth day: at least X below the 52-week high AND the deepest close since that high', () => {
  // look 5: closes 100 (high), 98, 96, 97, 95, 96
  const b = [100, 98, 96, 97, 95, 96, 94].map((c, i) => bar(i, c));
  const d = depthDays(b, 0.03, 5);
  // index 4 (95): high 100 at 0, dd -5 %, below 98, 96, 97 -> event; index 5 (96): not below 95; index 6 (94): high of 2..6 = 97 at 3,
  // dd -3.1 %, below 95 and 96 since index 3 -> event
  assert.deepEqual(d.map((x) => x.ev), [true, false, true]);
  assert.equal(d.length, 3);
  // a shallow new low is not an event
  const s = [100, 99.5, 99, 98.5, 98.2].map((c, i) => bar(i, c));
  assert.equal(depthDays(s, 0.03, 5)[0].ev, false);
});

test('no look-ahead: a day\'s event flag does not change when later candles change', () => {
  const r = rng(7), b = [];
  let px = 100;
  for (let i = 0; i < 400; i++) { px *= 1 + (r() - 0.52) * 0.03; b.push(bar(i, px)); }
  const a = depthDays(b, 0.03, 252);
  const c = b.slice(0, 330).concat(b.slice(330).map((x) => ({ ...x, close: x.close * 3, high: x.high * 3, low: x.low * 3, open: x.open * 3 })));
  const a2 = depthDays(c, 0.03, 252);
  for (let i = 0; i < 330 - 251; i++) assert.deepEqual(a2[i], a[i]);
});

test('the trade: entry after the signal day, one-day hold, stop at 2 x ATR, costs in R', () => {
  const g = [];
  for (let i = 0; i < 30; i++) g.push(bar(i, 2000, 2000, 2005, 1995));   // true range 10 -> ATR 10, risk 20
  g.push(bar(30, 2008, 2000, 2010, 1990));
  const j = entryIndex(g, g[29].time);
  assert.equal(j, 30);
  const tr = tradeAt(g, j);
  assert.equal(tr.risk, K_ATR * 10);
  assert.equal(tr.kind, 'time');
  assert.equal(tr.gross, 8 / 20);
  assert.ok(Math.abs(tr.cost - (RT / 20 + tr.nights * FIN.xau.long * 2000 / 20)) < 1e-12);
  // a candle that trades through the stop exits at the stop: -1R gross
  const g2 = g.slice(0, 30).concat([bar(30, 1990, 2000, 2001, 1970)]);
  assert.equal(tradeAt(g2, 30).gross, -1);
  // one position at a time: two signals on the same day give one trade
  assert.equal(simulate([{ t: g[29].time }, { t: g[29].time }], g).length, 1);
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
  const verdictLine = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(verdictLine.includes('FAIL, 0 of 3'));
  assert.ok(verdictLine.includes(`n ${t1.oos.n}`));
  assert.ok(verdictLine.includes(t1.oos.excess.toFixed(3)));
  assert.ok(verdictLine.includes(t1.oos.tMonth.toFixed(2)));
  const fmt = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  for (const t of res.tests) {
    assert.ok(md.includes(fmt(t.oos.excess)), `${t.id} OOS excess in the report`);
    assert.ok(md.includes(`| ${t.id} | ${t.placebo.beaten} | ${t.control.beaten} |`), `${t.id} placebo / control row`);
  }
  // the pre-registration came first and names the data
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.ok(pre.includes('spx500') && pre.includes('nas100') && pre.includes('xau'));
});
