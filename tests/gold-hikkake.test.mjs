// Hikkake on spot gold daily: the setup, the stop-order entry and its cancel, the exits, no look-ahead, the control, and the
// report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, setupAt, entryOf, manage, runTest, control, cost, holm, monthT, B, COST, HOLD } from '../research/edge/gold-hikkake/run.mjs';

const H = 3600;
// hand-made H1 candles: 17:00 New York days (Mon-Fri), 24 candles each, flat at 100 (high 101, low 99) unless given
function make(dayCandles) {
  const out = []; let t = Date.UTC(2024, 0, 1, 22) / 1000;
  for (const cs of dayCandles) {
    while ([6, 0].includes(new Date((t + 2 * H) * 1000).getUTCDay())) t += 24 * H;
    for (let h = 0; h < 24; h++) { const c = cs && cs[h]; out.push({ time: t + h * H, ...(c || { open: 100, high: 101, low: 99, close: 100 }) }); }
    t += 24 * H;
  }
  return out;
}
const bar = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });
const day = (o, h, l, c) => [...Array(24)].map((_, k) => (k === 0 ? bar(o, h, l, c) : bar(c, Math.min(h, c + 0.1), Math.max(l, c - 0.1), c)));

// days 0-24 flat; day 25 inside (100.5 / 99.5), day 26 breaks below only (low 99), day 27 rallies through 100.8 at hour 3
function scenario({ through = false } = {}) {
  const d = [...Array(32)].map(() => null);
  d[25] = day(100, 100.5, 99.5, 100); d[26] = day(100, 100.2, 99, 99.4);
  d[27] = [...Array(24)].map((_, h) => (h < 3 ? bar(99.4, 99.6, through && h === 1 ? 98.9 : 99.2, 99.4) : h === 3 ? bar(99.4, 101, 99.3, 100.9) : bar(100.9, 101, 100.8, 100.9)));
  return make(d);
}

test('setup: inside day then a break of one side only; outside or no break gives none', () => {
  const ds = build(scenario());
  const s = setupAt(ds, 26); assert.equal(s.side, 1); assert.equal(+s.level.toFixed(2), 100.5 + B); assert.equal(+s.stop.toFixed(2), 99 - B);
  assert.equal(setupAt(ds, 25), null); assert.equal(setupAt(ds, 27), null);
  const d = [...Array(30)].map(() => null); d[25] = day(100, 100.5, 99.5, 100); d[26] = day(100, 100.7, 99.2, 100); // breaks both: none
  assert.equal(setupAt(build(make(d)), 26), null);
  d[26] = day(100, 100.9, 99.8, 100.6); assert.equal(setupAt(build(make(d)), 26).side, -1);
});

test('entry: the buy stop fills on day i+2, cancelled when price trades through the false-break low first', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, setupAt(ds, 26));
  assert.ok(e); assert.equal(e.fillK, ds[27].a + 3); assert.equal(+e.fill.toFixed(2), 100.8);
  const h2 = scenario({ through: true }), d2 = build(h2); assert.equal(entryOf(h2, d2, setupAt(d2, 26)), null);
});

test('no look-ahead: candles after the fill do not change the entry; days after the setup do not change the setup', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, setupAt(ds, 26));
  const h2 = h1.map((c, k) => (k > e.fillK ? { ...c, high: c.high + 40, low: c.low - 40 } : { ...c })), d2 = build(h2);
  assert.deepEqual(entryOf(h2, d2, setupAt(d2, 26)), e);
  assert.deepEqual(setupAt(d2, 26), setupAt(ds, 26));
});

test('exits: worst case on the fill candle, the hold, a gapped stop at the open, costs and financing', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, setupAt(ds, 26));
  const r = manage(h1, ds, 1, e.fill, e.stop, e.fillK, 27, HOLD, true, false);
  assert.equal(r.how, 'time'); assert.equal(r.k, ds[27 + HOLD].b);
  const g = h1.map((c, k) => (k === e.fillK + 2 ? { ...c, ...bar(98, 98.2, 97.5, 98) } : c)), r2 = manage(g, build(g), 1, e.fill, e.stop, e.fillK, 27, HOLD, true, false);
  assert.equal(r2.how, 'stop'); assert.equal(r2.exit, 98);
  const c = cost(-1, 100, 101, { exit: 99 }, 0, 3 * 86400); assert.equal(c.fin, 0); assert.equal(+c.net.toFixed(4), +(1 - COST).toFixed(4));
  const c2 = cost(1, 100, 99, { exit: 101 }, h1[0].time, h1[0].time + 3 * 86400); assert.ok(c2.fin > 0); assert.ok(c2.net2 < c2.net);
});

test('control and one-at-a-time: a market trade on any day with the same stop in ATR; runTest takes the setup once', () => {
  const h1 = scenario(), ds = build(h1);
  const k = control(h1, ds, 22, 1, 1, false); assert.ok(k); assert.ok(Number.isFinite(k.net));
  const T = runTest(h1, ds, false); assert.equal(T.length, 1); assert.equal(T[0].side, 1);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  assert.equal(monthT([], ['2020-01-01', '2020-12-31']).months, 12);
});

test('report matches result.json; verdict line is short and carries the reason', () => {
  const r = JSON.parse(fs.readFileSync('research/edge/gold-hikkake/result.json', 'utf8'));
  const md = fs.readFileSync('research/edge/gold-hikkake/RESULT.md', 'utf8');
  const v = md.match(/\*\*Verdict: (.+?)\*\*/)[1]; assert.equal(v, r.verdict); assert.ok(v.length < 220);
  assert.equal(r.pass, r.tests.T1.pass && r.tests.T2.pass);
  for (const [k, t] of Object.entries(r.tests)) {
    assert.ok(md.includes(`| ${k} | OOS 2017-26 | ${t.oos.n} (`)); assert.equal(t.trades.length, t.oos.n);
    if (t.placebo) assert.equal(t.placebo.means.length, 40);
  }
  const pre = fs.readFileSync('research/edge/gold-hikkake/PREREGISTRATION.md');
  assert.equal(r.prereg, (sha(pre)));
});
import crypto from 'node:crypto';
function sha(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
