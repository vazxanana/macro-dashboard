// node --test tests/edgekit.test.mjs - the overnight studies' shared toolkit (research/edge/_lib/edgekit.mjs), offline,
// on hand-made candles: no look-ahead, stop first, gap fills, a limit's fill candle, a hand-drawn QM, resample and
// trading-day counts, the statistics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import * as K from '../research/edge/_lib/edgekit.mjs';

const T0 = Date.UTC(2024, 0, 8) / 1000; // a Monday 00:00 UTC
const bar = (i, o, h, l, c, sec = 300) => ({ t: T0 + i * sec, o, h, l, c, e: T0 + (i + 1) * sec });
function walk(n, seed = 3, sec = 300) {
  const r = K.rng(seed); const out = []; let p = 100;
  for (let i = 0; i < n; i++) { const o = p; const c = o + (r() - 0.5) * 2; const h = Math.max(o, c) + r(); const l = Math.min(o, c) - r(); out.push(bar(i, o, h, l, c, sec)); p = c; }
  return out;
}
const perturb = (bars, from) => bars.map((b, i) => (i < from ? b : { ...b, o: b.o + 50, h: b.h + 90, l: b.l - 90, c: b.c - 40 }));

test('no look-ahead: outputs known by candle i do not move when every later price changes', () => {
  const B = walk(600);
  for (const cut of [100, 257, 401]) {
    const A = perturb(B, cut + 1);
    const sw = (x) => K.swings(x, 3).filter((s) => s.ci <= cut);
    assert.deepEqual(sw(A), sw(B));
    const bx = (x) => K.boxesClose(x).filter((b) => b.bi >= 0 && b.bi <= cut);
    assert.deepEqual(bx(A), bx(B));
    const hl = (x) => K.boxesHL(x, 3).filter((b) => b.bi >= 0 && b.bi <= cut);
    assert.deepEqual(hl(A), hl(B));
    const qm = (x) => K.qms(x, 3).filter((q) => q.i <= cut);
    assert.deepEqual(qm(A), qm(B));
    const sa = K.structure(A, 3), sb = K.structure(B, 3);
    assert.deepEqual(sa.events.filter((e) => e.i <= cut), sb.events.filter((e) => e.i <= cut));
    assert.deepEqual(sa.side.slice(0, cut + 1), sb.side.slice(0, cut + 1));
  }
  assert.ok(K.structure(B, 3).events.length > 5, 'the walk has breaks');
});

