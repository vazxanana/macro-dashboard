// Mosha retracement chain study (research/edge/mosha-retrace): the chain's pieces on hand-made candles, and the committed result
// against the pre-registered verdict. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, VARIANTS, boEvents, run, weeklyEvents } from '../research/edge/mosha-retrace/run.mjs';
import { K as K0, verdictOf } from '../research/edge/mosha-level/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/mosha-retrace/result.json', import.meta.url)));
const FIRST = JSON.parse(fs.readFileSync(new URL('../research/edge/mosha-level/result.json', import.meta.url)));
const PRE = fs.readFileSync(new URL('../research/edge/mosha-retrace/PREREGISTRATION.md', import.meta.url), 'utf8');
const RUN = fs.readFileSync(new URL('../research/edge/mosha-retrace/run.mjs', import.meta.url), 'utf8');
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

test('the constants are the pre-registered ones and the shared ones come from mosha-level', () => {
  assert.deepEqual([K.W4, K.W1, K.BASE, K.PAD, K.MIN_R0, K.MIN_RR, K.TOL, K.TAP_WINDOW], [3, 1, K0.BASE, K0.PAD, K0.MIN_R0, K0.MIN_RR, K0.TOL, 86400]);
  for (const s of ['`W4 = 3`', '`W1 = 1`', '`BASE = 3`', '`PAD = $0.30`', '`VALID = 24 h`', '`HOLD = 72 h`', '`MIN_R0 = $1.00`', '`MIN_RR = 2`']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(Object.keys(VARIANTS), ['P', 'M15', 'A', 'K', 'T3']);
});

test('BO events: a close beyond the last swing that existed when the candle opened, each level once', () => {
  const B = [bar(0, 10, 11, 9, 10), bar(1, 10, 12, 10, 11), bar(2, 11, 11.5, 9.8, 11), bar(3, 11, 13, 10.8, 12.5), bar(4, 12.5, 14, 12, 13.5), bar(5, 13.5, 13.8, 9.5, 9.6)];
  const ev = boEvents(B, 1, 1);
  assert.deepEqual(ev.map((e) => [e.t, e.dir, e.level]), [[4, 1, 12], [6, -1, 9.8]]);   // candle 3 closes above the high of candle 1; candle 4 does not repeat it; candle 5 closes below the low of candle 2
  assert.equal(ev[0].born, 3); assert.equal(ev[1].born, 4);                                // a swing exists from the close of the candle after it
  assert.equal(boEvents(B.slice(0, 3), 1, 1).length, 0);                                   // candle 2 cannot break a swing that only exists once it has closed
});

// a small market: an H4 BO buy, an H1 BO sell after it, a retest that fills the limit, then the barrier
function market() {
  const M5 = [], add = (t, o, h, l, c) => M5.push(bar(t, o, h, l, c));
  let t = 0; const flat = (n, px) => { for (let i = 0; i < n; i++, t += 300) add(t, px, px + 0.4, px - 0.4, px); };
  const leg = (n, a, b) => { for (let i = 0; i < n; i++, t += 300) { const o = a + ((b - a) * i) / n, c = a + ((b - a) * (i + 1)) / n; add(t, o, Math.max(o, c) + 0.3, Math.min(o, c) - 0.3, c); } };
  flat(48 * 12, 100);            // 4 days flat
  leg(48, 100, 96); leg(48, 96, 104);   // a red H4 candle, then a green one closing above its high: a bullish engulf zone under price
  leg(48 * 4, 104, 120); leg(48 * 3, 120, 114); leg(48 * 4, 114, 118);   // an H4 swing high near 120
  leg(48, 118, 126);             // H4 close above it: H4 BO buy
  leg(12, 126, 123.5); leg(12, 123.8, 125.5); leg(12, 125.5, 121);   // H1: a swing low at 123.2, a lower high, a close below: H1 BO sell
  leg(6, 121, 123.8); flat(3, 124.2);   // the retest of the broken level (fills the limit, stays under the stop)
  leg(120, 124, 100);            // down through the barrier
  flat(48, 100);
  return M5;
}
const agg = (M5, sec) => { const out = []; for (const b of M5) { const k = Math.floor(b.time / sec) * sec, c = out.at(-1); if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } } return out; };

