// research/edge/gold-metals-confirm: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { breakouts, signals, trade, stream, baseline, addExcess, monthSums, holm, lcg, HOLD, RT, DAY } from '../research/edge/gold-metals-confirm/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
// common days: weekdays only, closes per key from functions of the index
function mkDays(n, f) {
  const out = []; let t = T0;
  for (let i = 0; i < n; i++) { while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY; out.push({ t, ...f(i) }); t += DAY; }
  return out;
}
const flat = (i) => 100 + (i % 2) * 0.5;

test('breakout needs 20 earlier days and reads no later day', () => {
  const days = mkDays(30, (i) => ({ xau: i === 25 ? 200 : flat(i), xag: flat(i), xpt: flat(i), xpd: flat(i) }));
  const b = breakouts(days, 'xau');
  assert.equal(b[19], null); assert.equal(b[20], 0); assert.equal(b[25], 1);
  // changing a later close never changes an earlier breakout
  const later = days.map((d, i) => (i === 29 ? { ...d, xau: 1 } : d));
  assert.deepEqual(breakouts(later, 'xau').slice(0, 29), b.slice(0, 29));
});

test('confirmation counts metals breaking the same side within three days', () => {
  const days = mkDays(30, (i) => ({ xau: i === 25 ? 200 : flat(i), xag: i === 23 ? 200 : flat(i), xpt: i === 25 ? 200 : flat(i), xpd: i === 22 ? 200 : flat(i) }));
  const s = signals(days).find((x) => x.i === 25);
  assert.equal(s.side, 1); assert.equal(s.conf, 2); assert.equal(s.confirmed, true);   // xag (2 days before) + xpt; xpd 3 days before = no
  const dn = mkDays(30, (i) => ({ xau: i === 25 ? 50 : flat(i), xag: i === 25 ? 200 : flat(i), xpt: flat(i), xpd: flat(i) }));
  const s2 = signals(dn).find((x) => x.i === 25);
  assert.equal(s2.side, -1); assert.equal(s2.conf, 0); assert.equal(s2.confirmed, false);   // a breakout the other way does not confirm
});

const bar = (time, o, h, l, c) => ({ time, open: o, high: h, low: l, close: c });
function goldBars(n, f) { const out = []; let t = T0; for (let i = 0; i < n; i++) { while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY; out.push(bar(t, ...f(i))); t += DAY; } return out; }

test('trade: stop 2 x ATR(20), stop first, 15-candle hold, costs and financing on buys', () => {
  const g = goldBars(60, (i) => [100, 101, 99, 100]);   // true range 2 -> ATR 2 -> 1R = $4
  const tr = trade(g, 30, 1);
  assert.equal(tr.risk, 4); assert.equal(tr.kind, 'time'); assert.equal(tr.k, 30 + HOLD - 1);
  const fin = nights(tr.t, tr.c) * FIN.xau.long * 100 / 4;
  assert.ok(Math.abs(tr.net - (0 - RT / 4 - fin)) < 1e-12);
  const sh = trade(g, 30, -1); assert.ok(Math.abs(sh.net + RT / 4) < 1e-12);   // sells: no financing
  const g2 = goldBars(60, (i) => (i === 33 ? [100, 101, 95, 99] : [100, 101, 99, 100]));
  const st = trade(g2, 30, 1); assert.equal(st.kind, 'stop'); assert.equal(st.exit, 96); assert.equal(st.k, 33);
  const g3 = goldBars(60, (i) => (i === 33 ? [94, 95, 93, 94] : [100, 101, 99, 100]));
  assert.equal(trade(g3, 30, 1).kind, 'gap');
  assert.equal(trade(g, 50, 1), null);   // runs past the data
});

test('stream holds one position at a time; excess subtracts the same-side baseline', () => {
  const g = goldBars(120, (i) => [100 + i * 0.1, 101 + i * 0.1, 99 + i * 0.1, 100.1 + i * 0.1]);
  const sigs = [g[40], g[42], g[60]].map((b) => ({ t: Math.floor(b.time / DAY) * DAY, side: 1, conf: 2 }));
  const s = stream(g, sigs); assert.equal(s.length, 2);
  const days = g.map((b) => ({ t: Math.floor(b.time / DAY) * DAY }));
  const base = baseline(g, days, days[30].t, days[80].t);
  assert.ok(base[1].net > 0 && base[-1].net < 0);
  const ex = addExcess(s, base); assert.ok(Math.abs(ex[0].excess - (ex[0].net - base[1].net)) < 1e-12);
});

test('month sums, Holm and the seeded generator', () => {
  const from = Date.UTC(2020, 0, 1) / 1000, end = Date.UTC(2020, 2, 31) / 1000;
  assert.deepEqual(monthSums([{ c: Date.UTC(2020, 0, 9) / 1000, v: 1 }, { c: Date.UTC(2020, 2, 9) / 1000, v: 2 }], from, end, 'v'), [1, 0, 2]);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const a = lcg(7), b = lcg(7); assert.equal(a(), b()); assert.notEqual(lcg(1)(), lcg(2)());
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-metals-confirm/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-metals-confirm/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.includes('FAIL, 0 of 3') && vl.length < 260);
  const [T1, T2, T3] = r.tests;
  assert.equal(T1.pass, false);
  for (const s of [String(T1.oos.n), T1.oos.mean.toFixed(3), T1.oos.tMonth.toFixed(2), T1.is.mean.toFixed(3)]) assert.ok(vl.includes(s), s);
  for (const s of [T1.oos.x2.toFixed(3), T1.is.tMonth.toFixed(2), T2.oos.tMonth.toFixed(2), T3.oos.tMonth.toFixed(2), T3.oos.mean.toFixed(3), String(T1.placebo.beaten) + ' of 40'])
    assert.ok(md.includes(s), s);
  assert.equal(T1.placebo.t.length, 40);
  const w = r.windows.oos;
  for (const s of [w.baseline.long.net.toFixed(3), w.baseline.short.net.toFixed(3), w.confirmed.medianStop.toFixed(2)]) assert.ok(md.includes(s.replace('-', '-')), s);
  assert.ok(w.confirmed.medianStop >= 10);
});
