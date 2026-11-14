// Daily candlestick reversal patterns on CFD markets: the pattern rules on hand-made candles, no look-ahead, the trade's
// stop and exits, the one-at-a-time stream, Holm, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { match, signals, trade, stream, holm, p2, net, MARKETS, P, PATTERNS } from '../research/edge/candle-patterns/run.mjs';

const DAY = 86400;
const bar = (i, o, h, l, c) => ({ time: 1104796800 + i * DAY, open: o, high: h, low: l, close: c });
// 25 quiet candles drifting down, so a pattern on candle 25+ sits at a 10-day low
const base = () => Array.from({ length: 25 }, (_, i) => { const m = 110 - i * 0.2; return bar(i, m + 0.1, m + 0.5, m - 0.5, m - 0.1); });

test('the pre-registered numbers and market set', () => {
  assert.equal(P.LOOK, 10); assert.equal(P.ATR, 20); assert.equal(P.BUF, 0.1); assert.equal(P.TARGET, 2); assert.equal(P.HOLD, 5);
  assert.equal(P.DRAWS, 40); assert.equal(MARKETS.length, 28); assert.ok(!MARKETS.some((k) => k.startsWith('xau')));
  assert.equal(PATTERNS.length, 6);
});

test('each pattern on hand-made candles, and its mirror does not fire', () => {
  const D = [bar(0, 10, 10.2, 8.9, 9), bar(1, 8.8, 10.6, 8.7, 10.5)];
  assert.equal(match('beng', D, 1), 2); assert.equal(match('seng', D, 1), 0);
  const S = [bar(0, 9, 10.2, 8.9, 10), bar(1, 10.2, 10.3, 8.6, 8.8)];
  assert.equal(match('seng', S, 1), 2); assert.equal(match('beng', S, 1), 0);
  // a body that only equals the first does not engulf
  assert.equal(match('beng', [bar(0, 10, 10.1, 8.9, 9), bar(1, 9, 10.1, 8.9, 10)], 1), 0);
  const H = [bar(0, 10, 10.05, 7, 9.9)];            // body 0.1, lower 2.9, upper 0.05 of range 3.05
  assert.equal(match('ham', H, 0), 1); assert.equal(match('star', H, 0), 0);
  const St = [bar(0, 10, 13, 9.95, 10.1)];
  assert.equal(match('star', St, 0), 1); assert.equal(match('ham', St, 0), 0);
  const M = [bar(0, 12, 12.1, 9.9, 10), bar(1, 9.9, 10, 9.5, 9.8), bar(2, 9.9, 11.6, 9.8, 11.5)];
  assert.equal(match('mst', M, 2), 3); assert.equal(match('est', M, 2), 0);
  const E = [bar(0, 10, 12.1, 9.9, 12), bar(1, 12.1, 12.5, 12, 12.2), bar(2, 12.1, 12.2, 10.4, 10.5)];
  assert.equal(match('est', E, 2), 3); assert.equal(match('mst', E, 2), 0);
  // the third candle must close past the first body's midpoint
  assert.equal(match('mst', [M[0], M[1], bar(2, 9.9, 10.9, 9.8, 10.8)], 2), 0);
});

test('the context filter: a bullish pattern only at a 10-day low', () => {
  const D = base(); const lo = D[24].low;
  D.push(bar(25, lo + 0.1, lo + 0.15, lo - 1, lo));       // a hammer making a new 10-day low
  assert.equal(signals(D, 'ham').length, 1);
  const U = base(); U.push(bar(25, 120, 120.05, 119, 119.95)); // the same shape far above the range
  assert.equal(signals(U, 'ham').length, 0);
  assert.equal(signals(U, 'ham', { context: false }).length, 1);
});

test('no look-ahead: a signal and its stop do not change when later candles change', () => {
  const D = base(); const lo = D[24].low;
  D.push(bar(25, lo + 0.1, lo + 0.15, lo - 1, lo));
  for (let i = 26; i < 32; i++) D.push(bar(i, lo, lo + 0.3, lo - 0.3, lo));
  const a = signals(D, 'ham'), ta = trade(D, a[0]);
  const D2 = D.map((b, i) => (i > 25 ? { ...b, open: b.open + 5, high: b.high + 50, low: b.low - 50, close: b.close * 3 } : b));
  const b = signals(D2, 'ham'), tb = trade(D2, b[0]);
  assert.deepEqual(a, b); assert.equal(ta.stop, tb.stop);
  for (const id of PATTERNS.map((p) => p.id)) assert.deepEqual(signals(D.slice(0, 26), id), signals(D, id).filter((s) => s.i <= 25));
});

