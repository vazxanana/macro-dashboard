// research/edge/gold-comex-calendar: the calendar from the CME rules, the trade on hand-made candles, no look-ahead, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { optionsExpiry, firstNotice, isBiz, addBiz } from '../research/edge/gold-comex-calendar/dates.mjs';
import { prepare, trade, events, monthT, holm, COST } from '../research/edge/gold-comex-calendar/run.mjs';

const dir = new URL('../research/edge/gold-comex-calendar/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

test('calendar: hand-checked expiries and first notice days', () => {
  assert.equal(optionsExpiry(2024, 10), '2024-11-25');   // Thanksgiving 28 Nov out
  assert.equal(optionsExpiry(2025, 2), '2025-03-26');
  assert.equal(optionsExpiry(2025, 10), '2025-11-24');
  assert.equal(optionsExpiry(2024, 2), '2024-03-25');    // Good Friday 29 Mar out
  assert.equal(optionsExpiry(2016, 2), '2016-03-28');    // Good Friday 25 Mar out
  assert.equal(optionsExpiry(2021, 11), '2021-12-28');   // Christmas observed Fri 24 Dec
  assert.equal(firstNotice(2024, 11), '2024-11-29');     // day after Thanksgiving is a business day
  assert.equal(firstNotice(2025, 1), '2025-01-31');
  assert.equal(firstNotice(2026, 0), '2025-12-31');
  assert.equal(isBiz('2021-12-31'), true);               // Saturday New Year 2022 not observed on 31 Dec
  assert.equal(isBiz('2021-06-18'), true);               // Juneteenth only from 2022
  assert.equal(isBiz('2023-06-19'), false);
  assert.equal(addBiz('2024-11-25', -5), '2024-11-18');
  // the Friday clause: Sep 2026's 4th last business day is Fri 25 Sep -> Thu 24 Sep
  assert.equal(optionsExpiry(2026, 8), '2026-09-24');
});

test('events: T3 only before active months, windows of five business days', () => {
  const E = events(2025, 2025);
  const t3 = E.filter((e) => e.test === 'T3').map((e) => e.mk);
  assert.deepEqual(t3, ['2025-01', '2025-03', '2025-05', '2025-07', '2025-09', '2025-11']);
  for (const e of E) assert.equal(addBiz(e.a, 5), e.b);
});

// hand-made weekday candles from 2024-01-01
function rows(n, f) { const out = []; let t = Date.UTC(2024, 0, 1) / 1000;
  while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w < 6) out.push(f(out.length, t)); t += 86400; } return out; }

test('trade: R, stop, costs, financing on longs only', () => {
  const rs = rows(40, (i, t) => [t, 100 + i, 101 + i, 99 + i, 100 + i, 1]);   // TR 2 a day -> ATR 2, risk 4
  const P = prepare(rs), d = (k) => new Date(rs[k][0] * 1000).toISOString().slice(0, 10);
  const L = trade(P, d(25), d(30), 1), S = trade(P, d(25), d(30), -1);
  assert.equal(L.risk, 4); assert.equal(L.R, 5 / 4); assert.ok(L.fin > 0); assert.equal(S.fin, 0);
  assert.ok(Math.abs(L.net - (L.R - COST / 4 - L.fin)) < 1e-12);
  assert.equal(S.how, 'stop');                     // short stop at 125 + 4 = 129 hit on day 29 (high 130)
  assert.equal(S.exit, 129); assert.equal(S.R, -1);
});

test('no look-ahead: prices after the exit and before the ATR window do not move a trade', () => {
  const base = (i, t) => [t, 100 + Math.sin(i), 102 + Math.sin(i), 98 + Math.sin(i), 100 + Math.cos(i), 1];
  const a = rows(60, base), b = a.map((r, i) => i > 35 ? [r[0], 999, 1999, 1, 500, 1] : r);
  const d = new Date(a[25][0] * 1000).toISOString().slice(0, 10), e = new Date(a[30][0] * 1000).toISOString().slice(0, 10);
  assert.deepEqual(trade(prepare(a), d, e, -1), trade(prepare(b), d, e, -1));
});

test('statistics: month sums and Holm', () => {
  const T = [{ a: '2020-01-02', net: 1 }, { a: '2020-01-09', net: 1 }, { a: '2020-02-03', net: 1 }, { a: '2020-03-03', net: 3 }];
  const m = monthT(T); assert.equal(m.months, 3); assert.ok(m.t > 0);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
});

test('report matches result.json, verdict line', () => {
  assert.equal(R.verdict, 'FAIL'); assert.deepEqual(R.passed, []);
  const line = MD.match(/\*\*Verdict: [^\n]*\*\*/)[0];
  assert.ok(line.length < 220, line);
  const T1 = R.tests.T1;
  assert.ok(line.includes(T1.oos.net.toFixed(3)) && line.includes(`n ${T1.oos.n}`) && line.includes(T1.oos.tNet.toFixed(2)));
  for (const k of ['T1', 'T2', 'T3']) { const r = R.tests[k];
    for (const w of ['oos', 'is']) { const x = r[w];
      const sign = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
      assert.ok(MD.includes(`| ${x.n} | ${sign(x.net)} | ${x.tNet.toFixed(2)} | ${sign(x.gross)} |`), `${k} ${w}`); }
    assert.ok(MD.includes(`| ${r.placebo.beaten} |`), `${k} placebo`);
    assert.equal(r.pass, false); }
  assert.ok(!/edge here/.test(MD) || /Nothing is an edge here/.test(MD));
});
