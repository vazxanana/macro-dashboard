// gold-dominant-h4: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyOf, blockOf, toDays, blocks, setup, simulate, TESTS, baseline, holm, monthT, RT, ATR_N } from '../research/edge/gold-dominant-h4/run.mjs';

const dir = new URL('../research/edge/gold-dominant-h4/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const H = 3600, DAY = 86400;

// weekday New York days from 1 Jan 2020 (winter: New York = UTC-5): 23 H1 candles 18:00 NY .. 16:00 NY, flat at 100, range 1
function h1Days(nDays, tweak = () => null) {
  const rows = []; let d = Date.UTC(2020, 0, 1, 23) / 1000, made = 0;
  while (made < nDays) {
    const w = new Date((d + 6 * H) * 1000).getUTCDay();
    if (w >= 1 && w <= 5) {
      for (let h = 0; h < 23; h++) { const x = tweak(made, h) || { o: 100, h: 100.5, l: 99.5, c: 100 }; rows.push([d + h * H, x.o, x.h, x.l, x.c]); }
      made++;
    }
    d += DAY;
  }
  return rows;
}
// h = hours after 18:00 New York: block 0 = h 0-2 (18-20), 1 = 3-6, 2 = 7-10, 3 = 11-14, 4 = 15-18 (09-12), 5 = 19-22 (13-16)

test('New York hour to H4 block', () => {
  assert.deepEqual([17, 20, 21, 0, 1, 4, 5, 8, 9, 12, 13, 16].map(blockOf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(nyOf(Date.UTC(2020, 0, 6, 23) / 1000).hour, 18);
});

test('widest block, its direction and the day direction; read from the signal day and before only', () => {
  // day 25: block 4 (09-12 New York) rises 3 with a wide range, the day closes down overall
  const wide = (k, h) => (k !== 25 ? null : h >= 15 && h <= 18 ? { o: 100 + (h - 15), h: 101 + (h - 15) + 1, l: 100 + (h - 15) - 1, c: 101 + (h - 15) }
    : h === 22 ? { o: 103, h: 103.2, l: 96.8, c: 97 } : h > 18 ? { o: 103, h: 103.4, l: 102.6, c: 103 } : null);
  const D = toDays(h1Days(32, wide)), i = D.findIndex((d) => d.bars.some((b) => b.o === 101));
  const s = setup(D, i);
  assert.ok(s);
  assert.equal(blocks(D[i])[4].c - blocks(D[i])[4].o, 4);
  // block 5 holds the 103 -> 97 drop (range 6.6) and is the widest: direction down, day direction down
  assert.equal(s.dom, 5); assert.equal(s.domDir, -1); assert.equal(s.dayDir, -1);
  assert.equal(TESTS.T1.side(s), -1); assert.equal(TESTS.T2.side(s), 0);
  // every later price changed: the setup's signal and ATR stay
  const later = (k, h) => (k <= 25 ? wide(k, h) : { o: 50, h: 300, l: 10, c: 70 });
  const s2 = setup(toDays(h1Days(32, later)), i);
  assert.equal(s2.dom, s.dom); assert.equal(s2.domDir, s.domDir); assert.equal(s2.dayDir, s.dayDir); assert.equal(s2.atr, s.atr);
  assert.equal(setup(D, ATR_N - 1), null);
});

test('T2 / T3 fire when the day closes against the widest block', () => {
  // block 4 rises 6 wide, then the day sells off below its open in small candles
  const tw = (k, h) => (k !== 25 ? null : h >= 15 && h <= 18 ? { o: 100 + 1.5 * (h - 15), h: 101.5 + 1.5 * (h - 15) + 3, l: 100 + 1.5 * (h - 15) - 3, c: 101.5 + 1.5 * (h - 15) }
    : h > 18 ? { o: 106 - 2.1 * (h - 19), h: 106 - 2.1 * (h - 19) + 0.3, l: 106 - 2.1 * (h - 19) - 2.4, c: 106 - 2.1 * (h - 18) } : null);
  const D = toDays(h1Days(32, tw)), i = D.findIndex((d) => d.bars.some((b) => b.c === 101.5));
  const s = setup(D, i), B = blocks(D[i]);
  assert.equal(s.dom, 4); assert.equal(s.domDir, 1); assert.equal(s.dayDir, -1);
  assert.ok(B[4].h - B[4].l > B[5].h - B[5].l);
  assert.equal(TESTS.T2.side(s), 1); assert.equal(TESTS.T3.side(s), 1);
});

test('trade: next day entry, stop 1 ATR, stop first with a gap, time exit; costs', () => {
  const D = toDays(h1Days(30)), s = setup(D, 25);
  let t = simulate(s, 1, 1);
  assert.equal(t.how, 'time'); assert.equal(t.entry, 100); assert.equal(t.exit, 100); assert.equal(t.gross, 0);
  assert.equal(t.entryT, D[26].bars[0].t); assert.equal(t.exitT, D[26].bars.at(-1).t + H);
  assert.ok(Math.abs(t.cost - RT / s.atr) < 1e-12);
  t = simulate(s, 1, 3); assert.equal(t.exitT, D[28].bars.at(-1).t + H);
  const gap = { ...s, next: [{ ...s.next[0], bars: s.next[0].bars.map((b, j) => (j === 2 ? { ...b, o: 98, l: 97.5, h: 98.2, c: 98 } : b)) }, ...s.next.slice(1)] };
  t = simulate(gap, 1, 1); assert.equal(t.how, 'stop'); assert.equal(t.exit, 98); assert.ok(Math.abs(t.gross + 2) < 1e-9);
  const touch = { ...s, next: [{ ...s.next[0], bars: s.next[0].bars.map((b, j) => (j === 2 ? { ...b, h: 101.5 } : b)) }, ...s.next.slice(1)] };
  t = simulate(touch, -1, 1); assert.equal(t.how, 'stop'); assert.equal(t.exit, 101); assert.ok(Math.abs(t.gross + 1) < 1e-9);
});

test('baseline per year and side, Holm, month t', () => {
  const D = toDays(h1Days(30)), S = []; for (let i = 0; i < D.length; i++) { const s = setup(D, i); if (s) S.push(s); }
  const b = baseline(S, 1); assert.ok(Math.abs(b.get('2020:1') + RT) < 1e-9 && Math.abs(b.get('2020:-1') + RT) < 1e-9);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  assert.equal(monthT([{ day: '2020-01-05', net: 1 }, { day: '2020-02-05', net: 1 }], ['2020-01-01', '2020-03-31']).months, 3);
});

test('the report says what result.json says', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passAlone, []);
  const line = MD.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line.startsWith('**Verdict: FAIL, 0 of 3')); assert.ok(line.length < 220);
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3), tt = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  const T1 = R.tests.T1;
  assert.ok(line.includes(`lift ${f(T1.oos.lift)}R, t ${tt(T1.oos.tLift).replace('+', '')}, net ${f(T1.oos.net)}R a trade, n ${T1.oos.n.toLocaleString('en-US')}`));
  for (const k of ['T1', 'T2', 'T3']) { const x = R.tests[k]; assert.equal(x.pass, false);
    assert.ok(MD.includes(`| ${x.is.n} | ${f(x.is.gross)} / ${f(x.is.net)} | ${f(x.is.lift)} (${tt(x.is.tLift)}) |`), k);
    assert.ok(MD.includes(`| ${x.oos.n} | ${f(x.oos.gross)} / ${f(x.oos.net)} | ${tt(x.oos.tGross)} / ${tt(x.oos.t)} | ${f(x.oos.net2x)} | ${f(x.oos.lift)} (${tt(x.oos.tLift)}) | ${x.holm.toFixed(3)} | ${x.placebo.beaten} of 40 | ${x.control.beaten} of 40 |`), k);
    assert.ok(x.oos.n >= 100 && x.is.n >= 100); }
  assert.equal(R.costs.roundTrip, 0.6); assert.deepEqual(R.windows, { is: ['2007-01-01', '2016-12-31'], oos: ['2017-01-01', '2026-10-31'] });
});
