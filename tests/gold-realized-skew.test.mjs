// Gold intraday realized-skewness study: the skew, the days, the trade (stop, no look-ahead), Holm, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rsk, dayLabel, buildDays, features, sideOf, trade, holm, monthSums, P } from '../research/edge/gold-realized-skew/run.mjs';

const T0 = Date.UTC(2025, 0, 6, 22) / 1000; // Monday 6 Jan 2025 17:00 New York = the start of Tuesday 7 Jan's trading day
// n days of 5-minute candles (200 a day), price path from fn(day, k)
function make(n, fn) {
  const bars = [];
  for (let d = 0; d < n; d++) for (let k = 0; k < 200; k++) { const t = T0 + d * 86400 + k * 300, c = fn(d, k), o = k ? bars.at(-1)[4] : c; bars.push([t, o, Math.max(o, c) + 0.1, Math.min(o, c) - 0.1, c]); }
  return bars;
}

test('realized skewness: symmetric returns 0, one big up move positive, one big down move negative', () => {
  assert.equal(rsk([1, -1, 1, -1]), 0);
  assert.ok(rsk([0.01, -0.001, -0.001, -0.001, -0.001]) > 1);
  assert.ok(rsk([-0.01, 0.001, 0.001, 0.001, 0.001]) < -1);
  assert.equal(rsk([0, 0]), null);
});

test('trading day: 17:00 New York starts the next day, in winter and in summer', () => {
  assert.equal(dayLabel(Date.UTC(2025, 0, 6, 21, 55) / 1000), '2025-01-06');
  assert.equal(dayLabel(Date.UTC(2025, 0, 6, 22, 0) / 1000), '2025-01-07');
  assert.equal(dayLabel(Date.UTC(2025, 6, 7, 20, 55) / 1000), '2025-07-07');
  assert.equal(dayLabel(Date.UTC(2025, 6, 7, 21, 0) / 1000), '2025-07-08');
});

test('features use day i and earlier only; side thresholds', () => {
  const fn = (d, k) => 2000 + d + Math.sin(d * 7 + k) * (1 + (d % 5));
  const a = make(260, fn), b = make(260, (d, k) => d > 240 ? 5000 + k : fn(d, k));
  const fa = features(buildDays(a)), fb = features(buildDays(b));
  assert.deepEqual(fa.slice(0, 241), fb.slice(0, 241));
  assert.equal(sideOf(0.1), 'buy'); assert.equal(sideOf(0.9), 'sell'); assert.equal(sideOf(0.5), null); assert.equal(sideOf(null), null);
});

test('trade: entry at the next day open, stop on the losing side, a gap fills at the open, else out at the 5th day close', () => {
  const bars = make(12, (d) => 2000 + d), days = buildDays(bars);
  const feat = days.map(() => ({ atr: 10 }));
  const t = trade(bars, days, feat, 2, 'buy');
  assert.equal(t.entry, bars[days[3].a][1]); assert.equal(t.stop, t.entry - P.stopAtr * 10); assert.equal(t.how, 'time');
  assert.equal(t.exitPx, bars[days[2 + P.hold].b][4]);
  assert.ok(t.net < t.gross && t.nights > 0);
  const s = trade(bars, days, feat, 2, 'sell'); assert.equal(s.stop, s.entry + 15); assert.equal(s.nights, 0);
  const g = bars.map((x, i) => i === days[4].a ? [x[0], 1900, 1901, 1899, 1900] : x), tg = trade(g, days, feat, 2, 'buy');
  assert.equal(tg.how, 'gap'); assert.equal(tg.exitPx, 1900); assert.ok(tg.gross < -1);
});

test('Holm and month sums', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  const m = monthSums([{ exitT: Date.UTC(2020, 2, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 2, 9) / 1000, net: 2 }], Date.UTC(2020, 0, 1) / 1000);
  assert.deepEqual(m, [0, 0, 3]);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-realized-skew/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-realized-skew/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\./);
  assert.ok(md.split('\n').find((l) => l.startsWith('**Verdict')).length < 220 + 4);
  assert.deepEqual(r.checks, { tOos: false, sameSign: false, twoX: false });
  const f = (v, d = 3) => (v > 0 ? '+' : '') + v.toFixed(d);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos']) {
    const s = r.rows[k][w];
    assert.ok(md.includes(`| ${s.n} | ${f(s.gross)} | ${f(s.net)} | ${s.tGross.toFixed(2)} | ${s.tNet.toFixed(2)} | ${f(s.totalNet, 2)} |`), `${k} ${w}`);
  }
  for (const k of ['T1', 'T2', 'T3']) assert.ok(md.includes(`${k} ${r.rows[k].pHolm.toFixed(4)}`));
  assert.ok(md.includes(`beats ${r.placebo.beats} of 40`) && md.includes(`${f(r.placebo.p95)}R`));
  assert.ok(!/now live|live change made/i.test(md));
});
