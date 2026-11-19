// research/edge/rsi2-unused-markets: the frozen RSI(2) pullback on the six OANDA index CFDs no earlier study used. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as O from '../research/edge/rsi2-unused-markets/frozen.mjs';
import { FROZEN, MARKETS, CANDIDATES, USED, WINDOWS, ORIGINAL, coverage, placeboTrades, normP } from '../research/edge/rsi2-unused-markets/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'rsi2-unused-markets');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const R = JSON.parse(read('result.json'));
const DAY = 86400, T0 = Date.parse('2019-01-07T00:00:00Z') / 1000;

function series(closes) {
  const out = []; let t = T0;
  closes.forEach((c, i) => {
    while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : c;
    out.push([t, o, Math.max(o, c) + 0.5, Math.min(o, c) - 0.5, c, 1]); t += DAY;
  });
  return out;
}
const closes = [...Array(260)].map((_, i) => 100 + i * 0.5);
closes.push(225, 221, 222, 226, 232, 233, 234);
for (let i = 0; i < 30; i++) closes.push(234 + i * 0.5);
const DGS2 = [['2006-01-06', 4.36], ['2018-01-05', 1.96]];

test('frozen.mjs is the original rule file, byte for byte', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN.sha256);
  assert.equal(h, 'edade889f2825fa71d911e039bfe5b9fdaaf5677e7b2fd55742e742830d5ab65');
  assert.deepEqual(O.P, { SMA_LONG: 200, SMA_EXIT: 5, RSI_N: 2, RSI_MAX: 10, ATR_N: 20, STOP_ATR: 3, FIN_ADD: 2.5, SEEDS: 40 });
});

test('the unused set: none read by #838 or rsi2-replicate, the six qualified ones and their costs match the pre-registration', () => {
  const used = new Set([...USED['838'], ...USED.replicate]);
  for (const k of CANDIDATES) assert.ok(!used.has(k), k);
  assert.deepEqual(Object.keys(MARKETS), ['us2000', 'ch20', 'nl25', 'hk33', 'cn50', 'sg30']);
  const pre = read('PREREGISTRATION.md');
  for (const [k, m] of Object.entries(MARKETS)) assert.match(pre, new RegExp('`' + k + '` \\| ' + m.cost.toFixed(1) + ' \\|'));
  assert.equal(WINDOWS.B[0], '2016-01-01'); assert.deepEqual(WINDOWS.A, ['2008-01-01', '2015-12-31']);
  assert.deepEqual(R.qualified, Object.keys(MARKETS));
  assert.equal(R.coverage.es35.ok, false); assert.equal(R.coverage.in50.ok, false);
});

test('coverage reads candle dates: late start, early end and a hole in window B each disqualify', () => {
  const ok = coverage(series([...Array(300)].map(() => 100)), '2020-03-02');
  assert.equal(ok.firstSignal <= '2016-01-04', false);          // the hand series starts 2019: too late for window B
  const rows = []; let t = Date.parse('2014-01-01T00:00:00Z') / 1000;
  while (t < Date.parse('2026-11-07T00:00:00Z') / 1000) { rows.push([t, 1, 1, 1, 1, 1]); t += DAY; }
  assert.equal(coverage(rows, '2026-11-06').ok, true);
  assert.equal(coverage(rows, '2026-12-31').ok, false);           // last candle over 14 days before the newest
  const holed = rows.filter((r) => r[0] < Date.parse('2020-03-01T00:00:00Z') / 1000 || r[0] > Date.parse('2020-03-20T00:00:00Z') / 1000);
  assert.match(coverage(holed, '2026-11-06').why, /hole in window B/);
});

test('the frozen rule on a hand-made series, and the frozen cost (DGS2 + 2.5 % a night)', () => {
  const D = O.candles(series(closes)), tr = O.simulate(D);
  assert.equal(tr.length, 1);
  const t = tr[0];
  assert.equal(t.i, t.sig + 1); assert.equal(t.entry, D[t.i].open); assert.ok(t.stop < t.entry);
  const x = { entry: 2000, exit: 2020, risk: 60, tIn: Date.parse('2023-07-03T00:00:00Z') / 1000, tOut: Date.parse('2023-07-07T00:00:00Z') / 1000 };
  const n = O.net(x, MARKETS.us2000.cost, DGS2), fin = 4 * (1.96 + 2.5) / 100 / 365 * 2000;
  assert.ok(Math.abs(n.R - (20 - 0.6 - fin) / 60) < 1e-12);
});

test('placeboTrades repeats the frozen placebo (same mean for the same seed); normP is the frozen formula', () => {
  const D = O.candles(series(closes.concat([...Array(60)].map((_, i) => 249 - (i % 7) * 3 + i * 0.2))));
  const real = O.simulate(D).map((t) => O.net(t, 2, DGS2));
  for (const s of [1, 7, 40]) {
    const mine = placeboTrades(D, real, 2, DGS2, '2019-01-01', '2020-12-31', s);
    assert.ok(Math.abs(mine.reduce((a, t) => a + t.ret, 0) / mine.length - O.placebo(D, real, 2, DGS2, '2019-01-01', '2020-12-31', s)) < 1e-12);
  }
  assert.ok(Math.abs(normP(1.96) - 0.025) < 1e-3); assert.ok(Math.abs(normP(-1.96) - 0.975) < 1e-3);
});

test('result.json: gate reproduced #838, verdict follows the four checks, RESULT.md quotes the file', () => {
  assert.equal(R.gate.pass, true);
  for (const row of R.gate.rows) {
    assert.deepEqual(row.A, ORIGINAL[row.market].A); assert.deepEqual(row.B, ORIGINAL[row.market].B);
    assert.equal(row.holmP, ORIGINAL[row.market].holm);
  }
  const B = R.pool.B, c = R.checks;
  assert.equal(c.positive, B.avgR > 0); assert.equal(c.tMonths, B.tMonthsR >= 2);
  assert.equal(c.markets4of6, B.positiveMarkets >= 4); assert.equal(c.placebo, B.avgR > B.placebo.p95);
  assert.equal(R.verdict, Object.values(c).every(Boolean) ? 'REPLICATES' : 'DOES NOT REPLICATE');
  assert.equal(B.placebo.seeds, 40);
  const md = read('RESULT.md');
  assert.match(md, new RegExp('\\*\\*Verdict: ' + R.verdict + '\\*\\*'));
  assert.ok(md.includes(`| 469 | **${B.avgR.toFixed(3)}** |`.replace('469', String(B.n))));
  assert.ok(md.includes(`**${B.tMonthsR.toFixed(2)}**`));
  for (const [k, m] of Object.entries(R.markets)) {
    const row = `| ${k.toUpperCase()} | ${m.B.n} | ${(m.B.avgRet >= 0 ? '+' : '') + m.B.avgRet.toFixed(3)} | ${(m.B.avgR >= 0 ? '+' : '') + m.B.avgR.toFixed(3)} |`;
    assert.ok(md.includes(row), row);
  }
  assert.ok(md.includes(`95th percentile +${B.placebo.p95.toFixed(3)}R`));
});
