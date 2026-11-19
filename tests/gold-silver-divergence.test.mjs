// gold-silver-divergence study: the pre-registered rule on hand-made candles, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from '../research/edge/gold-silver-divergence/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const DIR = new URL('../research/edge/gold-silver-divergence/', import.meta.url);
const T0 = Date.UTC(2021, 2, 1, 0) / 1000; // Monday 00:00 UTC
const H = 3600;
// joined series from close arrays; flat candles (o = h = l = c) unless overridden
function build(gc, sc, start = T0) {
  return gc.map((c, k) => ({ t: start + k * H, g: { o: c, h: c, l: c, c }, s: { o: sc[k], h: sc[k], l: sc[k], c: sc[k] } }));
}
const flat = (n, v) => new Array(n).fill(v);

test('joinBars keeps only hours both markets have', () => {
  const J = D.joinBars([[1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3]], [[3, 9, 9, 9, 9], [1, 8, 8, 8, 8]]);
  assert.deepEqual(J.map((x) => x.t), [1, 3]);
  assert.equal(J[1].s.c, 9);
});

test('divergent high and low on hand-made candles', () => {
  // prior 24: gold 100 with one 101 bump, silver 20 with one 21 bump; candle 24 gold 102 (new high), silver 20.5 (< 21)
  const g = flat(24, 100), s = flat(24, 20); g[5] = 101; s[5] = 21;
  let J = build([...g, 102], [...s, 20.5]);
  assert.equal(D.eventAt(J, 24), 'high');
  assert.equal(D.eventAt(J, 24, 'gold'), 'high');
  // silver confirms (21.5 > 21): no divergence, still a gold-only event
  J = build([...g, 102], [...s, 21.5]);
  assert.equal(D.eventAt(J, 24), null);
  assert.equal(D.eventAt(J, 24, 'gold'), 'high');
  // silver equal to its max is a confirmation too ("strictly below")
  J = build([...g, 102], [...s, 21]);
  assert.equal(D.eventAt(J, 24), null);
  // low mirror
  const g2 = flat(24, 100), s2 = flat(24, 20); g2[3] = 99; s2[3] = 19;
  J = build([...g2, 98], [...s2, 19.5]);
  assert.equal(D.eventAt(J, 24), 'low');
  J = build([...g2, 98], [...s2, 18.5]);
  assert.equal(D.eventAt(J, 24), null);
  // gold at its max is not a new high
  J = build([...g, 101], [...s, 20]);
  assert.equal(D.eventAt(J, 24), null);
  // not enough look-back
  assert.equal(D.eventAt(J, 23), null);
});

test('no look-ahead: an event, ATR and entry check read nothing after the candle', () => {
  const g = flat(24, 100), s = flat(24, 20); g[5] = 101; s[5] = 21;
  const a = build([...g, 102, 103, 104], [...s, 20.5, 30, 30]);
  const b = build([...g, 102, 50, 1], [...s, 20.5, 1, 99]);
  for (const i of [24]) {
    assert.equal(D.eventAt(a, i), D.eventAt(b, i));
    assert.equal(D.atrAt(a, i), D.atrAt(b, i));
  }
  const sa = D.signals(a), sb = D.signals(b);
  assert.deepEqual(sa.filter((x) => x.i === 24), sb.filter((x) => x.i === 24));
});

test('rollover skip and the next-candle check', () => {
  const g = flat(24, 100), s = flat(24, 20); g[5] = 101; s[5] = 21;
  // event candle at index 24; choose start so that the entry candle (index 25) begins at 21:00 or 22:00 UTC
  for (const hr of [21, 22]) {
    const start = Date.UTC(2021, 2, 2, hr) / 1000 - 25 * H;
    const J = build([...g, 102, 102], [...s, 20.5, 20.5], start);
    assert.equal(new Date(J[25].t * 1000).getUTCHours(), hr);
    assert.equal(D.entryOk(J, 24), false);
  }
  const start = Date.UTC(2021, 2, 2, 20) / 1000 - 25 * H;
  const J = build([...g, 102, 102], [...s, 20.5, 20.5], start);
  assert.equal(D.entryOk(J, 24), true);
  // a gap: the next candle starts two hours later
  J[25].t += H;
  assert.equal(D.entryOk(J, 24), false);
});

