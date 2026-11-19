// tl-third-touch study (research/edge/tl-third-touch): the H4 zone with its two breaks and ISL, the H1 line through two pivots,
// the third-touch detection inside the zone, the trade simulation and its costs, no look-ahead, and the committed result
// against the pre-registered bar and the written report. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, h4From, pivot, zones, islBroken, lineAt, tlEntry, ctlEntry, simulate, book, monthT, halfOf } from '../research/edge/tl-third-touch/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/tl-third-touch/PREREGISTRATION.md'), RUN = rd('../research/edge/tl-third-touch/run.mjs'), RES = rd('../research/edge/tl-third-touch/RESULT.md');
const J = JSON.parse(rd('../research/edge/tl-third-touch/result.json'));
const T0 = Date.UTC(2021, 0, 4, 0, 0, 0) / 1000;                                     // a Monday, 00:00 UTC
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const C4 = (rows) => rows.map(([o, h, l, c], i) => ({ time: T0 + i * P.H4, open: o, high: h, low: l, close: c }));

// A buy zone on H4: swing high 105 (candle 2), the leg falls to 98 (candle 5, red: the zone candle 101.5-98), candle 8 closes
// above 105 (first break), a new swing high 108 forms (candle 9, known at 11), candle 12 closes above it (second break).
// ISL = the high of candle 4 (103), closed above by candle 8.
const ZR = [
  [100, 101, 99, 100.5], [100.5, 102, 100, 101.5], [101.5, 105, 101, 104], [104, 104.5, 102, 102.5], [102.5, 103, 100.5, 101],
  [101, 101.5, 98, 98.5], [98.5, 100, 98.2, 99.8], [99.8, 103.5, 99.5, 103.2], [103.2, 106, 103, 105.6], [105.6, 108, 105, 107.5],
  [107.5, 107.8, 106, 106.5], [106.5, 107, 105.5, 106], [106, 109, 105.8, 108.6], [108.6, 109, 107, 107.5], [107.5, 108, 106.5, 107],
];
const flip4 = (rows) => rows.map(([o, h, l, c]) => [200 - o, 200 - l, 200 - h, 200 - c]);

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K4, P.K1, P.N, P.BREAK2_WITHIN, P.LIFE, P.PAD, P.MIN_R0, P.RR, P.HOLD, P.COST, P.PLACEBO, P.NEED_PLACEBO, P.SEED], [2, 3, 6, 30, 120, 0.30, 1, 2, 259200, 0.30, 40, 38, 20261113]);
  for (const s of ['**N = 6**', '**30 H4 candles**', '120 H4 candles', '$0.30 beyond the zone', '**Target**: 2R', '72 hours', '**38 of 40**', 'A = 1 Jan 2020 to 31 Dec 2023, B = 1 Jan 2024 to 31 Oct 2026', 'Holm']) assert.ok(PRE.includes(s), s);
  assert.equal(halfOf(Date.UTC(2023, 11, 31, 23) / 1000), 'a'); assert.equal(halfOf(Date.UTC(2024, 0, 1) / 1000), 'b'); assert.equal(halfOf(Date.UTC(2026, 10, 1) / 1000), null); assert.equal(halfOf(Date.UTC(2019, 11, 31) / 1000), null);
});

