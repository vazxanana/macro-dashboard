// Luxus's VR cycle study (research/edge/luxus-vr-cycle): the rule's pieces on hand-made candles, no look-ahead in the detector,
// and the committed report against result.json. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, WIN, TESTS, boEvents, levelsOf, detect, simLimit, simMarketAt, book, monthT, holm, verdictOf, rng } from '../research/edge/luxus-vr-cycle/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/luxus-vr-cycle/PREREGISTRATION.md'), RES = rd('../research/edge/luxus-vr-cycle/RESULT.md');
const R = JSON.parse(rd('../research/edge/luxus-vr-cycle/result.json'));
const bar = (time, open, high, low, close) => ({ time, open, high, low, close });

// a seeded M5 random walk with an upward drift (gives bullish H4 / H1 and plenty of VRs), weekdays only
function walk(days, seed, drift = 0.02) {
  const r = rng(seed), M5 = []; let px = 2000;
  for (let t = Date.UTC(2021, 0, 4) / 1000, n = 0; n < days * 288; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue; n++;
    const o = px, c = o + drift + (r() - 0.5) * 2.4, h = Math.max(o, c) + r() * 0.6, l = Math.min(o, c) - r() * 0.6; px = c;
    M5.push(bar(t, +o.toFixed(2), +h.toFixed(2), +l.toFixed(2), +c.toFixed(2)));
  }
  return M5;
}

test('the constants and windows are the pre-registered ones', () => {
  assert.deepEqual([K.W, K.W5, K.PAD, K.COST, K.SEEDS], [2, 1, 0.30, 0.60, 40]);
  assert.deepEqual([K.LEVEL_AGE, K.EPISODE, K.VALID, K.HOLD, K.RETRACE], [10 * 86400, 12 * 3600, 24 * 3600, 72 * 3600, 72 * 3600]);
  for (const s of ['`W` = 2', '`W5` = 1', '`LEVEL_AGE` = 10', '`EPISODE` = 12 h', '`VALID` = 24 h', '`HOLD` = 72 h', '`RETRACE` = 72 h', '`PAD` = $0.30', '$0.60 a round trip', '40 seeds']) assert.ok(PRE.includes(s), s);
  const d = (t) => new Date(t * 1000).toISOString().slice(0, 10);
  assert.deepEqual([d(WIN.is[0]), d(WIN.is[1]), d(WIN.oos[1]), d(WIN.rep[0])], ['2020-01-01', '2024-01-01', '2026-11-01', '2007-01-01']);
  assert.deepEqual(Object.keys(TESTS), ['T1', 'T2', 'T3']);
});

test('his BO: a close above the last unbroken swing high is a BO buy, its origin the lowest low of the leg', () => {
  const H = (i, o, h, l, c) => bar(i * 3600, o, h, l, c);
  const B = [H(0, 10, 11, 9, 10), H(1, 10, 12, 9.5, 11), H(2, 11, 15, 10.5, 13), H(3, 13, 14, 12, 12.5), H(4, 12.5, 13, 8, 11.5), H(5, 11.5, 14.5, 11, 14), H(6, 14, 16, 13.8, 15.6)];
  const ev = boEvents(B, 2, 3600), up = ev.find((e) => e.side === 1);
  assert.ok(up); assert.equal(up.j, 6); assert.equal(up.at, 7 * 3600);   // candle 5 closes 14, under the swing high 15: no BO; candle 6 closes 15.6 > 15
  assert.equal(up.origin, 8);                                              // the lowest low from the swing (candle 2) to the BO candle
  const L = levelsOf(B, 2, 3600, 'H1').find((l) => l.p === 15);
  assert.equal(L.born, 5 * 3600); assert.equal(L.dead, 7 * 3600);
});

test('fills: limit fill, stop first, missed when the target trades before the return, expiry, costs and financing', () => {
  const m = (i, o, h, l, c) => bar(i * 300, o, h, l, c), sell = { side: -1, placed: 0, entry: 100, stop: 102, target: 96, r0: 2 };
  let r = simLimit([m(0, 99, 99.5, 98, 99), m(1, 99, 100.2, 98.8, 100), m(2, 100, 100.5, 95.5, 96)], sell);
  assert.equal(r.status, 'closed'); assert.equal(r.exit, 'target'); assert.equal(r.R, 2); assert.equal(r.net, +(2 - 0.60 / 2).toFixed(4)); assert.equal(r.net2, +(2 - 1.20 / 2).toFixed(4));
  r = simLimit([m(0, 99, 100.5, 98.8, 100), m(1, 100, 102.5, 95, 96)], sell); assert.equal(r.exit, 'stop'); assert.equal(r.R, -1);
  assert.equal(simLimit([m(0, 99, 99.5, 95.8, 96)], sell).status, 'missed');
  assert.equal(simLimit([m(0, 99, 99.5, 98, 99), m(300, 99, 99.5, 98, 99)], sell).status, 'expired');
  // a buy held over a rollover pays financing (nights x FIN.xau.long x entry / r0)
  const t0 = Date.UTC(2025, 0, 6, 20) / 1000, B = [bar(t0, 2001, 2001.5, 1999.8, 2000.5)];
  for (let k = 1; k < 60; k++) B.push(bar(t0 + k * 300, 2000.5, 2000.9, 2000.2, 2000.6));
  B.push(bar(t0 + 60 * 300, 2000.6, 2010.5, 2000.4, 2010));
  const b = simLimit(B, { side: 1, placed: t0, entry: 2000, stop: 1995, target: 2010, r0: 5 });
  assert.equal(b.exit, 'target'); assert.equal(b.R, 2); assert.ok(b.fin > 0); assert.equal(b.net, +(2 - 0.12 - b.fin).toFixed(4));
  const p = simMarketAt(B, 0, 1, 5, 10); assert.equal(p.status, 'closed');
});

