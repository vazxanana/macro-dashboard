// Gold held to an ATR barrier against a fixed-time hold: the rule on hand-made data, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { atr, hold, ARMS, P, holm, monthT, pairs, shuffled, rate, TESTS } from '../research/edge/gold-atr-barrier-hold/run.mjs';

const MON = 1793577600; // Monday 2 Nov 2026 00:00 UTC
const t = (i) => MON + (Math.floor(i / 5) * 7 + (i % 5)) * 86400;
const flat = (n, px = 100, r = 1) => [...Array(n)].map((_, i) => ({ time: t(i), open: px, high: px + r / 2, low: px - r / 2, close: px }));

test('ATR(14) is the mean true range of the 14 days ending at i and reads nothing later', () => {
  const b = flat(30);
  assert.equal(atr(b, 13), null); assert.equal(atr(b, 14), 1);
  const c = b.map((x, i) => (i > 20 ? { ...x, high: 999, low: 1 } : x));
  assert.equal(atr(c, 20), atr(b, 20));
});

test('barrier hold: stop first, target, gap fill at the open, time exit; costs in ATR units', () => {
  const noFin = { finMult: 0 };
  const b = flat(40);
  // entry at bar 15 open (100), ATR 1: target 102 touched on bar 17
  b[17] = { ...b[17], high: 102.5 };
  let r = hold(b, 14, -1, ARMS.A, 1, noFin); // a sell: its target is 98, its stop 102 -> stopped on bar 17
  assert.equal(r.why, 'stop'); assert.equal(r.days, 3); assert.ok(Math.abs(r.gross + 2) < 1e-12);
  r = hold(b, 14, 1, ARMS.A, 1, noFin);
  assert.equal(r.why, 'target'); assert.ok(Math.abs(r.gross - 2) < 1e-12); assert.ok(Math.abs(r.net - (2 - P.spread)) < 1e-12);
  // both in one day: stop first
  b[16] = { ...b[16], high: 103, low: 97 };
  assert.equal(hold(b, 14, 1, ARMS.A, 1, noFin).why, 'stop');
  // a gap through the target fills at the open
  const g = flat(40); g[16] = { ...g[16], open: 105, high: 106, low: 104.5, close: 105 };
  r = hold(g, 14, 1, ARMS.A, 1, noFin); assert.equal(r.why, 'target'); assert.ok(Math.abs(r.gross - 5) < 1e-12);
  // nothing touched: the time hold leaves at the close of its 10th day
  r = hold(flat(40), 14, 1, ARMS.B, 1, noFin); assert.equal(r.why, 'time'); assert.equal(r.days, 10);
  // financing on buys only
  assert.ok(hold(flat(40), 14, 1, ARMS.B, 1).fin > 0); assert.equal(hold(flat(40), 14, -1, ARMS.B, 1).fin, 0);
  // not exited by the last bar -> dropped
  assert.equal(hold(flat(20), 14, 1, ARMS.B, 1), null);
});

test('a trade never reads a bar after its exit', () => {
  const b = flat(60); b[17] = { ...b[17], high: 102.5 };
  const c = b.map((x, i) => (i > 17 ? { ...x, open: 1, high: 1, low: 1, close: 1 } : x));
  assert.deepEqual(hold(c, 14, 1, ARMS.A, 1), hold(b, 14, 1, ARMS.A, 1));
});

test('helpers: Holm, month-sum t, shuffle keeps the day shapes, rate', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
  assert.equal(monthT([{ t: MON, v: 1 }, { t: MON + 86400 * 40, v: 2 }, { t: MON + 86400 * 70, v: 3 }]).months, 3);
  const b = flat(200).map((x, i) => ({ ...x, close: 100 + i, open: 100 + i, high: 101 + i, low: 99 + i }));
  const win = [new Date(t(60) * 1000).toISOString().slice(0, 10), new Date(t(120) * 1000).toISOString().slice(0, 10)];
  const s = shuffled(b, win, 1);
  assert.equal(s.length, b.length); assert.deepEqual(s.map((x) => x.time), b.map((x) => x.time));
  const rows = pairs(b, TESTS.T1, win); assert.ok(rows.length > 10);
  assert.ok(Number.isFinite(rate(rows, 'x')) && Number.isFinite(rate(rows, 'y')));
});

test('the report says what result.json holds, and FAIL with the artifact named', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-atr-barrier-hold/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-atr-barrier-hold/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.equal(r.preRegisteredBar, 'PASS');
  assert.match(md, /\*\*Verdict: FAIL\. [^*]*artifact[^*]*\*\*/);
  assert.ok(md.match(/\*\*Verdict: ([^*]*)\*\*/)[1].length < 220);
  const s = (x, d = 4) => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d);
  for (const k of ['T1', 'T2', 'T3']) {
    const x = r.tests[k];
    assert.ok(md.includes(`${x.is.n} / ${x.oos.n} | ${s(x.is.d)} (${s(x.is.dGross)}) | ${s(x.is.t, 2)} (${s(x.is.tGross, 2)}) | ${s(x.oos.d)} (${s(x.oos.dGross)}) | ${s(x.oos.t, 2)} (${s(x.oos.tGross, 2)}) | ${s(x.oos2x)} | ${x.pHolm.toFixed(3)} | ${r.placebo[k].above} of 40`), k);
  }
  const c = r.postHoc.T1.oos;
  assert.ok(md.includes(`above only **${c.shuffledD.realAbove} of 40**`));
  assert.ok(md.includes(`${s(c.rateA)} | ${s(c.rateB)} | ${s(c.rateDiff)}`));
  assert.ok(c.shuffledD.realAbove < 38 && c.rateDiff < 0);
});
