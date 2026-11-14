// gold-h4-pinbar: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { h4Start, toH4, toD1, d1Above, pin, cand, simulate, runTest, TESTS, holm, monthT, RT, BUF, HOLD } from '../research/edge/gold-h4-pinbar/run.mjs';

const dir = new URL('../research/edge/gold-h4-pinbar/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');
const T0 = Date.UTC(2020, 0, 6, 2) / 1000;   // Monday 02:00 UTC, an H4 boundary

// flat candles around 100, each with range 1 (ATR 1), then whatever `extra` adds
function bars(extra = []) {
  const c = []; for (let i = 0; i < 30; i++) c.push({ time: T0 + i * 14400, open: 100, high: 100.5, low: 99.5, close: 100, end: T0 + (i + 1) * 14400 });
  for (const x of extra) c.push({ time: c.at(-1).time + 14400, end: c.at(-1).end + 14400, ...x });
  for (let k = 0; k < 14; k++) { const p = c.at(-1).close; c.push({ time: c.at(-1).time + 14400, end: c.at(-1).end + 14400, open: p, high: p + 0.05, low: p - 0.05, close: p }); }   // quiet padding
  c.forEach((x) => { x.atr = 1; });
  return c;
}

test('H4 boundaries 22/02/06/10/14/18 UTC, Sunday stub joins the 22:00 candle', () => {
  const at = (s) => Date.parse(s) / 1000;
  assert.equal(h4Start(at('2020-01-06T03:00:00Z')), at('2020-01-06T02:00:00Z'));
  assert.equal(h4Start(at('2020-01-06T01:00:00Z')), at('2020-01-05T22:00:00Z'));
  assert.equal(h4Start(at('2020-06-07T21:00:00Z')), at('2020-06-07T22:00:00Z'));   // Sunday 21:00 summer reopen
  const h1 = [[at('2020-06-07T21:00:00Z'), 1, 2, 0.5, 1.5], [at('2020-06-07T22:00:00Z'), 1.5, 3, 1, 2], [at('2020-06-08T02:00:00Z'), 2, 2, 2, 2]];
  const c = toH4(h1);
  assert.equal(c.length, 2); assert.equal(c[0].open, 1); assert.equal(c[0].high, 3); assert.equal(c[0].close, 2);
});

test('pin bar: wick, body, range and the new 20-candle extreme', () => {
  const bull = { open: 99.6, high: 99.7, low: 97, close: 99.65 };   // range 2.7, lower wick 2.6, new low
  assert.equal(pin(bars([bull]), 30), 1);
  assert.equal(pin(bars([{ ...bull, low: 99.6, high: 99.9 }]), 30), 0);                 // no new low, short range
  assert.equal(pin(bars([{ open: 99.6, high: 99.7, low: 97, close: 97.2 }]), 30), 0);   // body at the bottom
  assert.equal(cand(bars([{ open: 99.6, high: 99.7, low: 97, close: 97.2 }]), 30), 1);  // placebo: no wick rule
  const c = bars([bull]); c[30].atr = 3; assert.equal(pin(c, 30), 0);                   // range < ATR
  assert.equal(pin(bars([{ open: 100.4, high: 103, low: 100.3, close: 100.35 }]), 30), -1);
});

test('trade: entry next open, stop $0.30 past the pin, stop first in a shared candle, time exit after 12', () => {
  const bull = { open: 99.6, high: 99.7, low: 97, close: 99.65 };
  let c = bars([bull, { open: 99.7, high: 110, low: 96, close: 100 }]);            // stop and target in one candle
  let t = simulate(c, 30, 1, 2); assert.equal(t.how, 'stop'); assert.equal(t.stop, 97 - BUF); assert.equal(t.entry, 99.7);
  assert.ok(Math.abs(t.gross + 1) < 1e-9); assert.ok(Math.abs(t.cost - RT / t.risk) < 1e-12);
  const flat = Array.from({ length: 13 }, () => ({ open: 99.8, high: 100, low: 99.5, close: 99.9 }));
  c = bars([bull, ...flat]); t = simulate(c, 30, 1, 2);
  assert.equal(t.how, 'time'); assert.equal(t.exitIdx, 30 + HOLD); assert.equal(t.exit, 99.9);
  c = bars([bull, { open: 96, high: 99, low: 95, close: 98 }]); assert.equal(simulate(c, 30, 1, 2), null);   // opened past the stop
  c = bars([bull, { open: 99.7, high: 106, low: 99.7, close: 105 }]); t = simulate(c, 30, 1, 2);
  assert.equal(t.how, 'target'); assert.ok(Math.abs(t.gross - 2) < 1e-9); assert.ok(t.fin >= 0);
  t = simulate(bars([{ open: 100.4, high: 103, low: 100.3, close: 100.35 }, ...flat]), 30, -1, 2); assert.equal(t.fin, 0);   // shorts pay no financing
});

