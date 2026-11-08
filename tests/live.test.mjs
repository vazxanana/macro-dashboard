// node --test tests/live.test.mjs — the council live runner's pure parts (council/live.mjs). No network, no git.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { parseEnv, isFresh, shouldPush, scrubber, serveHandler, FRESH_SEC, PUSH_FILES } from '../council/live.mjs';

test('parseEnv: KEY=VALUE, comments, quotes, bad lines ignored; values never echoed by scrubber', () => {
  const e = parseEnv('# c\nGH_TOKEN=abc123def\n OANDA_ENV = "practice" \nbad line\n1X=2\nLIVE_EVERY=30\n');
  assert.deepEqual(e, { GH_TOKEN: 'abc123def', OANDA_ENV: 'practice', LIVE_EVERY: '30' });
  const s = scrubber(e); assert.equal(s('token abc123def sent, every 30'), 'token [secret] sent, every 30');
});

test('isFresh: a heartbeat under FRESH_SEC old means the runner owns the Trader', () => {
  const now = 1794000000; assert.equal(FRESH_SEC, 180);
  assert.equal(isFresh({ at: new Date((now - 60) * 1000).toISOString() }, now), true);
  assert.equal(isFresh({ at: new Date((now - 200) * 1000).toISOString() }, now), false);
  assert.equal(isFresh(null, now), false); assert.equal(isFresh({ at: 'garbage' }, now), false);
});

test('shouldPush: trade files at once, the rest on the periodic cadence, nothing when clean', () => {
  assert.deepEqual(PUSH_FILES, ['trades.json', 'ctrader/mirror.json', 'ctrader/tokens.json', 'live.json']);
  assert.equal(shouldPush(['snapshot.json'], 0, 400, 300), 'periodic');
  assert.equal(shouldPush(['snapshot.json'], 0, 100, 3000), null);
  assert.equal(shouldPush(['ctrader\\mirror.json'], 0, 10, 3000), 'trade files changed');
  assert.equal(shouldPush([], 0, 100000, 1), null);
});

test('serveHandler: the Vercel-style handler answers on node:http with status, headers and JSON', async () => {
  const handler = async (req, res) => { if (req.query.sym === 'xau') { res.setHeader('X-T', '1'); return res.status(200).json({ ok: true, tf: req.query.tf }); } return res.status(400).json({ error: 'unknown' }); };
  const srv = http.createServer((req, res) => serveHandler(handler, req, res)); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port, ok = await fetch(`http://127.0.0.1:${port}/md/bars?sym=xau&tf=5m`), bad = await fetch(`http://127.0.0.1:${port}/md/bars?sym=zz`);
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('x-t'), '1'); assert.deepEqual(await ok.json(), { ok: true, tf: '5m' }); assert.equal(bad.status, 400);
  srv.close();
});

test('wiring: the workflow steps aside while the heartbeat is fresh; the install files exist and point at the runner', () => {
  const yml = fs.readFileSync(new URL('../.github/workflows/council.yml', import.meta.url), 'utf8');
  assert.match(yml, /livefresh\(\)/); assert.match(yml, /if livefresh; then echo "live runner alive/); assert.match(yml, /\[ "\$k" -eq 2 \] && ! livefresh/); assert.match(yml, /livefresh \|\| node council\/ctrader-mirror\.mjs data/);
  for (const f of ['install-vps.sh', 'meridianx-live.service', 'run-live.cmd', 'install-task.cmd', 'env.example', 'README.md']) assert.ok(fs.existsSync(new URL(`../scripts/live/${f}`, import.meta.url)), f);
  const ex = fs.readFileSync(new URL('../scripts/live/env.example', import.meta.url), 'utf8'); assert.doesNotMatch(ex, /=[^\s#]{12,}/, 'the template holds names only');
  assert.match(fs.readFileSync(new URL('../scripts/live/meridianx-live.service', import.meta.url), 'utf8'), /node council\/live\.mjs/);
});
