// gold-asia-fx-move: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { windowMove, asiaZ, simulate, costR, atrBefore, dailyOf, TESTS, monthT, holm, H, D, LOOK, COST } from '../research/edge/gold-asia-fx-move/run.mjs';

const dir = new URL('../research/edge/gold-asia-fx-move/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// hourly candles of weekdays from a Monday, price p(t)
function candles(days, p) {
  const out = [], d0 = Math.floor(Date.parse('2020-01-06') / 1000 / D);
  for (let d = d0; d < d0 + days; d++) { const w = new Date(d * D * 1000).getUTCDay(); if (w === 0 || w === 6) continue; for (let h = 0; h < 24; h++) { const t = d * D + h * H, o = p(t), c = p(t + H); out.push({ time: t, open: o, high: Math.max(o, c) + 0.1, low: Math.min(o, c) - 0.1, close: c }); } }
  return out;
}

test('Asian move reads 00:00 open to 06:00 close; a hole gives none', () => {
  const cs = candles(3, (t) => 100 + (t % D) / H);
  const by = new Map(cs.map((b) => [b.time, b])), d = Math.floor(cs[0].time / D);
  assert.ok(Math.abs(windowMove(by, d, 0, 7) - Math.log(107 / 100)) < 1e-12);
  by.delete(d * D + 6 * H); assert.equal(windowMove(by, d, 0, 7), null);
});

test('z uses only earlier days: changing a later day never moves an earlier z', () => {
  let k = 0; const noise = new Map();
  const p = (t) => { const d = Math.floor(t / D); if (!noise.has(d)) noise.set(d, Math.sin(++k * 1.7)); return 100 + noise.get(d) * ((t % D) / H); };
  const cs = candles(140, p), z1 = asiaZ(cs);
  const last = Math.floor(cs.at(-1).time / D), cs2 = cs.map((b) => (Math.floor(b.time / D) === last ? { ...b, close: b.close * 1.5, open: b.open * 1.5 } : b)), z2 = asiaZ(cs2);
  for (const [d, z] of z1) if (d < last) assert.equal(z2.get(d), z);
  assert.ok(z1.size > 0 && z1.size <= 100 - LOOK + 1);
});

test('the three rules', () => {
  assert.equal(TESTS.T1.rule(-1.6), 1); assert.equal(TESTS.T1.rule(-1.4), 0); assert.equal(TESTS.T1.rule(2), 0);
  assert.equal(TESTS.T2.rule(1.5), -1); assert.equal(TESTS.T2.rule(-3), 0);
  assert.equal(TESTS.T3.rule(1.5), 1); assert.equal(TESTS.T3.rule(-1.5), -1); assert.equal(TESTS.T3.rule(0.3), 0);
});

test('simulate: stop first, gap fills at the open, time exit; cost', () => {
  const t = 1e9, mk = (o, h, l, c, i) => ({ time: t + i * H, open: o, high: h, low: l, close: c });
  const a = simulate([mk(100, 101, 99, 100.5, 0), mk(100.5, 103, 100, 102, 1)], 1, 10); assert.equal(a.how, 'time'); assert.equal(a.gross, 0.2);
  const b = simulate([mk(100, 101, 95, 96, 0), mk(85, 86, 80, 81, 1)], 1, 10); assert.equal(b.how, 'stop'); assert.equal(b.exit, 85); assert.equal(b.gross, -1.5);
  const c = simulate([mk(100, 111, 99, 105, 0)], -1, 10); assert.equal(c.exit, 110); assert.equal(c.gross, -1);
  assert.equal(costR(a, 1, 10), COST / 10);   // 07-20 UTC: no rollover crossed
  assert.equal(costR(a, -1, 10, 2), 2 * COST / 10);
});

test('ATR uses only days before the trade day', () => {
  const cs = candles(40, (t) => 100 + Math.sin(t / 7000) * 3), days = dailyOf(cs), d = days.at(-1).d;
  const a = atrBefore(days, d), b = atrBefore(dailyOf(cs.map((x) => (Math.floor(x.time / D) === d ? { ...x, high: x.high + 50 } : x))), d);
  assert.equal(a, b);
});

test('month t and Holm', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const rows = [{ d: Math.floor(Date.parse('2020-01-10') / 1000 / D), v: 1 }, { d: Math.floor(Date.parse('2020-02-10') / 1000 / D), v: 2 }];
  assert.ok(Number.isFinite(monthT(rows, ['2020-01-01', '2020-03-31'], (r) => r.v)));
});

test('the report matches result.json', () => {
  assert.equal(res.verdict, 'FAIL'); assert.deepEqual(res.passed, []);
  const v = md.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(v && v[1].length < 220, 'verdict line under 220 characters');
  const o = res.tests.T1.oos; assert.ok(v[1].includes(`n ${o.n}`) && v[1].includes(`month t ${o.t.toFixed(2)}`) && v[1].includes(o.net.toFixed(3)));
  const f = (x, d = 3) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(d);
  for (const [id, t] of Object.entries(res.tests)) for (const w of ['is', 'oos']) {
    const x = t[w];
    for (const s of [`| ${x.n} |`, `| ${f(x.gross)} | ${f(x.net)} | ${f(x.net2)} | ${f(x.baseline)} | ${f(x.excess)} | ${f(x.tGross, 2)} | ${f(x.t, 2)} | ${f(x.tExcess, 2)} | ${f(x.total, 2)} |`]) assert.ok(md.includes(s), `${id} ${w}: ${s}`);
    assert.ok(md.includes(`${x.placebo.beaten} of 40`) && md.includes(`${x.control.beaten} of 40`), `${id} ${w} placebo / control`);
    assert.ok(x.n >= 100);
  }
  assert.ok(md.includes(`| ${res.tests.T1.holmP.toFixed(2)} |`));
});
