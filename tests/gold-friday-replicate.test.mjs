// gold-friday-replicate: the frozen copy, the payroll dates, the H1 builder, the cost change, no look-ahead, and the report
// against result.json (offline, hand-made candles).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { days } from '../research/edge/gold-drd-long/run.mjs';
import * as O from '../research/edge/gold-friday-replicate/original.mjs';
import { ORIG_SHA, derive, payrollDates, proxyPayroll, toH1, parseHist, setup, fridays, recost, placeboWith, splitPayroll, dayYmd, FRI, SIDE } from '../research/edge/gold-friday-replicate/run.mjs';

const DIR = new URL('../research/edge/gold-friday-replicate/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const H = 3600;

// January (New York UTC-5): a 17:00 New York day runs 22:00 UTC the evening before to 21:00 UTC. spec = [o, h, l, c] per weekday
function make(specs, start = Date.UTC(2015, 0, 5) / 1000) {
  const h1 = []; let day = start;
  for (const [o, hi, lo, c] of specs) {
    while ([0, 6].includes(new Date(day * 1000).getUTCDay())) day += 86400;
    const t0 = day - H;
    for (let k = 0; k < 22; k++) { const px = k === 21 ? c : o; h1.push({ time: t0 + k * H, open: k ? px : o, high: k === 5 ? hi : Math.max(o, px), low: k === 7 ? lo : Math.min(o, px), close: px }); }
    day += 86400;
  }
  return h1;
}
const flat = (n, px = 100) => Array.from({ length: n }, () => [px, px + 1, px - 1, px]);

test('original.mjs is the verbatim copy of gold-weekday run.mjs', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('original.mjs', DIR))).digest('hex');
  assert.equal(sha, ORIG_SHA);
  assert.equal(R.original.sha256, ORIG_SHA);
  assert.equal(FRI, 5); assert.equal(SIDE, 1);
});

test('payroll dates: the BLS rule, holidays, January, and the repository list from 2022', () => {
  assert.equal(derive(2019, 0), '2019-02-01');   // January 2019 report
  assert.equal(derive(2020, 5), '2020-07-02');   // June 2020: 3 July observed holiday -> Thursday
  assert.equal(derive(2021, 11), '2022-01-07');  // the Friday on or before 3 January moves one week later
  assert.equal(derive(2017, 7), '2017-09-01');
  const s = payrollDates();
  assert.ok(s.has('2013-10-22') && s.has('2013-11-08'));   // shutdown exceptions
  assert.ok(s.has('2025-11-20') && !s.has('2025-10-03'));   // the 2025 shutdown, from events.mjs
  assert.ok(s.has('2022-01-07'));
  assert.ok(proxyPayroll('2026-11-06') && !proxyPayroll('2026-11-13'));
});

