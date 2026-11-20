// A workflow that runs scripts/own-candles.sh must check out what it needs: the script, council/md-proxy.mjs and api/bars.js
// (19 Nov 2026: backtest.yml's sparse checkout held council only and every run failed at "cannot open scripts/own-candles.sh").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('every workflow that starts its own candle service checks out scripts, council and api', () => {
  const dir = new URL('../.github/workflows/', import.meta.url);
  const bad = [];
  for (const f of fs.readdirSync(dir)) {
    const y = fs.readFileSync(new URL(f, dir), 'utf8');
    if (!/sh scripts\/own-candles\.sh/.test(y)) continue;
    // the first checkout step of the code (the one without ref: council-data)
    const step = y.split(/- name: /).find((s) => /uses: actions\/checkout@/.test(s) && !/ref: council-data/.test(s));
    if (!step || !/sparse-checkout/.test(step)) continue;   // a full checkout has everything
    const list = (step.match(/sparse-checkout:\s*\|?\s*([\s\S]*?)(?:\n\s*\n|$)/) || [, ''])[1];
    for (const need of ['scripts', 'council', 'api']) if (!new RegExp(`(^|\\s)${need}(\\s|$)`).test(list)) bad.push(`${f}: ${need}`);
  }
  assert.deepEqual(bad, []);
});
