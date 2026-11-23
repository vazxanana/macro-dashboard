// The phase reader (research/edge/_lib/phase.mjs): no look-ahead, and hand-made trend / pullback / continuation / range cases.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readPhase, readTf } from '../research/edge/_lib/phase.mjs';
import { resample, dailyNY, rng } from '../research/edge/_lib/edgekit.mjs';

const T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday

// Candles of `sec` from a list of [price, candles to get there] legs; each candle moves in a straight line, wicks 0.05 out.
function path(start, legs, sec, t0 = T0) {
  const out = []; let p = start, t = t0;
  for (const [to, n] of legs) {
    const step = (to - p) / n;
    for (let i = 0; i < n; i++) {
      const o = p, c = p + step;
      out.push({ t, o, h: Math.max(o, c) + 0.05, l: Math.min(o, c) - 0.05, c, e: t + sec });
      p = c; t += sec;
    }
  }
  return out;
}
const B = 48, S = 8; // big and small legs, in M15 candles
function set(legs) {
  const m15 = path(100, legs, 900);
  const h1 = resample(m15, 3600);
  return { '1h': h1, '15m': m15, end: m15[m15.length - 1].e };
}

test('no look-ahead: changing every candle after t leaves the reading unchanged', () => {
  const rand = rng(11);
  const m5 = []; let p = 1.1;
  for (let i = 0; i < 12 * 24 * 60; i++) {
    const t = T0 + i * 300; const o = p; p = p * (1 + (rand() - 0.5) * 0.002);
    m5.push({ t, o, h: Math.max(o, p) * (1 + rand() * 0.0005), l: Math.min(o, p) * (1 - rand() * 0.0005), c: p, e: t + 300 });
  }
  const build = (bars) => ({ '1d': dailyNY(bars), '4h': resample(bars, 14400), '1h': resample(bars, 3600), '15m': resample(bars, 900), '5m': bars });
  for (const frac of [0.4, 0.7, 0.93]) {
    const t = m5[Math.floor(m5.length * frac)].t + 137; // inside a candle: the forming candle must not count
    const a = readPhase(build(m5), t);
    const rand2 = rng(99);
    const later = m5.map((b) => (b.t + 300 > t ? { ...b, o: b.o * 1.3, h: b.h * (1.3 + rand2() * 0.1), l: b.l * 0.7, c: b.c * (0.7 + rand2() * 0.6) } : b));
    const b = readPhase(build(later), t);
    assert.deepEqual(b, a);
    assert.ok(a.tf['1h'].n > 0 && a.tf['1d'].n > 0);
  }
});

test('trend: a straight run after the H1 break is a move', () => {
  const X = set([[108, B], [104, B], [114, B], [110, B], [130, 3 * B]]);
  const r = readPhase(X, X.end);
  const h1 = r.tf['1h'];
  assert.equal(h1.side, 1);
  assert.equal(h1.confirmed, true);
  assert.equal(h1.stage, 'move');
  assert.ok(h1.pos > 0.9);
  assert.equal(h1.rangeUsed, 'internal'); // price never came back half way
  assert.ok(r.summary.includes('H1 up, move'));
});

test('pullback: M15 breaks against the H1 side, H1 does not', () => {
  const X = set([[108, B], [104, B], [114, B], [110, B], [118, B], [117, S], [125, B], [115.5, B]]);
  const r = readPhase(X, X.end);
  const h1 = r.tf['1h'];
  assert.equal(h1.side, 1, 'H1 stays up');
  assert.equal(h1.stage, 'pullback');
  assert.ok(h1.depth >= 0.5, 'came back over half the external range');
  assert.equal(h1.rangeUsed, 'external');
  assert.ok(Math.abs(h1.half - (h1.external.hi + h1.external.lo) / 2) < 1e-9);
  assert.equal(r.tf['15m'].side, -1);
  assert.equal(r.agree['1h/15m'], false);
});

test('continuation: after the pullback M15 breaks back with H1', () => {
  const X = set([[108, B], [104, B], [114, B], [110, B], [118, B], [117, S], [125, B], [123, B / 2], [123.3, 4], [115.5, B], [124, B]]);
  const h1 = readPhase(X, X.end).tf['1h'];
  assert.equal(h1.side, 1);
  assert.equal(h1.stage, 'continuation');
});

test('range: two ChoChs in a row without a BO', () => {
  const X = set([[110, B], [104, B], [112, B], [103, B], [113, B], [108, B]]);
  const h1 = readPhase(X, X.end).tf['1h'];
  assert.equal(h1.stage, 'range');
  assert.equal(h1.confirmed, false);
});

test('a ChoCh against a BO trend that fails is the old side holding, not a range', () => {
  // H1 breaks: ChoCh up, BO up, ChoCh down (below 113), ChoCh up (above 116)
  const X = set([[110, B], [104, B], [112, B], [107, B], [118, B], [113, B], [116, B], [109, B], [117, B]]);
  const h1 = readPhase(X, X.end).tf['1h'];
  assert.equal(h1.failedChoCh, true);
  assert.equal(h1.side, 1);
  assert.equal(h1.confirmed, false);
  assert.notEqual(h1.stage, 'range');
});

test('storyline on the timeframe below: BO, then a QM against it is the VR', () => {
  // H1 breaks down; then M15 makes a QM buy (lower high, sweep of the shoulder, close above the lower high).
  const X = set([[110, B], [104, B], [107, B], [96, B], [97.4, 6], [96.9, 6], [97.25, 6], [96.6, 6], [97.6, 6]]);
  const r = readPhase(X, X.end);
  const h1 = r.tf['1h'];
  assert.equal(h1.side, -1);
  assert.ok(['VR', 'CF'].includes(h1.story.step), 'story step ' + h1.story.step);
  assert.ok(h1.story.vr && h1.story.vr.zone.lo <= h1.story.vr.zone.hi);
});

test('too few candles: no side, range, no throw', () => {
  const x = readTf(path(100, [[101, 4]], 3600));
  assert.equal(x.side, 0); assert.equal(x.stage, 'range');
  const r = readPhase({ '1d': [], '4h': [], '1h': [], '15m': [] }, T0);
  assert.equal(r.agree.all, false);
  assert.ok(typeof r.summary === 'string');
});
