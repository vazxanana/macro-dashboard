// node --test tests/eqx-bridge.test.mjs
// The Equinox bridge (24 Nov 2026): a member's personal key, the feed, the endpoint's refusals, the MetaTrader program's guards.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { eqxCandidates, EQX } from '../council/ctrader-mirror.mjs';
const require = createRequire(import.meta.url);
const E = require('../api/_eqx-bridge.js'), H = require('../api/eqx-bridge.js'), S = require('../api/_session.js'), G = require('../api/_guard.js');
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const NOW = 1795560000, env = { SESSION_SECRET: 'a-test-secret-of-enough-length' }, secret = S.secret(env);
const rec = (o) => ({ id: 'fade-m15-b' + (o.t || NOW - 600), kind: 'fade-m15', market: 'audusd', side: 1, t: NOW - 600, entry: 100, stop: 99, target: 102, status: 'open', first: NOW - 500, float: 0.1, ...o });
const FILES = { fade: { records: [
  rec({}),                                                                    // fresh: open
  rec({ id: 'old', t: NOW - 9000, first: NOW - 8000 }),                        // late: hold
  rec({ id: 'far', t: NOW - 700, float: 1.2 }),                                // far from its entry: hold
  rec({ id: 'done', t: NOW - 5000, status: 'stopped', endT: NOW - 100, R: -1 }), // closed lately
  rec({ id: 'gone', t: NOW - 400000, status: 'target', endT: NOW - 300000 }),  // closed long ago: not in the feed
  rec({ id: 'nostop', t: NOW - 650, stop: 101 }),                              // stop on the winning side: never written
  rec({ id: 'eurusd:x', market: 'eurusd', side: -1, t: NOW - 300, entry: 1.1, stop: 1.101, target: 1.098 }),
  rec({ id: 'weird', market: 'zzz', t: NOW - 200 }),
  rec({ id: 'gold', market: 'xau', t: NOW - 250 }),                            // gold left the Break fade desk: never written
] }, bigfade: { records: [] }, fvg: { records: [] }, goldvb: { records: [rec({ id: 'vb', market: 'xau', t: NOW - 100, target: null })] } };
const res = () => ({ h: {}, code: 0, body: null, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, json(x) { this.body = x; return this; }, send(x) { this.body = x; return this; } });
const deps = (over = {}) => ({ env, now: () => NOW * 1000, readFile: async (p) => ({ ok: true, buf: Buffer.from(JSON.stringify(FILES[p.split('/')[0]])) }), users: async () => ({ ana: { name: 'Ana', role: 'reviewer' }, vic: { name: 'Vic', role: 'viewer' } }), ...over });

