// Turtle Soup on spot gold daily: the channel, the stop-order entry, the exits, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, channel, entryOf, manage, runTest, TESTS, B, monthT } from '../research/edge/gold-daily-turtle-soup/run.mjs';

const H = 3600;
// hand-made H1 candles: `n` 17:00 New York days (Mon-Fri), 24 candles each, flat at `base` unless a day's candles are given
function make(dayCandles, base = 100) {
  const out = []; let t = Date.UTC(2024, 0, 1, 22) / 1000; // Mon 1 Jan 2024 22:00 UTC = 17:00 New York, the Tuesday trading day
  for (const cs of dayCandles) {
    while ([6, 0].includes(new Date((t + 2 * H) * 1000).getUTCDay())) t += 24 * H; // skip Saturday / Sunday trading days
    for (let h = 0; h < 24; h++) { const c = cs && cs[h]; out.push({ time: t + h * H, ...(c || { open: base, high: base + 1, low: base - 1, close: base }) }); }
    t += 24 * H;
  }
  return out;
}
const flat = (n) => [...Array(n)].map(() => null);
const bar = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

// 25 flat days (low 99), day 10 made the 20-day low 95, then day 25 breaks it and comes back
function scenario({ back = true, closeBelow = false } = {}) {
  const d = flat(30); d[10] = [...Array(24)].map((_, h) => (h === 5 ? bar(100, 100, 95, 99) : null));
  d[25] = [...Array(24)].map((_, h) => (h === 3 ? bar(99, 99, 93, 94) : h === 4 && back ? bar(94, 96, 93.5, 95.8) : h > 3 && closeBelow ? bar(94, 94.2, 93.8, 94) : null));
  return make(d);
}

test('channel: the prior 20-day low, its age, and the spacing', () => {
  const h1 = scenario(), ds = build(h1);
  const ch = channel(ds, 25, 1); assert.equal(ch.level, 95); assert.equal(ch.age, 15);
  assert.equal(channel(ds, 5, 1), null); // fewer than 20 days
});

test('classic entry: buy stop at the old low + B after the break, stop below the new low', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, 25, 1, 'classic');
  assert.ok(e); assert.equal(+e.fill.toFixed(2), 95 + B); assert.equal(+e.stop.toFixed(2), 93 - B);
  assert.equal(h1[e.fillK].time, h1[ds[25].a + 4].time);
  // no way back on day i: the order still works on day i+1, and a candle that opens through it fills at its open
  const h2 = scenario({ back: false, closeBelow: true }), d2 = build(h2), e2 = entryOf(h2, d2, 25, 1, 'classic');
  assert.equal(e2.fillK, d2[26].a); assert.equal(e2.fill, 100);
  // and with day i+1 never back above the old low: no trade
  const h3 = h2.map((c, k) => (k >= d2[26].a ? { ...c, open: 94, high: 94.5, low: 93.5, close: 94 } : c)), d3 = build(h3);
  assert.equal(entryOf(h3, d3, 25, 1, 'classic'), null);
});

test('spacing: a 20-day low made 2 days before the break gives no trade', () => {
  const d = flat(30); d[23] = [...Array(24)].map((_, h) => (h === 5 ? bar(100, 100, 95, 99) : null));
  d[25] = [...Array(24)].map((_, h) => (h === 3 ? bar(99, 99, 93, 94) : h === 4 ? bar(94, 96, 93.5, 95.8) : null));
  const h1 = make(d), ds = build(h1); assert.equal(channel(ds, 25, 1).age, 2); assert.equal(entryOf(h1, ds, 25, 1, 'classic'), null);
});

