// Month-end equity / gold rebalancing flow study: the rule on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { months, trade, signal, closeAt, holm, monthT, P } from '../research/edge/gold-rebalance-flow/run.mjs';

// weekday candles from 1 Dec 2019 to 31 Jan 2020: flat gold (range 10), January edited by janGold; S&P flat, then spxJan4 through TD-4
function make(janGold, spxJan4) {
  const days = [], spx = [];
  for (let t = Date.UTC(2019, 11, 1) / 1000; t < Date.UTC(2020, 1, 1) / 1000; t += 86400) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    days.push({ time: t, open: 100, high: 105, low: 95, close: 100 });
    spx.push({ time: t, open: 3000, high: 3000, low: 3000, close: 3000 });
  }
  const j0 = days.findIndex((d) => d.time >= Date.UTC(2020, 0, 1) / 1000);
  janGold(days, j0);
  for (let i = j0; i <= spx.length - 4; i++) spx[i].close = spxJan4;
  return { days, spx };
}
const keep = () => {};

test('equities ahead of gold buys gold at TD-3, gold ahead sells; the trade runs TD-3 open to TD-1 close', () => {
  const a = make(keep, 3300); const w = months(a.days, a.spx).at(-1);
  assert.ok(w.D < 0); assert.equal(signal(w), 1); assert.equal(w.atr, 10); assert.equal(w.rest.length, 3);
  const tr = trade(w, 1); assert.equal(tr.entry, 100); assert.equal(tr.exit, 100); assert.equal(tr.risk, 15);
  assert.ok(tr.nights >= 2 && tr.cost > 0.6 / 15);
  const b = make(keep, 2700); assert.equal(signal(months(b.days, b.spx).at(-1)), -1);
  const c = make(keep, 3000); assert.equal(signal(months(c.days, c.spx).at(-1)), 0);
});

test('the stop: touched fills at the stop, a gap fills at the open; sells pay no financing', () => {
  const a = make((d) => { const L = d.length; d[L - 2] = { ...d[L - 2], high: 120 }; }, 2700);
  const s = trade(months(a.days, a.spx).at(-1), -1);
  assert.equal(s.stopped, true); assert.equal(s.exit, 115); assert.equal(s.gross, -1); assert.equal(s.nights, 0);
  const g = make((d) => { const L = d.length; d[L - 2] = { ...d[L - 2], open: 125, high: 126 }; }, 2700);
  assert.equal(trade(months(g.days, g.spx).at(-1), -1).exit, 125);
});

test('no look-ahead: the last three days never change the signal or the ATR', () => {
  const a = make(keep, 3300);
  const b = make((d) => { const L = d.length; for (let i = L - 3; i < L; i++) d[i] = { ...d[i], open: 50, high: 300, low: 10, close: 200 }; }, 3300);
  for (let i = b.spx.length - 3; i < b.spx.length; i++) b.spx[i].close = 1;
  const wa = months(a.days, a.spx).at(-1), wb = months(b.days, b.spx).at(-1);
  assert.equal(wa.D, wb.D); assert.equal(wa.atr, wb.atr);
  assert.equal(closeAt(a.spx, a.spx[5].time + 3600), a.spx[5].close); assert.equal(closeAt(a.spx, 0), null);
});

test('Holm and month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const rows = [{ t: Date.UTC(2017, 0, 3) / 1000, x: 1 }, { t: Date.UTC(2017, 1, 3) / 1000, x: 1 }];
  assert.ok(monthT(rows, 'x', 2017, 2017) > 0);
  assert.equal(P.cost, 0.6);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-rebalance-flow/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-rebalance-flow/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 3/);
  const head = md.match(/\*\*Verdict:[^\n]*\*\*/)[0]; assert.ok(head.length < 220 + 6);
  const f = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  for (const [w, lab] of [['is', '2007-16'], ['oos', '2017-26']]) for (const k of ['T1', 'T2', 'T3']) {
    const s = r[w][k];
    assert.ok(md.includes(`| ${lab} | ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${f(s.excess)} | ${s.tNet.toFixed(2)} | ${s.tExcess.toFixed(2)} |`), `${w} ${k}`);
  }
  assert.ok(md.includes(`beats ${r.placebo.beatenBy} of ${r.placebo.of}`));
  assert.equal(r.checks.oosT, false); assert.equal(r.checks.placebo, false);
});
