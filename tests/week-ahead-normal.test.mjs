// Week ahead: "A normal day now" for every market the strategist covers (frame.normalDays).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalDays } from '../council/week-ahead.mjs';

const FC = { assets: {
  es: { last: 7150.2, expMovePct: 1.12, volRatio: 1.79 }, nq: { last: 26192.8, expMovePct: 1.72, volRatio: 1.71 },
  usdjpy: { last: 158.782, expMovePct: 0.24, volRatio: 0.67 }, eurusd: { last: 1.09884, expMovePct: 0.31, volRatio: 1.08 },
  gold: { last: 3575.385, expMovePct: 1.44, volRatio: 1.01 } } };

test('units and rounding per market, in the fixed order', () => {
  const r = normalDays(FC);
  assert.deepEqual(r.map((x) => x.k), ['gold', 'eurusd', 'usdjpy', 'nq', 'es']);
  assert.deepEqual(r.map((x) => [x.move, x.unit]), [[51, '$'], [34, 'pips'], [38, 'pips'], [451, 'points'], [80, 'points']]);
  assert.equal(r[0].text, 'Gold: about ±$51 (±1.4%)');
  assert.equal(r[1].text, 'EUR/USD: about ±34 pips (±0.3%)');
  assert.equal(r[0].pct, 1.44); assert.equal(r[0].ratio, 1.01);
  const big = normalDays({ assets: { nq: { last: 26192.8, expMovePct: 5 } } })[0];
  assert.equal(big.text, 'NQ: about ±1,310 points (±5.0%)'); assert.equal(big.ratio, null);
});

test('the ratio wording: 1.3 and over, 0.75 and under, nothing in between', () => {
  const r = normalDays(FC);
  assert.equal(r[2].text, 'USD/JPY: about ±38 pips (±0.2%), quieter than usual');
  assert.equal(r[3].text, 'NQ: about ±451 points (±1.7%), 1.7x its usual');
  assert.equal(r[4].text, 'ES: about ±80 points (±1.1%), 1.8x its usual');
  const t = (v) => normalDays({ assets: { gold: { last: 4000, expMovePct: 1, volRatio: v } } })[0].text;
  assert.equal(t(1.3), 'Gold: about ±$40 (±1.0%), 1.3x its usual');
  assert.equal(t(1.29), 'Gold: about ±$40 (±1.0%)');
  assert.equal(t(0.75), 'Gold: about ±$40 (±1.0%), quieter than usual');
  assert.equal(t(0.76), 'Gold: about ±$40 (±1.0%)');
  for (const x of r) assert.ok(!/\b(buy|sell|up|down|edge)\b/i.test(x.text), x.text);
});

test('a missing or unusable asset is skipped; no forecast is an empty list', () => {
  const r = normalDays({ assets: { gold: { last: 4000, expMovePct: null }, eurusd: { last: null, expMovePct: 0.3 }, usdjpy: { last: 158, expMovePct: 'x' },
    nq: { last: 0, expMovePct: 1 }, es: { last: 7000, expMovePct: 1 }, btc: { last: 1, expMovePct: 1 } } });
  assert.deepEqual(r.map((x) => x.k), ['es']);
  for (const fc of [null, undefined, {}, { assets: null }, { assets: {} }]) assert.deepEqual(normalDays(fc), []);
});

test('build puts it on the frame and the page draws it as text', () => {
  const src = fs.readFileSync(new URL('../council/week-ahead.mjs', import.meta.url), 'utf8');
  assert.match(src, /frame\.normalDays = normalDays\(fc\)/);
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  const line = page.split('\n').find((l) => l.includes('F.normalDays'));
  assert.ok(line, 'renderAhead draws frame.normalDays');
  assert.match(line, /<b>A normal day now<\/b>/);
  assert.match(line, /<span class="wa-r">' \+ esc\(m\.text\) \+ '<\/span>/);
  assert.match(line, /A range for planning, not a forecast of direction\./);
  assert.equal((line.match(/\bm\.\w+/g) || []).join(), 'm.text', 'only the text, through esc');
});
