// Monday-tells-the-week study on gold: the rule on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weeks, trade, signal, atrAt, holm, monthT, P } from '../research/edge/gold-monday-tell/run.mjs';

const MON = Date.UTC(2020, 0, 6) / 1000; // a Monday
// 25 weekdays of flat candles (range 10) ending on a Friday, then a Monday..Friday week
function make(monClose, rest) {
  const days = []; let t = MON - 7 * 86400 * 5;
  while (days.length < 25) { const w = new Date(t * 1000).getUTCDay(); if (w > 0 && w < 6) days.push({ time: t, open: 100, high: 105, low: 95, close: 100 }); t += 86400; }
  days.push({ time: MON, open: 100, high: Math.max(105, monClose), low: Math.min(95, monClose), close: monClose });
  rest.forEach((b, i) => days.push({ time: MON + (i + 1) * 86400, ...b }));
  return days;
}
const bar = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

test('signal from Monday only: a big up Monday buys, a small one is no trade', () => {
  const up = make(108, [bar(108, 110, 107, 109), bar(109, 111, 108, 110), bar(110, 112, 109, 111), bar(111, 113, 110, 112)]);
  const w = weeks(up).at(-1);
  assert.equal(w.atr, 10); assert.equal(w.M, 8); assert.equal(signal(w), 1);
  const small = weeks(make(103, [bar(103, 104, 102, 103), bar(103, 104, 102, 103), bar(103, 104, 102, 103), bar(103, 104, 102, 103)])).at(-1);
  assert.equal(signal(small), 0);
  const tr = trade(w, 1);
  assert.equal(tr.entry, 108); assert.equal(tr.exit, 112); assert.equal(tr.risk, 15);
  assert.ok(Math.abs(tr.gross - 4 / 15) < 1e-12); assert.ok(tr.nights === 5 && tr.cost > 0.6 / 15);
});

test('the stop: touched intraday fills at the stop, a gap fills at the open; sells pay no financing', () => {
  const w = weeks(make(92, [bar(92, 93, 90, 91), bar(91, 108, 90, 100), bar(100, 101, 99, 100), bar(100, 101, 99, 100)])).at(-1);
  assert.equal(signal(w), -1);
  const s = trade(w, -1); assert.equal(s.stopped, true); assert.equal(s.exit, 107); assert.equal(s.gross, -1); assert.equal(s.nights, 0);
  const g = weeks(make(92, [bar(92, 93, 90, 91), bar(110, 112, 109, 111), bar(100, 101, 99, 100), bar(100, 101, 99, 100)])).at(-1);
  assert.equal(trade(g, -1).exit, 110);
});

test('no look-ahead: changing Tuesday-Friday never changes the signal or the ATR', () => {
  const a = make(108, [bar(108, 110, 107, 109), bar(109, 111, 108, 110), bar(110, 112, 109, 111), bar(111, 113, 110, 112)]);
  const b = make(108, [bar(108, 190, 7, 9), bar(9, 211, 8, 110), bar(110, 312, 9, 11), bar(11, 13, 10, 12)]);
  const wa = weeks(a).at(-1), wb = weeks(b).at(-1);
  assert.equal(wa.atr, wb.atr); assert.equal(signal(wa), signal(wb));
  assert.equal(atrAt(a, a.length - 5), atrAt(a.slice(0, a.length - 4), a.length - 5));
});

test('Holm and month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const rows = [{ t: Date.UTC(2017, 0, 3) / 1000, x: 1 }, { t: Date.UTC(2017, 1, 3) / 1000, x: 1 }];
  assert.ok(monthT(rows, 'x', 2017, 2017) > 0);
  assert.equal(P.cost, 0.6);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-monday-tell/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-monday-tell/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const head = md.match(/\*\*Verdict:[^\n]*\*\*/)[0]; assert.ok(head.length < 220 + 6);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const [w, lab] of [['is', '2007-16'], ['oos', '2017-26']]) for (const k of ['T1', 'T2', 'T3']) {
    const s = r[w][k];
    assert.ok(md.includes(`| ${lab} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.excess)} | ${s.tNet.toFixed(2)} | ${s.tExcess.toFixed(2)} |`), `${w} ${k}`);
  }
  assert.ok(md.includes(`beats ${r.placebo.beatenBy} of ${r.placebo.of}`));
  assert.ok(Object.values(r.checks).every((v) => v === false));
});
