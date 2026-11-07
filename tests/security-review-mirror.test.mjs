// node --test tests/security-review-mirror.test.mjs — the demo mirror, test order and suite scrub every token they use, not only
// the configured ones: a rotated or stored token echoed in a broker error never reaches mirror.json / test.json / suite.json
// (those files are published with the council data).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mirrorRound, seal, scrubber } from '../council/ctrader-mirror.mjs';
import { testRound } from '../council/ctrader-test.mjs';
import { suiteRound } from '../council/ctrader-suite.mjs';

const ENV = { CTRADER_CLIENT_ID: 'fake-client-id', CTRADER_CLIENT_SECRET: 'fake-client-secret', CTRADER_ACCESS_TOKEN: 'fake-access-old',
  CTRADER_REFRESH_TOKEN: 'fake-refresh-old', CTRADER_ACCOUNT_ID: '4242', CTRADER_ENV: 'demo', CTRADER_MIRROR: 'on' };
const STORED = { accessToken: 'stored-access-9f8e7d', refreshToken: 'stored-refresh-9f8e7d' };

// answers app auth, then fails the account list with a description that repeats the token it was sent
function echoing() {
  const sent = [];
  class WS { constructor(url) { this.url = url; setTimeout(() => this.onopen && this.onopen(), 0); }
    send(text) { const m = JSON.parse(text); sent.push(m); if (m.payloadType === 51) return;
      const r = (payloadType, payload) => setTimeout(() => this.onmessage({ data: JSON.stringify({ clientMsgId: m.clientMsgId, payloadType, payload }) }), 0);
      if (m.payloadType === 2100) return r(2101, {});
      if (m.payloadType === 2149) return r(2142, { errorCode: 'SERVER_ERROR', description: `bad token ${m.payload.accessToken} / ${STORED.refreshToken}` });
      return r(50, { errorCode: 'UNEXPECTED' }); }
    close() {} }
  return { WS, sent };
}

test('scrubber can learn more secrets after it is made', () => {
  const s = scrubber(ENV); s.add('later-secret-123', null, 'x');
  assert.equal(s('a fake-access-old b later-secret-123 c x'), 'a [redacted] b [redacted] c x');
});

test('mirror: a stored (rotated) token echoed in an error is scrubbed', async () => {
  const b = echoing();
  const out = await mirrorRound({ env: ENV, trades: [], state: {}, tokens: seal(STORED, ENV), WS: b.WS, now: 1794000000, timeout: 200 });
  assert.ok(b.sent.some((m) => m.payload && m.payload.accessToken === STORED.accessToken), 'the stored token was used');
  const txt = JSON.stringify(out.state) + JSON.stringify(out.log);
  assert.match(txt, /SERVER_ERROR/); assert.doesNotMatch(txt, /stored-access|stored-refresh/);
});

test('test order: a stored token echoed in an error is scrubbed', async () => {
  const b = echoing();
  const req = await testRound({ env: ENV, req: { request: 't1', _tokens: seal(STORED, ENV) }, WS: b.WS, now: 1794000000 });
  delete req._tokens;
  const txt = JSON.stringify(req); assert.match(txt, /SERVER_ERROR/); assert.doesNotMatch(txt, /stored-access|stored-refresh/);
});

test('suite: a stored token echoed in an error is scrubbed', async () => {
  const b = echoing();
  const req = await suiteRound({ env: ENV, req: { request: 's1', _tokens: seal(STORED, ENV) }, WS: b.WS });
  delete req._tokens;
  const txt = JSON.stringify(req); assert.match(txt, /SERVER_ERROR/); assert.doesNotMatch(txt, /stored-access|stored-refresh/);
});
