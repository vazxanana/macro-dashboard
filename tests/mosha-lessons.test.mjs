// node --test tests/mosha-lessons.test.mjs: the Mosha desk as Luxus's main page and the lessons he sends (owner, 10 Nov 2026:
// "he will train u, allow him to send you trades images so u can learn"): who may open the desk and who may teach
// (api/mosha.js moshaLevel, the accounts), the lessons endpoint (api/mosha-lessons.js: pictures checked, own lessons only, the
// assistant's key reads and replies and nothing else), the page's pure pieces and wiring. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const L = require('../api/mosha-lessons.js');
const { moshaLevel, canRead, handle: logHandle } = require('../api/mosha.js');
const A = require('../api/_accounts.js'), S = require('../api/_session.js'), G = require('../api/_guard.js');
const { cleanPerms, clean } = require('../api/users.js');
const TEACH = require('../assets/mosha-teach.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), JS = rd('../assets/mosha-teach.js'), API = rd('../api/mosha-lessons.js'), DESK = rd('../assets/mosha-desk.js'), TOOL = rd('../scripts/mosha-lessons.mjs');

const NOW = Date.UTC(2026, 10, 10, 16, 0, 0), ENV = { SESSION_SECRET: 'a-test-session-secret-0123456789' };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]), JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 9)]), WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4, 1), Buffer.from('WEBP'), Buffer.alloc(200, 3)]);
const url = (type, buf) => `data:${type};base64,${buf.toString('base64')}`;
const mk = () => { let db = []; const img = new Map(), gone = []; return { get: async () => JSON.parse(JSON.stringify(db)), put: async (v) => { db = JSON.parse(JSON.stringify(v)); }, putImg: async (id, type, buf) => { img.set(id, { type, buf }); }, getImg: async (id) => (img.has(id) ? img.get(id).buf : null), delImg: async (id) => { img.delete(id); gone.push(id); }, peek: () => db, img, gone }; };
let tick = 0;
const call = async (store, method, who, body, extra = {}) => { const out = { headers: {} }; const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; return out; }, send: (b) => { out.raw = b; return out; } };
  await L.handle({ method, body, query: extra.query || {}, headers: extra.headers || {} }, res, { env: ENV, store, who: async () => who, sameOrigin: extra.sameOrigin || (() => true), now: NOW + 1000 * ++tick }); return out; };
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' }, LUXUS = { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach', home: 'mosha' }, FRED = { u: 'fred', name: 'Fred', role: 'reviewer' }, CARLOS = { u: 'carlos', name: 'Carlos', role: 'viewer' };
const key = () => ({ headers: { authorization: `Bearer ${L.readerKey(ENV)}` } });

