// The owner's demo-account settings (27 Nov 2026): the Profile card, its endpoint, the rules (api/_demo-settings.js) and the
// council reading them (council/owner-config.mjs) in the mirror and the demo jobs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DS = require('../api/_demo-settings.js');
const EP = require('../api/demo-settings.js');
import { BOOKS, LIMITS } from '../council/ctrader-mirror.mjs';
import * as VB from '../council/vb-demo.mjs';
import * as GO from '../council/gotobi.mjs';
import * as NQ from '../council/nq-demo.mjs';
import * as DOM from '../council/dom-demo.mjs';
import { readConfig } from '../council/owner-config.mjs';
const rd = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the strategies are the mirror\'s books, their risk today is LIMITS.risk, the jobs\' defaults and limits are the jobs\' own', () => {
  assert.deepEqual(Object.keys(DS.BOOKS).sort(), BOOKS.slice().sort());
  for (const [k, b] of Object.entries(DS.BOOKS)) { assert.ok(Object.prototype.hasOwnProperty.call(LIMITS.risk, b.riskKey), k); assert.equal(b.risk, LIMITS.risk[b.riskKey], k); }
  assert.equal(DS.JOBS.vb.risk, VB.RISK); assert.equal(DS.JOBS.vb.max, VB.MAX_RISK);
  assert.equal(DS.JOBS.gotobi.risk, GO.RISK);
  assert.equal(DS.JOBS.nq.risk, NQ.RISK); assert.equal(DS.JOBS.nq.max, NQ.MAX_RISK); assert.equal(DS.JOBS.nq.uj.risk, NQ.UJ.risk); assert.equal(DS.JOBS.nq.uj.max, NQ.UJ.maxRisk);
  assert.equal(DS.JOBS.dom.risk, DOM.RISK); assert.equal(DS.JOBS.dom.max, DOM.RISK_MAX); assert.equal(DS.JOBS.dom4.risk, DOM.VARIANTS.gold4r.risk);
});

