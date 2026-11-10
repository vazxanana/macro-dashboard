// Mosha cycle, second half (research/edge/mosha-cycle): the buy at the barrier on hand-made candles, and the committed result
// against the pre-registered verdict. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, VARIANTS, run } from '../research/edge/mosha-cycle/run.mjs';
import { K as KR } from '../research/edge/mosha-retrace/run.mjs';
import { verdictOf } from '../research/edge/mosha-level/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const R = JSON.parse(rd('../research/edge/mosha-cycle/result.json')), PRE = rd('../research/edge/mosha-cycle/PREREGISTRATION.md'), RUN = rd('../research/edge/mosha-cycle/run.mjs'), MD = rd('../research/edge/mosha-cycle/RESULT.md');
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });
const agg = (M5, sec) => { const out = []; for (const b of M5) { const k = Math.floor(b.time / sec) * sec, c = out.at(-1); if (!c || c.time !== k) out.push({ time: k, open: b.open, high: b.high, low: b.low, close: b.close }); else { c.high = Math.max(c.high, b.high); c.low = Math.min(c.low, b.low); c.close = b.close; } } return out; };

// an H4 BO buy, a retracement that reaches the engulf barrier, an H1 BO back up, a retest that fills the buy limit, a run to the old high
function market(reach = true) {
  const M5 = []; let t = 0;
  const flat = (n, px) => { for (let i = 0; i < n; i++, t += 300) M5.push(bar(t, px, px + 0.4, px - 0.4, px)); };
  const leg = (n, a, b) => { for (let i = 0; i < n; i++, t += 300) { const o = a + ((b - a) * i) / n, c = a + ((b - a) * (i + 1)) / n; M5.push(bar(t, o, Math.max(o, c) + 0.3, Math.min(o, c) - 0.3, c)); } };
  flat(48 * 12, 100);
  leg(48 * 4, 100, 110); leg(48 * 3, 110, 106); leg(48 * 2, 106, 108);   // an H4 swing high near 110
  leg(48, 108, 104); leg(48, 104, 113);        // a red H4 candle, then a green one closing above its high AND above the swing: engulf barrier (top 108.3) and H4 BO buy
  leg(36, 113, 124); leg(12, 124, 126);        // the leg up: high 126.3 (its last hour stays above the retracement's first low)
  leg(12, 126, 123.5); leg(12, 123.8, 125.5); leg(12, 125.5, 121);   // H1 swing low 123.2, a lower high, a close below: the retracement starts
  if (!reach) { leg(48, 121, 112); leg(96, 112, 140); return M5; }   // never reaches 108.3
  leg(84, 121, 107.5);                         // down into the barrier (tap), not through its bottom
  leg(12, 107.5, 109.5); leg(12, 109.2, 108.2); leg(12, 108.2, 112);   // H1 swing high 109.8, a higher low, a close above: H1 BO buy
  leg(6, 112, 109.7); flat(3, 109.6);          // the retest of the broken H1 level fills the limit, above the stop
  leg(96, 110, 128); flat(48, 128);            // back up through the old high
  return M5;
}
const ctx = (M5) => ({ M5, M15: agg(M5, 900), H1: agg(M5, 3600), H4: agg(M5, 14400), F: M5, W: [] });

