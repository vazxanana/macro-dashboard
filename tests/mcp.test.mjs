// node --test tests/mcp.test.mjs — the ICT MCP server (api/mcp.js): keys, path allowlist, scrubbing, stats, JSON-RPC
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const handler = require('../api/mcp.js'), L = handler.lib;

test('keys: only MCP_KEYS entries, constant length, named', () => {
  process.env.MCP_KEYS = 'fred:abcdefghijklmnopqrstuvwx, Orlando : zyxwvutsrqponmlkjihgfedcba ,bad:short';
  assert.equal(L.whoIs('abcdefghijklmnopqrstuvwx'), 'fred');
  assert.equal(L.whoIs('zyxwvutsrqponmlkjihgfedcba'), 'orlando');
  assert.equal(L.whoIs('short'), null); assert.equal(L.whoIs('abcdefghijklmnopqrstuvwy'), null); assert.equal(L.whoIs(''), null); assert.equal(L.whoIs(undefined), null);
});
test('proposals may touch the ICT edge only', () => {
  for (const p of ['ict/tracker.mjs', '.claude/skills/ICT/SKILL.md', 'tests/ict-roll.test.mjs', 'tests/fixtures/ict/trades.json', 'research/ict/notes.md', 'research/edge/ict-exits-replay/run.mjs']) assert.ok(L.okPath(p), p);
  for (const p of ['council/trader.mjs', 'api/mcp.js', '.github/workflows/ict.yml', 'ict/../api/x.js', 'ict/sub/x.mjs', 'market-structure.html', 'ict/tracker.js', '', 42]) assert.ok(!L.okPath(p), String(p));
});
test('cTrader results carry labels, never account numbers or ids', () => {
  const s = L.scrub({ label: 'ICT', account: { id: '10152144', login: '10152144' }, base: false, open: [{ positionId: 9, symbol: 'XAUUSD', pnl: 3.2, note: 'acct 10152144 here' }] });
  assert.deepEqual(s, { label: 'ICT', open: [{ symbol: 'XAUUSD', pnl: 3.2, note: 'acct … here' }] });
});
test('stats and brief', () => {
  const rows = [{ id: 'a', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1, status: 'win', R: 2, grade: { letter: 'A', total: 9 }, aset: true, feat: { session: 'NY AM' } },
    { id: 'b', market: 'nq', short: 'NQ', side: 'sell', signalAt: 2, status: 'loss', R: -1, grade: { letter: 'B', total: 6 }, feat: { session: 'London' } },
    { id: 'c', market: 'es', short: 'ES', side: 'buy', signalAt: 3, status: 'open', R: null, grade: { letter: 'B+', total: 7 }, feat: {} }];
  const st = L.stats(rows);
  assert.equal(st.n, 3); assert.equal(st.open, 1); assert.equal(st.wins, 1); assert.equal(st.losses, 1); assert.equal(st.netR, 1); assert.equal(st.winRate, 0.5); assert.equal(st.byMarket.NQ.R, 1);
  assert.deepEqual(L.filterTrades(rows, { grade: 'A' }).map((t) => t.id), ['a']);
  assert.deepEqual(L.filterTrades(rows, { status: 'closed' }).map((t) => t.id), ['b', 'a']);
  assert.deepEqual(L.filterTrades(rows, { market: 'ES' }).map((t) => t.id), ['c']);
  assert.equal(L.brief(rows[0]).aSetup, true); assert.equal(L.brief(rows[2]).status, 'open');
});
test('JSON-RPC: initialize, tools/list, notifications, unknown', async () => {
  const init = await L.rpc('fred', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18'); assert.equal(init.result.serverInfo.name, 'meridian-ict');
  const list = await L.rpc('fred', { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.ok(list.result.tools.find((t) => t.name === 'ict_propose_change')); assert.ok(list.result.tools.find((t) => t.name === 'search'));
  assert.equal(await L.rpc('fred', { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'nope' })).error.code, -32601);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'ict_file_read', arguments: { path: 'api/mcp.js' } } })).result.isError, true);
});
test('handler: refuses without a key, answers with one, reads trades through a fake GitHub', async () => {
  process.env.MCP_KEYS = 'fred:abcdefghijklmnopqrstuvwx'; process.env.GH_READ_TOKEN = 'ghp_fake';
  const files = { 'ict/trades.json': [{ id: 'nq-b-1', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1793926800, status: 'open', R: null, grade: { letter: 'B+', total: 7 }, feat: { session: 'NY AM' } }],
    'ict/replay.json': { trades: [{ id: 'nq-b-1-r', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1793926800, status: 'open', replay: true }, { id: 'es-s-0-r', market: 'es', short: 'ES', side: 'sell', signalAt: 1700000000, status: 'win', R: 2.3, replay: true, grade: { letter: 'A', total: 9 }, aset: true, feat: { session: 'London' } }] } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { const m = /contents\/(.+)\?ref=/.exec(url); const p = m && decodeURIComponent(m[1]); const f = files[p];
    return f ? new Response(JSON.stringify(f), { status: 200 }) : new Response('{}', { status: 404 }); };
  const mk = (q, body, method = 'POST') => { const out = { code: 0, headers: {}, body: null }; const res = { setHeader: (k, v) => { out.headers[k] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; }, end: () => out };
    return handler({ method, query: q, headers: {}, body }, res).then(() => out); };
  try {
    assert.equal((await mk({}, {})).code, 401);
    assert.equal((await mk({ key: 'wrong-wrong-wrong-wrong-' }, {})).code, 401);
    const r = await mk({ key: 'abcdefghijklmnopqrstuvwx' }, { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'ict_trades', arguments: { source: 'both' } } });
    assert.equal(r.code, 200); const out = r.body.result.structuredContent;
    assert.equal(out.total, 2, 'the live signal is not counted twice'); assert.equal(out.stats.wins, 1); assert.equal(out.records[0].id, 'nq-b-1');
    const n = await mk({ key: 'abcdefghijklmnopqrstuvwx' }, { jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(n.code, 202);
  } finally { globalThis.fetch = realFetch; }
});
test('profile key: a member proves the password; the owner reserved name and unknown actions are refused', async () => {
  process.env.MCP_KEYS = 'fred:abcdefghijklmnopqrstuvwx';
  assert.deepEqual(L.PROFILE_USERS, ['fred']);
  const mk = (body) => { const out = { code: 0, body: null }; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; }, end: () => out };
    return handler({ method: 'POST', query: {}, headers: { host: 'meridianx.dev' }, body }, res).then(() => out); };
  assert.equal((await mk({ action: 'mykey', user: 'owner', pw: 'x' })).code, 403);
  assert.equal((await mk({ action: 'mykey', user: 'Bad Name!', pw: 'x' })).code, 403);
  assert.equal((await mk({ action: 'other' })).code, 400);
  const r = await mk({ action: 'mykey', user: 'fred', pw: 'wrong' });   // the user list fails closed here (no Blob): never a URL
  assert.notEqual(r.code, 200); assert.ok(!JSON.stringify(r.body).includes('abcdefghijklmnopqrstuvwx'));
});
test('derived keys: name.hmac, stable, any granted member, MCP_KEYS overrides; a grant is checked on every call', async () => {
  const env = { CTRADER_LINK_KEY: 'link-secret' };
  const k = L.derivedKey('fred', env); assert.match(k, /^fred\.[A-Za-z0-9_-]{32}$/); assert.equal(k, L.derivedKey('fred', env)); assert.notEqual(k, L.derivedKey('fred', { CTRADER_LINK_KEY: 'other' }));
  assert.equal(L.derivedKey('owner', env), null); assert.equal(L.derivedKey('fred', {}), null); assert.match(L.derivedKey('carlos', env), /^carlos\./);
  assert.equal(L.keyFor('fred', env), k); assert.equal(L.keyFor('fred', { ...env, MCP_KEYS: 'fred:overrideoverrideoverride' }), 'overrideoverrideoverride');
  assert.equal(L.whoIs(k, env), 'fred'); assert.equal(L.whoIs(L.derivedKey('carlos', env), env), 'carlos'); assert.equal(L.whoIs(k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A'), env), null); assert.equal(L.whoIs('fred.short', env), null);
  L.GRANT.users = { carlos: { perms: { mcp: true } }, orlando: { mcp: true }, fred: { perms: { mcp: false } }, luxus: {} }; L.GRANT.at = Date.now();
  assert.equal(await L.granted('carlos', 'h', env), true); assert.equal(await L.granted('orlando', 'h', env), true); assert.equal(await L.granted('luxus', 'h', env), false); assert.equal(await L.granted('fred', 'h', env), false);
  assert.equal(await L.granted('luxus', 'h', { ...env, MCP_KEYS: 'luxus:abcdefghijklmnopqrstuvwx' }), true);
  L.GRANT.users = { fred: {} }; assert.equal(await L.granted('fred', 'h', env), true); L.GRANT.users = null;
});
