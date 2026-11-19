// The measured move (ABCD) on gold H4: buckets, swings, setups, trigger, management, costs, no look-ahead, the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bucketOf, h4, setups, trigger, manage, cost, targetD, targetHalf, holm, monthT, tradingDays, dayBefore,
  PIV, AB_ATR, BC_MIN, BC_MAX, BUF, COST, HOLD, WAIT, SEEDS } from '../research/edge/gold-measured-move/run.mjs';

test('pre-registered numbers', () => {
  assert.deepEqual([PIV, AB_ATR, BC_MIN, BC_MAX, BUF, COST, HOLD, WAIT, SEEDS], [3, 2, 0.382, 0.786, 0.30, 0.60, 30, 30, 40]);
});

test('H4 buckets start at 02/06/10/14/18/22 UTC; the last bucket is dropped', () => {
  const t = (iso) => Date.parse(iso) / 1000;
  assert.equal(bucketOf(t('2026-01-05T22:00:00Z')), t('2026-01-05T22:00:00Z'));
  assert.equal(bucketOf(t('2026-01-06T01:00:00Z')), t('2026-01-05T22:00:00Z'));
  assert.equal(bucketOf(t('2026-01-06T02:00:00Z')), t('2026-01-06T02:00:00Z'));
  const rows = [['2026-01-06T02:00:00Z', 10, 12, 9, 11], ['2026-01-06T03:00:00Z', 11, 13, 10, 12], ['2026-01-06T06:00:00Z', 12, 12, 8, 9]].map(([s, ...v]) => [t(s), ...v]);
  const b = h4(rows);
  assert.equal(b.length, 1); assert.deepEqual([b[0].open, b[0].high, b[0].low, b[0].close], [10, 13, 9, 12]);
});

// a hand-made long ABCD: A low 100, B high 120, C low 110 (ratio 0.5), then a break of B
function path() {
  const pts = [105, 104, 103, 102, 101, 100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 118, 116, 114, 112, 110, 112, 114, 116, 118, 119, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132];
  return pts.map((p, i) => ({ time: 1e9 + i * 14400, open: p, high: p + 0.5, low: p - 0.5, close: p }));
}

test('a long ABCD is found at the confirmation of C, triggered after it, D = C + (B - A)', () => {
  const bars = path(), S = setups(bars).filter((s) => s.side > 0);
  const s = S.find((x) => x.B === 120.5 && x.C === 109.5);
  assert.ok(s, 'setup found');
  assert.equal(s.A, 99.5); assert.equal(s.conf, s.c + PIV);
  assert.ok(s.ratio >= BC_MIN && s.ratio <= BC_MAX && s.B - s.A >= AB_ATR * s.atr);
  const g = trigger(bars, s);
  assert.equal(bars[g.k].close > s.B, true); assert.ok(g.k >= s.c + PIV); assert.equal(g.e, g.k + 1);
  assert.equal(targetD(s), 109.5 + 21); assert.equal(targetHalf(s), 120.5 + 0.5 * (130.5 - 120.5));
  const tr = manage(bars, g.e, 1, s.C - BUF, targetD(s));
  assert.equal(tr.how, 'target'); assert.ok(tr.stop < tr.entry && tr.R > 0);
});

test('no look-ahead: setups up to a candle never change when later candles change', () => {
  let a = 9, p = 1000; const bars = [];
  for (let i = 0; i < 1500; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5, o = p; p += r * 12;
    bars.push({ time: 1e9 + i * 14400, open: o, high: Math.max(o, p) + Math.abs(r) * 3, low: Math.min(o, p) - Math.abs(r) * 3, close: p }); }
  const S = setups(bars);
  assert.ok(S.length > 10);
  for (const k of [300, 700, 1200]) {
    const alt = bars.map((b, i) => (i > k ? { ...b, high: b.high + 80, low: b.low - 80, close: b.close + (i % 2 ? 40 : -40) } : b));
    const key = (x) => `${x.side}:${x.a}:${x.b}:${x.c}:${x.conf}`;
    assert.deepEqual(setups(alt).filter((x) => x.conf <= k).map(key), S.filter((x) => x.conf <= k).map(key));
    for (const s of S.filter((x) => x.conf <= k)) { const g = trigger(bars, s); if (g.skip || g.k > k) continue;
      assert.deepEqual(trigger(alt, s), g); }
  }
});

