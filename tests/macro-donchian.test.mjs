// macro-donchian: the rule on hand-made candles, and the committed report against result.json (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../research/edge/macro-donchian/run.mjs';

const bars = (n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { time: 1167609600 + i * 86400, open: c - 0.5, high: c + 1, low: c - 1, close: c }; });

test('a long signal needs a close above the 20-day high and EMA20 above EMA50', () => {
  const b = bars(80, (i) => 100 + 3 * i), F = M.frame(b);
  assert.equal(F[60].longSig, true);
  assert.equal(F[60].shortSig, false);
  const flat = M.frame(bars(80, () => 100));
  assert.ok(flat.every((f) => !f.longSig && !f.shortSig));
});

test('a trade has a stop on its losing side, exits at the stop or after five days', () => {
  const b = bars(80, (i) => 100 + 3 * i), F = M.frame(b);
  const x = M.trade(b, F, 60, 1);
  assert.equal(x.entry, b[61].open);
  assert.equal(x.how, 'time');
  assert.equal(x.exit, b[65].close);
  const d = bars(80, (i) => (i <= 61 ? 100 + i : 100 + 61 - 20 * (i - 61))), Fd = M.frame(d), y = M.trade(d, Fd, 60, 1);
  assert.ok(y.how === 'stop' || y.how === 'gap');
  assert.ok(y.R <= -0.99);
});

test('the committed result: FAIL, as RESULT.md says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/macro-donchian/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/macro-donchian/RESULT.md', import.meta.url), 'utf8');
  assert.match(r.verdict, /^FAIL/);
  assert.ok(md.includes(r.verdict));
  assert.equal(r.T1.pass, false);
  assert.ok(r.long.netR < r.placebo.p95);
  assert.equal(r.scoreSplit.pass, false);
});
