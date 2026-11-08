// node --test tests/lit-replay.test.mjs — the LIT replay over the last two months (paper research for the owner to study)
import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, fetchBars } from '../council/lit-replay.mjs';

const NOW = Date.UTC(2026, 10, 6, 12) / 1000;   // a Friday noon UTC
function synth(days) {   // 5m gold candles, a slow random walk through the sessions, deterministic
  const out = []; let px = 4000, a = 20261108;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 2 ** 32 - 0.5; };
  for (let t = NOW - days * 86400; t < NOW; t += 300) { const o = px, c = px + rnd() * 3; out.push({ time: t, open: o, high: Math.max(o, c) + Math.abs(rnd()), low: Math.min(o, c) - Math.abs(rnd()), close: c }); px = c; }
  return out;
}
test('replay: the window, the funnel, every setup with a reason or an order, the variants; prices come back positive', () => {
  const out = replay(replayBars(synth(80)), { days: 63, now: NOW });
  assert.equal(out.from, '2026-09-04'); assert.equal(out.to, '2026-11-06'); assert.ok(out.bars > 15000);
  for (const k of ['sweeps', 'eqh', 'inSession', 'withAcc', 'premium', 'fbos']) assert.ok(k in out.funnel);
  assert.ok(Array.isArray(out.setups) && Array.isArray(out.trades) && out.variants && typeof out.stats === 'object');
  for (const s of out.setups) { assert.ok(s.t >= NOW - 63 * 86400); assert.ok(s.levelPx > 0 && s.accLow > 0 && s.accHigh >= s.accLow); assert.ok(s.why || s.order); if (s.order) { assert.ok(s.order.entry > 0 && s.order.stop > 0 && s.order.target > 0); if (s.side === 'sell') assert.ok(s.order.stop > s.order.entry && s.order.target < s.order.entry); else assert.ok(s.order.stop < s.order.entry && s.order.target > s.order.entry); } }
  for (const x of out.trades) { assert.ok(x.entry > 0 && x.exit > 0 && x.stop > 0 && typeof x.Rnet === 'number'); }
  assert.match(out.note, /Paper research/);
  // the study sets: labelled, with fills and gated trades, prices positive, stop on the right side
  assert.deepEqual(Object.keys(out.study), ['loose-limit', 'market-break']);
  for (const S of Object.values(out.study)) { assert.ok(S.label && S.desc && S.build && S.fills && S.gated); for (const x of S.fills.trades) { assert.ok(x.entry > 0 && x.stop > 0 && x.target > 0 && x.tExit >= x.t); if (x.side === 'sell') assert.ok(x.stop > x.entry); else assert.ok(x.stop < x.entry); } assert.ok(S.gated.n <= S.fills.n); }
});
test('fetchBars: windows are stitched, deduplicated, the forming candle dropped', async () => {
  const calls = [];
  const fetchFn = async (url) => { const u = new URL(url); const from = +u.searchParams.get('from'), to = +u.searchParams.get('to'); calls.push([from, to]);
    const bars = []; for (let t = Math.floor(from / 300) * 300; t <= to; t += 300) bars.push({ time: t, open: 4000, high: 4001, low: 3999, close: 4000.5, live: t + 300 > NOW });
    return { ok: true, json: async () => ({ bars }) }; };
  const bars = await fetchBars(10, fetchFn, NOW);
  assert.ok(calls.length >= 2); assert.ok(bars.every((b, i) => !i || b.t > bars[i - 1].t));   // sorted, unique
  assert.ok(bars.at(-1).t + 300 <= NOW);
});
function replayBars(rows) { return rows.map((b) => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close })).filter((b) => { const d = new Date(b.t * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 22) || (wd === 5 && h >= 21)); }); }