test('clean: every field checked, unknown keys and bad values refused with a sentence', () => {
  const ok = DS.clean({ books: { boxfade: { account: '10152145', risk: 0.01, on: false }, council: { risk: 0.0002 } }, jobs: { dom: { account: '*6154', risk: 0.005, on: true }, nq: { ujRisk: 0.015 } }, extra: 1 });
  assert.deepEqual(ok, { v: 1, books: { boxfade: { account: '10152145', risk: 0.01, on: false }, council: { risk: 0.0002 } }, jobs: { dom: { account: '*6154', risk: 0.005, on: true }, nq: { ujRisk: 0.015 } } });
  for (const [b, re] of [[{ books: { nope: {} } }, /unknown strategy/], [{ books: { eqx: { risk: 0.2 } } }, /between/], [{ books: { eqx: { risk: 0.00001 } } }, /between/],
    [{ books: { eqx: { account: 'abc' } } }, /account/], [{ books: { eqx: { on: 'yes' } } }, /true or false/], [{ jobs: { vb: { risk: 0.02 } } }, /between/],
    [{ jobs: { live: { on: true } } }, /unknown demo job/], [{ jobs: { vb: { ujRisk: 0.01 } } }, /no USD\/JPY rule/], [{ books: { council: { risk: 0.0002 }, shadow: { risk: 0.001 } } }, /council's trades/], [null, /object/]])
    assert.throws(() => DS.clean(b), re);
  assert.throws(() => DS.clean({ books: { constructor: {} } }), /unknown strategy/);
});

test('apply: accounts, a drained account a book left, risk, books off and the jobs; live and other keys untouched', () => {
  const cfg = { live: { on: true, account: '*999' }, vb: { risk: 0.01 }, dom: { account: '*6154', risk: 0.01 }, other: 7 };
  const acc = { mirrorAccounts: { council: '', boxfade: '10152148', bfade: '10152145' }, drain: [] };
  const c = DS.apply(cfg, { books: { boxfade: { account: '10152146', risk: 0.01, on: false }, eqx: { risk: 0.005 } }, jobs: { vb: { on: false }, dom: { account: '', risk: 0.002 }, nq: { ujRisk: 0.01 } } }, acc);
  assert.equal(c.mirrorAccounts.boxfade, '10152146'); assert.equal(c.mirrorAccounts.bfade, '10152145');
  assert.deepEqual(c.drain, ['10152148']);   // the account the Box fade left keeps a round to manage its open copies
  assert.deepEqual(c.mirrorRisk, { boxfade: 0.01, eqx: 0.005 }); assert.deepEqual(c.mirrorOff, ['boxfade']);
  assert.deepEqual(c.vb, { risk: 0.01, on: false }); assert.deepEqual(c.dom, { risk: 0.002 }); assert.deepEqual(c.nq, { ujRisk: 0.01 });
  assert.deepEqual(c.live, cfg.live); assert.equal(c.other, 7); assert.deepEqual(cfg.vb, { risk: 0.01 });   // the original is not changed
  // a stored file that breaks the rules is held to them anyway (a value out of range is clamped or ignored)
  const d = DS.apply({}, { books: { eqx: { risk: 9, account: 'x' } }, jobs: { vb: { risk: 9 } } }, acc);
  assert.deepEqual(d.mirrorRisk, {}); assert.equal(d.mirrorAccounts.eqx, undefined); assert.equal(d.vb.risk, 0.01);
});

test('the council reads config.json with the settings on top; a missing or broken settings file changes nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-')); fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ vb: { risk: 0.01 } }));
  assert.deepEqual(readConfig(dir, {}), { vb: { risk: 0.01 } });
  fs.mkdirSync(path.join(dir, 'owner')); fs.writeFileSync(path.join(dir, 'owner/demo-settings.json'), '{ not json');
  assert.deepEqual(readConfig(dir, {}), { vb: { risk: 0.01 } });
  fs.writeFileSync(path.join(dir, 'owner/demo-settings.json'), JSON.stringify({ v: 1, books: {}, jobs: { vb: { on: false } } }));
  assert.equal(readConfig(dir, {}).vb.on, false);
  for (const f of ['council/vb-demo.mjs', 'council/gotobi.mjs', 'council/nq-demo.mjs', 'council/dom-demo.mjs']) { const t = rd(f); assert.match(t, /const cfg = readConfig\(dir\);/, f); assert.ok(!/fs\.readFileSync\(path\.join\(dir, 'config\.json'\)/.test(t), f); }
  const m = rd('council/ctrader-mirror.mjs');
  assert.match(m, /const cfg = readConfig\(DIR, accFile\) \|\| \{\}, offBooks = new Set/);
  assert.match(m, /openBooks: g\.books\.filter\(\(b\) => !offBooks\.has\(b\)\)/);
  assert.match(m, /LIMITS\.risk\[k\] = \+v;/);
  // the live account's code never reads the owner's demo settings
  assert.ok(!/owner-config|demo-settings/.test(rd('council/live.mjs')));
});

