// council/md-proxy.mjs (15 Nov 2026): the council loop's own OANDA candle service, so the Trader's feed does not depend on the
// website. Offline: not started without OANDA_TOKEN; with one it answers /md/bars through api/bars.js (an unknown market is a
// 400 before any network call) and nothing else; council.yml starts it only with the secret and only then moves MD_BASE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { start } from '../council/md-proxy.mjs';
test('not started without a token; serves only /md/bars through the site\'s handler', async () => {
  assert.equal(start(0, {}), null);
  const old = process.env.OANDA_TOKEN; process.env.OANDA_TOKEN = 'test-token';
  const srv = start(0, process.env);
  try {
    await new Promise((r) => srv.once('listening', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    const a = await fetch(`${base}/md/bars?sym=nope&tf=1h&n=2`); assert.equal(a.status, 400); assert.match(await a.text(), /unknown sym/);
    assert.equal((await fetch(`${base}/api/login`)).status, 404);
  } finally { srv.close(); if (old === undefined) delete process.env.OANDA_TOKEN; else process.env.OANDA_TOKEN = old; }
});
test('council.yml: the secret reaches the loop, MD_BASE moves only once the service answers', () => {
  const y = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(y, /OANDA_TOKEN: \$\{\{ secrets\.OANDA_TOKEN \}\}/);
  const i = y.indexOf('node council/md-proxy.mjs 8790'), j = y.indexOf('export MD_BASE=http://127.0.0.1:8790/md/'), k = y.indexOf('for i in $(seq 1 $ROUNDS)');
  assert.ok(i > 0 && j > i && k > j, 'started before the rounds, MD_BASE set after it answered');
  assert.match(y.slice(i, j), /curl -fs/);
});
test('the backtest and macro-gold workflows start the same service before their scripts, keyed (daily-cache stays keyless)', () => {
  for (const [w, arg] of [['backtest', ''], ['macro-gold', '']]) {
    const y = fs.readFileSync(new URL(`../.github/workflows/${w}.yml`, import.meta.url), 'utf8');
    const i = y.indexOf(`run: sh scripts/own-candles.sh${arg}\n`); assert.ok(i > 0, w);
    assert.match(y.slice(y.lastIndexOf('- name:', i), i), /OANDA_TOKEN: \$\{\{ secrets\.OANDA_TOKEN \}\}/, w);
  }
  assert.doesNotMatch(fs.readFileSync(new URL('../.github/workflows/daily-cache.yml', import.meta.url), 'utf8'), /secrets\./, 'the weekly cache stays keyless');
  const sh = fs.readFileSync(new URL('../scripts/own-candles.sh', import.meta.url), 'utf8');
  assert.match(sh, /GITHUB_ENV/); assert.match(sh, /exit 0; \}/);
});