test('no look-ahead: changing every price after the pin leaves its signal; D1 filter reads completed days only', () => {
  const bull = { open: 99.6, high: 99.7, low: 97, close: 99.65 };
  const a = bars([bull, { open: 99, high: 99, low: 99, close: 99 }]), b = bars([bull, { open: 50, high: 200, low: 40, close: 60 }]);
  assert.equal(pin(a, 30), pin(b, 30));
  const day = 86400, h1 = [];
  for (let d = 0; d < 200; d++) for (let h = 0; h < 24; h++) { const t = Date.UTC(2021, 0, 4) / 1000 - 2 * 3600 + d * day + h * 3600, w = new Date(t * 1000).getUTCDay();
    if (w === 6 || (w === 0 && new Date(t * 1000).getUTCHours() < 22) || (w === 5 && new Date(t * 1000).getUTCHours() >= 22)) continue;
    const p = 100 + d; h1.push([t, p, p, p, p]); }
  const d1 = toD1(h1), last = h1.at(-1)[0];
  const atMid = h1[h1.length - 10][0] + 3600;
  const above = d1Above(d1, atMid);
  h1.at(-1)[4] = -1e9;   // a later price in the current day must not change the reading
  assert.equal(d1Above(toD1(h1), atMid), above);
  assert.equal(above, true);
  assert.ok(last > atMid);
});

test('one position at a time, Holm, month t', () => {
  const bull = { open: 99.6, high: 99.7, low: 97, close: 99.65 };
  const c = bars([bull, { open: 99.7, high: 99.8, low: 96, close: 97 }, { open: 97, high: 97.1, low: 94, close: 97 }]);
  const T = runTest(c, [], TESTS.T1); assert.ok(T.length >= 1); for (let k = 1; k < T.length; k++) assert.ok(T[k].i >= T[k - 1].exitIdx);
  assert.deepEqual(holm([0.01, 0.04, 0.5]), [0.03, 0.08, 0.5]);
  const m = monthT([{ exitT: Date.UTC(2020, 0, 5) / 1000, net: 1 }, { exitT: Date.UTC(2020, 1, 5) / 1000, net: 1 }], ['2020-01-01', '2020-03-31']);
  assert.equal(m.months, 3);
});

test('report matches result.json, verdict and checks', () => {
  assert.equal(R.verdict, R.tests.T1.pass ? 'PASS' : 'FAIL');
  for (const x of Object.values(R.tests)) assert.equal(x.pass, Object.values(x.checks).every(Boolean));
  const line = MD.match(/\*\*Verdict: ([^*]+)\*\*/); assert.ok(line); assert.ok(line[0].length < 220);
  assert.ok(line[1].startsWith(R.verdict));
  const f = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  for (const [k, x] of Object.entries(R.tests)) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${k} `)); assert.ok(row, k);
    for (const s of [String(x.is.n), String(x.oos.n), `${f(x.oos.gross)} / ${f(x.oos.net)}`, `${f(x.is.gross)} / ${f(x.is.net)}`, f(x.oos.net2x), `${x.placebo.beaten} of 40`, x.holm.toFixed(3)])
      assert.ok(row.includes(s), `${k}: ${s} in ${row}`);
  }
  assert.ok(MD.includes(`median ${f(R.tests.T1.placebo.median)}R`));
});
