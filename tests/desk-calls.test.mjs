// node --test tests/desk-calls.test.mjs: Take / Skip on the desks' own signals (23 Nov 2026). An OPEN record of the Mosha,
// Engulfing, MSNR or LIT desk becomes a journal call with its own levels, method and source { desk, id }; a record already
// called shows the call; the server refuses a second call on the same signal (a withdrawn one too, review 23 Nov); guests never
// get the buttons. Practice only. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { handle, _reset } = require('../api/journal.js');
const J = require('../api/_journal.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

const T0 = Date.UTC(2026, 10, 23, 9, 0, 0);
const mk = () => { _reset(); const db = new Map(); return { get: async (u) => (db.get(u) || []).slice(), put: async (u, v) => { db.set(u, v); } }; };
const call = async (store, method, who, body, extra = {}) => { const out = {}; const res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; } };
  await handle({ method, body }, res, { env: {}, store, who: async () => who, sameOrigin: () => true, now: T0, ...extra }); return out; };
const OWNER = { u: 'owner', role: 'owner' }, FRED = { u: 'fred', role: 'reviewer' };
const REC = { id: 'eurusd:eg-plan-b-1795000000', market: 'eurusd', side: 1, entry: 1.1, stop: 1.097, target: 1.103, l: '5m', label: 'Engulfing plan', kind: 'eg-plan', R: null };

test('fromRecord: the record\'s own levels, timeframe, method and source; nothing for a closed or unusable record', () => {
  const p = J.fromRecord('eg', REC);
  assert.deepEqual(p, { market: 'eurusd', side: 'buy', entry: 1.1, stop: 1.097, target: 1.103, tf: 'M5', method: 'Engulfing plan', source: { desk: 'eg', id: REC.id } });
  assert.equal(J.fromRecord('mosha', { ...REC, id: 'sop-15m-1', market: undefined, side: -1, entry: 4000, stop: 4010, target: 3980, l: '15m', label: 'H1 BO → M15 VR' }).market, 'xau', 'a Mosha gold record has no market field');
  assert.equal(J.fromRecord('mosha', { ...REC, market: undefined, side: -1, entry: 4000, stop: 4010, target: 3980 }).side, 'sell');
  assert.equal(J.fromRecord('eg', { ...REC, R: 1.2 }), null, 'a closed record');
  assert.equal(J.fromRecord('eg', { ...REC, endT: 1 }), null);
  assert.equal(J.fromRecord('eg', { ...REC, market: 'usdcad' }), null, 'a market the journal does not take');
  assert.equal(J.fromRecord('eg', { ...REC, stop: 1.101 }), null, 'a stop not on the losing side is never a call');
  assert.equal(J.fromRecord('eg', { ...REC, stop: null }), null);
  assert.equal(J.fromRecord('charts', REC), null, 'only the four desks');
  assert.equal(J.fromRecord('eg', { ...REC, target: null }).target, null, 'a trailed stop with no target');
  assert.equal(J.fromRecord('eg', { ...REC, target: 1.09 }).target, null, 'a target on the wrong side is left out');
  assert.equal(J.fromRecord('eg', { ...REC, l: '4h' }).tf, 'H4'); assert.equal(J.fromRecord('eg', { ...REC, l: 'x' }).tf, null);
  // the preset is a call the server accepts as it stands
  assert.equal(J.check({ ...p, action: 'skip', confidence: 2, reason: 'late' }, T0 / 1000).error, undefined);
});

test('findCall: the latest call on that signal, a withdrawn one included (review 23 Nov 2026)', () => {
  const s = { desk: 'eg', id: REC.id };
  assert.equal(J.findCall([], 'eg', REC.id), null);
  assert.equal(J.findCall([{ id: 'a', at: 1, source: s, withdrawn: 5 }], 'eg', REC.id).id, 'a', 'a withdrawn call keeps the signal called');
  assert.equal(J.findCall([{ id: 'a', at: 1, source: s }, { id: 'b', at: 2, source: s }, { id: 'c', at: 3, source: { desk: 'lit', id: REC.id } }], 'eg', REC.id).id, 'b');
});

test('server: one call a signal an account, a withdrawn call included; another account calls it on its own', async () => {
  const s = mk(), body = (a) => ({ call: { ...J.fromRecord('eg', REC), action: a, confidence: 3, reason: 'one line' } });
  const first = await call(s, 'POST', OWNER, body('take')); assert.equal(first.code, 200); assert.deepEqual(first.body.call.source, { desk: 'eg', id: REC.id });
  assert.equal(first.body.call.method, 'Engulfing plan'); assert.equal(first.body.call.tf, 'M5');
  const again = await call(s, 'POST', OWNER, body('skip')); assert.equal(again.code, 409); assert.match(again.body.error, /already has your call/);
  assert.equal((await call(s, 'POST', FRED, body('skip'))).code, 200, 'another account calls it on its own');
  assert.equal((await call(s, 'POST', OWNER, { remove: first.body.call.id }, { now: T0 + 60e3 })).code, 200);
  assert.equal((await call(s, 'POST', OWNER, body('skip'), { now: T0 + 70e3 })).code, 409, 'withdrawn: the signal takes no new call (no Take, withdraw, Skip)');
  // a Charts call has no desk signal: never refused as a repeat
  const ch = { call: { market: 'xau', side: 'buy', action: 'take', entry: 4000, stop: 3990, confidence: 3, source: { desk: 'charts' } } };
  assert.equal((await call(s, 'POST', OWNER, ch)).code, 200); assert.equal((await call(s, 'POST', OWNER, ch)).code, 200);
});

