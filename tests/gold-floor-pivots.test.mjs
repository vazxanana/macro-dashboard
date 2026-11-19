// Gold floor pivots study: the levels, each test's rule on hand-made candles, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { levelsAt, runDay, score, monthT, holm, pOneSided, dailies, COST } from '../research/edge/gold-floor-pivots/run.mjs';

const D0 = Date.UTC(2024, 0, 8) / 1000;   // a Monday
const bar = (i, o, h, l, c) => [D0 + 7 * 3600 + i * 300, o, h, l, c];
const lv = { P: 100, R1: 105, S1: 95, atr: 10 };   // 0.25 x ATR = 2.5, 0.2 x ATR = 2, 0.1 x ATR = 1

test('levels: P, R1, S1 from the previous day only; ATR20 from the 20 days before', () => {
  const days = [...Array(25)].map((_, i) => ({ time: i * 86400, open: 100, high: 104, low: 96, close: 100 }));
  days[23] = { time: 23 * 86400, open: 100, high: 110, low: 90, close: 106 };
  const a = levelsAt(days, 24);
  assert.equal(+a.P.toFixed(6), 102); assert.equal(+a.R1.toFixed(6), 114); assert.equal(+a.S1.toFixed(6), 94);
  assert.equal(+a.atr.toFixed(6), +((19 * 8 + 20) / 20).toFixed(6));
  const b = days.map((d, i) => (i === 24 ? { ...d, high: 999, low: 1, close: 500 } : d));
  assert.deepEqual(levelsAt(b, 24), a, 'the trading day itself is never read');
  assert.equal(levelsAt(days, 20), null);
});

test('daily candles fold the weekend into Monday', () => {
  const sat = Date.UTC(2024, 0, 6) / 1000, mon = sat + 2 * 86400;
  const d = dailies([[sat - 86400, 1, 2, 0.5, 1.5], [sat + 86400 + 79200, 1.6, 9, 1.4, 1.7], [mon, 1.7, 2, 1.6, 1.8]]);
  assert.equal(d.length, 2); assert.equal(d[1].high, 9); assert.equal(d[1].open, 1.6); assert.equal(d[1].close, 1.8);
});

test('T1 fades R1: sell limit at R1, stop 0.25 ATR above, target P; target not taken on the fill candle', () => {
  const bars = [bar(0, 101, 102, 100.5, 101.5), bar(1, 101.5, 105.5, 101, 104), bar(2, 104, 104.2, 99.8, 100.5)];
  const t = runDay('T1', bars, lv);
  assert.equal(t.side, 'sell'); assert.equal(t.entry, 105); assert.equal(t.stop, 107.5); assert.equal(t.exit, 100); assert.equal(t.how, 'target');
  assert.ok(t.stop > t.entry, 'stop on the losing side');
  const s = score(t); assert.equal(+s.gross.toFixed(6), 2); assert.equal(+s.net.toFixed(6), +(2 - COST / 2.5).toFixed(6)); assert.equal(s.fin, 0);
  const st = runDay('T1', [bar(0, 101, 102, 100.5, 101.5), bar(1, 101.5, 108, 99, 104)], lv);
  assert.equal(st.how, 'stop', 'stop first when one candle holds both');
});

test('a level within 0.1 ATR of the 07:00 open is not used', () => {
  assert.equal(runDay('T1', [bar(0, 104.5, 106, 104, 105.5), bar(1, 105.5, 106, 105, 105.2)], { ...lv, S1: 50 }), null);
  assert.equal(runDay('T3', [bar(0, 100.5, 101, 99, 99.5)], lv), null);
});

test('T2 buys the next open after a close above R1, stop 0.25 ATR back inside, out at the last candle', () => {
  const bars = [bar(0, 101, 102, 100.5, 101.8), bar(1, 101.8, 106, 101.7, 105.6), bar(2, 105.8, 107, 105.5, 106.5), bar(3, 106.5, 108, 106, 107.9)];
  const t = runDay('T2', bars, lv);
  assert.equal(t.side, 'buy'); assert.equal(t.entry, 105.8); assert.equal(t.stop, 102.5); assert.equal(t.exit, 107.9); assert.equal(t.how, 'time');
  assert.equal(t.entryT, bars[2][0], 'enters on the candle after the signal close');
});

test('T3 buys the first touch of P from above, target R1, stop 0.2 ATR under P', () => {
  const bars = [bar(0, 103, 103.5, 102, 102.5), bar(1, 102.5, 102.6, 99.5, 100.2), bar(2, 100.2, 105.2, 100, 105)];
  const t = runDay('T3', bars, lv);
  assert.equal(t.side, 'buy'); assert.equal(t.entry, 100); assert.equal(t.stop, 98); assert.equal(t.exit, 105); assert.equal(t.how, 'target');
});

test('no look-ahead: changing candles after the entry leaves the entry unchanged', () => {
  const bars = [bar(0, 101, 102, 100.5, 101.5), bar(1, 101.5, 105.5, 101, 104), bar(2, 104, 104.2, 99.8, 100.5)];
  const a = runDay('T1', bars, lv), b = runDay('T1', [...bars.slice(0, 2), bar(2, 104, 120, 90, 110)], lv);
  assert.equal(a.entry, b.entry); assert.equal(a.entryT, b.entryT); assert.equal(a.stop, b.stop);
});

test('statistics: month t counts empty months as 0, Holm is monotone, the t tail', () => {
  const m = (y, mo) => Date.UTC(y, mo, 5) / 1000, from = m(2021, 0), to = m(2021, 3);
  const r = monthT([{ entryT: m(2021, 0), net: 1 }, { entryT: m(2021, 1), net: 1 }, { entryT: m(2021, 2), net: 1 }], from, to);
  assert.equal(r.months, 4); assert.equal(+r.t.toFixed(4), 3);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOneSided(2, 60) - 0.025) < 0.003); assert.ok(Math.abs(pOneSided(0, 10) - 0.5) < 1e-9);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-floor-pivots/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-floor-pivots/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(r.passed, []);
  const head = md.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.ok(head.length < 220, 'headline under 220 characters'); assert.match(head, /^\*\*Verdict: FAIL: /);
  const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3), tg = (x) => (x < 0 ? '−' : '') + Math.abs(x).toFixed(2);
  assert.ok(head.includes(`${f(r.tests.T1.oos.net)}R a trade net out of sample (n ${r.tests.T1.oos.n}, month t ${tg(r.tests.T1.oos.tNet)})`));
  for (const k of ['T1', 'T2', 'T3']) {
    const s = r.tests[k];
    assert.equal(s.pass, false);
    assert.ok(md.includes(`| ${s.oos.n} | ${f(s.oos.gross)} | ${f(s.oos.net)} |`), `${k} out-of-sample row`);
    assert.ok(md.includes(`| ${s.is.n} | ${f(s.is.gross)} | ${f(s.is.net)} |`), `${k} in-sample row`);
    assert.ok(md.includes(`| ${s.placebo.beaten} of 40 |`), `${k} placebo`);
    assert.equal(s.oos.fin, 0, 'flat by 20:00 UTC: no rollover crossed');
  }
  assert.match(md, /never a gate, exit, entry or size of the live gold book/);
});
