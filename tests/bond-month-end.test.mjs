// The bond month-end study: trading days counted from the month's end with holidays, the stop, no look-ahead, the report
// against result.json. Offline: synthetic candles only, plus the committed result.json and RESULT.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isUsTradingDay, calendar, fromEnd, buildDays, atrAt, trade, netOf, windowTrades, verdictOf, holm, STOP_ATR } from '../research/edge/bond-month-end/run.mjs';

const DIR = new URL('../research/edge/bond-month-end/', import.meta.url);

test('count from the month end on a hand-made calendar: holidays are not trading days', () => {
  const hol = new Set(['2030-04-26', '2030-04-29']);   // a made-up Friday and Monday off near the month's end
  const isT = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w >= 1 && w <= 5 && !hol.has(d); };
  const days = calendar('2030-04-01', '2030-05-31', isT), L = fromEnd(days);
  assert.equal(L['2030-04-30'], -1);
  assert.equal(L['2030-04-25'], -2);                    // 26 and 29 skipped
  assert.equal(L['2030-04-24'], -3);
  assert.equal(L['2030-04-23'], -4);                    // the rule's entry day
  assert.equal(L['2030-04-26'], undefined);
  assert.equal(L['2030-05-31'], -1);
  assert.equal(L['2030-05-28'], -4);
});

test('US bond-market calendar: full holidays out, half days in, observed Christmas, special closures', () => {
  for (const d of ['2024-11-28', '2016-05-30', '2021-12-24', '2010-12-24', '2012-10-30', '2012-10-29', '2023-06-19', '2024-10-14', '2024-11-11', '2024-03-29', '2025-01-09'])
    assert.equal(isUsTradingDay(d), false, d);
  for (const d of ['2024-11-29', '2024-12-24', '2021-12-31', '2021-06-18', '2024-11-27', '2024-12-31'])
    assert.equal(isUsTradingDay(d), true, d);
  const L = fromEnd(calendar('2024-11-01', '2024-11-30', isUsTradingDay));
  assert.deepEqual(['2024-11-25', '2024-11-26', '2024-11-27', '2024-11-29'].map((d) => L[d]), [-4, -3, -2, -1]);   // Thanksgiving skipped
  const M = fromEnd(calendar('2016-05-01', '2016-05-31', isUsTradingDay));
  assert.equal(M['2016-05-26'], -3); assert.equal(M['2016-05-25'], -4);   // Memorial Day 30 May
});

// synthetic daily candles, one per weekday at 00:00 UTC; price from f(i)
function synth(from, to, f) {
  const rows = []; let i = 0;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000, e = Date.parse(to + 'T00:00:00Z') / 1000; t <= e; t += 86400) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = f(i - 1), c = f(i); rows.push([t, o, Math.max(o, c) + 0.2, Math.min(o, c) - 0.2, c, 100]); i++;
  }
  return rows;
}
const wk = (d) => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w >= 1 && w <= 5; };

test('the stop: 2 x ATR(20) under the entry; a touch fills at the stop, a gap at the open; R in stop units', () => {
  const rows = synth('2024-01-01', '2024-03-29', (i) => 100 + 0.1 * Math.sin(i));
  const days = calendar('2024-01-01', '2024-03-31', wk), D = buildDays(rows, days);
  const e = D.findIndex((x) => x.d === '2024-03-22'), atr = atrAt(D, e);
  const base = trade(rows, D, e, e + 3, 0.0003);
  assert.ok(Math.abs(base.entry - base.stop - STOP_ATR * atr) < 1e-4);
  assert.equal(base.how, 'time');
  const touch = rows.map((r) => r.slice()), k = D[e + 2].ri; touch[k][3] = base.stop - 1;
  const T = trade(touch, D, e, e + 3, 0.0003);
  assert.equal(T.how, 'stop'); assert.ok(Math.abs(T.gross + 1) < 1e-9);
  const gap = rows.map((r) => r.slice()); gap[k][1] = base.stop - base.dist; gap[k][3] = base.stop - base.dist - 0.1;
  const G = trade(gap, D, e, e + 3, 0.0003);
  assert.equal(G.how, 'gap'); assert.ok(Math.abs(G.gross + 2) < 1e-3);
  assert.ok(netOf(base) < base.gross && netOf(base, 0) === base.gross && netOf(base, 2) < netOf(base));
});

test('no look-ahead: entry, ATR and stop do not move when prices after the entry change; the result ignores prices after the exit', () => {
  const f = (i) => 100 + 0.05 * i + 0.3 * Math.cos(i / 3);
  const rows = synth('2024-01-01', '2024-04-30', f), days = calendar('2024-01-01', '2024-04-30', wk), D = buildDays(rows, days);
  const e = D.findIndex((x) => x.d === '2024-03-22'), a = trade(rows, D, e, e + 3, 0.0003);
  const later = rows.map((r) => r[0] > D[e].t ? [r[0], r[1] * 1.1, r[2] * 1.1, r[3] * 1.1, r[4] * 1.1, r[5]] : r);
  const b = trade(later, D, e, e + 3, 0.0003);
  assert.equal(b.entry, a.entry); assert.equal(b.stop, a.stop); assert.equal(atrAt(buildDays(later, days), e), atrAt(D, e));
  const after = rows.map((r) => r[0] > D[e + 3].t ? [r[0], 1, 1, 1, 1, r[5]] : r);
  const c = trade(after, buildDays(after, days), e, e + 3, 0.0003);
  assert.equal(c.gross, a.gross);
  // the rule's own trades: entry at TD-4, exit at TD-1 of the same month
  const L = fromEnd(days), W = windowTrades(rows, D, L, 4, 0.0003).trades;
  for (const t of W) { assert.equal(L[t.entryD], -4); assert.equal(L[t.exitD], -1); assert.equal(t.entryD.slice(0, 7), t.exitD.slice(0, 7)); }
  assert.ok(W.length >= 1);
});

test('Holm over two tests', () => {
  assert.deepEqual(holm([0.01, 0.04]).map((x) => +x.toFixed(4)), [0.02, 0.04]);
  assert.deepEqual(holm([0.3, 0.2]).map((x) => +x.toFixed(4)), [0.4, 0.4]);
});

test('the report says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const V = verdictOf(R.markets);
  assert.equal(V.verdict, R.verdict); assert.equal(V.passed, R.passed);
  assert.deepEqual(V.tests.map((t) => t.pass), R.tests.map((t) => t.pass));
  assert.match(md.split('\n').find((l) => l.startsWith('**Verdict')), new RegExp(`Verdict: ${R.verdict}`));
  const sgn = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x).toFixed(3);
  for (const k of ['usb10y', 'usb30y']) {
    const m = R.markets[k];
    for (const w of ['decisive', 'replication']) {
      assert.ok(md.includes(sgn(m[w].net)), `${k} ${w} net ${m[w].net}`);
      assert.ok(md.includes(m[w].t.toFixed(2)), `${k} ${w} t ${m[w].t}`);
      assert.ok(md.includes(`| ${m[w].n} |`), `${k} ${w} n`);
    }
    assert.ok(md.includes(sgn(m.placebo.p95)), `${k} placebo p95`);
    assert.ok(md.includes(`${m.rank} of ${m.rankOf}`), `${k} rank`);
    for (const x of ['x0', 'x2']) assert.ok(md.includes(sgn(m.cost[x].decisive.net)), `${k} cost ${x}`);
    assert.ok(md.includes(sgn(m.roll.decisive.net)), `${k} roll row`);
  }
  for (const t of R.tests) assert.ok(md.includes(t.holmP.toFixed(2)), `Holm ${t.test}`);
});