test('every candidate has its stop on the losing side and its target on the winning side', () => {
  const M5 = walk(80, 7), { cand, funnel } = detect(M5);
  assert.ok(cand.T1.length > 0 && cand.T2.length > 0, JSON.stringify(funnel));
  for (const c of [...cand.T1, ...cand.T2]) {
    assert.ok(c.side * (c.entry - c.stop) > 0, 'stop on the losing side'); assert.ok(c.side * (c.target - c.entry) > 0, 'target on the winning side');
  }
  assert.ok(cand.T1.every((c) => c.side === -1) && cand.T2.every((c) => c.side === 1));
});

test('no look-ahead: candles after a cut never change an order placed before it', () => {
  const M5 = walk(80, 11), cut = M5[Math.floor(M5.length * 0.6)].time;
  const full = detect(M5).cand, part = detect(M5.filter((b) => b.time < cut)).cand;
  for (const k of ['T1', 'T2']) {
    const a = full[k].filter((c) => c.placed <= cut).map((c) => JSON.stringify(c)), b = part[k].filter((c) => c.placed <= cut).map((c) => JSON.stringify(c));
    assert.deepEqual(a, b, k); assert.ok(a.length > 0, `${k} has orders before the cut`);
  }
  // and changing every price after the cut changes nothing before it
  const moved = M5.map((b) => (b.time >= cut ? bar(b.time, b.open + 50, b.high + 50, b.low + 50, b.close + 50) : b));
  assert.deepEqual(detect(moved).cand.T1.filter((c) => c.placed < cut), full.T1.filter((c) => c.placed < cut));
});

test('one at a time, month sums with empty months, Holm, the verdict rule', () => {
  const M5 = walk(60, 3), { cand } = detect(M5), bk = book(M5, cand.T1);
  for (let i = 1; i < bk.length; i++) assert.ok(bk[i].placed >= bk[i - 1].closed, 'no overlap');
  const tr = [{ placed: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { placed: Date.UTC(2020, 2, 5) / 1000, net: 1 }];
  assert.equal(monthT(tr, [Date.UTC(2020, 0, 1) / 1000, Date.UTC(2021, 0, 1) / 1000]).months, 12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const ok = { is: { net: { n: 50, avg: 0.1 } }, oos: { net: { mt: 2.5, avg: 0.2 }, net2: { n: 50, avg: 0.05 } }, pHolm: 0.02 };
  assert.equal(verdictOf(ok).verdict, 'PASS'); assert.equal(verdictOf({ ...ok, pHolm: 0.2 }).verdict, 'INCONCLUSIVE');
  assert.equal(verdictOf({ ...ok, is: { net: { n: 50, avg: -0.1 } } }).verdict, 'FAIL');
});

test('the report says what result.json says', () => {
  assert.equal(R.topic, 'luxus-vr-cycle'); assert.equal(R.primary.verdict, 'FAIL');
  assert.ok(R.candidates.every((c) => c.verdict === 'FAIL'));
  const line = RES.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(line.length < 220, 'headline under 220 characters'); assert.match(line, /FAIL, 0 of 3/);
  const f = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(3);
  const t = (x) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
  const S = R.tests;
  assert.ok(line.includes(`${f(S.T1.oos.net.avg)}R`) && line.includes(`n ${S.T1.oos.net.n}`) && line.includes(`month t ${t(S.T1.oos.net.mt)}`));
  assert.ok(line.includes(`${f(S.T1.is.net.avg)}R`) && line.includes(`${f(S.T2.oos.net.avg)}R OOS`) && line.includes(`${f(S.T2.is.net.avg)}R IS`));
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['is', 'oos', 'rep']) {
    const X = S[k][w]; assert.ok(RES.includes(`| ${X.net.n.toLocaleString('en-US')} | ${f(X.gross.avg)} |`), `${k} ${w} n and gross`);
    assert.ok(RES.includes(`${f(X.net.avg)}`) && RES.includes(`| ${t(X.net.mt)} |`), `${k} ${w} net and t`);
  }
  assert.equal(S.T1.placebo.oos.length, 40); assert.ok(RES.includes(`${S.T1.placebo.oosAtOrAbove} of 40`));
  for (const k of ['T1', 'T2', 'T3']) assert.equal(S[k].pHolm, 1);
});

test('nothing live: the study imports no council member but the cost helpers, writes only its result', () => {
  const run = rd('../research/edge/luxus-vr-cycle/run.mjs');
  const imports = [...run.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((x) => !x.startsWith('node:'));
  assert.deepEqual(imports.sort(), ['../../../council/fills.mjs', '../mosha-level/run.mjs', '../mosha-sweep/run.mjs']);
  assert.ok(!/mosha-lessons|api\//.test(run.replace(/\/\/.*$/gm, '')));
});