test('Plus One needs a close below the old low and fills only on the next day', () => {
  const h1 = scenario(), ds = build(h1);
  assert.equal(entryOf(h1, ds, 25, 1, 'plus'), null, 'day i closed back above the old low: no Plus One');
  const d = flat(30); d[10] = [...Array(24)].map((_, h) => (h === 5 ? bar(100, 100, 95, 99) : null));
  d[25] = [...Array(24)].map(() => bar(94, 94.2, 93, 94)); d[26] = [...Array(24)].map((_, h) => (h === 2 ? bar(94, 96, 93.8, 95.5) : h < 2 ? bar(94, 94.2, 93.9, 94) : null));
  const h2 = make(d), d2 = build(h2), e = entryOf(h2, d2, 25, 1, 'plus');
  assert.ok(e); assert.equal(+e.fill.toFixed(2), 95.3); assert.equal(+e.stop.toFixed(2), 92.7); assert.equal(h2[e.fillK].time, h2[d2[26].a + 2].time);
});

test('no look-ahead: changing every candle after the fill leaves the entry unchanged', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, 25, 1, 'classic');
  const h2 = h1.map((c, k) => (k > e.fillK ? { ...c, high: c.high + 50, low: c.low - 50 } : { ...c })), d2 = build(h2);
  assert.deepEqual(entryOf(h2, d2, 25, 1, 'classic'), e);
});

test('exits: stop counts on the fill candle (worst case), stop before target in one candle, then target, then time', () => {
  const h1 = scenario(), ds = build(h1), e = entryOf(h1, ds, 25, 1, 'classic'), d0 = 25;
  // target 2R above 95.3: risk 2.6 -> 100.5; flat days after have high 101 -> target on the next candle
  let r = manage(h1, ds, 1, e.fill, e.stop, e.fillK, d0, 3, true); assert.equal(r.how, 'target'); assert.equal(r.k, e.fillK + 1);
  const h2 = h1.map((c, k) => (k === e.fillK + 1 ? { ...c, high: 101, low: 90 } : c));
  r = manage(h2, build(h2), 1, e.fill, e.stop, e.fillK, d0, 3, true); assert.equal(r.how, 'stop'); assert.equal(r.exit, e.stop);
  const h3 = h1.map((c, k) => (k === e.fillK ? { ...c, low: 92 } : c));
  r = manage(h3, build(h3), 1, e.fill, e.stop, e.fillK, d0, 3, true); assert.equal(r.how, 'stop');
  const h4 = h1.map((c, k) => (k > e.fillK ? { ...c, open: 96, high: 96.5, low: 95.5, close: 96 } : c)), d4 = build(h4);
  r = manage(h4, d4, 1, e.fill, e.stop, e.fillK, d0, 3, true); assert.equal(r.how, 'time'); assert.equal(r.k, d4[28].b);
});

test('every trade has a stop on the losing side; one position at a time', () => {
  const h1 = scenario(), ds = build(h1);
  for (const t of Object.values(TESTS)) { const T = runTest(h1, ds, t);
    for (const x of T) assert.ok(x.side * (x.fill - x.stop) > 0);
    for (let j = 1; j < T.length; j++) assert.ok(T[j].fillK > T[j - 1].exitK); }
});

test('month t counts every month of the window', () => {
  const T = [{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 2, 5) / 1000, net: 1 }];
  assert.equal(monthT(T, ['2020-01-01', '2020-03-31']).months, 3);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-daily-turtle-soup/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-daily-turtle-soup/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.deepEqual(r.passAlone, []);
  const v = md.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v && v[1].startsWith('FAIL') && v[0].length < 220);
  const m = (x) => (x < 0 ? '−' : x > 0 ? '+' : '') + Math.abs(x).toFixed(3);
  for (const [k, t] of Object.entries(r.tests)) {
    for (const w of ['oos', 'is']) { const s = t[w];
      assert.ok(md.includes(`| ${s.n} | ${s.win}% | ${s.stops} / ${s.targets} / ${s.times} | ${m(s.gross)} | ${m(s.net)} | ${m(s.net2x)} | ${s.t} |`), `${k} ${w}`); }
    assert.ok(md.includes(`| ${k} |`) && md.includes(`${t.placebo.beaten} of 40`), `${k} placebo`);
    assert.equal(t.pass, false);
  }
  assert.ok(!/now live|goes live/i.test(md));
});