test('the chain: H4 BO, the first H1 BO against it, a limit at the broken H1 level, the barrier as target', () => {
  const M5 = market(), C = { M5, M15: agg(M5, 900), H1: agg(M5, 3600), H4: agg(M5, 14400), F: M5, W: [] };
  const { orders, funnel } = run(C, 'P');
  assert.ok(funnel.signals >= 1);
  const o = orders.find((x) => x.side === -1 && x.status === 'closed');
  assert.ok(o, 'a sell was placed and filled');
  assert.ok(o.stop > o.entry && o.target < o.entry);                              // a stop on the right side, always
  assert.ok(o.r0 >= K.MIN_R0 && (o.entry - o.target) >= K.MIN_RR * o.r0);
  assert.ok(o.placed > o.h4At);                                                    // the H1 BO comes after the H4 BO
  assert.ok(o.breakAt != null && o.breakAt < o.placed);                            // the M5 break candle sits inside the H1 BO candle
  assert.equal(o.exit, 'target'); assert.ok(o.net > 0);
  for (const x of orders) assert.ok(x.side < 0 ? x.stop > x.entry : x.stop < x.entry);
  const used = new Set(orders.map((x) => x.h4At)); assert.equal(used.size, orders.length);   // one signal per H4 BO
  assert.equal(run(C, 'A').orders.length, 0);                                      // no weekly direction known: the weekly variant places nothing
  assert.ok(run(C, 'T3').orders.every((x) => Math.abs(Math.abs(x.target - x.entry) / x.r0 - 3) < 0.01));
});

test('weekly events: weeks start on Monday and a Sunday candle belongs to the week that follows', () => {
  const mon = Date.UTC(2026, 0, 5) / 1000, H = [];
  const at = (w) => (w < 8 ? 100 + 5 * w : w < 14 ? 135 - 5 * (w - 7) : w < 24 ? 105 + 6 * (w - 13) : 165 - 7 * (w - 23));   // up, down, up through the old high, down
  for (let w = 0; w < 30; w++) for (let d = -1; d < 5; d++) { const px = at(w); H.push(bar(mon + w * 604800 + d * 86400, px, px + 2, px - 2, px + 1)); }
  const ev = weeklyEvents(H);
  assert.ok(ev.length >= 1); for (const e of ev) { assert.equal((e.t - mon) % 604800, 0); assert.ok(e.dir === 1 || e.dir === -1); }
});

test('the committed result is the pre-registered verdict on its own numbers', () => {
  assert.equal(R.topic, 'mosha-retrace'); assert.equal(R.variantsTried, 5);
  const P = R.variants.P, v = verdictOf(P);
  assert.equal(R.primary.verdict, v.verdict); assert.ok(R.verdict.startsWith(v.verdict + ':'));
  assert.equal(P.filled, P.all.n); assert.equal(P.is.n + P.oos.n, P.all.n); assert.equal(P.sells.n + P.buys.n, P.all.n);
  assert.equal(Object.values(P.exits).reduce((a, b) => a + b, 0), P.all.n);
  assert.equal(R.trades.length, P.all.n); assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - P.all.total) < 0.05);
  assert.equal(P.orders, P.filled + P.missed + P.expired);
  for (const k of Object.keys(R.variants)) { const x = R.variants[k]; assert.ok(x.pHolm >= x.p && x.pHolmNine >= x.pHolm); assert.ok(x.funnel.signals === P.funnel.signals); }
  assert.equal(Object.keys(R.variants).length + Object.keys(FIRST.variants).length, 9);
  const md = fs.readFileSync(new URL('../research/edge/mosha-retrace/RESULT.md', import.meta.url), 'utf8');
  assert.ok(md.includes(`**Verdict: ${v.verdict} `)); assert.ok(md.includes(`| ${P.all.n} |`)); assert.ok(md.includes('+' + P.all.avg.toFixed(3)));
  assert.ok(/hypothesis, not a finding/.test(md));   // the M15 variant is never called an edge
});

test('paper research only: candles in, its own files out; mosha-level runs no mode when imported', () => {
  assert.ok(!/council\/(trader|ctrader|alerts|live)|api\/|child_process|histToUtc|histStampUtc/.test(RUN));
  assert.ok(!/process\.env\.(?!GOLD_|OUT_DIR|MD_BASE)/.test(RUN));
  const first = fs.readFileSync(new URL('../research/edge/mosha-level/run.mjs', import.meta.url), 'utf8');
  assert.ok(first.includes('path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)'));
  assert.ok(RUN.includes('path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)'));
});
