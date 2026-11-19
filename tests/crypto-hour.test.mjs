// research/edge/crypto-hour: offline checks of the hour choice, the trade, the stop, costs and financing, and the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, ts, hours, atrBefore, rolloverNights, simHour, hourTable, chooseHours, study, holm } from '../research/edge/crypto-hour/run.mjs';
import { CFD_CRYPTO } from '../council/fills.mjs';

const DIR = new URL('../research/edge/crypto-hour/', import.meta.url);
const H = 3600;

// synthetic 5-minute rows: flat price, except a drift `bp(h, t)` (basis points) spread over hour h
function series(from, to, bp, base = 100) {
  const rows = []; let px = base;
  for (let t = ts(from); t < ts(to); t += 300) {
    const h = new Date(t * 1000).getUTCHours(), step = bp(h, t) / 1e4 / 12, wig = 0.001 * px;
    const o = px, c = px * (1 + step);
    rows.push([t, o, Math.max(o, c) + wig, Math.min(o, c) - wig, c]);
    px = c;
  }
  return rows;
}

test('hours: only complete UTC hours are built', () => {
  const rows = series('2022-01-01', '2022-01-02', () => 0);
  rows.splice(5, 1);
  const Hm = hours(rows);
  assert.equal(Hm.size, 23);
  assert.equal(Hm.has(ts('2022-01-01')), false);
  const b = Hm.get(ts('2022-01-01') + H);
  assert.equal(b.m5.length, 12);
  assert.equal(b.o, b.m5[0][1]); assert.equal(b.c, b.m5[11][4]);
});

test('hour choice is made on discovery only', () => {
  // discovery (2022-23): hour 5 up, hour 9 down; decisive (2024): the opposite and much larger
  const bp = (h, t) => (t < ts('2024-01-01') ? (h === 5 ? 3 : h === 9 ? -3 : 0) + ((t / 300) % 7 - 3) * 0.2 : (h === 9 ? 50 : h === 5 ? -50 : 0));
  const rows = series('2022-01-01', '2024-03-01', bp);
  const Hm = hours(rows);
  const pick = chooseHours(hourTable([Hm], P.windows.discovery));
  assert.deepEqual(pick, { long: 5, short: 9 });
  const S = study({ btc: rows, eth: rows });
  assert.deepEqual(S.pick, { long: 5, short: 9 });
  // decisive figures do not move the pick
  const rows2 = series('2022-01-01', '2024-03-01', (h, t) => (t < ts('2024-01-01') ? bp(h, t) : 0));
  assert.deepEqual(study({ btc: rows2, eth: rows2 }).pick, { long: 5, short: 9 });
  assert.ok(S.tests.every((x) => x.n > 0 && x.n <= 61));
});

test('ATR(24) uses the 24 closed hours before entry and needs all 25', () => {
  const Hm = hours(series('2022-01-01', '2022-01-03', () => 0));
  const T = ts('2022-01-02') + 2 * H;
  const a = atrBefore(Hm, T);
  assert.ok(a > 0);
  Hm.delete(T - 25 * H);
  assert.equal(atrBefore(Hm, T), null);
  assert.ok(atrBefore(Hm, T + H) > 0);
});