test('Luxus: the Mosha desk is his main page and he may teach; the defaults survive a stored copy of his record', () => {
  assert.equal(A.BUILT_IN.luxus.mosha, 'teach'); assert.equal(A.BUILT_IN.luxus.home, 'mosha'); assert.equal(A.BUILT_IN.luxus.role, 'viewer', 'still a viewer everywhere else');
  for (const k of ['fred', 'orlando', 'carlos']) { assert.equal(A.BUILT_IN[k].mosha, undefined, k); assert.equal(A.BUILT_IN[k].home, undefined, k); }
  assert.deepEqual(A.publicRecord(A.BUILT_IN.luxus), { name: 'Luxus', role: 'viewer', mosha: 'teach', home: 'mosha' });
  const stored = { name: 'Luxus', role: 'viewer', hash: 'b'.repeat(64) };   // what the Users page saves after "New password"
  assert.deepEqual(S.account('luxus', stored), { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach', home: 'mosha' });
  assert.deepEqual(S.account('carlos', { name: 'Carlos', role: 'viewer', hash: 'b'.repeat(64) }), { u: 'carlos', name: 'Carlos', role: 'viewer' });
  assert.deepEqual(S.account('newone', { name: 'New', role: 'viewer', hash: 'b'.repeat(64), mosha: 'teach' }).mosha, 'teach');
  assert.equal(S.account('owner').role, 'owner');
});

test('who may open the Mosha desk and who may teach: a stored choice wins, then the member\'s own flag, then the other desks', () => {
  assert.equal(moshaLevel(null), false); assert.equal(moshaLevel(OWNER), 'teach'); assert.equal(moshaLevel(LUXUS), 'teach'); assert.equal(moshaLevel(CARLOS), false);
  assert.equal(moshaLevel(FRED), 'read', 'a reviewer reads it with the other desks'); assert.equal(moshaLevel({ ...FRED, perms: { desks: false } }), false); assert.equal(moshaLevel({ ...CARLOS, perms: { desks: true } }), 'read');
  assert.equal(moshaLevel({ ...LUXUS, perms: { mosha: false } }), false, 'the owner can switch it off on the Users page'); assert.equal(moshaLevel({ ...LUXUS, perms: { mosha: 'read' } }), 'read');
  assert.equal(moshaLevel({ ...FRED, perms: { mosha: 'teach' } }), 'teach'); assert.equal(moshaLevel({ ...FRED, perms: { mosha: false } }), false); assert.equal(moshaLevel({ ...CARLOS, perms: { mosha: 'yes' } }), false, 'an unknown value gives nothing');
  assert.equal(canRead(LUXUS), true); assert.equal(canRead(CARLOS), false);
  assert.deepEqual(cleanPerms({ mosha: 'teach' }), { mosha: 'teach' }); assert.deepEqual(cleanPerms({ mosha: false, desks: true }), { mosha: false, desks: true }); assert.equal(cleanPerms({ mosha: true }), null); assert.equal(cleanPerms({ mosha: 'write' }), null);
  assert.deepEqual(clean({ luxus: { name: 'Luxus', role: 'viewer', hash: 'a'.repeat(64), mosha: 'teach', home: 'mosha', perms: { mosha: 'read' } } }).luxus, { name: 'Luxus', role: 'viewer', hash: 'a'.repeat(64), perms: { mosha: 'read' } }, 'only perms.mosha is stored: the built-in default is applied by key');
});

test('the trade log stays the owner\'s: Luxus reads it on his page and cannot write it', async () => {
  const out = {}, res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; } }, store = { get: async () => [], put: async () => { throw new Error('written'); } };
  await logHandle({ method: 'GET' }, res, { env: {}, store, who: async () => LUXUS, sameOrigin: () => true }); assert.equal(out.code, 200); assert.equal(out.body.canWrite, false);
  await logHandle({ method: 'POST', body: { save: { side: 'sell', at: NOW / 1000, entry: 10, stop: 11 } } }, res, { env: {}, store, who: async () => LUXUS, sameOrigin: () => true }); assert.equal(out.code, 403);
});