test('the slot: open records only, on every row and Open now card of the four desks, carrying the record\'s own fields', () => {
  const SOP = rd('../assets/mosha-sop.js'), DT = rd('../assets/desk-trades.js');
  const src = SOP.slice(SOP.indexOf('  function dcSlot('), SOP.indexOf('  API.dcSlot = dcSlot;'));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dcSlot = new Function('esc', src + '; return dcSlot;')(esc);
  assert.equal(dcSlot('eg', { ...REC, R: 0.4 }), '', 'a closed record has no slot');
  const html = dcSlot('eg', REC), m = /data-dc="eg" data-dc-r="([^"]*)"/.exec(html); assert.ok(m, html);
  const back = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  assert.deepEqual(J.fromRecord('eg', back), J.fromRecord('eg', REC));
  assert.equal((SOP.match(/dcSlot\('mosha', r, kind\)/g) || []).length, 2, 'Mosha: the trades row and the Open now card');
  assert.equal((DT.match(/SOP\.dcSlot\(k, r\)/g) || []).length, 2, 'LIT / Engulfing / MSNR: the trades row and the Open now card');
  assert.match(DT, /openCard\(r, k\)/); assert.match(DT, /rowHTML\(S, r, k\)/);
});

test('the page: the journal\'s own dialog, members only, never guests, nothing stored, the chart click held back', () => {
  const PAGE = rd('../market-structure.html'), blk = PAGE.slice(PAGE.indexOf('<script id="ms-jr-js">'), PAGE.indexOf('</script>', PAGE.indexOf('<script id="ms-jr-js">')));
  assert.match(blk, /if \(document\.documentElement\.dataset\.role === 'public'\) return;/);
  assert.match(blk, /if \(!ST\.ok \|\| !J \|\| !J\.fromRecord\) return;/, 'buttons only once GET /api/journal let this account write');
  assert.match(blk, /J\.findCall\(ST\.calls, desk, pre\.source\.id\)/); assert.match(blk, /'Your call' \+ \(c\.withdrawn/);
  assert.match(blk, /openDlg\(pre\)/); assert.match(blk, /Take or skip this signal/); assert.match(blk, /source: P\.source/);
  assert.match(blk, /Write one line: why take it, or why skip it\./);
  assert.match(blk, /e\.stopPropagation\(\); e\.preventDefault\(\);[\s\S]*\}, true\);/, 'capture phase: the Open now card does not open the chart');
  assert.doesNotMatch(blk, /localStorage|sessionStorage|ctrader|council\//);
  assert.match(PAGE, /html\[data-role="public"\] :is\(#ms-jr-btn, #ms-jr, #ms-jr-card, span\.dc\) \{ display: none !important; \}/);
  assert.match(PAGE, /\.jr\.jr-pre \.jr-full \{ display: none; \}/);
  const css = PAGE.slice(PAGE.indexOf('<style id="ms-jr-css">'), PAGE.indexOf('</style>', PAGE.indexOf('<style id="ms-jr-css">')));
  assert.match(css, /pointer: coarse[^}]*\.dc-b \{ min-height: 44px/);
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px var\(--sans\)|font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
  for (const f of ['../assets/mosha-sop.js', '../assets/desk-trades.js', '../assets/ms-journal.js']) assert.doesNotMatch(rd(f).slice(rd(f).indexOf('dcSlot') >= 0 ? 0 : 0), /placeOrder|NEW_ORDER_REQ/);
});

test('review 23 Nov 2026: the slot is never inside the Open now card\'s button, folds away on a phone, and the observer skips ticks', () => {
  const SOP = rd('../assets/mosha-sop.js'), DT = rd('../assets/desk-trades.js'), PAGE = rd('../market-structure.html');
  for (const [name, src, fn] of [['mosha', SOP, '  function openCard(r) {'], ['desks', DT, '  function openCard(r, k) {']]) {
    const body = src.slice(src.indexOf(fn), src.indexOf('\n  }\n', src.indexOf(fn)));
    assert.match(body, /return '<li><div class="oc-b" data-(sop|dk)-chart="/, name + ': the button is an inner element');
    assert.match(body, /<\/p><\/div>' \+ (dcSlot\('mosha', r, kind\)|\(SOP\.dcSlot \? SOP\.dcSlot\(k, r\) : ''\)) \+ '<\/li>'/, name + ': the slot comes after it');
    assert.doesNotMatch(body, /<li [^>]*role="button"/);
  }
  assert.match(PAGE, /#v-mosha \.mo-open li:not\(\.empty\) :is\(\.trk, \.trk-l, dl, \.nt, span\.dc\) \{ display: none; \}/);
  const blk = PAGE.slice(PAGE.indexOf('<script id="ms-jr-js">'), PAGE.indexOf('</script>', PAGE.indexOf('<script id="ms-jr-js">')));
  assert.match(blk, /new MutationObserver\(function \(recs\) \{ if \(slotRaf \|\| !ST\.ok \|\| \(window\.msLiveOnly && window\.msLiveOnly\(recs\)\)\) return;/);
});
