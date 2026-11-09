// node --test tests/inner-pages.test.mjs — inner pages design pass (9 Nov 2026): Council Systems no longer throws on the Mosha BO
// chain line, ict/desk.json reads as empty until the first review is saved, compact calendar cells, the 12 px floor and no endless
// animation in the pass's own stylesheet, LIT replay text escaped once. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

test('Council Systems: the Mosha BO chain line reads its own snapshot (it threw "sn is not defined" and stopped the replica card)', () => {
  const start = html.indexOf('{ const sn = COUNCIL.snap || {}, m = sn.moshaBo');
  assert.ok(start > 0, 'the Mosha BO block declares sn itself');
  const end = html.indexOf('${wk}${pos}`); }', start) + '${wk}${pos}`); }'.length;
  const block = html.slice(start, end), out = {};
  const run = (snap) => new Function('COUNCIL', 'set', block)({ snap }, (id, v) => { out[id] = v; });
  run({ moshaBo: { state: { stage: 'h1', dir: 1, w1: 1, h4: { level: 4000, t: 1762600000 } } } });
  assert.match(out['ms-rep-mosha'], /H4 BO <b>buy<\/b> at 4000/);
  run(null); assert.equal(out['ms-rep-mosha'], 'Mosha BO chain: waiting for the Trader.');
});

test('/cdata: ict/desk.json reads as an empty desk for a signed-in member until the first review is saved; other files keep 404', async () => {
  const data = require('../api/data.js'), S = require('../api/_session.js');
  assert.deepEqual(JSON.parse(data.EMPTY_UNTIL_WRITTEN['ict/desk.json']), { reviews: {} });
  const res = () => { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; }; return r; };
  const env = { CTRADER_LINK_KEY: 'link-key-fake-0123456789' }, missing = async () => ({ ok: false, status: 404 });
  const deps = { builtIns: { fred: { name: 'Fred', hash: 'f'.repeat(64), role: 'reviewer', ict: true } }, blobUsers: async () => ({ users: {} }) };
  const tok = S.issue(env, 'fred', 'f'.repeat(64), { u: 'fred', name: 'Fred', role: 'reviewer', ict: true });
  const call = async (p, cookie) => { const r = res(); await data.handle({ query: { p }, headers: { host: 'x.test', ...(cookie ? { cookie } : {}) } }, r, { env, fetch: missing, deps }); return r; };
  const ok = await call('ict/desk.json', `ms_session=${tok}`);
  assert.equal(ok.code, 200); assert.equal(ok.body, '{"reviews":{}}'); assert.equal(ok.headers['cache-control'], 'private, no-store');
  assert.equal((await call('ict/other.json', `ms_session=${tok}`)).code, 404, 'only the listed files read as empty');
  assert.equal((await call('ict/desk.json')).code, 401, 'guests still need a session');
});

test('calendar cells: the full R for wide screens, a compact one for phones', () => {
  const src = html.match(/window\.msCalR = function[^\n]+/)[0], w = {};
  new Function('window', src)(w);
  const cell = (v) => w.msCalR(v, 'FULL').match(/class="cr-s"[^>]*>([^<]+)</)[1];
  assert.equal(cell(1.234), '+1.2R'); assert.equal(cell(-0.31), '−0.3R'); assert.equal(cell(10.1), '+10R'); assert.equal(cell(-15.7), '−16R'); assert.equal(cell(0), '0.0R');
  assert.match(w.msCalR(1, '+1.00R'), /<span class="cr-l">\+1\.00R<\/span>/);
});

test('the pass stylesheet: no text under 12 px and no endless animation', () => {
  const css = html.match(/<style id="ms-inner-css">([\s\S]*?)<\/style>/)[1];
  for (const m of css.matchAll(/font(?:-size)?:\s*(?:[0-9]{3}\s+)?([0-9.]+)px/g)) assert.ok(+m[1] >= 12, `font ${m[0]}`);
  assert.doesNotMatch(css, /\binfinite\b/);
  assert.match(css, /animation-iteration-count: 3/, 'loaders in these views stop after a few cycles');
});

test('LIT replay: strings escaped once at parse are not escaped again (they showed as &amp;#39;)', () => {
  const lit = html.slice(html.indexOf('async function litReplay()'), html.indexOf('function guestCard('));
  assert.match(lit, /JSON\.parse\(await r\.text\(\), \(k, v\) =>/);
  assert.doesNotMatch(lit, /esc\(R\.note\)|esc\(S\.label\)|esc\(S\.desc\)/);
});
