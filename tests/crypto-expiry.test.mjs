// research/edge/crypto-expiry: the last-Friday calendar, the trade on hand-made candles, and the report against result.json.
// Offline: no candle file is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lastFriday, isExpiry, series, simulate, costs, nights, P, WINDOWS, holm, monthT } from '../research/edge/crypto-expiry/run.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/crypto-expiry');
const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 1000;

test('last Friday of the month on known months', () => {
  const known = { '2022-01': '2022-01-28', '2023-06': '2023-06-30', '2024-03': '2024-03-29', '2024-12': '2024-12-27',
    '2025-02': '2025-02-28', '2025-12': '2025-12-26', '2026-10': '2026-10-30', '2026-07': '2026-07-31' };
  for (const [ym, d] of Object.entries(known)) assert.equal(lastFriday(+ym.slice(0, 4), +ym.slice(5, 7) - 1), day(d), ym);
  assert.equal(isExpiry(day('2024-03-29')), true);
  assert.equal(isExpiry(day('2024-03-22')), false);
  assert.equal(new Date(lastFriday(2025, 1) * 1000).getUTCDay(), 5);
});

test('primary window is Friday 08:00 to Monday 08:00, stop 1.5 ATR, no target', () => {
  assert.equal(WINDOWS.post.entry, 8 * 3600);
  assert.equal(WINDOWS.post.exit, 3 * 86400 + 8 * 3600);
  assert.equal(WINDOWS.post.dir, 1);
  assert.equal(WINDOWS.into.dir, -1);
  assert.equal(P.K_STOP, 1.5);
  // flat candles at 100, then a drop through a long's stop (100 - 1.5 x 2 = 97)
  const t0 = day('2024-03-29') + 8 * 3600, rows = [];
  for (let i = 0; i < 40; i++) { const px = i < 20 ? 100 : 95; rows.push([t0 + i * 300, px, px + 0.5, px - 0.5, px]); }
  const S = series(rows), tr = simulate(S, t0, 1, 2, t0 + 39 * 300);
  assert.equal(tr.how, 'stop'); assert.equal(tr.stop, 97); assert.equal(tr.risk, 3);
  assert.ok(tr.R <= -1);                        // gap at the open below the stop: exit at the open
  const up = series(rows.map((r) => [r[0], 100, 100.5, 99.5, 100])), tt = simulate(up, t0, -1, 2, t0 + 39 * 300);
  assert.equal(tt.how, 'time'); assert.equal(tt.R + 0, 0);
});

test('financing: a Friday 08:00 to Monday 08:00 hold pays five nights; costs come off R', () => {
  const f = day('2025-01-31');
  assert.equal(nights(f + 8 * 3600, f + 3 * 86400 + 8 * 3600), 5);
  const tr = { t: f + 8 * 3600, closed: f + 3 * 86400 + 8 * 3600, side: 1, entry: 100000, risk: 3000, R: 0.5 };
  const c = costs(tr, 'btc');
  assert.ok(Math.abs(c.cost - 0.0004 * 100000 / 3000) < 1e-12);
  assert.ok(Math.abs(c.net - (0.5 - c.cost - c.fin)) < 1e-12);
  assert.ok(costs(tr, 'btc', 2).net < c.net);
});

test('statistics helpers', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((x) => +x.toFixed(3)), [0.03, 0.08, 0.5]);
  const m = monthT([{ closed: day('2024-01-05'), net: 1 }, { closed: day('2024-03-05'), net: 1 }], day('2024-01-01'), day('2024-03-31'));
  assert.equal(m.months, 3); assert.equal(m.n, 3);
});

test('RESULT.md and result.json agree; the verdict follows the pre-registered bar', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${res.verdict}\\.\\*\\*`));
  assert.ok(['PASS', 'FAIL'].includes(res.verdict));
  assert.ok(res.headline.length < 220);
  assert.ok(md.includes(res.headline));
  const p = res.windows.post.tests.POOL, pl = res.windows.post.placebo;
  const cond = { oosT: p.oos.netR > 0 && p.oos.tMonth >= 2, isPositive: p.is.netR > 0, x2: p.oos.net2 > 0, placebo: pl.beat >= 38 };
  assert.deepEqual(res.cond, cond);
  assert.equal(res.verdict, Object.values(cond).every(Boolean) ? 'PASS' : 'FAIL');
  assert.equal(pl.of, 40); assert.equal(pl.means.length, 40);
  assert.equal(pl.beat, pl.means.filter((m) => m < p.oos.netR).length);
  assert.equal(p.oos.n, res.windows.post.tests.BTC.oos.n + res.windows.post.tests.ETH.oos.n);
  for (const k of ['BTC', 'ETH', 'POOL']) assert.ok(md.includes(`| ${k} | OOS | ${res.windows.post.tests[k].oos.n} |`));
  // every listed trade is on an expiry Friday and has a stop-or-time exit
  for (const m of ['btc', 'eth']) for (const [d, , how] of res.trades[m]) { assert.ok(isExpiry(day(d)), d); assert.ok(['stop', 'time'].includes(how)); }
  assert.ok(fs.existsSync(path.join(DIR, 'PREREGISTRATION.md')));
});