test('no model names, no private course wording, nothing live imported but the financing rate', () => {
  for (const s of [PRE, RUN, RES]) for (const w of ['L3XUS', '411', 'Zlankator', 'PITCHOU', 'Sama', 'BERG']) assert.ok(!s.includes(w), w);
  assert.ok(!/from ['"]\.\.\/\.\.\/\.\.\/(api|ict)\//.test(RUN)); assert.ok(/from '\.\.\/\.\.\/\.\.\/council\/fills\.mjs'/.test(RUN));
  assert.ok(!/ctrader|trades\.json'|writeAtomic/.test(RUN.replace(/OUT_DIR, 'trades\.json'/, '')), 'writes nothing of the council');
});

test('H4 from H1 in UTC buckets; pivots at or beyond the left, strictly beyond the right', () => {
  const H1 = Array.from({ length: 9 }, (_, i) => ({ time: T0 + i * 3600, open: i, high: i + 1, low: i - 1, close: i + 0.5 }));
  const H4 = h4From(H1); assert.equal(H4.length, 3); assert.deepEqual([H4[0].open, H4[0].high, H4[0].low, H4[0].close, H4[2].time], [0, 4, -1, 3.5, T0 + 2 * P.H4]);
  const B = [1, 2, 3, 3, 2, 1, 0].map((h, i) => ({ high: h, low: h - 5 }));
  assert.equal(pivot(B, 3, 2, 1), true, 'equal to the left counts'); assert.equal(pivot(B, 2, 2, 1), false, 'equal to the right does not');
});

test('the zone: last red candle at the leg origin, two breaks, ISL, live from the close of the second break; and its mirror', () => {
  const { zones: Z, funnel } = zones(C4(ZR), 1); assert.ok(funnel.firstBreaks >= 1);
  const z = Z.find((x) => x.z === 5); assert.ok(z, 'the zone of candle 5');
  assert.deepEqual([z.top, z.bottom, z.isl, z.S, z.b1, z.b2, z.stop, z.Tc], [101.5, 98, 103, 105, 8, 12, 97.7, T0 + 13 * P.H4]);
  const S = zones(C4(flip4(ZR)), -1).zones.find((x) => x.z === 5); assert.ok(S, 'the sell mirror');
  assert.deepEqual([S.top, S.bottom, S.isl, S.b2], [102, 98.5, 97, 12]); near(S.stop, 102.3);
  // the zone dies when a close goes below its low before the second break
  const dead = ZR.map((r, i) => (i === 10 ? [107.5, 107.8, 97, 97.5] : r)); assert.ok(!zones(C4(dead), 1).zones.some((x) => x.z === 5));
  // no second break within the limit, no zone
  const flat = ZR.slice(0, 12); assert.ok(!zones(C4(flat), 1).zones.some((x) => x.z === 5));
});

test('ISL: a close beyond the extreme of the candle before the zone candle, up to the second break', () => {
  const H4 = C4(ZR); assert.equal(islBroken(H4, 5, 12, 1), true);
  const hi = H4.map((b, i) => (i === 4 ? { ...b, high: 200 } : b)); assert.equal(islBroken(hi, 5, 12, 1), false);
  assert.equal(islBroken(H4, 5, 7, 1), true); assert.equal(islBroken(H4, 5, 6, 1), false, 'not broken before candle 7 closed at 103.2');
});

// H1: pivot high 110 at candle 3, pivot high 106 at candle 10 (known at 13), the line 110 - 4/7 per candle; candles 11-17 stay
// under it; candle 18 reaches 101.6 against a line of 101.43, inside the zone 98-101.5: the third touch. Then 105, 109.
const HI = [105, 106, 107, 110, 108, 107, 105, 104, 103, 102, 106, 103, 102, 101, 100.5, 100, 99.5, 99, 101.6, 105, 109, 109.5];
const h1 = (his = HI) => his.map((h, i) => ({ time: T0 + i * 3600, open: i === 18 ? 99.2 : h - 0.5, high: h, low: i === 18 ? 99 : h - 1, close: h - 0.4 }));
const ZONE = { s: 1, top: 101.5, bottom: 98, stop: 97.7, b2t: T0, Tc: T0 + 12 * 3600, end: T0 + 400 * 3600, zt: T0 - 86400 };

test('the line through two pivots and its projection', () => {
  const L = { i1: 3, v1: 110, i2: 10, v2: 106 }; near(lineAt(L, 3), 110); near(lineAt(L, 10), 106); near(lineAt(L, 18), 110 - (4 / 7) * 15);
});

test('third-touch detection: the first touch after the line is known, inside the zone, filled at the line', () => {
  const r = tlEntry(h1(), ZONE); assert.equal(r.note, 'trade'); const c = r.cand;
  assert.deepEqual([c.i, c.line.i1, c.line.i2, c.s], [18, 3, 10, 1]); near(c.entry, +(110 - (4 / 7) * 15).toFixed(3)); near(c.r0, +(c.entry - 97.7).toFixed(3));
  // a line touched while it was being confirmed is dropped
  const early = HI.map((h, i) => (i === 12 ? 105 : h)); assert.equal(tlEntry(h1(early), ZONE).cand, null);
  // pivots closer than N candles make no line
  assert.equal(tlEntry(h1(HI.map((h, i) => (i === 3 ? 104.9 : i === 2 ? 104.8 : h))), ZONE).cand?.line?.i1 ?? null, null);
  // the line's value outside the zone at the touch: no trade from that line
  assert.equal(tlEntry(h1(), { ...ZONE, top: 100.5 }).note, 'outside');
  // a touch before the zone is live is consumed without a trade
  assert.equal(tlEntry(h1(), { ...ZONE, Tc: T0 + 19 * 3600 }).cand, null);
});

test('no look-ahead: candles after the touch cannot change the entry', () => {
  const a = tlEntry(h1(), ZONE).cand; const later = HI.map((h, i) => (i > 18 ? 90 + i : h)); const b = tlEntry(h1(later), ZONE).cand;
  assert.deepEqual(a, b);
  const c1 = ctlEntry(h1(), { ...ZONE, Tc: T0 + 14 * 3600 }), c2 = ctlEntry(h1(later), { ...ZONE, Tc: T0 + 14 * 3600 }); assert.deepEqual(c1, c2);
});

test('the control: a limit at the zone near edge on the first touch from Tc', () => {
  const c = ctlEntry(h1(), { ...ZONE, Tc: T0 + 14 * 3600 }); assert.equal(c.i, 14); near(c.entry, 100, 1e-9); // candle 14 opens at 100, below 101.5
  const d = ctlEntry(h1(), ZONE); assert.equal(d.i, 12); near(d.entry, 101.5);
});

test('the trade: stop first, the target not credited on the entry candle, time exit, costs and financing on buys only', () => {
  const H = (rows) => rows.map(([o, h, l, c], i) => ({ time: T0 + i * 3600, open: o, high: h, low: l, close: c }));
  const c = { s: 1, i: 0, t: T0, entry: 100, stop: 98, r0: 2 };
  let o = simulate(H([[100, 105, 99, 104], [104, 105, 103, 104]]), c); assert.equal(o.exit, 'target'); assert.equal(o.closed, T0 + 3600 + 1800);
  o = simulate(H([[100, 101, 97, 99]]), c); assert.equal(o.exit, 'stop'); assert.equal(o.R, -1); near(o.net, -1 - 0.15);
  o = simulate(H([[100, 101, 99, 100], [100, 105, 97, 100]]), c); assert.equal(o.exit, 'stop', 'stop before target in one candle');
  o = simulate(H([[100, 101, 99, 100], [97, 98, 96, 97]]), c); assert.equal(o.exit, 'stop (gap)'); assert.equal(o.R, -1.5);
  const long = H(Array.from({ length: 80 }, () => [100.5, 101, 99.5, 100.5])); o = simulate(long, c); assert.equal(o.exit, 'time'); assert.equal(o.closed, T0 + 72 * 3600);
  assert.ok(o.nights >= 3 && o.fin > 0); near(o.net, o.R - 0.15 - (o.nights * P.FIN_LONG * 100) / 2, 1e-4);
  const s = simulate(long, { ...c, s: -1, stop: 102 }); assert.equal(s.fin, 0);
  const bk = book(H([[100, 105, 99, 104], [104, 105, 103, 104]]), [c, { ...c, t: T0 + 1 }]); assert.equal(bk.trades.length, 1); assert.equal(bk.busy, 1);
});

test('month-sum t covers Jan 2020 to Oct 2026, empty months count 0', () => {
  const m = monthT([{ t: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { t: Date.UTC(2026, 10, 5) / 1000, net: 5 }]); assert.equal(m.months, 82); near(m.meanMonth, +(1 / 82).toFixed(3));
});

test('the committed result: the pre-registered bar, and the report says the same', () => {
  assert.equal(J.topic, 'tl-third-touch'); const pass = Object.values(J.conditions).every(Boolean);
  assert.equal(J.verdict.startsWith(pass ? 'PASS' : 'FAIL'), true);
  assert.equal(J.conditions['T1c TL month-sum t >= 2'], J.trendline.month.t >= 2); assert.equal(J.conditions['T2 TL beats the control, Welch t >= 2'], J.tests.T2.welch >= 2);
  assert.equal(J.placebo.runs.length, 40); assert.equal(J.placebo.beat, J.placebo.runs.filter((x) => J.trendline.all.exp > x.exp).length);
  assert.ok(RES.startsWith('# '), 'title'); assert.ok(RES.split('\n').slice(0, 4).join(' ').includes(`**Verdict: ${pass ? 'PASS' : 'FAIL'}`));
  const sg = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  for (const [k, s] of [['trendline', J.trendline], ['control', J.control]]) for (const h of ['a', 'b', 'all']) {
    assert.ok(RES.includes(`| ${s[h].n} |`), `${k} ${h} n`); assert.ok(RES.includes(sg(s[h].exp)), `${k} ${h} exp ${sg(s[h].exp)}`); }
  for (const x of [J.trendline.month.t, J.control.month.t, J.tests.T2.welch]) assert.ok(RES.includes(String(x).replace('-', '−')), String(x));
  assert.ok(RES.includes(`${J.placebo.beat} of 40`)); assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-tl-third-touch.md', import.meta.url)) || pass, 'a proposal only on a pass');
});