test('M1 / M5 rows -> UTC H1 candles, HistData labels through the converter, a repeated minute dropped', () => {
  const h = toH1([[7200 + 120, 3, 4, 2, 3.5], [7200, 1, 5, 1, 2], [7200 + 3600, 9, 9, 9, 9]]);
  assert.deepEqual(h, [{ time: 7200, open: 1, high: 5, low: 1, close: 3.5 }, { time: 10800, open: 9, high: 9, low: 9, close: 9 }]);
  const rows = parseHist('20200102 120000;1;2;0.5;1.5;0\n20200102 120000;9;9;9;9;0\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], Date.UTC(2020, 0, 2, 17, 0) / 1000);   // winter label = UTC-5
});

test('the Friday session trade, the cost change and the payroll split; a later candle changes no earlier trade', () => {
  const h1 = make([...flat(24), [100, 101.5, 99.5, 101]]);
  const S = setup(h1), T = fridays(S);
  assert.ok(T.length >= 1 && T.every((x) => S.ds[x.i].wd === 5 && x.side === 1));
  const last = T.at(-1);
  assert.equal(last.entry, 100); assert.equal(last.exit, 101); assert.equal(last.risk, 2);
  assert.ok(Math.abs(last.cost - 0.6 / 2) < 1e-12);
  const e = recost(last, 0.00016);
  assert.ok(Math.abs(e.cost - 0.00016 * 100 / 2) < 1e-12 && Math.abs(e.net - (e.gross - e.cost - e.fin)) < 1e-12);
  const ymd = dayYmd(S.ds[last.i].d);
  const sp = splitPayroll(T, S.ds, (d) => d === ymd);
  assert.equal(sp.pay.length, 1); assert.equal(sp.other.length, T.length - 1);
  const S2 = setup(make([...flat(24), [100, 101.5, 99.5, 101], [100, 500, 1, 100], ...flat(5)]));
  assert.equal(JSON.stringify(fridays(S2).slice(0, T.length)), JSON.stringify(T));
});

test('placeboWith with no cost change is the original placebo', () => {
  const S = setup(make(flat(80).map(([o], k) => [o + k * 0.1, o + k * 0.1 + 1, o + k * 0.1 - 1, o + k * 0.1 + 0.3])));
  const T = fridays(S);
  assert.deepEqual(placeboWith(S, T, undefined, 5), O.placebo(S.h1, S.idx, S.ds, T, 5));
});

test('result.json: gate, three checks, Holm over R2 and R3, and the verdict rule', () => {
  assert.equal(R.g0.pass, true); assert.equal(R.g0.n, 500); assert.equal(R.g0.net, 0.06);
  assert.equal(R.R1.survives, R.R1.oos.other.net > 0 && R.R1.oos.other.t >= 1.5);
  const h = O.holm([R.R2.p, R.R3.p]);
  assert.equal(R.R2.holm, +h[0].toFixed(4)); assert.equal(R.R3.holm, +h[1].toFixed(4));
  assert.equal(R.R2.pass, R.R2.histdata.net > 0 && R.R2.histdata.t >= 2 && R.R2.holm < 0.05 && R.R2.histdata.net2x > 0);
  assert.equal(R.R3.pass, R.R3.oos.net > 0 && R.R3.oos.t >= 2 && R.R3.holm < 0.05);
  assert.equal(R.verdict, R.R1.survives && R.R2.pass && R.R3.pass ? 'REPLICATES' : 'FAIL');
  assert.equal(R.R4.computed, false);
});

test('RESULT.md states the figures of result.json', () => {
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${R.verdict}\\.`));
  const line = MD.split('\n').find((l) => l.startsWith('**Verdict'));
  assert.ok(line.length < 230);
  const row = (name) => MD.split('\n').find((l) => l.startsWith(`| ${name}`));
  const chk = (l, s) => { for (const v of [s.n, s.gross, s.net, s.net2x, s.t, s.tGross]) assert.ok(l.includes(`| ${v} |`), `${l} lacks ${v}`); };
  chk(row('R1 other'), R.R1.oos.other); chk(row('R1 payroll'), R.R1.oos.pay);
  chk(row('R2 HistData'), R.R2.histdata); chk(row('R3 XAU/EUR'), R.R3.oos);
  assert.ok(row('R2 HistData').includes(`${R.R2.placebo.beaten} / 40`) && row('R3 XAU/EUR').includes(`${R.R3.placebo.beaten} / 40`));
  assert.ok(row('R1 other').includes(`${R.R1.placeboOther.beaten} / 40`));
  for (const [y, v] of Object.entries(R.years.oanda)) assert.ok(MD.includes(`| ${y} | ${v.net >= 0 ? '+' : ''}${v.net.toFixed(3)} (${v.n})`), y);
  assert.match(MD, /not\s+independent evidence/);
  assert.match(MD, /R4, the next 52 Fridays, is the real test/);
});

test('no look-ahead: ATR of a day uses only earlier days', () => {
  const ds = O.enrich(days(make([...flat(25), [100, 130, 70, 100]])));
  assert.equal(ds[25].atr, 2);
});
