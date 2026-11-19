// Time-series momentum on gold: the signal, the volatility target, the stop, no look-ahead, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weekdays, monthEnds, ewmaVol, atr, weight, direction, holdMonth, run, stats, holm, P } from '../research/edge/gold-tsmom/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

// hand-made weekday candles from 2020-01-01, close path given; open = previous close, high / low +-1
function path(closes, from = Date.UTC(2020, 0, 1) / 1000) {
  const rows = []; let t = from, prev = closes[0];
  for (const c of closes) {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += 86400;
    rows.push([t, prev, Math.max(prev, c) + 1, Math.min(prev, c) - 1, c]); prev = c; t += 86400;
  }
  return weekdays(rows);
}
const rising = (n, a = 1000, step = 1) => [...Array(n)].map((_, i) => a + i * step);

test('weekend stubs are dropped and month ends are the last weekday of each month', () => {
  const sat = Date.UTC(2020, 1, 1) / 1000, fri = Date.UTC(2020, 0, 31) / 1000, mon = Date.UTC(2020, 1, 3) / 1000;
  const b = weekdays([[mon, 1, 1, 1, 1], [sat, 1, 1, 1, 1], [fri, 1, 1, 1, 1]]);
  assert.deepEqual(b.map((x) => x.t), [fri, mon]);
  assert.deepEqual(monthEnds(b), [0]);
});

test('signal: sign of the lookback return, long / short and long / flat', () => {
  assert.equal(direction(0.1, 'ls'), 1); assert.equal(direction(-0.1, 'ls'), -1);
  assert.equal(direction(-0.1, 'lf'), 0); assert.equal(direction(0.1, 'lf'), 1); assert.equal(direction(0, 'ls'), 0);
  const up = run(path(rising(400)), { variant: 'ls' }), down = run(path(rising(400, 2000, -1)), { variant: 'ls' });
  assert.ok(up.length > 0 && up.every((r) => r.dir === 1 && r.signal > 0));
  assert.ok(down.every((r) => r.dir === -1));
  assert.ok(run(path(rising(400, 2000, -1)), { variant: 'lf' }).every((r) => r.dir === 0 && r.ret === 0));
  // the first traded month has 12 month ends behind it
  const me = monthEnds(path(rising(400)));
  assert.equal(up.length, me.length - 1 - P.lookback);
});

test('volatility target: w = 0.10 / sigma, capped at 3; EWMA of a constant 1 % daily move is 1 % x sqrt 261', () => {
  assert.equal(weight(0.2), 0.5); assert.equal(weight(0.01), 3); assert.equal(weight(0), 0);
  const cl = [100]; for (let i = 1; i < 200; i++) cl.push(cl[i - 1] * Math.exp(i % 2 ? 0.01 : -0.01));
  const b = path(cl);
  assert.ok(Math.abs(ewmaVol(b, 150) - 0.01 * Math.sqrt(261)) < 1e-9);
  assert.equal(ewmaVol(b, 59), null);
});

test('every position has a catastrophe stop 3 x ATR(20) from entry; a gap through it fills at the open', () => {
  const cl = rising(64, 1000, 0);
  const b = path(cl), a = 59;
  const A = atr(b, a); assert.ok(Math.abs(A - 2) < 1e-9); // high-low = 2 on flat candles
  b[a + 1].o = 1000; b[a + 2].o = 1000; b[a + 2].l = 993; // 3 x 2 = 6 under 1000 = 994: touched
  const h = holdMonth(b, a, a + 2, 1, 1, { costs: false });
  assert.equal(h.sl, 994); assert.equal(h.stopped, true); assert.equal(h.exit, 994);
  b[a + 2].o = 990; b[a + 2].l = 989;
  assert.equal(holdMonth(b, a, a + 2, 1, 1, { costs: false }).exit, 990);
  const s = holdMonth(b, a, a + 2, -1, 1, { costs: false }); assert.equal(s.sl, 1006); assert.equal(s.stopped, false);
});