test('a picture must really be a JPEG, PNG or WebP of an allowed size', () => {
  assert.deepEqual(Object.keys(L.imageOf(url('image/png', PNG))), ['type', 'buf']); assert.equal(L.imageOf(url('image/jpeg', JPG)).type, 'image/jpeg'); assert.equal(L.imageOf(url('image/webp', WEBP)).type, 'image/webp');
  assert.match(L.imageOf(url('image/png', JPG)).error, /not the picture it says/); assert.match(L.imageOf(url('image/jpeg', Buffer.from('<html><script>alert(1)</script>'.padEnd(300, ' ')))).error, /not the picture/);
  for (const bad of [url('image/svg+xml', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'.padEnd(200))), url('text/html', PNG), 'data:image/png;base64,@@@', 'https://example.com/a.png', '', null, 42, url('image/png', PNG.subarray(0, 20)), url('image/png', Buffer.concat([PNG, Buffer.alloc(L.MAX_BYTES)]))]) assert.ok(L.imageOf(bad).error, String(bad).slice(0, 40));
});

test('sending: a teacher starts a lesson and adds pictures to their own; readers read; nobody else writes', async () => {
  const s = mk();
  assert.equal((await call(s, 'GET', null)).code, 401); assert.equal((await call(s, 'GET', CARLOS)).code, 403); assert.equal((await call(s, 'PUT', OWNER)).code, 405);
  assert.equal((await call(s, 'POST', LUXUS, { add: { title: 'x', image: url('image/png', PNG) } }, { sameOrigin: () => false })).code, 403, 'cross-site refused');
  const g0 = await call(s, 'GET', LUXUS); assert.deepEqual(g0.body, { lessons: [], canTeach: true, who: 'luxus' }); assert.equal((await call(s, 'GET', FRED)).body.canTeach, false); assert.equal(g0.headers['cache-control'], 'private, no-store');
  const a = await call(s, 'POST', LUXUS, { add: { title: ' 2 Nov sell, gold ', note: 'M30 high swept, then the M5 VR.', caption: 'M30 sweep high', image: url('image/png', PNG) } });
  assert.equal(a.code, 200); const id = a.body.lesson.id; assert.match(id, /^\d{17}[a-z0-9]{4}$/);
  assert.deepEqual({ ...a.body.lesson, id: 0, at: 0, shots: a.body.lesson.shots.map((x) => x.caption) }, { id: 0, by: 'luxus', name: 'Luxus', at: 0, edited: null, title: '2 Nov sell, gold', note: 'M30 high swept, then the M5 VR.', shots: ['M30 sweep high'], reply: null });
  assert.equal(s.img.size, 1); assert.deepEqual(s.img.get(a.body.img).buf, PNG);
  const b = await call(s, 'POST', LUXUS, { add: { lesson: id, caption: 'M5 vr', image: url('image/jpeg', JPG) } }); assert.equal(b.code, 200); assert.deepEqual(b.body.lesson.shots.map((x) => x.caption), ['M30 sweep high', 'M5 vr']); assert.equal(s.peek().length, 1);
  assert.equal(s.peek()[0].shots[1].type, 'image/jpeg', 'the stored type is the checked one');
  // without a title the first caption names the lesson
  assert.equal((await call(s, 'POST', LUXUS, { add: { caption: 'i just took entry after bo sell', image: url('image/webp', WEBP) } })).body.lesson.title, 'i just took entry after bo sell');
  // not a teacher, a bad picture, someone else's lesson
  assert.equal((await call(s, 'POST', FRED, { add: { title: 'x', image: url('image/png', PNG) } })).code, 403); assert.equal((await call(s, 'POST', { ...LUXUS, perms: { mosha: 'read' } }, { add: { title: 'x', image: url('image/png', PNG) } })).code, 403);
  assert.equal((await call(s, 'POST', LUXUS, { add: { title: 'x', image: url('image/png', JPG) } })).code, 400); assert.equal((await call(s, 'POST', LUXUS, { add: { title: 'x' } })).code, 400); assert.equal((await call(s, 'POST', LUXUS, { add: { lesson: '20260101000000000zzzz', image: url('image/png', PNG) } })).code, 404);
  const other = { u: 'mira', name: 'Mira', role: 'viewer', mosha: 'teach' };
  assert.equal((await call(s, 'POST', other, { add: { lesson: id, image: url('image/png', PNG) } })).code, 403); assert.equal((await call(s, 'POST', other, { edit: { id, note: 'mine now' } })).code, 403); assert.equal((await call(s, 'POST', other, { remove: { id } })).code, 403);
  assert.equal((await call(s, 'POST', OWNER, { add: { lesson: id, caption: 'from the owner', image: url('image/png', PNG) } })).code, 200, 'the owner may add to any lesson');
  assert.equal(s.img.size, 4); assert.equal((await call(s, 'POST', LUXUS, {})).code, 400); assert.equal((await call(s, 'POST', LUXUS, 'not json')).code, 400);
  // a lesson holds 12 pictures
  for (let i = 0; i < L.MAX_SHOTS - 3; i++) assert.equal((await call(s, 'POST', LUXUS, { add: { lesson: id, image: url('image/png', PNG) } })).code, 200);
  assert.match((await call(s, 'POST', LUXUS, { add: { lesson: id, image: url('image/png', PNG) } })).body.error, /holds 12 pictures/);
});

test('the pictures are served to readers only, as pictures; editing and removing', async () => {
  const s = mk(), a = await call(s, 'POST', LUXUS, { add: { title: '10 Nov sell', caption: 'H4 level', image: url('image/png', PNG) } }), id = a.body.lesson.id, img = a.body.img;
  const b = await call(s, 'POST', LUXUS, { add: { lesson: id, caption: 'M5 vr', image: url('image/jpeg', JPG) } });
  const p = await call(s, 'GET', FRED, null, { query: { img } }); assert.equal(p.code, 200); assert.deepEqual(p.raw, PNG); assert.equal(p.headers['content-type'], 'image/png'); assert.equal(p.headers['x-content-type-options'], 'nosniff'); assert.match(p.headers['cache-control'], /^private, /);
  assert.equal((await call(s, 'GET', null, null, { query: { img } })).code, 401); assert.equal((await call(s, 'GET', CARLOS, null, { query: { img } })).code, 403);
  assert.equal((await call(s, 'GET', FRED, null, { query: { img: '../users/x' } })).code, 400); assert.equal((await call(s, 'GET', FRED, null, { query: { img: '20260101000000000abcd' } })).code, 404);
  const e = await call(s, 'POST', LUXUS, { edit: { id, title: '10 Nov sell, gold', note: 'Wait for the return to the zone.', img, caption: 'Your level' } }); assert.deepEqual([e.body.lesson.title, e.body.lesson.note, e.body.lesson.shots[0].caption], ['10 Nov sell, gold', 'Wait for the return to the zone.', 'Your level']); assert.ok(e.body.lesson.edited);
  assert.equal((await call(s, 'POST', LUXUS, { edit: { id, img: '20260101000000000abcd', caption: 'x' } })).code, 404);
  const r1 = await call(s, 'POST', LUXUS, { remove: { id, img: b.body.img } }); assert.equal(r1.body.removed, 1); assert.equal(r1.body.lesson.shots.length, 1); assert.deepEqual(s.gone, [b.body.img]); assert.equal((await call(s, 'GET', FRED, null, { query: { img: b.body.img } })).code, 404);
  const r2 = await call(s, 'POST', OWNER, { remove: { id } }); assert.equal(r2.body.removed, 1); assert.equal(s.peek().length, 0); assert.equal(s.img.size, 0); assert.equal((await call(s, 'POST', OWNER, { remove: { id } })).code, 404);
});

test('the assistant\'s key: it reads the lessons and writes a reply, nothing else; a wrong key is counted like a wrong password', async () => {
  G._reset(); const s = mk(), a = await call(s, 'POST', LUXUS, { add: { title: '2 Nov buy', caption: 'the range', image: url('image/png', PNG) } }), id = a.body.lesson.id, k = L.readerKey(ENV);
  assert.match(k, /^mr[0-9a-f]{40}$/); assert.equal(L.readerKey({}), null, 'no session secret, no key'); assert.equal(L.readerKey({ ...ENV, MOSHA_READER: 'off' }), null); assert.notEqual(L.readerKey({ ...ENV, MOSHA_READER_SALT: 'x' }), k);
  assert.equal((await call(s, 'GET', OWNER, null, { query: { get: 'reader' } })).body.key, k); assert.equal((await call(s, 'GET', LUXUS, null, { query: { get: 'reader' } })).code, 403); assert.equal((await call(s, 'GET', FRED, null, { query: { get: 'reader' } })).code, 403);
  const g = await call(s, 'GET', null, null, key()); assert.equal(g.code, 200); assert.deepEqual([g.body.who, g.body.canTeach, g.body.lessons.length], ['assistant', false, 1]);
  assert.deepEqual((await call(s, 'GET', null, null, { ...key(), query: { img: a.body.img } })).raw, PNG);
  assert.equal((await call(s, 'GET', null, null, { ...key(), query: { get: 'reader' } })).code, 403, 'the key does not show itself');
  const r = await call(s, 'POST', null, { reply: { id, text: 'A range at the lows after the sell: buy at 3900.7 with the stop under it at 3896.8.' } }, key()); assert.equal(r.code, 200); assert.equal(r.body.lesson.reply.shots, 1); assert.equal(TEACH.stateOf(r.body.lesson), 'read');
  for (const body of [{ add: { title: 'x', image: url('image/png', PNG) } }, { edit: { id, note: 'x' } }, { remove: { id } }]) assert.equal((await call(s, 'POST', null, body, key())).code, 403, Object.keys(body)[0]);
  assert.equal(s.peek().length, 1); assert.equal(s.peek()[0].note, '');
  // a new picture after the reply: the lesson shows as not read again
  const more = await call(s, 'POST', LUXUS, { add: { lesson: id, caption: 'the entry', image: url('image/png', PNG) } }); assert.equal(TEACH.stateOf(more.body.lesson), 'more');
  assert.equal((await call(s, 'POST', LUXUS, { reply: { id, text: 'x' } })).code, 403, 'a teacher does not write the desk\'s reply'); assert.equal((await call(s, 'POST', OWNER, { reply: { id, text: '' } })).body.lesson.reply, null);
  assert.equal((await call(s, 'POST', null, { reply: { id: '20260101000000000abcd', text: 'x' } }, key())).code, 404);
  // wrong keys: 401 each, then 429 from the shared guard; the right key is refused too while the guard is up
  G._reset(); for (let i = 0; i < G.MAX; i++) assert.equal((await call(s, 'GET', OWNER, null, { headers: { authorization: 'Bearer mr' + '0'.repeat(40) } })).code, 401, 'a header with a wrong key is never a session');
  assert.equal((await call(s, 'GET', null, null, key())).code, 429); G._reset();
  // the key switched off: nothing answers to it
  const out = {}, res = { setHeader() {}, status: (c) => { out.code = c; return res; }, json: (b) => { out.body = b; } };
  await L.handle({ method: 'GET', headers: { authorization: `Bearer ${k}` }, query: {} }, res, { env: { ...ENV, MOSHA_READER: 'off' }, store: s, who: async () => null, now: NOW }); assert.equal(out.code, 401); G._reset();
});

test('the page\'s pure pieces: the size a picture is sent at, a caption from a file name, where a lesson stands', () => {
  assert.deepEqual(TEACH.fit(3600, 1800, 1800), { w: 1800, h: 900 }); assert.deepEqual(TEACH.fit(900, 1950, 1800), { w: 831, h: 1800 }); assert.deepEqual(TEACH.fit(1280, 679, 1800), { w: 1280, h: 679 }, 'never enlarged');
  assert.equal(TEACH.captionOf('m5 vr.png'), 'm5 vr'); assert.equal(TEACH.captionOf('M30_sweep-high.JPG'), 'M30 sweep high');
  for (const n of ['IMG_2041.jpg', 'Screenshot 2026-11-02 at 12.03.png', 'photo.jpeg', '20261102_120301.png', 'WhatsApp Image 2026-11-02.jpeg', '', null]) assert.equal(TEACH.captionOf(n), '', String(n));
  assert.equal(TEACH.stateOf({ shots: [1], reply: null }), 'new'); assert.equal(TEACH.stateOf({ shots: [1, 2], reply: { shots: 1 } }), 'more'); assert.equal(TEACH.stateOf({ shots: [1, 2], reply: { shots: 2 } }), 'read');
  assert.deepEqual(TEACH.summary([{ shots: [1, 2], reply: null }, { shots: [1], reply: { shots: 1 } }]), { lessons: 2, shots: 3, unread: 1 }); assert.deepEqual(TEACH.summary([]), { lessons: 0, shots: 0, unread: 0 });
  assert.equal(TEACH.bytesOf('data:image/jpeg;base64,' + 'A'.repeat(4000)), 3000); assert.ok(TEACH.MAX_SIDE * 1 === 1800 && TEACH.MAX_PICK === 8);
});

test('page wiring: Luxus lands on the Mosha desk, the desk opens on its own, the cards and the script are there', () => {
  // the page's own permission function, lifted out of the page
  const code = PAGE.slice(PAGE.indexOf('window.MS_PERM_KEYS = ['), PAGE.indexOf('window.msMergeUsers')), w = {}; new Function('window', code)(w);
  assert.ok(w.MS_PERM_KEYS.includes('mosha')); const P = (R, owner) => w.msPerms(R, owner).mosha;
  assert.equal(P(null, true), 'teach'); assert.equal(P(LUXUS), 'teach'); assert.equal(P(CARLOS), false); assert.equal(P(FRED), 'read'); assert.equal(P({ ...LUXUS, perms: { mosha: false } }), false); assert.equal(P({ ...FRED, perms: { desks: false } }), false); assert.equal(P({ ...FRED, perms: { mosha: 'teach' } }), 'teach');
  for (const R of [LUXUS, CARLOS, FRED, { ...LUXUS, perms: { mosha: 'read' } }, { ...FRED, perms: { mosha: false } }, { ...CARLOS, perms: { desks: true } }]) assert.equal(P(R), moshaLevel(R), 'the page and the server agree: ' + JSON.stringify(R));
  assert.equal(w.msPerms(LUXUS).desks, false, 'the other desks stay closed to him'); assert.equal(w.msPerms(LUXUS).charts, false);
  assert.match(PAGE, /mosha: 'mosha', ict: 'ict' \}/); assert.match(PAGE, /!h0 && window\.MS_ACCT && window\.MS_ACCT\.home === 'mosha' && !msDenied\('mosha'\) \? 'mosha'/);
  assert.match(PAGE, /if \(E\.mosha\) document\.documentElement\.dataset\.mosha = E\.mosha;/); assert.match(PAGE, /x\.perms \|\| null, x\.mosha \|\| false, x\.home \|\| false\]/, 'a new Mosha level reaches a signed-in page');
  assert.match(PAGE, /html\[data-deny~="desks"\] \.desk-sw a:not\(\.ictx\):not\(\[data-dsw="mosha"\]\), html:not\(\[data-mosha\]\) \.desk-sw a\[data-dsw="mosha"\] \{ display: none !important; \}/);
  assert.match(PAGE, /html\[data-deny~="desks"\]:not\(\[data-ict\]\):not\(\[data-mosha\]\) \.dsk \{ display: none !important; \}/);
  assert.match(PAGE, /k === 'ict' \? !!document\.documentElement\.dataset\.ict : !PUB && !msDenied\(k\)/);
  assert.ok(PAGE.includes('<script src="/assets/mosha-teach.js" defer></script>')); assert.match(DESK, /if \(root\.msMoshaTeach\) root\.msMoshaTeach\(\)/);
  const sec = PAGE.slice(PAGE.indexOf('id="v-mosha"'), PAGE.indexOf('id="v-lit"'));
  for (const id of ['mo-teach', 'mo-t-form', 'mo-t-file', 'mo-t-drop', 'mo-t-picks', 'mo-t-send', 'mo-t-msg', 'mo-lessons', 'mo-l-sub', 'mo-l-body', 'mo-l-key', 'mo-l-keybtn', 'mo-l-keyout']) assert.ok(sec.includes(`id="${id}"`), id);
  assert.match(sec, /id="mo-teach" hidden/); assert.match(sec, /id="mo-l-key" hidden/); assert.match(sec, /id="mo-t-file" accept="image\/png,image\/jpeg,image\/webp" multiple/); assert.match(sec, /id="mo-t-msg" role="status" aria-live="polite"/);
  assert.match(PAGE, /name="mosha" value="\$\{v\}"/); assert.match(PAGE, /if \(m\) perms\.mosha = m === 'off' \? false : m;/);
  // the script: it talks to the lessons endpoint only, escapes what it prints, and uses the styled dialogs
  assert.deepEqual([...new Set([...JS.matchAll(/fetch\(([A-Za-z_]+)/g)].map((m) => m[1]))], ['URL_']); assert.match(JS, /var URL_ = '\/api\/mosha-lessons'/);
  assert.ok(!/require\(|import /.test(JS)); assert.ok(!/[^.a-zA-Z](prompt|confirm|alert)\(/.test(JS)); assert.ok(!/innerHTML = [^;]*\+ (l|s|p)\.(title|note|caption|name)\b(?!\))/.test(JS), 'what a teacher wrote is escaped before it is printed');
  assert.ok(!/api\/(run|ctrader|bridge|mosha')/.test(JS)); assert.match(rd('../vercel.json'), /"api\/mosha-lessons\.js": \{\s*"maxDuration": 30/);
});

test('the endpoint and the assistant\'s script: lessons only, nothing that trades, the key never in a file', () => {
  assert.ok(!/council\/|ctrader|\/orders?\b|trades\.json/.test(API.replace(/^\/\/.*$/gm, ''))); assert.deepEqual([...API.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1]), ['node:crypto', './_session.js', './_guard.js', './mosha.js', '@vercel/blob']);
  assert.match(API, /access: 'private'/g); assert.ok(!/access: 'public'/.test(API)); assert.match(API, /allowOverwrite: false, contentType: type/);
  assert.match(TOOL, /process\.env\.MOSHA_READER_KEY \? \{ Authorization/); assert.ok(!/mr[0-9a-f]{40}/.test(TOOL + API + JS + PAGE), 'no key in a file'); assert.match(TOOL, /GAP = 2500/);
});