test('the constants are the pre-registered ones and come from the first half', () => {
  assert.deepEqual([K.W4, K.W1, K.BASE, K.PAD, K.MIN_R0, K.MIN_RR, K.LEVEL_AGE, K.WAIT], [KR.W4, KR.W1, KR.BASE, KR.PAD, KR.MIN_R0, KR.MIN_RR, KR.LEVEL_AGE, 72 * 3600]);
  for (const s of ['`W4 = 3`', '`W1 = 1`', '`BASE = 3`', '`PAD = $0.30`', '`WAIT = 72 h`', '`VALID = 24 h`', '`HOLD = 72 h`', '`MIN_R0 = $1.00`', '`MIN_RR = 2`']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(Object.keys(VARIANTS), ['P', 'Z', 'M15', 'T3']);
});

test('the cycle: retracement into the barrier, H1 BO back, buy limit with a stop below, target the old high', () => {
  const { orders, funnel, cycles } = run(ctx(market()), 'P');
  assert.ok(funnel.taps >= 1 && funnel.h1back >= 1);
  const o = orders.find((x) => x.side === 1);
  assert.ok(o, 'a buy was placed'); assert.equal(o.status, 'closed');
  assert.ok(o.stop < o.entry && o.target > o.entry);                              // a stop on the right side, always
  assert.ok(o.h4At < o.retraceAt && o.retraceAt < o.tapAt && o.tapAt <= o.placed); // the order of the chain
  assert.ok(o.barrier > 108 && o.barrier < 108.6);                                 // the engulf zone's top
  assert.ok(Math.abs(o.target - 126.3) < 0.01);                                    // the high the retracement came from
  assert.ok(o.r0 >= K.MIN_R0 && o.target - o.entry >= K.MIN_RR * o.r0);
  assert.equal(o.exit, 'target'); assert.ok(o.net > 0);
  assert.ok(cycles.some((c) => c.stage === 'order'));
  for (const v of Object.keys(VARIANTS)) for (const x of run(ctx(market()), v).orders) assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry, v);
  const z = run(ctx(market()), 'Z').orders.find((x) => x.side === 1); if (z) assert.ok(z.stop < o.stop);   // the stop under the barrier is the wider one
});

test('no tap, no trade: a retracement that never reaches the barrier places nothing on that cycle', () => {
  const { orders, cycles } = run(ctx(market(false)), 'P');
  assert.equal(orders.filter((x) => x.side === 1 && x.barrier > 108 && x.barrier < 108.6).length, 0);
  assert.ok(cycles.some((c) => c.stage === 'retracement' && c.barrier > 108 && c.barrier < 108.6));
});

test('the committed result is the pre-registered verdict on its own numbers', () => {
  assert.equal(R.topic, 'mosha-cycle'); assert.equal(R.variantsTried, 4);
  const P = R.variants.P, v = verdictOf(P);
  assert.equal(R.primary.verdict, v.verdict); assert.ok(R.verdict.startsWith(v.verdict + ':'));
  assert.equal(P.filled, P.all.n); assert.equal(P.is.n + P.oos.n, P.all.n); assert.equal(P.orders, P.filled + P.missed + P.expired);
  assert.equal(R.trades.length, P.all.n); assert.ok(Math.abs(R.trades.reduce((a, t) => a + t.R, 0) - P.all.total) < 0.05);
  for (const k of Object.keys(R.variants)) { const x = R.variants[k]; assert.ok(x.pHolm >= x.p && x.pHolmAll >= x.pHolm); }
  const first = JSON.parse(rd('../research/edge/mosha-retrace/result.json'));
  assert.equal(R.cycle.retrace.n, first.variants.P.all.n); assert.equal(R.cycle.retrace.total, first.variants.P.all.total);   // the first half, re-run here, is the published one
  assert.equal(R.cycle.barrier.n, P.all.n); assert.equal(R.cycle.both.n, R.cycle.retrace.n + R.cycle.barrier.n);
  assert.ok(Math.abs(R.cycle.both.total - (R.cycle.retrace.total + R.cycle.barrier.total)) < 0.05);
  assert.ok(MD.includes(`**Verdict: ${v.verdict}.`)); assert.ok(MD.includes(`| ${P.all.n} |`)); assert.ok(MD.includes('−' + Math.abs(P.all.avg).toFixed(3)));
  assert.ok(MD.includes(`| ${R.cycle.both.n} |`));
});

test('paper research only: candles in, its own files out', () => {
  assert.ok(!/council\/|api\/|child_process|histToUtc|histStampUtc/.test(RUN));
  assert.ok(!/process\.env\.(?!GOLD_|OUT_DIR|MD_BASE)/.test(RUN));
  assert.ok(RUN.includes('path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)'));
});
