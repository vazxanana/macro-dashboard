// Mosha sweep, VR and CF study (research/edge/mosha-sweep): the detector's pieces on hand-made candles, and the committed result
// against the pre-registered verdict. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, ENTRIES, agg, h1Levels, simMarket, detect, book, summarize, verdictOf } from '../research/edge/mosha-sweep/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/mosha-sweep/PREREGISTRATION.md'), RUN = rd('../research/edge/mosha-sweep/run.mjs');
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

// a market with one clean setup: an H1 swing high at 110, a sweep of it to 111.3, an M5 VR, a CF, a further break and a retest
function market() {
  const M5 = []; let t = 0;
  const flat = (n, px) => { for (let i = 0; i < n; i++, t += 300) M5.push(bar(t, px, px + 0.2, px - 0.2, px)); };
  const leg = (n, a, b) => { for (let i = 0; i < n; i++, t += 300) { const o = a + ((b - a) * i) / n, c = a + ((b - a) * (i + 1)) / n; M5.push(bar(t, o, Math.max(o, c) + 0.1, Math.min(o, c) - 0.1, c)); } };
  flat(48 * 6, 100);
  leg(48, 100, 96); leg(48, 96, 102);                     // H4: a red candle then a green one closing above its high: a bullish engulf zone (top 100.1), the barrier below
  leg(48 * 3, 102, 104);
  leg(12, 104, 110); leg(12, 110, 107); leg(12, 107, 106); leg(12, 106, 106.5);   // an H1 swing high at 110.1 with lower highs after it
  leg(12, 106.5, 108);
  leg(6, 108, 109.5); leg(2, 109.5, 108.9); leg(4, 108.9, 111.2);   // a three-candle M5 swing low near 108.8, then the sweep above 110.1 to 111.3
  leg(4, 111.2, 110.4); leg(3, 110.4, 108.2);              // down: a close below the VR's low = the CF
  leg(2, 108.2, 108.9); leg(3, 108.9, 107.4);              // a small bounce (the next swing low), then a close below it: the zone of the next break
  leg(3, 107.4, 108.15); flat(2, 108.1);                   // the return to the zone: fills the limit, stays under its stop
  leg(60, 108.1, 99); flat(24, 99);                        // down to the barrier
  return M5;
}

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([K.WH, K.W5, K.BASE, K.PAD, K.MIN_R0, K.MIN_RR, K.COST], [2, 1, 3, 0.30, 1, 2, 0.30]);
  assert.deepEqual([K.LEVEL_AGE, K.EPISODE, K.STAGE2, K.ZONE_AGE], [10 * 86400, 12 * 3600, 24 * 3600, 30 * 86400]);
  for (const s of ['`WH = 2`', '`W5 = 1`', '`LEVEL_AGE = 10` days', '`EPISODE = 12 h`', '`STAGE2 = 24 h`', '`BASE = 3` candles', '`PAD = $0.30`', '`MIN_R0 = $1.00`', '`MIN_RR = 2`', '`ZONE_AGE = 30` days', '`VALID = 24 h`', '`HOLD = 72 h`']) assert.ok(PRE.includes(s), s);
  assert.deepEqual(Object.keys(ENTRIES), ['CF', 'ZONE']);
  assert.equal(new Date(K.FROM * 1000).toISOString().slice(0, 10), '2006-07-01'); assert.equal(new Date(K.SPLIT * 1000).toISOString().slice(0, 10), '2020-01-01');
});

test('H1 levels: a swing exists two candles later and dies on an H1 close through it', () => {
  const H = (i, o, h, l, c) => bar(i * 3600, o, h, l, c);
  const H1 = [H(0, 10, 11, 9, 10), H(1, 10, 12, 9.5, 11), H(2, 11, 15, 10.5, 13), H(3, 13, 14, 12, 12.5), H(4, 12.5, 13, 11, 11.5), H(5, 11.5, 15.5, 11, 14.8), H(6, 14.8, 16, 14, 15.6)];
  const a = h1Levels(H1).find((l) => l.side === -1 && l.p === 15);
  assert.ok(a); assert.equal(a.born, 5 * 3600);       // the close of the second candle after it
  assert.equal(a.dead, 7 * 3600);                     // candle 5 trades above it but closes below; candle 6 closes above
});

test('simMarket: the stop counts first, a gap through the stop exits at the open, time exit at 72 h', () => {
  const o = { side: -1, entry: 100, stop: 102, target: 96, r0: 2, placed: 0 }, m = (t, o_, h, l, c) => bar(t * 300, o_, h, l, c);
  assert.equal(simMarket([m(0, 100, 103, 95, 99)], o).exit, 'stop');
  let r = simMarket([m(0, 100, 101, 95.5, 96)], o); assert.equal(r.exit, 'target'); assert.equal(r.R, 2); assert.equal(r.net, +(2 - 0.30 / 2).toFixed(4));
  r = simMarket([m(0, 100, 101, 99, 100), m(1, 103, 104, 102.5, 103)], o); assert.equal(r.exit, 'stop (gap)'); assert.equal(r.R, -1.5);
  r = simMarket([m(0, 100, 101, 99, 100), m(864, 99, 99.5, 98.5, 99)], o); assert.equal(r.exit, 'time'); assert.equal(r.R, 0.5);
  const b = simMarket([m(0, 50, 50.5, 49.6, 50.2), m(1, 50.2, 53.1, 50, 53)], { side: 1, entry: 50, stop: 49, target: 53, r0: 1, placed: 0 });
  assert.equal(b.exit, 'target'); assert.equal(b.R, 3);
});

