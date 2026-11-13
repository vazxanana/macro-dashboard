// research/edge/crypto-weekend: window boundaries, the stop, the swap count, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, ts, index, starts, simTrade, rolloverNights, ruleTrades, judge } from '../research/edge/crypto-weekend/run.mjs';

const DIR = new URL('../research/edge/crypto-weekend/', import.meta.url);
const H = 3600, M5 = 300;

// flat 5m candles from a to b (exclusive), price p, range +/- w, with optional overrides by time
function flat(a, b, p = 100, w = 0.5, over = {}) {
  const out = [];
  for (let t = a; t < b; t += M5) out.push(over[t] || [t, p, p + w, p - w, p]);
  return out;
}

test('window boundaries: W enters Friday 21:00 UTC and holds 50 h to Sunday 23:00; M is Monday 00:00 to Tuesday 00:00', () => {
  const fri = ts('2024-03-01') + 21 * H, mon = ts('2024-03-04');
  assert.equal(new Date(fri * 1000).getUTCDay(), 5);
  assert.equal(new Date(mon * 1000).getUTCDay(), 1);
  const rows = flat(fri - 30 * H, mon + 30 * H);
  assert.deepEqual(starts(rows, P.rules.W.dow, P.rules.W.hour), [fri]);
  assert.deepEqual(starts(rows, P.rules.M.dow, P.rules.M.hour), [mon]);
  assert.equal(fri + P.rules.W.hold, ts('2024-03-03') + 23 * H);
  assert.equal(mon + P.rules.M.hold, ts('2024-03-05'));
  // a trade belongs to the window of its entry: 2023-12-31 is discovery, 2024-01-01 decisive
  const ix = index(rows);
  const w = ruleTrades(ix, rows, 'btc', P.rules.W, P.windows.decisive);
  assert.equal(w.trades.length, 1);
  assert.equal(w.trades[0].t, fri);
  assert.equal(ruleTrades(ix, rows, 'btc', P.rules.W, P.windows.discovery).trades.length, 0);
  // the exit is the close of the Sunday 22:55 candle when not stopped
  assert.equal(w.trades[0].exitT, fri + 50 * H);
  assert.equal(w.trades[0].stopped, false);
});

test('stop: 2 x ATR(24) H1, hit on the 5m path, gap fills at the open; every trade has one on the losing side', () => {
  const T0 = ts('2024-03-04'); // Monday
  // H1 true range 1.0 every hour before entry (5m ranges +/- 0.5) -> ATR 1, stop distance 2
  const hit = T0 + 3 * H;
  const rows = flat(T0 - 30 * H, T0 + 25 * H, 100, 0.5, { [hit]: [hit, 101.5, 103, 101, 102] });
  const ix = index(rows);
  const s = simTrade(ix, T0, 24 * H, -1, 'btc');
  assert.equal(s.stop, 102);
  assert.ok(s.stop > s.entry);
  assert.equal(s.stopped, true);
  assert.equal(s.exit, 102);
  assert.equal(s.exitT, hit + M5);
  assert.ok(Math.abs(s.gross + 1) < 1e-12);
  // opened beyond the stop: exit at the open
  const rows2 = flat(T0 - 30 * H, T0 + 25 * H, 100, 0.5, { [hit]: [hit, 104, 105, 103.5, 104] });
  const g = simTrade(index(rows2), T0, 24 * H, -1, 'btc');
  assert.equal(g.exit, 104);
  assert.ok(Math.abs(g.gross + 2) < 1e-12);
  // a long's stop sits below its entry
  const l = simTrade(ix, T0, 24 * H, 1, 'btc');
  assert.ok(l.stop < l.entry);
  // missing ATR hours: no trade
  assert.ok(simTrade(index(flat(T0 - 10 * H, T0 + 25 * H)), T0, 24 * H, -1, 'btc').skip);
  // hold under 95 % covered: no trade
  const holey = flat(T0 - 30 * H, T0 + 25 * H).filter((r) => !(r[0] > T0 + H && r[0] < T0 + 4 * H));
  assert.ok(simTrade(index(holey), T0, 24 * H, -1, 'btc').skip);
});

test('swap count: 17:00 New York in (entry, exit], Friday counts three', () => {
  // US summer (EDT): Friday 17:00 NY = 21:00 UTC = the W entry instant, not inside the hold -> Sat + Sun = 2
  const summer = ts('2024-07-05') + 21 * H;
  assert.equal(rolloverNights(summer, summer + 50 * H), 2);
  // US winter (EST): Friday 17:00 NY = 22:00 UTC inside the hold -> 3 + 1 + 1 = 5; Friday as one night -> 3
  const winter = ts('2024-01-05') + 21 * H;
  assert.equal(rolloverNights(winter, winter + 50 * H), 5);
  assert.equal(rolloverNights(winter, winter + 50 * H, 1), 3);
  // Monday short: one night
  assert.equal(rolloverNights(ts('2024-01-08'), ts('2024-01-09')), 1);
  assert.equal(rolloverNights(ts('2024-07-08'), ts('2024-07-09')), 1);
  // financing is charged at the broker's rate for the side
  const T0 = ts('2024-01-08');
  const s = simTrade(index(flat(T0 - 30 * H, T0 + 25 * H)), T0, 24 * H, -1, 'eth');
  assert.equal(s.nights, 1);
  assert.ok(Math.abs(s.fin - P.fin.eth.short / 365 * 100 / 2) < 1e-12);
  assert.ok(Math.abs(s.cost - P.cost * 100 / 2) < 1e-12);
});

test('judge: all five checks, Holm over the tests', () => {
  const base = { n: 150, R: 0.2, t: 3.5, discovery: { R: 0.1 } };
  const j = judge([base, { ...base, discovery: { R: -0.1 } }, { ...base, n: 90 }, { ...base, t: 1.5 }]);
  assert.deepEqual(j.map((x) => x.pass), [true, false, false, false]);
});

test('RESULT.md matches result.json, verdict first', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.verdict, R.tests.some((x) => x.pass) ? 'PASS' : 'FAIL');
  const firstPara = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(firstPara.includes(R.verdict));
  const sg = (x, d = 4) => (x >= 0 ? '+' : '') + x.toFixed(d);
  for (const t of R.tests) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${t.test} |`));
    assert.ok(row, t.test);
    const c = row.split('|').map((s) => s.trim());
    assert.equal(+c[2], t.n);
    assert.equal(c[3], sg(t.R));
    assert.equal(c[4], sg(t.gross));
    assert.equal(c[5], t.costR.toFixed(4));
    assert.equal(c[6], t.finR.toFixed(4));
    assert.equal(c[7], t.t.toFixed(2));
    assert.equal(c[8], t.monthT.toFixed(2));
    assert.equal(c[9], t.pHolm.toFixed(4));
    assert.equal(c[10], sg(t.discovery.R));
    assert.equal(c[11], t.pass ? 'yes' : 'no');
  }
  for (const [k, v] of Object.entries(R.placebo)) for (const c of ['btc', 'eth']) assert.ok(md.includes(String(v.beats[c])), `${k} ${c}`);
  for (const c of ['btc', 'eth']) for (const w of ['early', 'discovery', 'decisive']) {
    const x = R.context[c][w];
    for (const k of ['weekendSatSun', 'monday']) assert.ok(md.includes(`${sg(x[k].meanPct, 3)} (${x[k].t.toFixed(2)})`), `${c} ${w} ${k}`);
  }
});
