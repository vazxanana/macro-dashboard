// Macro desk "Before you trade" (18 Nov 2026, owner: "I want people to be able to use it to take or decide for trades").
// Runs the page's own pure block (window.MD_CHECK) on a hand-made reading: leans, release timing, stops on the losing side only,
// the stop against a normal day, gold's levels, positioning with the yen's inverted sign, and wording that never calls an edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const PAGE = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const a = PAGE.indexOf('  var MD_CHECK = window.MD_CHECK = (function () {'), b = PAGE.indexOf('  var TC = { side:');
const window = {}; new Function('window', PAGE.slice(a, b))(window);
const C = window.MD_CHECK;
const NOW = Date.parse('2026-11-18T12:00:00Z');
const fc = { goldScore: { ok: true, score: -0.95 }, regime: { vix: 18, vixTermRatio: 0.9 },
  assets: { gold: { pUp: 0.56, last: 4000, expMovePct: 1.2, volRatio: 1 }, eurusd: { pUp: 0.5, last: 1.1, expMovePct: 0.4, volRatio: 1.4 },
    usdjpy: { pUp: 0.44, last: 150, expMovePct: 0.5, volRatio: 1 }, nq: { pUp: 0.5, last: 20000, expMovePct: 1.5 }, es: { pUp: 0.5, last: 6000, expMovePct: 1 } },
  playbook: [{ at: '2026-11-18T12:30:00Z', country: 'USD', title: 'CPI m/m' }, { at: '2026-11-19T06:00:00Z', country: 'EUR', title: 'German PMI' }] };
const v = { summary: { levels: { above: { price: 4050, label: 'Round number' }, below: { price: 3950, label: '20-day average' }, mark: { px: 4000 } } } };
const cot = { markets: [{ k: 'gold', pct1y: 95, who: 'managed money', asOf: '2026-11-10' }, { k: 'jpy', pct1y: 95, who: 'leveraged funds' }] };

test('leans: up / down / none from pUp, and "today" lists the release and positioning per market', () => {
  assert.equal(C.lean({ pUp: 0.56 }), 'up'); assert.equal(C.lean({ pUp: 0.44 }), 'down'); assert.equal(C.lean({ pUp: 0.52 }), 'flat');
  const g = C.today('gold', fc, v, cot, NOW); assert.equal(g.next.title, 'USD CPI m/m'); assert.equal(g.cot.crowded, 'buy');
  // yen futures longs crowded = crowded on the USD/JPY sell side (council/cot.mjs sign -1); EUR events reach EUR/USD only
  const j = C.today('usdjpy', fc, v, cot, NOW); assert.equal(j.cot.crowded, 'sell');
  assert.equal(C.today('eurusd', fc, v, cot, NOW + 2 * 36e5).next.title, 'EUR German PMI');
  assert.equal(C.today('nq', fc, v, cot, NOW + 2 * 36e5).next, null, 'a EUR release is not an index event');
});

test('a release within the hour means wait; the stop must be on the losing side; the stop is set against a normal day', () => {
  const r = C.check({ market: 'gold', side: 'buy', entry: '4000', stop: '3998', target: '4080' }, fc, v, cot, NOW);
  assert.equal(r.verdict.state, 'wait'); assert.match(r.verdict.text, /CPI/);
  const stop = r.rows.find((x) => x.k === 'stop'); assert.equal(stop.state, 'caution'); assert.match(stop.text, /inside ordinary noise/); assert.match(stop.text, /Target 40R/);
  const lv = r.rows.find((x) => x.k === 'level'); assert.equal(lv.state, 'caution'); assert.match(lv.text, /\$4,050/);
  assert.equal(r.rows.find((x) => x.k === 'score').state, 'against', 'a low Gold Macro Score does not support a buy');
  assert.equal(r.rows.find((x) => x.k === 'cot').state, 'caution', 'crowded on the same side');
  const bad = C.check({ market: 'gold', side: 'buy', entry: '4000', stop: '4010' }, fc, v, cot, NOW + 5 * 36e5);
  assert.match(bad.err, /stop must be below the entry/); assert.equal(bad.rows.some((x) => x.k === 'stop'), false, 'no stop reading from a wrong-side stop');
  const sell = C.check({ market: 'gold', side: 'sell', entry: '4000', stop: '4040' }, fc, v, cot, NOW + 30 * 36e5);
  assert.equal(sell.rows.find((x) => x.k === 'score').state, 'neutral', 'the score never calls a sell');
  assert.equal(sell.rows.find((x) => x.k === 'event').state, 'clear'); assert.equal(sell.verdict.state, 'against');
});

test('the wording never calls a reading an edge, a signal or advice to take the trade', () => {
  const r = C.check({ market: 'eurusd', side: 'buy', stop: '1.09' }, fc, v, cot, NOW + 30 * 36e5);
  const all = JSON.stringify(r) + PAGE.slice(PAGE.indexOf('id="s-trade"'), PAGE.indexOf('<!-- 2. Next release'));
  assert.doesNotMatch(all, /take (this|the) trade|proven edge|guarantee/i);
  assert.match(all, /not a signal/); assert.match(all, /no direction edge/);
  assert.equal(r.rows.find((x) => x.k === 'mood').state, 'caution', 'EUR/USD at 1.4x its usual moves');
});