test('the key: derived per account, checked in full, never accepted for another account', () => {
  const k = E.keyOf(secret, 'ana'); assert.match(k, /^ana\.[A-Za-z0-9_-]{32}$/);
  assert.equal(E.whoOf(secret, k), 'ana'); assert.equal(E.whoOf(secret, k.replace('ana.', 'vic.')), null);
  assert.equal(E.whoOf(secret, k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A')), null); assert.equal(E.whoOf(secret, ''), null); assert.equal(E.whoOf(secret, 'x'.repeat(200)), null);
  assert.equal(E.keyOf(null, 'ana'), null); assert.equal(E.keyOf(secret, 'Bad Name'), null);
  assert.notEqual(E.keyOf(S.secret({ SESSION_SECRET: 'another-secret-of-enough-length' }), 'ana'), k);
});

test('the feed: open / hold / closed, a stop on the losing side or no line, and the same choices as the demo mirror', () => {
  const rows = E.lines(FILES, NOW), by = Object.fromEntries(rows.map((x) => [x.id, x.state]));
  assert.deepEqual(by, { ['fade:fade-m15-b' + (NOW - 600)]: 'open', 'fade:old': 'hold', 'fade:far': 'hold', 'fade:done': 'closed', 'fade:eurusd:x': 'open', 'goldvb:vb': 'open' });
  for (const x of rows) { const s = x.side === 'buy' ? 1 : -1; assert.ok(s * (+x.entry - +x.stop) > 0, x.id); }
  assert.equal(rows.find((x) => x.id === 'goldvb:vb').target, '');
  const mirror = Object.fromEntries(eqxCandidates(FILES, NOW).map((c) => [c.id.replace(/^eqx:/, ''), c.status !== 'open' ? 'closed' : c.noCopy ? 'hold' : 'open']));
  assert.deepEqual(by, mirror, 'the bridge and the mirror agree on every record');
  assert.deepEqual(E.DESKS, EQX.desks); assert.equal(E.FRESH, EQX.fresh); assert.equal(E.KEEP, EQX.keep); assert.equal(E.MAX_FLOAT, EQX.maxFloat);
  assert.deepEqual(E.lines(FILES, NOW, ['goldvb']).map((x) => x.desk), ['goldvb']);
  const text = E.csv(rows, NOW).split('\n'); assert.equal(text[0], '# eqx-bridge v1,' + NOW); assert.equal(text[1], 'id,desk,market,side,entry,stop,target,filled,state'); assert.equal(text[2].split(',').length, 9);
});

test('the endpoint: a good key reads the feed; a wrong key, a viewer, a removed account and the off switch are refused', async () => {
  G._reset();
  const get = async (key, d = deps(), q = {}) => { const r = res(); await H.handle({ method: 'GET', headers: { host: 'aureumdesk.co.uk' }, query: { key, ...q } }, r, d); return r; };
  const ok = await get(E.keyOf(secret, 'ana')); assert.equal(ok.code, 200); assert.match(ok.body, /^# eqx-bridge v1,/); assert.equal(ok.h['Cache-Control'], 'private, no-store'); assert.match(ok.h['Content-Type'], /text\/csv/);
  assert.equal((await get(E.keyOf(secret, 'owner'))).code, 200);
  assert.equal((await get('ana.' + 'x'.repeat(32))).code, 401);
  assert.equal((await get(E.keyOf(secret, 'vic'))).code, 403, 'a viewer has no desks');
  assert.equal((await get(E.keyOf(secret, 'bob'))).code, 403, 'an account that no longer exists');
  assert.equal((await get(E.keyOf(secret, 'ana'), deps({ users: async () => { const e = new Error('x'); e.status = 503; throw e; } }))).code, 503, 'fails closed');
  assert.equal((await get(E.keyOf(secret, 'ana'), deps({ env: { ...env, EQX_BRIDGE: 'off' } }))).code, 503);
  assert.equal((await get(E.keyOf(secret, 'ana'), deps({ readFile: async () => ({ ok: false }) }))).code, 502);
  const one = await get(E.keyOf(secret, 'ana'), deps(), { desks: 'goldvb,nonsense' }); assert.equal(one.body.trim().split('\n').length, 3);
  G._reset(); for (let i = 0; i < 10; i++) await get('ana.' + 'y'.repeat(32)); assert.equal((await get(E.keyOf(secret, 'ana'))).code, 429, 'wrong keys count like wrong passwords');
  G._reset();
});

test('the endpoint: the address is shown to a signed-in member with the desks, same origin only', async () => {
  const post = async (who, headers = { host: 'aureumdesk.co.uk' }, body = { action: 'mykey' }) => { const r = res(); await H.handle({ method: 'POST', headers, body }, r, deps({ who: async () => who })); return r; };
  const a = await post({ u: 'ana', role: 'reviewer' }); assert.equal(a.code, 200); assert.equal(a.body.url, 'https://aureumdesk.co.uk/api/eqx-bridge?key=' + E.keyOf(secret, 'ana')); assert.equal(a.body.desks.length, 4);
  assert.equal((await post(null)).code, 401); assert.equal((await post({ u: 'vic', role: 'viewer' })).code, 403);
  assert.equal((await post({ u: 'vic', role: 'viewer', perms: { desks: true } })).code, 200);
  assert.equal((await post({ u: 'ana', role: 'reviewer' }, { host: 'aureumdesk.co.uk', origin: 'https://evil.example' })).code, 403);
  assert.equal((await post({ u: 'ana', role: 'reviewer' }, { host: 'aureumdesk.co.uk' }, { action: 'other' })).code, 400);
  assert.equal((await post({ u: 'ana', role: 'reviewer' }, { host: 'evil.example' })).body.url.indexOf('https://aureumdesk.co.uk/'), 0, 'an unknown host never ends up in the address');
});

test('wiring: routed on the Worker, no order or broker code on the server side, the page card, the MetaTrader program', () => {
  assert.match(rd('cloudflare/src/worker.mjs'), /import eqxBridge from '\.\.\/\.\.\/api\/eqx-bridge\.js';/); assert.match(rd('cloudflare/src/worker.mjs'), /'eqx-bridge': eqxBridge/);
  for (const f of ['api/eqx-bridge.js', 'api/_eqx-bridge.js']) assert.doesNotMatch(rd(f), /require\([^)]*(council|ctrader|blob)|ExecuteMarketOrder|NEW_ORDER/, f);
  const page = rd('market-structure.html'); assert.match(page, /id="ms-pf-eqb"[^>]*hidden/); assert.match(page, /<script id="ms-eqb-js">/); assert.match(page, /body: JSON\.stringify\(\{ action: 'mykey' \}\)/);
  const eqb = page.slice(page.indexOf('<script id="ms-eqb-js">'), page.indexOf('</script>', page.indexOf('<script id="ms-eqb-js">'))); assert.doesNotMatch(eqb, /localStorage|sessionStorage/);
  const ea = rd('mt5/EquinoxBridge.mq5');
  for (const re of [/input bool\s+InpDryRun\s+= true;/, /if \(dir == 0 \|\| entry <= 0 \|\| stop <= 0 \|\| dir \* \(entry - stop\) <= 0\) return;/, /if \(GlobalVariableCheck\(GVP \+ tag\)\) return;/,
    /if \(PositionGetDouble\(POSITION_SL\) <= 0\) \{ Print\([^;]*it has no stop"\); trade\.PositionClose\(t\);/, /StringFind\(rows\[0\], "# eqx-bridge v1"\) != 0/, /void OnTimer\(\) \{\s*if \(!DemoOnly\(\)\) return;/, /LOSE\s+\/\/\|\s+AFTER costs|LOSE\s*\|?\s*\n\/\/\| AFTER costs/]) assert.match(ea, re);
  assert.match(rd('mt5/README.md'), /# EquinoxBridge\.mq5/);
});