const mkRes = () => { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
test('endpoint: the owner only, same origin, every field checked, written to council-data', async () => {
  const files = { 'config.json': { dom: { account: '*6154', risk: 0.01 } }, 'ctrader/mirror-accounts.json': { groups: [{ account: '10152146', books: ['shadow', 'lit'] }, { account: '99999999', books: ['bfade'] }] },
    'ctrader/accounts.json': { accounts: [{ books: ['shadow', 'lit'], label: 'Shadows + LIT', balance: 8867.15, account: { login: '…146', live: false, currency: 'USD' } }, { books: ['bfade'], label: 'X', account: { login: '…1', live: true } }] } };
  const f = async (u) => { const p = decodeURIComponent(new URL(u).pathname.split('/contents/')[1] || ''); return files[p] ? { ok: true, status: 200, arrayBuffer: async () => Buffer.from(JSON.stringify(files[p])) } : { ok: false, status: 404 }; };
  const env = { GH_TOKEN: 't' };
  let r = mkRes(); await EP.handle({ method: 'GET', headers: {} }, r, { env, fetch: f, who: async () => ({ u: 'fred', role: 'reviewer' }) }); assert.equal(r.code, 403);
  r = mkRes(); await EP.handle({ method: 'GET', headers: {} }, r, { env, fetch: f, who: async () => null }); assert.equal(r.code, 401);
  r = mkRes(); await EP.handle({ method: 'GET', headers: {} }, r, { env, fetch: f, who: async () => ({ u: 'owner' }) });
  assert.equal(r.code, 200); assert.equal(r.body.canWrite, true); assert.equal(r.body.current.books.lit, '10152146'); assert.equal(r.body.current.jobs.dom.account, '*6154');
  assert.deepEqual(r.body.accounts.map((a) => a.id), ['10152146']);   // a live account is never offered
  assert.equal(r.headers['Cache-Control'], 'private, no-store');
  let wrote = null; const write = async (e, body) => { wrote = body; };
  r = mkRes(); await EP.handle({ method: 'POST', headers: {}, body: { settings: { books: { eqx: { risk: 0.5 } } } } }, r, { env, write, sameOrigin: () => true, who: async () => ({ u: 'owner' }) }); assert.equal(r.code, 400); assert.equal(wrote, null);
  r = mkRes(); await EP.handle({ method: 'POST', headers: {}, body: { settings: { books: { eqx: { risk: 0.005 } } } } }, r, { env, write, sameOrigin: () => false, who: async () => ({ u: 'owner' }) }); assert.equal(r.code, 403); assert.equal(wrote, null);
  r = mkRes(); await EP.handle({ method: 'POST', headers: {}, body: JSON.stringify({ settings: { books: { eqx: { risk: 0.005 } } } }) }, r, { env, write, now: Date.UTC(2026, 10, 27), sameOrigin: () => true, who: async () => ({ u: 'owner' }) });
  assert.equal(r.code, 200); assert.deepEqual(wrote, { v: 1, books: { eqx: { risk: 0.005 } }, jobs: {}, at: '2026-11-27T00:00:00.000Z' });
  // no token that can write: nothing saved, said in words
  r = mkRes(); await EP.handle({ method: 'POST', headers: {}, body: { settings: {} } }, r, { env: {}, sameOrigin: () => true, who: async () => ({ u: 'owner' }) }); assert.equal(r.code, 503); assert.match(r.body.error, /GitHub token/);
});

test('page: the owner\'s Profile card and row, saving only what changed', () => {
  const h = rd('market-structure.html');
  assert.match(h, /data-pf-go="ms-pf-dset"/); assert.match(h, /<section class="card pf-ct pf-ds" id="ms-pf-dset"[^>]*hidden>/);
  assert.match(h, /const ok = \(\) => R\.dataset\.role === 'owner'/);
  const i = h.indexOf('function changes(now, was, prev) {'), j = h.indexOf('\n        window.msDemoSettingsChanges', i);
  const changes = new Function(h.slice(i, j) + '; return changes;')();
  const was = { books: { eqx: { account: '10152144', risk: 0.01, on: true }, bfade: { account: '10152145', risk: 0.05, on: true } }, jobs: { vb: { account: '', risk: 0.01, on: true } } };
  const now = JSON.parse(JSON.stringify(was)); now.books.eqx.risk = 0.005; now.jobs.vb.on = false;
  assert.deepEqual(changes(now, was, { books: { bfade: { on: false } } }), { books: { eqx: { risk: 0.005 }, bfade: { on: false } }, jobs: { vb: { on: false } } });
  const sc = h.slice(h.indexOf('<script id="ms-ds-js">'), h.indexOf('</script>', h.indexOf('<script id="ms-ds-js">')));
  assert.ok(!/localStorage|sessionStorage/.test(sc), 'nothing kept in the browser');
  assert.match(rd('cloudflare/src/worker.mjs'), /'demo-settings': demoSettings/);
  assert.ok(JSON.parse(rd('vercel.json')).functions['api/demo-settings.js']);
});
