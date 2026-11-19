// The turn-of-month study: trading days with NYSE holidays, the New York close candle, no look-ahead, the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dayKind, tradingDays, labels, isTurn, closeCandle, buildDays, atrAt, trade, ruleTrades, holm, welch } from '../research/edge/turn-of-month/run.mjs';

test('NYSE trading days: holidays on fixed dates, half days, special closures', () => {
  for (const d of ['2024-01-01', '2024-01-15', '2024-02-19', '2024-03-29', '2024-05-27', '2024-06-19', '2024-07-04', '2024-09-02', '2024-11-28', '2024-12-25',
    '2021-12-24', '2022-01-17', '2012-10-29', '2012-10-30', '2018-12-05', '2025-01-09', '2026-07-03']) assert.equal(dayKind(d), 'closed', d);
  for (const d of ['2024-11-29', '2024-12-24', '2024-07-03']) assert.equal(dayKind(d), 'half', d);
  assert.equal(dayKind('2021-06-18'), 'open', 'Juneteenth only from 2022');
  assert.equal(dayKind('2021-12-31'), 'open', 'New Year on a Saturday is not observed on the Friday');
  assert.equal(dayKind('2024-11-30'), 'closed');
  assert.deepEqual(tradingDays('2024-12-23', '2025-01-03'), ['2024-12-23', '2024-12-24', '2024-12-26', '2024-12-27', '2024-12-30', '2024-12-31', '2025-01-02', '2025-01-03']);
});

test('turn-of-month labels count trading days, not calendar days', () => {
  const L = labels(tradingDays('2024-11-01', '2024-12-31'));
  assert.equal(L['2024-11-27'].neg, -2); assert.equal(L['2024-11-29'].neg, -1);   // Thanksgiving skipped
  assert.equal(L['2024-12-02'].pos, 1); assert.equal(L['2024-12-04'].pos, 3);
  assert.ok(isTurn(L['2024-11-29']) && isTurn(L['2024-12-04']) && !isTurn(L['2024-12-05']) && !isTurn(L['2024-11-27']));
});

test('the close is the H1 candle ending 16:00 New York, daylight saving included; 13:00 on a half day', () => {
  assert.equal(new Date(closeCandle('2024-01-10') * 1000).toISOString(), '2024-01-10T20:00:00.000Z');
  assert.equal(new Date(closeCandle('2024-07-10') * 1000).toISOString(), '2024-07-10T19:00:00.000Z');
  assert.equal(new Date(closeCandle('2024-03-13') * 1000).toISOString(), '2024-03-13T19:00:00.000Z');   // US already on summer time
  assert.equal(new Date(closeCandle('2024-11-29') * 1000).toISOString(), '2024-11-29T17:00:00.000Z');
});

// synthetic hourly candles over a range of trading days; price path from f(hour index)
function synth(days, f) {
  const bars = [];
  const a = closeCandle(days[0]) - 30 * 3600, b = closeCandle(days.at(-1)) + 3600;
  for (let t = a, k = 0; t <= b; t += 3600, k++) { const c = f(k), o = f(k - 1); bars.push([t, o, Math.max(o, c) + 1, Math.min(o, c) - 1, c]); }
  return bars;
}

test('no look-ahead: the ATR and the entry do not move when prices after the entry change', () => {
  const days = tradingDays('2024-01-02', '2024-03-29');
  const A = synth(days, (k) => 1000 + 5 * Math.sin(k / 7) + k * 0.01);
  const D = buildDays(A, days), e = days.indexOf('2024-02-27');
  const cut = D[e].t;
  const B = A.map((x) => x[0] > cut ? [x[0], x[1] * 1.5, x[2] * 1.5, x[3] * 1.5, x[4] * 1.5] : x);
  const D2 = buildDays(B, days);
  assert.equal(atrAt(D, e), atrAt(D2, e));
  assert.equal(D[e].close, D2[e].close);
  const opt = { cost: 0.0004, rate: () => 4 };
  assert.equal(trade(A, D, e, e + 4, opt).stop, trade(B, D2, e, e + 4, opt).stop);
});

test('every trade has a stop below its entry, and a fall through it exits at the stop or the gapped open', () => {
  const days = tradingDays('2024-01-02', '2024-03-29');
  const D0 = days.indexOf('2024-02-27');
  const cutT = closeCandle(days[D0]);
  const bars = synth(days, (k) => 1000 + 3 * Math.sin(k / 5));
  const crash = bars.map((x) => x[0] > cutT + 5 * 3600 ? [x[0], x[1] - 200, x[2] - 200, x[3] - 200, x[4] - 200] : x);
  const D = buildDays(crash, days), opt = { cost: 0.0004, rate: () => 4 };
  const t = trade(crash, D, D0, D0 + 4, opt);
  assert.ok(t.stop < t.entry);
  assert.ok(t.how === 'stop' || t.how === 'stop-gap');
  assert.ok(t.exit <= t.stop);
  const L = labels(tradingDays('2024-01-01', '2024-03-31'));
  const { trades } = ruleTrades(bars, buildDays(bars, days), L, opt);
  assert.ok(trades.length >= 1 && trades.every((x) => x.stop < x.entry));
  const feb = trades.find((x) => x.entryD === '2024-02-28');   // TD-2 of February 2024 (29 Feb is TD-1)
  assert.ok(feb && (feb.how !== 'time' || feb.exitD === '2024-03-05'), 'exit at the close of TD+3 of March');
});

test('Holm and Welch', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(2)), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(welch([1, 2, 3, 4], [1, 2, 3, 4]).t) < 1e-12);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/turn-of-month/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/turn-of-month/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\*\*/);
  const sg = (x) => (x > 0 ? '+' : '') + x.toFixed(3);
  for (const [k, m] of Object.entries(r.markets)) {
    const o = m.oos;
    assert.ok(md.includes(`| ${o.n} | ${sg(o.net)} | ${o.t.toFixed(2)} | ${sg(o.gross)} | ${o.win.toFixed(2)} % | ${o.stops} | ${m.placebo.beaten} of 40 |`), k);
    assert.ok(md.includes(`| ${m.is.n} | ${sg(m.is.net)} | ${m.is.t.toFixed(2)} | ${sg(m.is.gross)} |`), k + ' 2008-15');
    assert.ok(md.includes(`${sg(m.daysOOS.diff)}, t ${m.daysOOS.t.toFixed(2)}`), k + ' days');
    assert.equal(r.checks[k].pass, false);
  }
  assert.equal(r.markets.spx500.placebo.seeds.length, 40);
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-turn-of-month.md', import.meta.url)), 'no proposal for a FAIL');
});
