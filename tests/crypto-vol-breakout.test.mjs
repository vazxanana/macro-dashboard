import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildDays, trades, charge, costPx, decide, ORIG_SHA, W } from '../research/edge/crypto-vol-breakout/run.mjs';

const dir = new URL('../research/edge/crypto-vol-breakout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir)));

test('crypto-vol-breakout: imported rule file unchanged, pre-registration hash recorded', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/index-vol-breakout/original.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, ORIG_SHA); assert.equal(R.originalSha, ORIG_SHA);
  const pre = crypto.createHash('sha256').update(fs.readFileSync(new URL('PREREGISTRATION.md', dir))).digest('hex');
  assert.equal(R.prereg, pre);
});

test('crypto-vol-breakout: result figures and verdict', () => {
  const p = R.series.pool;
  assert.equal(p.oos.n, 1428); assert.equal(p.oos.netR, 0.045); assert.equal(p.oos.t, 1.27);
  assert.equal(p.is.netR, -0.011); assert.equal(R.series.BTC.oos.n + R.series.ETH.oos.n, p.oos.n);
  assert.ok(Object.values(R.series).every((r) => !r.pass));
  assert.match(R.verdict, /^FAIL, 0 of 3/);
  assert.match(fs.readFileSync(new URL('RESULT.md', dir), 'utf8'), /\*\*Verdict: FAIL/);
  const again = decide(JSON.parse(JSON.stringify(R.series)));
  for (const k of Object.keys(again)) assert.equal(again[k].pass, R.series[k].pass);
});

test('crypto-vol-breakout: cost is 0.06 % of the entry, every day incl. weekends, no look-ahead', () => {
  assert.ok(Math.abs(costPx({ entry: 100000, stop: 99000 }) - 60) < 1e-6);
  assert.ok(Math.abs(charge({ entry: 100, stop: 99, r: 1, R: 1 }).net - 0.94) < 1e-9);
  // a seeded path over 10 UTC days (a weekend included)
  let s = 7; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const t0 = Date.parse('2024-03-01T00:00:00Z') / 1000, rows = []; let px = 100;
  for (let i = 0; i < 288 * 10; i++) { const o = px; px = o * (1 + (rnd() - 0.5) * 0.004); rows.push([t0 + i * 300, o, Math.max(o, px) * 1.0005, Math.min(o, px) * 0.9995, px]); }
  const days = buildDays(rows);
  assert.equal(days.length, 10); assert.ok(days.some((d) => d.dow === 6) && days.some((d) => d.dow === 0));
  assert.equal(days[0].prevRange, null);
  const tr = trades('X', days);
  assert.ok(tr.length > 0 && tr.every((x) => x.side * (x.entry - x.stop) > 0));
  // changing every price after a trade's exit time does not change that trade
  const x = tr[0], cut = rows.map((r) => (r[0] > x.fillT + 21 * 3600 ? [r[0], r[1] * 2, r[2] * 2, r[3] * 2, r[4] * 2] : r));
  const y = trades('X', buildDays(cut)).find((z) => z.day === x.day);
  assert.deepEqual(y, x);
  assert.ok(W.IS[1] < W.OOS[0]);
});