test('the trade: next open, stop past the extreme by 0.1 ATR, 2R target, stop first, five candles', () => {
  const D = base(); const lo = D[24].low;
  D.push(bar(25, lo + 0.1, lo + 0.15, lo - 1, lo));
  D.push(bar(26, lo + 0.2, lo + 0.4, lo + 0.1, lo + 0.3));
  for (let i = 27; i < 35; i++) D.push(bar(i, lo + 0.3, lo + 0.4, lo + 0.2, lo + 0.3));
  const s = signals(D, 'ham')[0], tr = trade(D, s);
  assert.equal(tr.entry, D[26].open); assert.ok(tr.stop < s.ext && tr.stop < tr.entry);
  assert.equal(tr.why, 'time'); assert.equal(tr.ix, 30); assert.equal(tr.exit, D[30].close);
  // a candle that touches both stop and target is a stop
  const W = D.slice(0, 27); W.push(bar(27, tr.entry, tr.entry + 10, tr.stop - 1, tr.entry));
  const tw = trade(W, s); assert.equal(tw.why, 'stop'); assert.ok(Math.abs(tw.g + 1) < 1e-9);
  // an open beyond the target exits at that open
  const G = D.slice(0, 27); G.push(bar(27, tr.entry + 5, tr.entry + 6, tr.entry + 4, tr.entry + 5));
  const tg = trade(G, s); assert.equal(tg.why, 'target'); assert.equal(tg.exit, tr.entry + 5);
  // an entry that opens past the stop is no trade
  const X = D.slice(0, 26); X.push(bar(26, lo - 3, lo - 2, lo - 4, lo - 3)); assert.equal(trade(X, s), null);
  // costs and financing only take away
  const n = net(tr, 'spx500'); assert.ok(n.n < tr.g && n.cost > 0);
});

test('one position at a time per market', () => {
  const D = base(); const lo = D[24].low;
  D.push(bar(25, lo + 0.1, lo + 0.15, lo - 1, lo));            // hammer at a 10-day low
  D.push(bar(26, lo, lo + 0.05, lo - 1.05, lo - 0.02));         // another, inside the first one's stop, while it is open
  for (let i = 27; i < 40; i++) D.push(bar(i, lo - 0.3, lo - 0.1, lo - 0.6, lo - 0.3));
  const all = signals(D, 'ham'), s = stream(D, ['ham']);
  assert.ok(all.length >= 2); assert.equal(s.length, 1);
});

test('Holm and the two-sided p', () => {
  assert.deepEqual(holm([0.5, 0.01]), [0.5, 0.02]);
  assert.ok(Math.abs(p2(1.96) - 0.05) < 0.001); assert.equal(p2(null), 1);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/candle-patterns/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/candle-patterns/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL, 0 of 14:/);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict')); assert.ok(line.length < 220 + 4);
  assert.equal(r.tests.length, 14);
  const f = (v, d = 3) => (v > 0 ? '+' : '') + v.toFixed(d);
  for (const t of r.tests) {
    const row = `| ${t.id} ${t.name} | ${t.is.n} | ${f(t.is.gross)} / ${f(t.is.net)} | ${f(t.is.tGross, 2)} / ${f(t.is.tNet, 2)} | ${t.oos.n} | ${f(t.oos.gross)} / ${f(t.oos.net)} | ${f(t.oos.tGross, 2)} / ${f(t.oos.tNet, 2)} | ${f(t.oos.x2)} | ${t.holm.toFixed(3)} |`;
    assert.ok(md.includes(row), t.id);
    assert.ok(!(t.oos.tNet >= 2 && t.holm < 0.05), t.id + ' does not pass');
  }
  assert.ok(md.includes(`${r.placebo.atOrAboveT1} of 40 draws`));
  assert.ok(md.includes(`seed ${r.placebo.seed}`));
});
