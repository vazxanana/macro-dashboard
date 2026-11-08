// Trade replay (market-structure.html, script#ms-trv-js): the #trade/<id> deep link and the stop's path, run without a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const src = html.match(/<script id="ms-trv-js">([\s\S]*?)<\/script>/)[1];
const W = {};
vm.runInNewContext(src, { window: W });
const T = W.MS_TRV;
const plain = (v) => JSON.parse(JSON.stringify(v));   // arrays made in the vm context are another realm's

test('parse: #trade/<id> and #trade/<id>/<tf>', () => {
  assert.deepEqual({ ...T.parse('#trade/xau-rscalp-1793563759') }, { id: 'xau-rscalp-1793563759', tf: null });
  assert.deepEqual({ ...T.parse('#trade/xau-rscalp-1793563759/M15') }, { id: 'xau-rscalp-1793563759', tf: '15m' });
  assert.deepEqual({ ...T.parse('trade/es-s-1754564400-r/h4') }, { id: 'es-s-1754564400-r', tf: '4h' });
  assert.deepEqual({ ...T.parse('#trade/replay-xau-gtl-1767600000/5m/') }, { id: 'replay-xau-gtl-1767600000', tf: '5m' });
  assert.equal(T.parse('#trade/x/W1').tf, null);                         // unknown timeframe: the viewer picks one
  assert.equal(T.parse('#trade/nq-b-1754010000-r%2Fx'), null);           // an encoded slash is not an id
});

test('parse: anything else is not a trade link', () => {
  for (const h of ['', '#', '#council/trades', '#trade', '#trade/', '#trades/xau-1', '#trade/<b>', '#trade/%E0%A4%A', '#trade/a/b/c', null, undefined]) assert.equal(T.parse(h), null, String(h));
});

test('href round-trips through parse', () => {
  for (const [id, tf] of [['xau-rscalp-1793563759', null], ['nq-b-1754010000-r', '15m'], ['replay-sol-trend-1673308800', '4h'], ['a.b:c_d-1', '1h']]) {
    const h = T.href(id, tf), p = T.parse(h);
    assert.equal(p.id, id); assert.equal(p.tf, tf);
  }
  assert.equal(T.href('xau-rscalp-1', '15m'), '#trade/xau-rscalp-1/M15');
});

test('desk: ICT records go to the ICT desk, the rest to the council viewer', () => {
  assert.equal(T.desk('nq-b-1754010000-r'), 'ict'); assert.equal(T.desk('es-s-1793995200'), 'ict'); assert.equal(T.desk('gc-b-1793995200'), 'ict');
  assert.equal(T.desk('xau-rscalp-1793563759'), 'council'); assert.equal(T.desk('replay-nq-nyflip-2022-12-28'), 'council'); assert.equal(T.desk('nq-open-1793995200'), 'council');
});

const bar = (time, low, high) => ({ time, open: low, high, low, close: high });
test('trail: break-even at +1.5R, then 1.5R behind the best price from +2R, never loosens, ends on the touch', () => {
  // buy 100, stop 90 (r0 10): +1R, +1.6R (break-even), +3R (stop 115), pull back (stop stays), touch 115
  const r = T.trail({ side: 1, entry: 100, stop: 90, trail: [2, 1.5], be: 1.5, bars: [bar(1, 95, 110), bar(2, 104, 116), bar(3, 112, 130), bar(4, 120, 125), bar(5, 114, 121), bar(6, 100, 110)] });
  assert.deepEqual(plain(r.pts.map((p) => p.value)), [90, 90, 100, 115, 115]);
  assert.equal(r.last, 115); assert.equal(r.moved, true);
});

test('trail: a sell mirrors it; nothing moves below the threshold; ATR-style trails ([1e6, 0]) are not rebuilt', () => {
  const s = T.trail({ side: -1, entry: 100, stop: 110, trail: [2, 1], bars: [bar(1, 95, 104), bar(2, 75, 98), bar(3, 80, 92)] });
  assert.deepEqual(plain(s.pts.map((p) => p.value)), [110, 110, 85]); assert.equal(s.last, 85);
  const flat = T.trail({ side: 1, entry: 100, stop: 90, trail: [2, 1], bars: [bar(1, 95, 112), bar(2, 96, 115)] });
  assert.equal(flat.moved, false);
  assert.equal(T.trail({ side: 1, entry: 100, stop: 90, trail: [1e6, 0], bars: [bar(1, 95, 500)] }).moved, false);
});

test('stopPath: recorded path wins; rebuilt only when the rule can move the stop', () => {
  const data = [bar(10, 95, 110), bar(20, 104, 116), bar(30, 112, 130)];
  const rec = T.stopPath({ entry: 100, stop: 90, side: 'buy', stops: [[5, 90], [15, 100], [25, 112]] }, data, 0, -1, {});
  assert.equal(rec.kind, 'recorded'); assert.deepEqual(plain(rec.pts.map((p) => p.value)), [90, 100, 112]);
  const rb = T.stopPath({ entry: 100, stop: 115, side: 'buy', r0: 10, trail: [2, 1.5] }, data, 0, -1, { stop0: 90 });
  assert.equal(rb.kind, 'rebuilt'); assert.equal(rb.last, 115);
  assert.equal(T.stopPath({ entry: 100, stop: 90, side: 'buy' }, data, 0, -1, {}), null);   // fixed stop and target: nothing to draw
});

test('agg: M5 -> M15 candles', () => {
  const m5 = [0, 300, 600, 900].map((t, i) => ({ time: t, open: 10 + i, high: 12 + i, low: 9 - i, close: 11 + i }));
  assert.deepEqual(plain(T.agg(m5, 900)), [{ time: 0, open: 10, high: 14, low: 7, close: 13 }, { time: 900, open: 13, high: 15, low: 6, close: 14 }]);
});

test('blocker names and the note strip are escaped', () => {
  assert.equal(T.blockName('d1'), 'Against the D1 rule'); assert.equal(T.blockName('new-rule'), 'New rule');
  const h = T.nbHtml({ shadow: true, blockedBy: ['news', '<x>'], note: 'a < b' }, true);
  assert.match(h, /Shadow: blocked by/); assert.match(h, /High-impact news/); assert.match(h, /&lt;x&gt;/); assert.match(h, /a &lt; b/);
  assert.equal(T.nbHtml({ blockedBy: [] }, false), '');
});
