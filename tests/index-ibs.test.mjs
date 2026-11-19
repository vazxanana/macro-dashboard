// research/edge/index-ibs: the IBS daily reversal on US indices (offline: hand-made candles, the committed result files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  closeCandle, sessionStarts, buildDays, tradingDays, trade, nights, finRate, monthT, monthsBetween, report, holm, ATR_N,
} from '../research/edge/index-ibs/run.mjs';

const dir = new URL('../research/edge/index-ibs/', import.meta.url);
const H = 3600;
const utcH = (ymd, h) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), h) / 1000;

// flat hourly candles over a span of days: o = c = 100, h 101, l 99
function flat(from, to) {
  const out = [];
  for (let t = utcH(from, 0); t < utcH(to, 0) + 86400; t += H) out.push([t, 100, 101, 99, 100]);
  return out;
}
const setBar = (bars, t, b) => { const i = bars.findIndex((x) => x[0] === t); bars[i] = [t, ...b]; };

test('the close candle and the session follow New York daylight saving', () => {
  assert.equal(closeCandle('2026-07-15'), utcH('2026-07-15', 19));      // EDT: 15:00-16:00 NY = 19:00 UTC
  assert.equal(closeCandle('2026-01-15'), utcH('2026-01-15', 20));      // EST: 20:00 UTC
  assert.equal(closeCandle('2026-11-27'), utcH('2026-11-27', 17));      // day after Thanksgiving: 12:00-13:00 EST
  const s = sessionStarts('2026-07-15');
  assert.equal(s.length, 7);
  assert.equal(s[0], utcH('2026-07-15', 13));                           // 09:00 EDT
  assert.equal(sessionStarts('2026-01-15')[0], utcH('2026-01-15', 14)); // 09:00 EST
  assert.equal(sessionStarts('2026-11-27').length, 4);                  // half day: 09:00 to the 13:00 close
});

test('IBS reads only that day\'s completed session candles', () => {
  const days = tradingDays('2026-07-13', '2026-07-17');
  const base = flat('2026-07-12', '2026-07-18');
  const d = '2026-07-15', tc = closeCandle(d);
  setBar(base, tc, [100, 101, 99, 99.5]);                                // close 99.5 in a 99-101 session: IBS 0.25
  const ibs0 = buildDays(base, days).find((x) => x.d === d).ibs;
  assert.ok(Math.abs(ibs0 - 0.25) < 1e-12);
  // a spike before 09:00 New York, after the close, and on the next day leaves IBS alone
  const b2 = base.map((x) => x.slice());
  setBar(b2, utcH(d, 12), [100, 130, 70, 100]);                           // 08:00-09:00 EDT
  setBar(b2, tc + H, [100, 130, 70, 100]);                                // 16:00-17:00 EDT
  setBar(b2, closeCandle('2026-07-16'), [100, 130, 70, 100]);
  assert.equal(buildDays(b2, days).find((x) => x.d === d).ibs, ibs0);
  // a session candle (09:00-10:00) does count
  const b3 = base.map((x) => x.slice());
  setBar(b3, utcH(d, 13), [100, 101, 98, 100]);
  assert.ok(Math.abs(buildDays(b3, days).find((x) => x.d === d).ibs - 1.5 / 3) < 1e-12);
  // a missing session candle = no IBS
  const b4 = base.filter((x) => x[0] !== utcH(d, 15));
  assert.equal(buildDays(b4, days).find((x) => x.d === d).ibs, null);
});

// a month of flat days (ATR 2 = the 24 h range), then trades on 2026-07-15 -> 07-16
function tradeSetup() {
  const days = tradingDays('2026-06-01', '2026-07-31');
  const bars = flat('2026-05-31', '2026-08-01');
  const D = buildDays(bars, days), e = D.findIndex((x) => x.d === '2026-07-15');
  return { days, bars, D, e, opt: { cost: 0, rate: () => 0 } };
}