test('stop on the losing side, stop first when both are hit, gaps fill at the open, time exit at candle 30', () => {
  const c = (o, h, l, cl, i) => ({ time: 1e9 + i * 14400, open: o, high: h, low: l, close: cl });
  const both = [c(100, 100, 100, 100, 0), c(100, 106, 94, 100, 1)];
  assert.equal(manage(both, 1, 1, 95, 105).how, 'stop');
  assert.equal(manage(both, 1, 1, 95, 105).R, -1);
  const gap = [c(100, 100, 100, 100, 0), c(100, 101, 99, 100, 1), c(90, 91, 89, 90, 2)];
  assert.equal(manage(gap, 1, 1, 95, 110).R, -2);   // opened through the stop: filled at the open
  const flat = Array.from({ length: 40 }, (_, i) => c(100, 100.5, 99.5, 100 + (i === 30 ? 0.2 : 0), i));
  const tr = manage(flat, 1, 1, 98, 110);
  assert.equal(tr.how, 'time'); assert.equal(tr.exitIdx, 30);
  assert.ok(manage(flat.slice(0, 10), 1, 1, 98, 110).open);
  for (const side of [1, -1]) { const t2 = manage(flat, 1, side, 100 - side * 2, 100 + side * 10); assert.ok(side * (t2.entry - t2.stop) > 0); }
});

test('costs: $0.60 a round trip on every trade, financing on buys only, doubled at 2x', () => {
  const tr = { R: 1, risk: 6, entry: 3000, entryT: Date.parse('2026-01-05T10:00:00Z') / 1000, exitT: Date.parse('2026-01-08T10:00:00Z') / 1000 };
  const s = cost(tr, -1), b = cost(tr, 1), b2 = cost(tr, 1, 2);
  assert.equal(s.fin, 0); assert.ok(Math.abs(s.net - (1 - 0.1)) < 1e-12);
  assert.equal(b.nights, 5);   // Mon, Tue, Wed (three)
  assert.ok(Math.abs(b.fin - 5 * 0.000148 * 3000 / 6) < 1e-12);
  assert.ok(Math.abs((1 - b2.net) - 2 * (1 - b.net)) < 1e-12);
});

test('trading days for the T3 trend filter: only a day already ended is read', () => {
  const t = (iso) => Date.parse(iso) / 1000, rows = [];
  for (let d = 0; d < 80; d++) for (let h = 0; h < 24; h++) { const tt = t('2026-01-05T00:00:00Z') + d * 86400 + h * 3600; rows.push([tt, 100 + d, 101 + d, 99 + d, 100 + d]); }
  const days = tradingDays(rows), last = days.at(-1);
  assert.ok(days.filter((x) => x.sma != null).length > 0);
  assert.notEqual(dayBefore(days, last.end - 1), last); assert.equal(dayBefore(days, last.end), last);
});

test('Holm and month sums', () => {
  assert.deepEqual(holm([0.5, 0.01, 0.02]).map((x) => +x.toFixed(3)), [0.5, 0.03, 0.04]);
  const T = [{ t: Date.parse('2020-01-10') / 1000, net: 1 }, { t: Date.parse('2020-03-10') / 1000, net: 2 }];
  assert.equal(monthT(T, '2020-01', '2020-04').months, 4);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-measured-move/result.json', import.meta.url))), md = fs.readFileSync(new URL('../research/edge/gold-measured-move/RESULT.md', import.meta.url), 'utf8');
  const s = (v) => (v > 0 ? '+' : '') + v.toFixed(3), f2 = (v) => v.toFixed(2);
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(r.passed, []);
  const head = md.match(/^\*\*Verdict: (.*)\*\*$/m);
  assert.ok(head && head[0].length < 220 && head[1].startsWith('FAIL, 0 of 3 tests'));
  for (const k of ['T1', 'T2', 'T3']) { const t = r.tests[k];
    assert.equal(t.pass, false);
    const row = `| ${t.is.net.n} | ${s(t.is.net.avg)} | ${f2(t.is.month.t)} | ${t.oos.net.n} | ${s(t.oos.gross.avg)} | ${s(t.oos.net.avg)} | ${f2(t.oos.month.t)} | ${s(t.oos.x2.avg)} | ${f2(t.pHolm)} | ${t.placebo.beaten} of 40 |`;
    assert.ok(md.includes(row), `${k} row`); }
  const T1 = r.tests.T1;
  assert.ok(md.includes(`${T1.placebo.targetShare.real} %`) && md.includes(`${T1.placebo.targetShare.placeboMedian} %`));
  assert.ok(md.includes(`${r.funnel.setups.toLocaleString('en-US')} setups`) && md.includes(`${r.funnel.triggered} triggered`));
  assert.ok(md.includes(`-0.043R a trade net out of sample (n ${T1.oos.net.n}, month t ${f2(T1.oos.month.t)})`));
});