function tradeBars(path) { // 25 look-back candles with true range 1 each (ATR = 1), then the given gold candles [o,h,l,c]
  const J = [];
  for (let k = 0; k < 25; k++) J.push({ t: T0 + k * H, g: { o: 100, h: 100.5, l: 99.5, c: 100 }, s: { o: 20, h: 20, l: 20, c: 20 } });
  path.forEach(([o, h, l, c], k) => J.push({ t: T0 + (25 + k) * H, g: { o, h, l, c }, s: { o: 20, h: 20, l: 20, c: 20 } }));
  return J;
}

test('stop and target order, gaps, time exit', () => {
  const sig = { i: 24, ev: 'high', atr: 1 };
  // sell at 100: stop 101, target 98.5; one candle holding both is a stop
  let J = tradeBars([[100, 101.2, 98.0, 99]]);
  let tr = D.simTrade(J, sig, 'sell');
  assert.equal(tr.how, 'stop'); assert.equal(tr.gross, -1);
  // target only
  J = tradeBars([[100, 100.4, 98.4, 98.6]]);
  tr = D.simTrade(J, sig, 'sell');
  assert.equal(tr.how, 'target'); assert.equal(tr.exit, 98.5); assert.ok(Math.abs(tr.gross - 1.5) < 1e-12);
  // gap through the stop fills at the open (worse than -1R)
  J = tradeBars([[100, 100.2, 99.9, 100], [101.6, 101.8, 101.5, 101.7]]);
  tr = D.simTrade(J, sig, 'sell');
  assert.equal(tr.how, 'stop-gap'); assert.ok(Math.abs(tr.gross + 1.6) < 1e-12);
  // a gap through the target fills at the target, never better
  J = tradeBars([[100, 100.2, 99.9, 100], [97, 97.2, 96.8, 97]]);
  tr = D.simTrade(J, sig, 'sell');
  assert.equal(tr.how, 'target'); assert.equal(tr.exit, 98.5);
  // nothing hit: out at the close of the 12th candle
  const quiet = Array.from({ length: 14 }, (_, k) => [100, 100.3, 99.7, 100 - k * 0.01]);
  J = tradeBars(quiet);
  tr = D.simTrade(J, sig, 'buy');
  assert.equal(tr.how, 'time'); assert.equal(tr.exitIdx, 25 + 11); assert.equal(tr.exit, quiet[11][3]);
  // data ending before the exit: no trade
  J = tradeBars(quiet.slice(0, 5));
  assert.equal(D.simTrade(J, sig, 'buy'), null);
  // every trade has a stop on the losing side
  tr = D.simTrade(tradeBars(quiet), sig, 'sell');
  assert.ok(tr.stop > tr.entry && tr.target < tr.entry);
});

test('side rule: fade sells a divergent high, follow buys it', () => {
  assert.equal(D.sideOf('high', 'fade'), 'sell');
  assert.equal(D.sideOf('low', 'fade'), 'buy');
  assert.equal(D.sideOf('high', 'follow'), 'buy');
  assert.equal(D.sideOf('low', 'follow'), 'sell');
});