test('simulate: stop first, gaps at the open, a limit fill candle can only stop, time exit, costs', () => {
  const long = { side: 1, entry: 100, stop: 99, target: 102, t: T0, type: 'market' };
  // one candle holds both stop and target: a stop
  let r = K.simulate(long, [bar(0, 100, 100.5, 99.8, 100.2), bar(1, 100.2, 103, 98, 101)]);
  assert.equal(r.reason, 'stop'); assert.equal(r.R, -1);
  // gap below the stop fills at the open
  r = K.simulate(long, [bar(0, 100, 100.5, 99.8, 100.2), bar(1, 98.5, 99, 98, 98.8)]);
  assert.equal(r.reason, 'stop'); assert.equal(r.exit, 98.5); assert.equal(r.R, -1.5);
  // gap above the target fills at the open (better)
  r = K.simulate(long, [bar(0, 100, 100.5, 99.8, 100.2), bar(1, 103, 103.5, 102.5, 103)]);
  assert.equal(r.reason, 'target'); assert.equal(r.R, 3);
  // limit: never fills before the order time; on its fill candle a high past the target does not count
  const lim = { side: 1, entry: 99.5, stop: 99, target: 100.5, t: T0 + 300, type: 'limit' };
  const LB = [bar(0, 100, 100, 99, 99.6), bar(1, 100, 101, 99.4, 100.9), bar(2, 100.3, 101, 100.2, 100.8)];
  r = K.simulate(lim, LB);
  assert.equal(r.fillT, T0 + 300); assert.equal(r.reason, 'target'); assert.equal(r.exitT, T0 + 900);
  // the fill candle can stop it
  r = K.simulate(lim, [bar(0, 100, 100, 99.9, 100), bar(1, 100, 100.2, 98.9, 99.2)]);
  assert.equal(r.reason, 'stop'); assert.equal(r.R, -1);
  // a limit gapped through fills at the open
  r = K.simulate({ ...lim, t: T0 }, [bar(0, 99.2, 99.3, 99.1, 99.25), bar(1, 99.3, 100, 99.2, 99.9)]);
  assert.equal(r.fill, 99.2);
  // expiry and time exit
  assert.equal(K.simulate({ ...lim, expire: T0 + 300 }, [bar(0, 100, 100, 99.9, 100), bar(1, 100, 100, 99, 99.2)]).status, 'nofill');
  r = K.simulate({ ...long, target: null, maxHold: 600 }, [bar(0, 100, 100.3, 99.9, 100.1), bar(1, 100.1, 100.4, 100, 100.3), bar(2, 100.3, 100.6, 100.2, 100.5)]);
  assert.equal(r.reason, 'time'); assert.ok(Math.abs(r.R - 0.3) < 1e-9);
  // costs
  r = K.simulate(long, [bar(0, 100, 102.5, 99.9, 102)], { cost: 0.3 });
  assert.equal(r.R, 2); assert.ok(Math.abs(r.Rnet - 1.7) < 1e-9);
  // a sell mirrors
  r = K.simulate({ side: -1, entry: 100, stop: 101, target: 98, t: T0, type: 'market' }, [bar(0, 100, 100.2, 97.5, 98)]);
  assert.equal(r.reason, 'target'); assert.equal(r.R, 2);
  // a stop on the wrong side
  assert.equal(K.simulate({ ...lim, stop: 100 }, LB).status, 'bad');
});

test('qms: a hand-drawn QM buy and its mirror', () => {
  // highs/lows: H0 110, L1 104, H1 108 (lower high), head 101 (below L1), then a close above 108
  const path = [105, 107, 110, 107, 106, 104, 106, 108, 106, 103, 101, 103, 105, 107, 109, 110, 109, 108];
  const B = path.map((p, i) => bar(i, p - 0.2, p + 0.3, p - 0.3, p));
  const q = K.qms(B, 1);
  const buy = q.find((x) => x.side === 1);
  assert.ok(buy, 'found a QM buy');
  assert.equal(buy.level, 108.3); assert.equal(buy.shoulder, 103.7); assert.equal(buy.head, 100.7);
  assert.equal(B[buy.i].c > 108.3, true); assert.equal(B[buy.i - 1].c <= 108.3, true);
  assert.deepEqual(buy.zone, { lo: 100.7, hi: 103.7 });
  const M = path.map((p, i) => bar(i, 200 - p + 0.2, 200 - p + 0.3, 200 - p - 0.3, 200 - p));
  const sell = K.qms(M, 1).find((x) => x.side === -1);
  assert.ok(sell); assert.equal(sell.i, buy.i);
  // no QM when support is never broken
  const path2 = [105, 107, 110, 107, 106, 104, 106, 108, 106, 105, 106, 107, 109, 110];
  assert.equal(K.qms(path2.map((p, i) => bar(i, p - 0.2, p + 0.3, p - 0.3, p)), 1).filter((x) => x.side === 1).length, 0);
});

test('boxes: a close outside ends a box and starts the next', () => {
  const B = [bar(0, 10, 11, 9, 10), bar(1, 10, 10.8, 9.5, 10.2), bar(2, 10.2, 11.5, 10, 11.2), bar(3, 11.2, 11.3, 10.9, 11)];
  const bx = K.boxesClose(B);
  assert.equal(bx[0].dir, 1); assert.equal(bx[0].bi, 2); assert.equal(bx[0].hi, 11); assert.equal(bx[0].lo, 9);
  assert.equal(bx[1].s, 2); assert.equal(bx[1].dir, 0);
});

