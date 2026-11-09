// Gold Macro Score inputs that stop updating (9 Nov reliability audit): a driver forward-filled for weeks reads as "no change"
// and pulls the score toward zero without a word; the DXY came only from the weekly daily-candle cache (refreshed Saturdays),
// so from Monday to Friday its latest value was up to six days old although this run had fresh OANDA closes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { goldMacroScore, scoreLine, STALE_DAYS, STALE_STOP_DAYS } from '../council/macroscore.mjs';
import { scoreSeries } from '../council/macro.mjs';

const DAY = 86400, T = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const NOW = T('2026-11-12') + 15 * 3600;   // Thursday 12 Nov 2026 15:00 UTC
// weekday series with a wobble, from 2008 to `end`
function series(end, v0, step, seed) {
  const out = []; let v = v0, s = seed;
  for (let t = T('2008-01-01'); t <= end; t += DAY) { const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue; s = (s * 1664525 + 1013904223) >>> 0; v += (s / 2 ** 32 - 0.5) * step; out.push({ t, v }); }
  return out;
}
const fresh = NOW - DAY;
const base = () => ({ ry: series(fresh, 1.5, 0.05, 1), y2: series(fresh, 3, 0.05, 2), y10: series(fresh, 3.8, 0.05, 3), dxy: series(fresh, 100, 0.4, 4).map((o) => ({ ...o, v: Math.max(80, o.v) })) });

test('fresh inputs: no stale flag, same score as before', () => {
  const s = goldMacroScore(base(), { asOf: NOW });
  assert.equal(s.ok, true); assert.deepEqual(s.stale, []);
  assert.doesNotMatch(scoreLine(s), /stale/);
});

test('a driver that stopped updating 2 weeks ago is flagged in the result and the line', () => {
  const S = base(); S.ry = S.ry.filter((o) => o.t <= NOW - 15 * DAY);
  const s = goldMacroScore(S, { asOf: NOW });
  assert.equal(s.ok, true);
  assert.deepEqual(s.stale.map((x) => x.k), ['ry']); assert.ok(s.stale[0].days >= STALE_DAYS);
  assert.match(scoreLine(s), /stale: real yield last \d{4}-\d\d-\d\d/);
});

test('a driver older than its own 4-week change window withholds the score instead of reading a flat line as "no change"', () => {
  const S = base(); S.dxy = S.dxy.filter((o) => o.t <= NOW - (STALE_STOP_DAYS + 3) * DAY);
  const s = goldMacroScore(S, { asOf: NOW });
  assert.equal(s.ok, false); assert.equal(s.score, null); assert.equal(s.bias, null);
  assert.match(s.why, /DXY/); assert.match(scoreLine(s), /n\/a/);
});

test('scoreSeries: the cached daily candles are extended with this run\'s closed OANDA days (DXY and gold)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mscore-')), dd = path.join(dir, 'research', 'daily');
  fs.mkdirSync(dd, { recursive: true });
  const cacheEnd = T('2026-11-06'), P = { eurusd: 1.1, usdjpy: 150, gbpusd: 1.3, usdcad: 1.36, usdchf: 0.88, xau: 4000 };
  for (const [k, p] of Object.entries(P)) fs.writeFileSync(path.join(dd, `${k}.json`), JSON.stringify({ rows: series(cacheEnd, p, p * 0.004, 9).map((o) => [o.t, o.v, o.v, o.v, Math.max(o.v, p / 2), 0]) }));
  const bars = {}, BK = { eurusd: 'eurusd', usdjpy: 'usdjpy', gbpusd: 'gbpusd', usdcad: 'usdcad', usdchf: 'usdchf', xau: 'gold' };
  for (const [k, p] of Object.entries(P)) bars[BK[k]] = [T('2026-11-09'), T('2026-11-10'), T('2026-11-11'), T('2026-11-12')].map((t, i) => ({ time: t, open: p, high: p, low: p, close: p * (1 + i / 1000) }));
  const S = await scoreSeries(async () => { throw new Error('offline'); }, NOW, { dir, data: { fred: {}, bars }, cache: {}, src: {} });
  const lastDay = (a) => new Date(a[a.length - 1].t * 1000).toISOString().slice(0, 10);
  assert.equal(lastDay(S.dxy), '2026-11-11', 'the last CLOSED day from this run (12 Nov is still forming)');
  assert.equal(lastDay(S.gold), '2026-11-11');
  assert.ok(S.dxy.filter((o) => o.t <= cacheEnd).length > 1000, 'the long cached history is kept');
});
