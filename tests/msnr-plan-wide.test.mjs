// tests/msnr-plan-wide.test.mjs - research/edge/msnr-plan-wide: offline checks of the harness and that RESULT.md says what
// result.json holds. No network, no candle cache: synthetic candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../research/edge/msnr-plan-wide/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/msnr-plan-wide/', import.meta.url);

function seeded(n, seed = 7, t0 = Date.UTC(2010, 0, 4) / 1000) {
  let s = seed; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let p = 1.3;
  for (let i = 0; i < n; i++) { const t = t0 + i * 300; const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue;
    const o = p, c = o + (r() - 0.5) * 0.0012 + Math.sin(i / 900) * 0.0001; const h = Math.max(o, c) + r() * 0.0004, l = Math.min(o, c) - r() * 0.0004;
    out.push({ t, o, h, l, c, e: t + 300 }); p = c; }
  return out;
}

test('cells: 54, names round-trip, the limit set has no MSNR split', () => {
  assert.equal(W.NCELL, 54);
  const seen = new Set();
  for (let i = 0; i < 54; i++) { const n = W.cellName(i); assert.equal(W.cellIndex(n.s, n.c, n.tr, n.st, n.x), i); seen.add(W.cname(n)); if (n.s === 1) assert.equal(n.call, 'all'); }
  assert.equal(seen.size, 54);
});

test('pips: ten points, the desk value for gold and silver', () => {
  assert.equal(W.PIP.xau, 0.1); assert.equal(W.PIP.xag, 0.01); assert.equal(W.PIP.usdjpy, 0.01); assert.equal(W.PIP.eurjpy, 0.01);
  for (const m of ['eurusd', 'gbpusd', 'audusd', 'nzdusd', 'usdcad', 'usdchf']) assert.equal(W.PIP[m], 1e-4);
});

test('exits: stop first in a candle holding both; targets 1R 2R 3R; a limit fill candle counts only the stop', () => {
  const B = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  const M = [B(0, 100, 100.5, 99.8, 100.2), B(300, 100.2, 101.2, 100.1, 101), B(600, 101, 103.5, 100.9, 103), B(900, 103, 103, 98, 99)];
  const r = W.exits(M, 1, 0, 100, 99); assert.deepEqual(r.R, [1, 2, 3]);
  const both = [B(0, 100, 101.5, 98.5, 100)]; assert.deepEqual(W.exits(both, 1, 0, 100, 99).R, [-1, -1, -1]);
  const lim = [B(0, 100.5, 101.5, 99.9, 100.2), B(300, 100.2, 100.3, 98.5, 99)];
  assert.deepEqual(W.exits(lim, 1, 0, 100, 99, true).R, [-1, -1, -1]);
  assert.equal(W.exits(M, 1, 0, 100, 100.5), null);   // stop not on the losing side: no trade
});

test('limit fills only when traded through by half the round trip', () => {
  const B = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  const M = [B(0, 1.1010, 1.1012, 1.1000, 1.1005), B(300, 1.1005, 1.1006, 1.09996, 1.1)];
  assert.equal(W.limitFill(M, 1, 1.1000, 0, 0.00003).i, 1);
  assert.equal(W.limitFill(M.slice(0, 1), 1, 1.1000, 0, 0.00003), null);
});

test('m30of matches the desk: buckets on :00 / :30 from two 15-minute candles', () => {
  const C = [{ time: 900, open: 1, high: 2, low: 0.5, close: 1.5 }, { time: 1800, open: 1.5, high: 3, low: 1, close: 2 }, { time: 2700, open: 2, high: 2.5, low: 0.2, close: 1 }];
  assert.deepEqual(W.m30of(C), [{ time: 1800, open: 1.5, high: 3, low: 0.2, close: 1 }]);
});

test('no look-ahead: plan signals on cut synthetic candles equal the full run up to the cut', () => {
  const M5 = seeded(60000), full = W.signals(M5, frames(M5));
  assert.ok(full.length > 100);
  for (const g of full) { assert.ok(g.T > 0 && (g.d === 1 || g.d === -1)); }
  const key = (g) => [g.tr, g.tf, g.T, g.d, g.far.toFixed(8), g.atr.toFixed(8), g.plan, g.call].join('|');
  for (const day of [80, 150]) { const T = Date.UTC(2010, 0, 4) / 1000 + day * 86400; const C = M5.filter((b) => b.e <= T);
    const cut = W.signals(C, frames(C)).filter((g) => g.T <= T).map(key).sort(), want = full.filter((g) => g.T <= T).map(key).sort();
    assert.deepEqual(cut, want); }
});

test('RESULT.md line 3 states result.json', () => {
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8').split('\n');
  const j = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(j.verdict));
  assert.equal(md[2], `**Verdict: ${j.verdict}. ${j.headline}.**`);
  assert.equal(j.cells.length, 54);
  assert.equal(j.passed.length, j.cells.filter((c) => c.pass).length);
  if (j.verdict === 'PASS') assert.ok(j.passed.length > 0); else assert.equal(j.passed.length, 0);
  for (const c of j.cells) if (c.pass) assert.ok(c.disc.n >= 300 && c.conf.n >= 300 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05 && c.vsControl.d >= 2 && c.vsControl.c >= 2);
  for (const x of j.cut) assert.equal(x.missing + x.extra, 0);
});