test('costs: $0.30 a round trip, financing on longs only', () => {
  const sig = { i: 24, ev: 'low', atr: 1 };
  const quiet = Array.from({ length: 14 }, () => [100, 100.3, 99.7, 100]);
  const J = tradeBars(quiet);
  const b = D.simTrade(J, sig, 'buy'), s = D.simTrade(J, sig, 'sell');
  assert.ok(Math.abs(b.costR - 0.30) < 1e-12 && Math.abs(s.costR - 0.30) < 1e-12);
  // the 12 candles from Tuesday 01:00 to 13:00 UTC hold no 22:00 rollover
  assert.equal(b.nights, 0); assert.equal(b.finR, 0);
  // shifted so a 22:00 rollover falls inside the hold: the buy pays, the sell does not
  const shift = (Date.UTC(2021, 2, 1, 15) / 1000) - T0;
  const J2 = J.map((x) => ({ ...x, t: x.t + shift }));
  const b2 = D.simTrade(J2, sig, 'buy'), s2 = D.simTrade(J2, sig, 'sell');
  const n = nights(J2[25].t, J2[36].t + H);
  assert.equal(n, 1); assert.equal(b2.nights, 1);
  assert.ok(Math.abs(b2.finR - n * FIN.xau.long * 100 / 1) < 1e-12);
  assert.equal(s2.finR, 0);
  assert.ok(Math.abs(b2.net - (b2.gross - 0.30 - b2.finR)) < 1e-12);
});

test('one trade at a time, month sums, Holm, percentile', () => {
  const sig = (i) => ({ i, ev: 'high', atr: 1 });
  const quiet = Array.from({ length: 30 }, () => [100, 100.3, 99.7, 100]);
  const J = tradeBars(quiet);
  const st = D.stream(J, [sig(24), sig(26), sig(36), sig(37)], 'fade');
  // the first trade runs candles 25-36 and closes at the end of 36; the signal at 36 enters at 37: allowed; 26 skipped
  assert.deepEqual(st.map((x) => x.t), [J[25].t, J[37].t]);
  const ms = D.monthSums([{ t: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { t: Date.UTC(2020, 2, 5) / 1000, net: -2 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 1) / 1000);
  assert.deepEqual(ms, [1, 0, -2, 0]);
  assert.deepEqual(D.holm({ a: 0.02, b: 0.04 }), { a: true, b: true });
  assert.deepEqual(D.holm({ a: 0.03, b: 0.04 }), { a: false, b: false });
  assert.equal(D.pct([1, 2, 3, 4, 5], 0.95), 4.8);
  assert.ok(Math.abs(D.pOne(2) - 0.02275) < 1e-4);
});

test('RESULT.md matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.match(md.split('\n').slice(0, 4).join(' '), new RegExp(`Verdict: ${r.verdict}`));
  for (const v of ['fade', 'follow']) {
    assert.equal(r.variants[v].pass, false);
    for (const w of ['decisive', 'replication']) {
      const x = r.variants[v][w], name = v[0].toUpperCase() + v.slice(1);
      const row = md.split('\n').find((l) => l.startsWith(`| ${name} | ${w === 'decisive' ? '2020-now' : '2008-2019'}`));
      assert.ok(row, `${v} ${w} row`);
      const c = row.split('|').map((q) => q.trim());
      assert.equal(+c[3], x.n); assert.equal(+c[4], x.net); assert.equal(+c[5], x.gross); assert.equal(+c[6], x.total);
      assert.equal(+c[7], x.win); assert.equal(+c[8], x.tMonth); assert.equal(+c[9], x.tTrade); assert.equal(c[10], `${x.dd.toFixed(2)}R`);
    }
    const p = r.placebo[v], name = v[0].toUpperCase() + v.slice(1);
    const row = md.split('\n').find((l) => l.startsWith(`| ${name} | ${r.variants[v].decisive.net.toFixed(3)} |`));
    assert.ok(row, `${v} placebo row`);
    const c = row.split('|').map((q) => q.trim());
    assert.equal(+c[3], p.median); assert.equal(+c[4], p.p95); assert.equal(c[5], `${p.min.toFixed(3)} to ${p.max.toFixed(3)}`);
    assert.equal(p.values.length, 40);
  }
  assert.match(md, new RegExp(r.events.divergent.toLocaleString('en-US')));
  assert.match(md, /stand-alone/);
});