test('entry at the open, exit at the close, stop 2 ATR, costs in R', () => {
  const T = ts('2024-02-06') + 3 * H; // a Tuesday, 03:00 UTC: no rollover inside
  const m5 = Array.from({ length: 12 }, (_, k) => [T + k * 300, 100 + k * 0.1, 100 + k * 0.1 + 0.05, 100 + k * 0.1 - 0.05, 100 + (k + 1) * 0.1]);
  const b = { t: T, o: 100, c: 101.2, m5 };
  const L = simHour(b, 1, 1, 'btc');
  assert.equal(L.entry, 100); assert.equal(L.exit, 101.2); assert.equal(L.stop, 98); assert.equal(L.stopped, false);
  assert.equal(L.nights, 0); assert.equal(L.fin, 0);
  assert.ok(Math.abs(L.gross - 0.6) < 1e-9);
  assert.ok(Math.abs(L.cost - CFD_CRYPTO * 100 / 2) < 1e-12);
  assert.ok(Math.abs(L.R - (0.6 - CFD_CRYPTO * 50)) < 1e-9);
  // short: stop at 102 is hit by no candle (high 101.25); a gap through the stop fills at the open
  const S = simHour(b, -1, 0.5, 'btc'); // stop 101
  assert.equal(S.stopped, true);
  assert.ok(Math.abs(S.exit - 101) < 1e-9 || S.exit > 101);
  assert.ok(S.gross <= -1 + 1e-9);
  const gap = { t: T, o: 100, c: 95, m5: [[T, 100, 100, 99, 99], [T + 300, 96, 96, 95, 95], ...m5.slice(2)] };
  const G = simHour(gap, 1, 1, 'btc'); // stop 98, candle 2 opens 96
  assert.equal(G.exit, 96); assert.equal(G.stopped, true);
});

test('financing: 17:00 New York in (entry, exit], Friday counts three', () => {
  // summer: 17:00 New York = 21:00 UTC; Tuesday 4 Jun 2024
  const tue = ts('2024-06-04');
  assert.equal(rolloverNights(tue + 20 * H, tue + 21 * H), 1);
  assert.equal(rolloverNights(tue + 21 * H, tue + 22 * H), 0);
  // winter: 22:00 UTC; Tuesday 6 Feb 2024
  const w = ts('2024-02-06');
  assert.equal(rolloverNights(w + 21 * H, w + 22 * H), 1);
  assert.equal(rolloverNights(w + 20 * H, w + 21 * H), 0);
  // Friday 7 Jun 2024
  const fri = ts('2024-06-07');
  assert.equal(rolloverNights(fri + 20 * H, fri + 21 * H), 3);
  const m5 = Array.from({ length: 12 }, (_, k) => [tue + 20 * H + k * 300, 100, 100.01, 99.99, 100]);
  const t = simHour({ t: tue + 20 * H, o: 100, c: 100, m5 }, 1, 1, 'eth');
  assert.equal(t.nights, 1);
  assert.ok(Math.abs(t.fin - 0.15 / 365 * 100 / 2) < 1e-12);
  const s = simHour({ t: tue + 20 * H, o: 100, c: 100, m5 }, -1, 1, 'btc');
  assert.ok(Math.abs(s.fin - 0.075 / 365 * 100 / 2) < 1e-12);
});

test('Holm is monotone and capped', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]), [0.04, 0.09, 0.09, 0.5]);
});

test('RESULT.md agrees with result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const pass = R.tests.filter((x) => x.pass).length;
  assert.equal(R.verdict, pass ? 'PASS' : 'FAIL');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${R.verdict}, ${pass} of 4 tests\\.\\*\\*`));
  assert.ok(md.indexOf('Verdict') < md.indexOf('## '), 'verdict first');
  assert.match(md, new RegExp(`\\| Long \\(highest t\\) \\| ${R.pick.long} \\|`));
  assert.match(md, new RegExp(`\\| Short \\(lowest t\\) \\| 0?${R.pick.short} \\|`));
  for (const t of R.tests) {
    const n = t.R.toFixed(4).replace('-', '\\-').replace('+', '\\+');
    assert.match(md, new RegExp(`\\| ${t.n} \\| ${t.R < 0 ? '-' : '\\+?'}${Math.abs(t.R).toFixed(4)} \\|`), t.test);
    assert.ok(md.includes(t.monthT.toFixed(2)), `${t.test} month t`);
    void n;
  }
  assert.ok(md.includes(`beats ${R.placebo.beatsLong} of 40`));
  assert.ok(md.includes(`beats ${R.placebo.beatsShort} of 40`));
  assert.equal(R.placebo.seeds.length, 40);
  assert.equal(R.params.cost, CFD_CRYPTO);
  assert.deepEqual(R.windows, P.windows);
});