test('the stop sits 1 x ATR(20) on the losing side; a gap fills at the open, a touch at the stop', () => {
  const { bars, D, e, opt } = tradeSetup();
  assert.ok(e > ATR_N);
  const L = trade(bars, D, e, e + 1, opt), S = trade(bars, D, e, e + 1, { ...opt, side: -1 });
  assert.equal(L.stop, 98); assert.equal(S.stop, 102);                   // ATR = 2 (101 - 99), entry 100
  assert.equal(L.how, 'time'); assert.equal(L.grossR, 0);
  // a candle after the entry opening below the stop: filled at its open
  const i = D[e].i;
  const g = bars.map((x) => x.slice()); g[i + 3] = [g[i + 3][0], 97, 97.5, 96, 97];
  const Lg = trade(g, D, e, e + 1, opt);
  assert.equal(Lg.how, 'stop-gap'); assert.equal(Lg.exit, 97); assert.equal(Lg.grossR, -1.5);
  // a low through the stop from above: filled at the stop
  const s = bars.map((x) => x.slice()); s[i + 3] = [s[i + 3][0], 100, 100.5, 97, 99];
  const Ls = trade(s, D, e, e + 1, opt);
  assert.equal(Ls.how, 'stop'); assert.equal(Ls.exit, 98); assert.equal(Ls.grossR, -1);
  // the short is stopped by highs, not lows
  assert.equal(trade(s, D, e, e + 1, { ...opt, side: -1 }).how, 'time');
  const h = bars.map((x) => x.slice()); h[i + 3] = [h[i + 3][0], 100, 103, 99.5, 100];
  const Sh = trade(h, D, e, e + 1, { ...opt, side: -1 });
  assert.equal(Sh.how, 'stop'); assert.equal(Sh.exit, 102); assert.equal(Sh.grossR, -1);
  // the entry candle itself is not checked (its close is the entry)
  const c = bars.map((x) => x.slice()); c[i] = [c[i][0], 100, 101, 90, 100];
  assert.equal(trade(c, D, e, e + 1, opt).how, 'time');
});

test('financing: one night Monday to Thursday, three from Friday, four over Good Friday; long and short rates', () => {
  const n = (a, b) => nights(closeCandle(a) + H, closeCandle(b) + H);
  assert.equal(n('2026-07-13', '2026-07-14'), 1);   // Monday
  assert.equal(n('2026-07-15', '2026-07-16'), 1);   // Wednesday counts one here
  assert.equal(n('2026-07-17', '2026-07-20'), 3);   // Friday
  assert.equal(n('2026-04-02', '2026-04-06'), 4);   // Thursday before Good Friday -> Monday
  assert.equal(n('2026-01-16', '2026-01-20'), 4);   // Friday before MLK day -> Tuesday (Fri 3 + Mon 1)
  assert.ok(Math.abs(finRate(4, 1) - 0.065 / 365) < 1e-15);
  assert.equal(finRate(4, -1), 0);                  // a short never earns a credit
  assert.ok(Math.abs(finRate(1, -1) - 0.015 / 365) < 1e-15);
  assert.ok(Math.abs(finRate(-0.5, 1) - 0.025 / 365) < 1e-15);
  const { bars, D, e } = tradeSetup();
  const t = trade(bars, D, e, e + 1, { cost: 0.0005, rate: () => 4 });
  assert.equal(t.nights, 1);
  assert.ok(Math.abs(t.R - (-(0.0005 + 0.065 / 365) * 100 / 2)) < 1e-12);
});

test('month-sum t counts empty months as 0; Holm', () => {
  const m = monthsBetween(2016, '2016-04-10');
  assert.deepEqual(m, ['2016-01', '2016-02', '2016-03', '2016-04']);
  const r = monthT([{ entryD: '2016-01-05', R: 1 }, { entryD: '2016-01-20', R: 1 }, { entryD: '2016-03-02', R: 2 }], m);
  assert.equal(r.months, 4); assert.equal(r.mean, 1);
  assert.deepEqual(holm([0.01, 0.04, 0.03]).map((x) => +x.toFixed(4)), [0.03, 0.06, 0.06]);
});

test('RESULT.md is written from result.json, and the verdict follows the checks', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
  assert.equal(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), report(res));
  const passed = Object.entries(res.checks).filter(([, c]) => c.pass).map(([id]) => id);
  assert.deepEqual(res.passed, passed);
  assert.equal(res.verdict, passed.length ? 'PASS' : 'FAIL');
  for (const [id, c] of Object.entries(res.checks)) assert.equal(c.pass, Object.values(c.checks).every(Boolean), id);
  const T2 = res.tests.T2;
  assert.equal(res.checks.T2.checks.b, T2.decisive.R > 0);
  assert.equal(res.checks.T2.checks.e, T2.placebo.beaten >= 38);
  assert.match(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), new RegExp(`Verdict: ${res.verdict}`));
  assert.ok(fs.existsSync(new URL('PREREGISTRATION.md', dir)));
});