test('costs: $0.30 a round trip x w, financing on longs only by nights x FIN', () => {
  const b = path([...rising(70, 1000, 0)]), a = 59, bb = 66;
  const L = holdMonth(b, a, bb, 1, 2), S = holdMonth(b, a, bb, -1, 2);
  assert.ok(Math.abs(L.cost - 2 * 0.3 / 1000) < 1e-12);
  assert.equal(L.nights, nights(b[a + 1].t, b[bb + 1].t)); assert.ok(L.nights > 0);
  assert.ok(Math.abs(L.fin - L.nights * FIN.xau.long * 2) < 1e-12);
  assert.equal(S.fin, 0); assert.equal(S.nights, 0);
});

test('no look-ahead: the signal, weight and stop of a month never read a later price', () => {
  const cl = []; for (let i = 0; i < 700; i++) cl.push(1000 + 100 * Math.sin(i / 37) + i * 0.3);
  const b = path(cl), base = run(b, { variant: 'ls' }), me = monthEnds(b), cut = me[20];
  const c = b.map((x, i) => (i > cut ? { ...x, o: x.o * 3, h: x.h * 3, l: x.l * 0.2, c: x.c * 0.5 } : x));
  const alt = run(c, { variant: 'ls' });
  const before = base.filter((r) => r.month <= new Date(b[cut].t * 1000).toISOString().slice(0, 7));
  assert.ok(before.length > 3);
  for (const r of before.slice(0, -1)) {
    const o = alt.find((x) => x.month === r.month);
    assert.deepEqual([o.signal, o.vol, o.dir, o.w, o.sl, o.ret], [r.signal, r.vol, r.dir, r.w, r.sl, r.ret], r.month);
  }
  // the month that opens right after the cut: its signal, size and stop distance are fixed; only its fill and result may change
  const r = base.find((x) => x.month === new Date(b[cut + 1].t * 1000).toISOString().slice(0, 7)), o = alt.find((x) => x.month === r.month);
  assert.deepEqual([o.signal, o.vol, o.w, +(o.sl - o.entry).toFixed(9)], [r.signal, r.vol, r.w, +(r.sl - r.entry).toFixed(9)]);
});

test('statistics and Holm', () => {
  const s = stats([0.01, -0.02, 0.03, 0.01]);
  assert.equal(s.n, 4); assert.equal(s.sumPct, 3); assert.equal(s.ddPct, -2);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  assert.deepEqual(holm([0.2013, 0.1515]), [0.303, 0.303]);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-tsmom/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-tsmom/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /^\*\*Verdict: FAIL\*\*/m);
  assert.equal(r.checks.ls.pass, false); assert.equal(r.checks.lf.pass, false);
  const row = (name, s) => assert.match(md, new RegExp(`${name}[^|]*\\| ${s.n} \\| ${s.sharpe.toFixed(2)} \\| ${s.t.toFixed(2)} \\| \\+${s.annPct.toFixed(2)} \\| \\+${s.sumPct.toFixed(1)}% \\| ${s.ddPct.toFixed(1)}% \\| ${s.retPerDd.toFixed(2)} \\|`), name);
  row('Long / short, Apr 2007', r.variants.ls.conf); row('Long / flat, Apr 2007', r.variants.lf.conf);
  row('Long / short, Jan 2018', r.variants.ls.late); row('Long / flat, Jan 2018', r.variants.lf.late);
  row('Buy-and-hold 1x, Apr 2007', r.buyHold.conf.gross); row('Buy-and-hold 1x, Jan 2018', r.buyHold.late.gross);
  assert.match(md, new RegExp(`Holm-adjusted p ${r.checks.ls.holmP}`));
  for (const [k, l] of [['ls', 1], ['ls', 3], ['ls', 6], ['lf', 1], ['lf', 3], ['lf', 6]]) {
    const x = r.lookbacks[k][l], f = (v) => (v < 0 ? '-' : '') + Math.abs(v).toFixed(2);
    assert.ok(md.includes(`${f(x.conf.sharpe)} \\| ${f(x.late.sharpe)}`), `${k} ${l}`);
  }
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-gold-tsmom.md', import.meta.url)), 'no proposal on a FAIL');
});
