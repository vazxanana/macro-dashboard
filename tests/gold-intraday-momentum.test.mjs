// Gold intraday momentum study: New York time across DST, the stop / gap logic, T3's median uses past days only,
// and the report against result.json. Offline, hand-made candles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nyUtc, priceAt, indexBars, tradingDays, trade, aboveMedian, setups, dailyAtr, holm, MED_N } from '../research/edge/gold-intraday-momentum/run.mjs';

const nyClock = (t) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(t * 1000));

test('New York clock times convert to UTC correctly around the DST switches', () => {
  // 2026: DST from 8 Mar to 1 Nov; 2007: from 11 Mar to 4 Nov
  for (const [y, m, d] of [[2026, 3, 6], [2026, 3, 9], [2026, 10, 30], [2026, 11, 2], [2007, 3, 9], [2007, 3, 12], [2007, 11, 2], [2007, 11, 5], [2016, 3, 14], [2016, 11, 7]]) {
    for (const [hh, mm] of [[8, 30], [10, 0], [15, 30], [16, 55], [17, 0]]) {
      const t = nyUtc(y, m, d, hh, mm), s = nyClock(t);
      assert.equal(s, `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, `${y}-${m}-${d} ${hh}:${mm}`);
    }
  }
  assert.equal(nyUtc(2026, 3, 9, 10, 0) - Date.UTC(2026, 2, 9, 10) / 1000, 4 * 3600);
  assert.equal(nyUtc(2026, 3, 6, 10, 0) - Date.UTC(2026, 2, 6, 10) / 1000, 5 * 3600);
});

test('trading days are weekdays; Monday starts at Friday 17:00 New York', () => {
  const d = tradingDays('2026-11-06', '2026-11-10');
  assert.deepEqual(d.map((x) => x.date), ['2026-11-06', '2026-11-09', '2026-11-10']);
  assert.equal(d[1].start, nyUtc(2026, 11, 6, 17, 0)); assert.equal(d[1].end, nyUtc(2026, 11, 9, 17, 0));
});

test('price at a time: the candle ending there, else one ending in the 15 minutes before, else nothing', () => {
  const X = 1_000_000_200 - (1_000_000_200 % 300);
  assert.equal(priceAt(indexBars([[X - 300, 1, 1, 1, 7]]), X), 7);
  assert.equal(priceAt(indexBars([[X - 1200, 1, 1, 1, 5]]), X), 5);
  assert.equal(priceAt(indexBars([[X - 1500, 1, 1, 1, 5]]), X), null);
  assert.equal(priceAt(indexBars([[X, 1, 1, 1, 9]]), X), null, 'a candle starting AT X is later, never read');
});

test('stop: a gap fills at the open, a touch fills at the stop, else out at the exit price', () => {
  const T = 3_000_000_000 - (3_000_000_000 % 300), E = T + 1800;
  const long = (bars) => trade(indexBars(bars), 1, T, E, 100, 98);
  assert.deepEqual(long([[T, 100, 101, 99, 100.5], [T + 300, 97, 97.5, 96, 97]]), { exit: 97, how: 'gap', at: T + 300 });
  assert.deepEqual(long([[T, 100, 101, 97.9, 99]]), { exit: 98, how: 'stop', at: T });
  assert.deepEqual(long([[T, 100, 101, 99, 100.5], [E - 300, 100.5, 102, 100, 101.5]]), { exit: 101.5, how: 'time', at: E });
  const short = trade(indexBars([[T, 100, 102.5, 99, 101]]), -1, T, E, 100, 102);
  assert.equal(short.exit, 102); assert.equal(short.how, 'stop');
  assert.equal(trade(indexBars([[T - 300, 100, 100, 90, 100]]), 1, T, E, 100, 98), null, 'the candle before the entry is not checked; no exit price -> null');
});

test("T3's median reads only the 250 previous days, never the day itself or later ones", () => {
  const hist = Array.from({ length: MED_N - 1 }, (_, i) => i / 1000);
  assert.equal(aboveMedian(hist, 1), null, 'fewer than 250 -> no trade');
  hist.push(0.249); // 250 values 0..0.249, median 0.1245
  assert.equal(aboveMedian(hist, 0.13), true); assert.equal(aboveMedian(hist, 0.12), false);
  assert.equal(aboveMedian([...Array(100).fill(9), ...hist], 0.13), true, 'only the last 250 count');
});

// a synthetic market: a flat 10 per day path with a trend, on real New York clock times
function synth(days, futureShock) {
  const bars = []; let p = 1000;
  for (const D of days) {
    for (let t = D.start + 3600; t < D.end; t += 300) { // break 17:00-18:00
      const ny = nyClock(t + 300).slice(-5); let step = Math.sin(t / 7000) * 0.3 + 0.01;
      if (futureShock && D.date >= futureShock) step *= 5;
      if (ny === '10:00') step += 0.5;
      const o = p; p = +(p + step).toFixed(3); bars.push([t, o, Math.max(o, p) + 0.1, Math.min(o, p) - 0.1, p]);
    }
  }
  return bars;
}

test('no look-ahead: changing every candle after a day leaves that day\'s signals, ATR and T3 choice unchanged', () => {
  const days = tradingDays('2014-01-01', '2016-03-31'), cut = '2016-02-01';
  const A = setups(synth(days), days).out, B = setups(synth(days, cut), days).out;
  for (const k of ['T1', 'T2', 'T3']) {
    const a = A[k].filter((u) => u.date < cut), b = B[k].filter((u) => u.date < cut);
    assert.ok(a.length > 50, `${k} has trades`); assert.deepEqual(a, b, k);
  }
  const at1 = dailyAtr(synth(days), days).atr, at2 = dailyAtr(synth(days, cut), days).atr, i = days.findIndex((d) => d.date === cut);
  assert.deepEqual(at1.slice(0, i + 1), at2.slice(0, i + 1), 'ATR of the cut day uses the days before it only');
});

test('Holm adjustment', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((v) => +v.toFixed(2)), [0.03, 0.06, 0.06]);
});

test('the report says what result.json holds, and FAIL', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-intraday-momentum/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-intraday-momentum/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, 'FAIL: 0 of 3 tests pass'); assert.deepEqual(r.passed, []);
  const line = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.match(line, /^\*\*Verdict: FAIL, 0 of 3/); assert.ok(line.length < 220);
  const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
  for (const k of ['T1', 'T2', 'T3']) {
    const x = r.tests[k]; assert.equal(x.pass, false);
    const row = `| ${k} | ${x.is.n} | ${f(x.is.gross)} | ${f(x.is.net)} | ${x.is.tMonth.toFixed(2)} | ${x.oos.n} | ${f(x.oos.gross)} | ${f(x.oos.net)} | ${x.oos.tMonthGross.toFixed(2)} | ${x.oos.tMonth.toFixed(2)} | ${x.holm.toFixed(3)} | ${f(x.oos.net2x)} | ${x.placebo.beats} / 40 | **no** |`;
    assert.ok(md.includes(row), `${k} row: ${row}`);
  }
  assert.equal(r.tests.T1.reg.oos.slope, 0.0136); assert.match(md, /\| T1 \| OOS \| 2366 \| \+0\.0136 \| \+3\.44 \|/);
});