test('resample and trading days', () => {
  const B = []; for (let i = 0; i < 288 * 7; i++) { const t = T0 + i * 300; const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue; B.push({ t, o: 1, h: 2, l: 0.5, c: 1.5, e: t + 300 }); }
  const H4 = K.resample(B, 14400);
  assert.ok(H4.every((x) => x.t % 14400 === 0));
  assert.equal(K.resample(B.slice(0, 288), 900).length, 96);
  assert.equal(K.resample(B.slice(0, 288), 3600).length, 24);
  const D = K.dailyNY(B);
  // Mon..Fri days ending 17:00 New York (22:00 UTC in January); Sunday's candles fold into Monday
  assert.ok(D.every((d) => { const wd = new Date(d.date + 'T00:00:00Z').getUTCDay(); return wd >= 1 && wd <= 5; }));
  assert.equal(new Date(D[1].e * 1000).getUTCHours(), 22);
  assert.equal(K.nyOffsetH(Date.UTC(2024, 6, 1) / 1000), 4); assert.equal(K.nyOffsetH(Date.UTC(2024, 0, 1) / 1000), 5);
  // closedBy
  assert.equal(K.closedCount(B, T0 + 900), 3); assert.equal(K.closedBy(B, T0 + 899).length, 2);
  assert.equal(K.barAt(B, T0 + 610), 2);
});

test('stats, holm, bootstrap', () => {
  const tr = []; for (let i = 0; i < 48; i++) tr.push({ R: i % 3 === 0 ? 2 : -1, exitT: Date.UTC(2020 + Math.floor(i / 12), i % 12, 10) / 1000 });
  const s = K.stats(tr);
  assert.equal(s.n, 48); assert.equal(s.wins, 16); assert.equal(s.total, 0); assert.equal(s.months, 48);
  assert.equal(s.IS.n, 48); assert.equal(s.OOS.n, 0); assert.ok(s.maxDD < 0);
  assert.ok(Math.abs(K.pFromT(1.96, 1e6) - 0.05) < 1e-3);
  assert.deepEqual(K.holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  const b = K.bootstrapMonths(tr, { draws: 500 });
  assert.equal(b.months, 48); assert.ok(b.q[0.05] < b.q[0.95]);
});

test('load reads the gzip cache by year and range', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ek-'));
  fs.mkdirSync(path.join(dir, 'xau'));
  fs.writeFileSync(path.join(dir, 'xau', '5m-2024.json.gz'), zlib.gzipSync(JSON.stringify([[T0 + 300, 2, 3, 1, 2], [T0, 1, 2, 0, 1], [T0, 1, 2, 0, 1]])));
  const b = K.load('xau', '5m', { dir, from: '2024-01-01', to: '2025-01-01' });
  assert.deepEqual(b.map((x) => x.t), [T0, T0 + 300]); assert.equal(b[0].e, T0 + 300);
  assert.equal(K.load('xau', '5m', { dir, from: T0 + 1 }).length, 1);
  assert.equal(K.COSTS.xau, 0.30);
});

test('New York offset follows the pre-2007 US daylight rule before 2007 (review 23 Nov 2026)', async () => {
  const K2 = await import('../research/edge/_lib/edgekit.mjs');
  const at = (s) => K2.nyOffsetH(Date.parse(s) / 1000);
  assert.equal(at('2006-03-20T12:00Z'), 5); // after the 2nd Sunday of March, before April: still winter in 2006
  assert.equal(at('2006-04-02T08:00Z'), 4); // 1st Sunday of April 07:00 UTC on
  assert.equal(at('2006-10-29T05:00Z'), 4);
  assert.equal(at('2006-10-29T07:00Z'), 5); // last Sunday of October 06:00 UTC off
  assert.equal(at('2006-11-02T12:00Z'), 5);
  assert.equal(at('2008-03-10T12:00Z'), 4);
  assert.equal(at('2008-11-01T12:00Z'), 4);
});