test('the detector: sweep of an H1 high, the VR, the CF, and both entries with a stop on the right side', () => {
  const M5 = market(), { cand, funnel } = detect(M5), bk = book(M5, cand);
  assert.ok(funnel.sweeps >= 1 && funnel.cf >= 1);
  const cf = bk.CF.orders.find((o) => o.side === -1), zn = bk.ZONE.orders.find((o) => o.side === -1);
  assert.ok(cf, 'a sell at the CF'); assert.ok(zn, 'a sell at the zone');
  assert.ok(Math.abs(cf.level - 110.1) < 0.01); assert.ok(cf.ext > cf.level);                 // the level was swept
  assert.ok(Math.abs(cf.stop - (cf.ext + K.PAD)) < 0.002);                                    // CF entry: stop past the extreme
  assert.ok(cf.entry < cf.v && cf.entry < cf.stop);                                           // sold on a close below the VR's low
  assert.ok(zn.placed > cf.placed && zn.entry < cf.entry && zn.stop < cf.stop);                // the zone entry comes later, lower, with the tighter stop
  assert.ok(zn.r0 < cf.r0);
  for (const o of [cf, zn]) { assert.ok(o.stop > o.entry && o.target < o.entry); assert.ok(o.r0 >= K.MIN_R0); assert.ok(o.entry - o.target >= K.MIN_RR * o.r0 - 1e-9); assert.ok(Math.abs(o.target - 100.1) < 0.01); }
  assert.equal(zn.status, 'closed'); assert.equal(zn.exit, 'target'); assert.ok(zn.net > 0);
  assert.equal(cf.exit, 'target'); assert.ok(cf.net > 0);
  for (const k of Object.keys(bk)) for (const o of bk[k].orders) assert.ok(o.side < 0 ? o.stop > o.entry : o.stop < o.entry);
  const mirror = M5.map((b) => bar(b.time, 200 - b.open, 200 - b.low, 200 - b.high, 200 - b.close)), mb = book(mirror, detect(mirror).cand);   // buys are the mirror image
  const bz = mb.ZONE.orders.find((o) => o.side === 1); assert.ok(bz); assert.ok(Math.abs(bz.entry - (200 - zn.entry)) < 1e-6); assert.ok(Math.abs(bz.stop - (200 - zn.stop)) < 1e-6); assert.equal(bz.exit, 'target');
});

test('one at a time per entry style; H1 and H4 candles are UTC buckets of the M5 file', () => {
  const M5 = market(), { cand } = detect(M5), twice = { CF: [...cand.CF, ...cand.CF.map((o) => ({ ...o, id: o.id + 'x', placed: o.placed + 300 }))], ZONE: cand.ZONE }, bk = book(M5, twice);
  assert.equal(bk.CF.orders.length, book(M5, cand).CF.orders.length); assert.ok(bk.CF.busy >= 1);
  const H1 = agg(M5, 3600); assert.ok(H1.every((b) => b.time % 3600 === 0)); assert.equal(H1[0].open, M5[0].open); assert.equal(H1[0].close, M5[11].close);
});

test('summaries and the verdict rule', () => {
  const mk = (avg, n, t = 0) => ({ n, avg, t, total: avg * n });
  const good = { all: mk(0.3, 300, 3), a: mk(0.25, 200), b: mk(0.4, 100), x2: mk(0.2, 300), pHolm: 0.01, years: { 2019: mk(0.2, 20), 2020: mk(0.3, 20), 2021: mk(0.5, 20), 2022: mk(-0.1, 20) } };
  assert.equal(verdictOf(good).verdict, 'PASS');
  assert.equal(verdictOf({ ...good, pHolm: 0.2 }).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, b: mk(-0.1, 100) }).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...good, a: mk(-0.1, 200) }).verdict, 'FAIL');
  assert.equal(verdictOf({ ...good, all: mk(-0.05, 300, -1), pHolm: 0.9 }).verdict, 'FAIL');
  const o = (placed, net, exit = 'stop') => ({ placed, closed: placed + 600, status: 'closed', exit, net, net2: net - 0.1, R: net + 0.1, side: -1, r0: 3, rr: 4 });
  const S = summarize([o(K.FROM + 86400, 1), o(K.SPLIT - 86400, -1), o(K.SPLIT + 86400, 2, 'target'), o(K.FROM - 86400, 5), o(K.SPLIT + 2 * 86400, 9, 'end (marked)')], K.SPLIT + 10 * 86400);
  assert.equal(S.all.n, 3); assert.equal(S.a.n, 2); assert.equal(S.b.n, 1); assert.equal(S.all.total, 2);   // warm-up and marked trades are left out
});

test('paper research only: candles in, its own files out', () => {
  assert.ok(!/council\/|api\/|child_process|histToUtc|histStampUtc/.test(RUN));
  assert.ok(!/process\.env\.(?!CANDLES|OUT_DIR|MD_BASE)/.test(RUN));
  assert.ok(RUN.includes('path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)'));
});
