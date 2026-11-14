// gold-pre-cpi: the rule on hand-made candles, no look-ahead, and the report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { weekdaysBefore, timesOf, atr, trade, runDay, indexOf, endingAt, blocked, holm, pOne, tOf, monthSums, COST, STOP_K }
  from '../research/edge/gold-pre-cpi/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const H = 3600;
// flat H1 candles from t0, n hours, price p, range 1
const flat = (t0, n, p = 2000) => Array.from({ length: n }, (_, i) => [t0 + i * H, p, p + 0.5, p - 0.5, p]);

test('times: three weekdays back, 17:00 New York entry, 08:00 / 09:00 / 16:00 on the day', () => {
  assert.equal(weekdaysBefore('2026-10-14', 3), '2026-10-09');          // Wednesday → previous Friday
  assert.equal(weekdaysBefore('2026-10-02', 3), '2026-09-29');          // Friday → Tuesday
  const tm = timesOf('2026-10-14');                                     // EDT: New York = UTC − 4
  assert.equal(tm.E, Date.UTC(2026, 9, 9, 21) / 1000);
  assert.equal(tm.X, Date.UTC(2026, 9, 14, 12) / 1000);
  assert.equal(tm.F, Date.UTC(2026, 9, 14, 13) / 1000);
  assert.equal(tm.C, Date.UTC(2026, 9, 14, 20) / 1000);
  const w = timesOf('2026-01-13');                                      // EST: UTC − 5
  assert.equal(w.X, Date.UTC(2026, 0, 13, 13) / 1000);
});

test('atr20 and the stop: 2 x ATR x √hours, a long exits at the stop, a gap at the open', () => {
  const b = flat(0, 40);
  assert.equal(atr(b, 25), 1);
  const up = trade(b, 25, 34, 1, 9);
  assert.equal(up.dist, STOP_K * 1 * 3);
  assert.equal(up.how, 'time');
  assert.equal(up.gross, 0);
  assert.ok(Math.abs(up.net - (-(COST / 6))) < 1e-12);                  // 2 Jan 1970 01:00-10:00 UTC: no 22:00 rollover crossed
  const s = flat(0, 40); s[30] = [30 * H, 2000, 2000.2, 1990, 1995];      // touches 2000 − 6 = 1994
  const t1 = trade(s, 25, 34, 1, 9);
  assert.equal(t1.how, 'stop'); assert.equal(t1.exit, 1994); assert.equal(t1.gross, -1);
  const g = flat(0, 40); g[28] = [28 * H, 1990, 1991, 1989, 1990];        // opens through the stop
  const t2 = trade(g, 25, 34, 1, 9);
  assert.equal(t2.how, 'gap'); assert.equal(t2.exit, 1990);
  const sh = trade(flat(0, 40), 25, 34, -1, 9);
  assert.equal(sh.stop, 2006); assert.equal(sh.nights, 0);               // shorts pay no financing
});

test('financing on longs over rollovers, from council/fills.mjs', () => {
  const t0 = Date.UTC(2026, 9, 5, 12) / 1000;                            // Monday 12:00 UTC
  const b = flat(t0, 80);
  const tr = trade(b, 25, 70, 1, 45);
  const nn = nights(b[25][0] + H, b[70][0] + H);
  assert.ok(nn >= 1);
  assert.equal(tr.nights, nn);
  assert.ok(Math.abs(tr.net - (tr.gross - (COST + nn * FIN.xau.long * 2000) / tr.dist)) < 1e-12);
});

test('no look-ahead: prices after the exit candle never change a trade; ATR reads only closed candles', () => {
  const b = flat(0, 60), c = b.map((x) => [...x]);
  for (let i = 35; i < 60; i++) c[i] = [i * H, 900, 3000, 100, 2500];
  assert.deepEqual(trade(b, 25, 34, 1, 9), trade(c, 25, 34, 1, 9));
  assert.equal(atr(b, 25), atr(c, 25));
});

test('runDay on a synthetic week: entry at E, pre-move to X, fade from F to C against it', () => {
  const R = '2026-10-14', tm = timesOf(R), start = tm.E - 40 * H;
  const bars = [];
  for (let t = start; t <= tm.C; t += H) { const up = t >= tm.E ? (t - tm.E) / H * 0.1 : 0; const p = 2000 + Math.min(up, (tm.X - tm.E) / H * 0.1); bars.push([t, p, p + 0.5, p - 0.5, p]); }
  const idx = indexOf(bars);
  assert.equal(bars[endingAt(idx, bars, tm.E)][0], tm.E - H);
  const d = runDay(bars, idx, R);
  assert.ok(d.move > 0);
  assert.equal(d.pre.entry, bars[endingAt(idx, bars, tm.E)][4]);
  assert.equal(d.pre.exit, bars[endingAt(idx, bars, tm.X)][4]);
  assert.ok(d.fade && d.fade.stop > d.fade.entry, 'an up pre-move is faded with a sell (stop above)');
});

test('clean window, statistics, Holm', () => {
  const tm = { E: 100, C: 200 };
  assert.equal(blocked([{ t: 150 }], tm, 120), true);
  assert.equal(blocked([{ t: 120 }, { t: 250 }], tm, 120), false);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOne(2.0, 1000) - 0.0229) < 0.002);
  assert.ok(pOne(-1, 20) > 0.5);
  assert.deepEqual(monthSums([{ R: '2026-01-02', net: 1 }, { R: '2026-01-20', net: 2 }, { R: '2026-02-01', net: -1 }]), [3, -1]);
  assert.equal(tOf([1, 1, 1]), 0);
});

test('the report against result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-pre-cpi/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/gold-pre-cpi/RESULT.md', import.meta.url), 'utf8');
  assert.equal(r.verdict, ['T1', 'T2', 'T3'].some((k) => r.tests[k].pass) ? 'PASS' : 'FAIL');
  const line = md.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line.endsWith('**') && line.includes(r.verdict) && line.length < 240);
  for (const k of ['T1', 'T2', 'T3']) {
    const x = r.tests[k];
    assert.equal(x.pass, Object.values(x.checks).every(Boolean));
    assert.equal(x.placebo.means.length, 40);
    assert.equal(x.placebo.beats, x.placebo.means.filter((m) => x.net > m).length);
    assert.ok(md.includes(`| ${k} `) && md.includes(`${x.t} | ${x.holm} |`), `${k} row`);
    assert.equal(r.trades[k].length, x.n);
    for (const tr of r.trades[k]) assert.ok(tr.stop !== tr.entry, 'every trade has a stop');
  }
  assert.ok(r.events.CPI.from >= '2018' && r.events.NFP.from >= '2022');
  // rule 6 is checked repo-wide by tests/no-model-names.test.mjs
});
