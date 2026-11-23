// tests/grid5-sd-eg.test.mjs - research/edge/grid5-sd-eg (offline: hand-made and seeded candles, the committed result).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { sdZones, tradesOf, stager, cellIndex, cellName, NCELL, monthOf } from '../research/edge/grid5-sd-eg/run.mjs';

const DIR = fileURLToPath(new URL('../research/edge/grid5-sd-eg/', import.meta.url));
const bar = (t, o, h, l, c, sec = 3600) => ({ t, o, h, l, c, e: t + sec });

test('the order block: the last bearish candle at or before the leg origin, out to the origin low', () => {
  // swing high at 3 (3 a side), a drop to a low at 6 with a red candle at 5, then a close above the swing high
  const P = [[10, 11, 9, 10.5], [10.5, 12, 10, 11.5], [11.5, 13, 11, 12.5], [12.5, 15, 12, 14], [14, 14.2, 12, 12.5], [12.5, 12.8, 10, 10.5],
    [10.5, 11.5, 9.5, 11.2], [11.2, 12.5, 11, 12.4], [12.4, 13.5, 12, 13.4], [13.4, 14.5, 13, 14.4], [14.4, 16, 14, 15.8], [15.8, 16.5, 15.5, 16.2]];
  const L = P.map((p, i) => bar(i * 3600, ...p));
  const Z = sdZones(L);
  const z = Z.find((x) => x.d === 1);
  assert.ok(z, 'a demand zone');
  assert.equal(z.oi, 5);                    // candle 5 is the last red candle at or before the lowest low (candle 6)
  assert.equal(z.lo, 9.5); assert.equal(z.hi, 12.8);
  assert.equal(z.at, L[10].e);              // known at the break candle's close
});

test('cell index round-trips and covers 1,440 rules', () => {
  assert.equal(NCELL, 1440);
  const seen = new Set();
  for (let ch = 0; ch < 3; ch++) for (let v = 0; v < 2; v++) for (let tr = 0; tr < 4; tr++) for (let st = 0; st < 3; st++) for (let en = 0; en < 2; en++) for (let sp = 0; sp < 2; sp++) for (let x = 0; x < 5; x++) seen.add(cellIndex(ch, v, tr, st, en, sp, x));
  assert.equal(seen.size, 1440);
  assert.deepEqual(cellName(cellIndex(2, 1, 3, 0, 1, 0, 4)), { chain: '1h>5m', visit: 'any', trigger: 'bo', stage: 'pull', entry: 'lim', stop: 'zone', exit: 'opp' });
  assert.equal(monthOf(Date.UTC(2015, 0, 1) / 1000), 60);
});

// a seeded random walk of 5-minute candles on weekdays
function walk(days, seed = 3, from = Date.UTC(2012, 0, 2) / 1000) {
  const r = K.rng(seed), out = []; let p = 1600;
  for (let t = from; t < from + days * 86400; t += 300) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const o = p, c = o + (r() - 0.5) * 2.4 + 0.05 * Math.sin(t / 86400 / 3); const h = Math.max(o, c) + r() * 0.8, l = Math.min(o, c) - r() * 0.8; p = c;
    out.push({ t, o, h, l, c, e: t + 300 });
  }
  return out;
}

test('no look-ahead: cutting the candles leaves every trade that finished before the cut unchanged, stops on the losing side', () => {
  const M5 = walk(150), from = Date.UTC(2012, 1, 15) / 1000, cut = Date.UTC(2012, 4, 10) / 1000;
  const run = (bars) => { const rows = []; tradesOf('xau', bars, frames(bars), (x) => rows.push(x), { from, to: Date.UTC(2013, 0, 1) / 1000 }); return rows; };
  const full = run(M5), part = run(M5.filter((b) => b.e <= cut));
  const done = (rows) => rows.filter((x) => x.t < cut - 11 * 86400).map((x) => JSON.stringify(x)).sort();
  assert.ok(done(full).length > 50, 'enough trades to compare: ' + done(full).length);
  assert.deepEqual(done(part), done(full));
  for (const x of full) { assert.ok(x.cr > 0); for (const R of x.R) if (Number.isFinite(R)) assert.ok(R >= -1 - 1e-9 || x.entry === 0, 'a stop costs 1R unless a market gap'); }
});

test('the stage reader uses only breaks known by then', () => {
  const M5 = walk(120, 9), F = frames(M5), st = stager(F['4h'], F['1h']);
  const t = Date.UTC(2012, 2, 20) / 1000, a = st(t);
  const cutF = frames(M5.filter((b) => b.e <= t)), b = stager(cutF['4h'], cutF['1h'])(t);
  assert.deepEqual(a, b);
  assert.ok(['move', 'pullback', 'continuation', 'range'].includes(a.stage));
});

test('RESULT.md line 3 states the verdict and counts of result.json', () => {
  const res = JSON.parse(fs.readFileSync(DIR + 'result.json', 'utf8'));
  const line = fs.readFileSync(DIR + 'RESULT.md', 'utf8').split('\n')[2];
  assert.match(line, new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\. '));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict));
  assert.ok(typeof res.headline === 'string' && res.headline.length > 20);
  for (const k of ['confirmed', 'checked', 'tested', 'discovery']) assert.ok(line.includes(res.real[k].toLocaleString('en-GB')), k + ' in line 3');
  if (res.best) { assert.ok(line.includes('n ' + res.best.n2.toLocaleString('en-GB'))); assert.ok(line.includes(String(res.best.t2))); }
  assert.equal(res.cells, 8640);
  assert.equal(res.verdict === 'PASS', res.real.confirmed > 0);
});
