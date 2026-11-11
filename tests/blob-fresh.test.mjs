// node --test tests/blob-fresh.test.mjs — every Blob file that is overwritten in place is read from the ORIGIN (11 Nov 2026).
// The Academy lost a verdict because its store read through the Blob CDN, which serves an overwritten file with its old bytes
// for up to a minute: a second function instance did not see a row stored seconds earlier, and a save made from such a read
// drops what was stored in between. The same read-then-write sat in notify, profile, sounds, the Mosha log and the Mosha
// lessons / book. Each test runs the real handler and the real Blob store of the module over a fake Blob service with that
// lag (tests/fixtures/blob-lag.mjs), with two function instances. Offline: no network, no real store.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import Module from 'node:module';
import { blobService, resOf } from './fixtures/blob-lag.mjs';
const require = createRequire(import.meta.url);

// api/_alerts.js, api/users.js load the Blob client and web-push by name: both are faked (the service is swapped per test)
let SVC = blobService('blob-fake'); const PUSH = { sent: [] };
const fakeBlob = { list: (...a) => SVC.blob.list(...a), put: (...a) => SVC.blob.put(...a), del: (...a) => SVC.blob.del(...a) };
const fakeWebpush = { setVapidDetails() {}, sendNotification: async (sub, payload) => { PUSH.sent.push({ sub, payload }); return { statusCode: 201 }; } };
const origLoad = Module._load;
Module._load = function (r, ...rest) { if (r === '@vercel/blob') return fakeBlob; if (r === 'web-push') return fakeWebpush; return origLoad.call(this, r, ...rest); };

const S = require('../api/_session.js'), A = require('../api/_accounts.js');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const OWNER = { u: 'owner', name: 'Owner', role: 'owner' }, LUXUS = { u: 'luxus', name: 'Luxus', role: 'viewer', mosha: 'teach' };
async function call(handle, deps, method, who, body, query) {
  const { out, res } = resOf();
  await handle({ method, headers: {}, query: query || {}, body: method === 'POST' ? body : undefined }, res, { ...deps, who: async () => who, sameOrigin: () => true });
  return out;
}
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
const png = `data:image/png;base64,${PNG.toString('base64')}`;

test('notify: a notification sent through one instance is seen by another within a minute, and deleting through it keeps the new one', async () => {
  const N = require('../api/notify.js'), W = blobService(), inst = () => ({ env: W.env, store: N.blobStore(W.env, W.io()) }), I1 = inst(), I2 = inst();
  const a = await call(N.handle, I1, 'POST', OWNER, { title: 'first' }); assert.equal(a.code, 200); W.now += 10 * 60e3;
  assert.equal((await call(N.handle, I2, 'GET', OWNER)).body.items.length, 1); W.now += 60e3;
  const b = await call(N.handle, I1, 'POST', OWNER, { title: 'second' }); assert.equal(b.code, 200); W.now += 5e3;
  assert.deepEqual((await call(N.handle, I2, 'GET', LUXUS)).body.items.map((x) => x.title), ['second', 'first'], 'the member sees the notification sent five seconds ago');
  assert.equal((await call(N.handle, I2, 'POST', OWNER, { remove: a.body.item.id })).body.removed, 1);
  assert.deepEqual(W.json('notices/list.json').map((x) => x.title), ['second'], 'the delete did not take the newer notification with it');
  assert.equal(W.reads.cdn, 0, 'no read went through the CDN');
});

test('profile: a name saved through one instance is not lost when the photo is saved through another', async () => {
  const P = require('../api/profile.js'), W = blobService(), ENV = { ...W.env, CTRADER_LINK_KEY: 'link-key-fake-0123456789' };
  const builtIns = { fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer' } }, deps = { builtIns, blobUsers: async () => ({ users: {} }) };
  const cookie = `ms_session=${S.issue(ENV, 'fred', sha('fred-pw'), S.account('fred', builtIns.fred))}`;
  const inst = () => ({ env: ENV, deps, store: P.blobStore(W.env, W.io()) }), I1 = inst(), I2 = inst();
  const go = async (I, method, body) => { const { out, res } = resOf(); await P.handle({ method, headers: { cookie }, body }, res, I); return out; };
  const photo = `data:image/png;base64,${PNG.toString('base64')}`;
  assert.equal((await go(I1, 'POST', { photo })).code, 200); W.now += 10 * 60e3;
  assert.equal((await go(I2, 'GET')).body.photo, photo); W.now += 60e3;
  assert.equal((await go(I1, 'POST', { name: 'Freddy' })).code, 200); W.now += 5e3;
  assert.equal((await go(I2, 'GET')).body.name, 'Freddy', 'the other device shows the new name at once');
  assert.equal((await go(I2, 'POST', { photo: null })).code, 200);
  assert.equal(W.json('profiles/fred.json').name, 'Freddy', 'removing the photo did not put the old record back'); assert.equal(W.json('profiles/fred.json').photo, undefined);
  assert.equal(W.reads.cdn, 0);
});

test('sounds: choosing the target sound through one instance does not drop the stop sound chosen a moment before through another', async () => {
  const D = require('../api/sounds.js'), W = blobService(), inst = () => ({ env: W.env, store: D.blobStore(W.env, W.io()), isOwnerSession: async () => true }), I1 = inst(), I2 = inst();
  const mp3 = `data:audio/mpeg;base64,${Buffer.alloc(300, 3).toString('base64')}`;
  const go = async (I, method, body) => { const { out, res } = resOf(); await D.handle({ method, headers: {}, body }, res, I); return out; };
  assert.equal((await go(I1, 'POST', { kind: 'sl', data: mp3, name: 'old.mp3' })).code, 200); W.now += 10 * 60e3;
  assert.equal((await go(I2, 'GET')).body.sl.name, 'old.mp3'); W.now += 60e3;
  assert.equal((await go(I1, 'POST', { kind: 'sl', data: mp3, name: 'new.mp3' })).code, 200); W.now += 5e3;
  assert.equal((await go(I2, 'GET')).body.sl.name, 'new.mp3');
  assert.equal((await go(I2, 'POST', { kind: 'tp', data: mp3, name: 'tp.mp3' })).code, 200);
  assert.equal(W.json('sounds/config.json').sl.name, 'new.mp3', 'the stop sound is the one chosen last'); assert.equal(W.json('sounds/config.json').tp.name, 'tp.mp3');
  assert.equal(W.reads.cdn, 0);
});

test('Mosha log: a trade logged through one instance can be closed through another at once, and no logged trade is dropped', async () => {
  const M = require('../api/mosha.js'), W = blobService(), now = W.now, at = Math.floor(now / 1000) - 3600;
  const inst = () => ({ env: W.env, store: M.blobStore(W.env, W.io()), now }), I1 = inst(), I2 = inst();
  const t1 = await call(M.handle, I1, 'POST', OWNER, { save: { market: 'xau', side: 'sell', at, entry: 4120, stop: 4128, target: 4080 } }); assert.equal(t1.code, 200); W.now += 10 * 60e3;
  assert.equal((await call(M.handle, I2, 'GET', OWNER)).body.trades.length, 1); W.now += 60e3;
  const buy = { market: 'xau', side: 'buy', at: at + 600, entry: 4100, stop: 4092 }, sell = { market: 'xau', side: 'sell', at, entry: 4120, stop: 4128, target: 4080 };
  const t2 = await call(M.handle, I1, 'POST', OWNER, { save: buy }); assert.equal(t2.code, 200); W.now += 5e3;
  const close = await call(M.handle, I2, 'POST', OWNER, { save: { ...buy, id: t2.body.trade.id, status: 'closed', exit: 4116, exitAt: at + 1800 } });
  assert.equal(close.code, 200, 'the trade logged five seconds ago is found (it was "no such trade")'); assert.equal(close.body.trade.R, 2); assert.equal(close.body.trade.pre, true);
  assert.equal((await call(M.handle, I2, 'POST', OWNER, { save: { ...sell, id: t1.body.trade.id, note: 'held' } })).code, 200);
  assert.deepEqual(W.json('mosha/trades.json').map((t) => t.id), [t1.body.trade.id, t2.body.trade.id], 'both trades are still in the log');
  assert.equal(W.json('mosha/trades.json')[0].stop, 4128, 'and each keeps its stop'); assert.equal(W.reads.cdn, 0);
});

test('Mosha lessons: a lesson sent a moment ago takes its next picture, the desk\'s answer and a book line through another instance, and nothing is dropped', async () => {
  const L = require('../api/mosha-lessons.js'), W = blobService(), inst = () => ({ env: W.env, store: L.blobStore(W.env, W.io()), now: W.now }), I1 = inst(), I2 = inst();
  const l1 = await call(L.handle, I1, 'POST', LUXUS, { add: { note: 'the sell of this morning', image: png, caption: 'M5 vr' } }); assert.equal(l1.code, 200);
  const k1 = await call(L.handle, I1, 'POST', LUXUS, { learn: { kind: 'rule', text: 'Wait for the CF before the entry.' } }); assert.equal(k1.code, 200); W.now += 10 * 60e3;
  const seen = await call(L.handle, I2, 'GET', OWNER); assert.equal(seen.body.lessons.length, 1); W.now += 60e3;
  const l2 = await call(L.handle, I1, 'POST', LUXUS, { add: { note: 'a second lesson, words only' } }); assert.equal(l2.code, 200);
  const k2 = await call(L.handle, I1, 'POST', LUXUS, { learn: { kind: 'avoid', text: 'No VR, no trade at all.' } }); assert.equal(k2.code, 200); W.now += 5e3;
  // the page sends the next picture of the lesson just made, and it lands on another instance
  const more = await call(L.handle, I2, 'POST', LUXUS, { add: { lesson: l2.body.lesson.id, image: png, caption: 'M5 cf' } });
  assert.equal(more.code, 200, 'the lesson stored five seconds ago is found (it was "no such lesson")');
  assert.equal((await call(L.handle, I2, 'POST', OWNER, { reply: { id: l1.body.lesson.id, text: 'A sell after the M5 CF, stop above the VR.' } })).code, 200);
  assert.equal((await call(L.handle, I2, 'POST', LUXUS, { book: { id: k1.body.item.id, confirm: true } })).code, 200);
  assert.deepEqual(W.json('mosha/lessons.json').map((l) => l.id), [l1.body.lesson.id, l2.body.lesson.id], 'both lessons are stored');
  assert.equal(W.json('mosha/lessons.json')[1].shots.length, 1); assert.equal(W.json('mosha/lessons.json')[0].thread.length, 1);
  assert.ok(W.json('mosha/book.json').some((b) => b.id === k2.body.item.id), 'the book line taught a moment ago was not dropped by the confirm');
  assert.equal(W.reads.cdn, 0, 'the lessons and the book are read from the origin');
  // a picture is written once under its own name, so it may come from the CDN
  const { out, res } = resOf(); await L.handle({ method: 'GET', headers: {}, query: { img: more.body.img } }, res, { ...I2, who: async () => OWNER });
  assert.equal(out.code, 200); assert.ok(Buffer.from(out.body).equals(PNG)); assert.equal(W.reads.cdn, 1);
});

test('Mosha lessons: a lesson stored while a picture was being uploaded is not overwritten by that picture\'s save', async () => {
  const L = require('../api/mosha-lessons.js'), W = blobService(), inst = () => ({ env: W.env, store: L.blobStore(W.env, W.io()), now: W.now }), I1 = inst(), I2 = inst();
  const l1 = await call(L.handle, I1, 'POST', LUXUS, { add: { note: 'first' } }); assert.equal(l1.code, 200); W.now += 5 * 60e3;
  let other = null;
  W.onPut = async (path) => { assert.match(path, /^mosha\/shots\//); other = await call(L.handle, I2, 'POST', LUXUS, { add: { note: 'sent from the phone meanwhile' } }); };
  const pic = await call(L.handle, I1, 'POST', LUXUS, { add: { lesson: l1.body.lesson.id, image: png } });
  assert.equal(pic.code, 200); assert.equal(other.code, 200);
  const stored = W.json('mosha/lessons.json');
  assert.deepEqual(stored.map((l) => l.id).sort(), [l1.body.lesson.id, other.body.lesson.id].sort(), 'both lessons are stored'); assert.equal(stored.find((l) => l.id === l1.body.lesson.id).shots.length, 1);
  // the lesson removed while its picture was on the way: nothing is written back, the picture is taken away again
  W.onPut = async () => { assert.equal((await call(L.handle, I2, 'POST', OWNER, { remove: { id: l1.body.lesson.id } })).code, 200); };
  const late = await call(L.handle, I1, 'POST', LUXUS, { add: { lesson: l1.body.lesson.id, image: png } });
  assert.equal(late.code, 404); assert.deepEqual(W.json('mosha/lessons.json').map((l) => l.id), [other.body.lesson.id]);
  assert.equal([...W.origin.keys()].filter((k) => k.startsWith('mosha/shots/')).length, 0, 'no picture is left without a lesson');
});

test('Mosha lessons: a write checks the account against the user list as it is now, not a minute-old copy', async () => {
  const L = require('../api/mosha-lessons.js'), W = blobService(), ENV = { ...W.env, CTRADER_LINK_KEY: 'link-key-fake-0123456789' };
  const builtIns = { luxus: { name: 'Luxus', hash: sha('lx-pw'), role: 'viewer' } }; let stored = { users: {} }, reads = 0;
  const deps = { builtIns, blobUsers: async () => { reads++; return stored; } }, cookie = `ms_session=${S.issue(ENV, 'luxus', sha('lx-pw'), S.account('luxus', builtIns.luxus))}`;
  const I = { env: ENV, deps, store: L.blobStore(W.env, W.io()), sameOrigin: () => true };
  const go = async (method, body) => { const { out, res } = resOf(); await L.handle({ method, headers: { cookie, host: 'meridianx.dev' }, query: {}, body }, res, I); return out; };
  S._cache.users = null; S._cache.at = 0;
  assert.equal((await go('GET')).body.canTeach, true); assert.equal((await go('POST', { add: { note: 'a lesson' } })).code, 200);
  stored = { users: { luxus: { ...builtIns.luxus, perms: { mosha: 'read' } } } };            // the owner switches his teaching off
  assert.equal((await go('POST', { add: { note: 'one more' } })).code, 403, 'the next lesson is refused at once');
  stored = { users: { luxus: { ...builtIns.luxus, disabled: true } } };                      // the owner removes the account
  assert.equal((await go('POST', { add: { note: 'and another' } })).code, 401);
  stored = { users: { luxus: { ...builtIns.luxus, hash: sha('new-pw') } } };                 // a new password ends the old session
  assert.equal((await go('POST', { learn: { kind: 'rule', text: 'A line of the book.' } })).code, 401);
  assert.equal(W.json('mosha/lessons.json').length, 1); assert.equal(W.json('mosha/book.json'), undefined);
  S._cache.users = null; S._cache.at = 0;
});

test('Academy store: a write by another instance within the same second is seen (the instance\'s own copy is used only while the file is still its own)', async () => {
  const ST = require('../api/_academy-store.js'), W = blobService();
  const inst = () => ST.blobStore(W.env, { ...W.io(), recent: new Map(), tails: new Map(), now: () => W.now }), A1 = inst(), B1 = inst();
  await A1.append('attempts/replica.json', [{ id: 1 }]); W.now += 1000;
  await B1.append('attempts/replica.json', [{ id: 2 }]); W.now += 1000;
  assert.deepEqual((await A1.rows('attempts/replica.json')).map((r) => r.id), [1, 2], 'the first instance reads the row the second stored a second later');
  await A1.append('attempts/replica.json', [{ id: 3 }]);
  assert.deepEqual(W.json('academy/attempts/replica.json').rows.map((r) => r.id), [1, 2, 3], 'and its next write keeps it');
  // its own copy still saves a read while nobody else has written
  const before = W.reads.origin; assert.deepEqual((await A1.rows('attempts/replica.json')).length, 3); assert.equal(W.reads.origin, before); assert.equal(W.reads.cdn, 0);
});

test('price alerts: an alert the device saved while the cron was reading candles is kept; a device that removed itself is not written back', async () => {
  SVC = blobService('blob-fake'); PUSH.sent = [];
  const env = { CRON_SECRET: 'cron-fake-0123456789', OANDA_TOKEN: 'oanda-fake', VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', BLOB_READ_WRITE_TOKEN: 'blob-fake' };
  const saved = {}; for (const k of Object.keys(env)) { saved[k] = process.env[k]; process.env[k] = env[k]; }
  const realFetch = globalThis.fetch;
  try {
    const now = Math.floor(Date.now() / 1000), keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }, sub = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys });
    const push = require('../api/push.js'), cron = require('../api/alert-cron.js');
    const post = async (body) => { const { out, res } = resOf(); await push({ method: 'POST', headers: {}, query: {}, body: JSON.stringify(body) }, res); return out; };
    const hitA = { id: 'a1', sym: 'xau', price: 2000, dir: 'above', at: now - 60 }, later = { id: 'a2', sym: 'xau', price: 2100, dir: 'above', at: now - 5 };
    assert.equal((await post({ sub: sub('one'), alerts: [hitA] })).code, 200); assert.equal((await post({ sub: sub('two'), alerts: [{ ...hitA, id: 'b1' }] })).code, 200);
    let during = async () => {};
    globalThis.fetch = async (url, o) => { const u = String(url);
      if (/oanda\.com\/v3\/instruments\/XAU_USD\/candles/.test(u)) { const f = during; during = async () => {}; await f(); return new Response(JSON.stringify({ candles: [{ time: String(now - 30), mid: { o: '1999', h: '2001', l: '1998', c: '2000.5' } }] }), { status: 200 }); }
      const r = await SVC.fetch(u, o); return r.ok ? new Response(JSON.stringify(await r.json()), { status: 200 }) : new Response('{}', { status: r.status }); };
    // while the cron reads the candles: device one adds an alert, device two removes itself
    during = async () => { assert.equal((await post({ sub: sub('one'), alerts: [hitA, later] })).code, 200); assert.equal((await post({ sub: sub('two'), alerts: [] })).code, 200); };
    const { out, res } = resOf(); await cron({ method: 'GET', headers: { authorization: `Bearer ${env.CRON_SECRET}` }, query: {} }, res);
    assert.equal(out.code, 200); assert.equal(out.body.sent, 2, 'both alerts that were hit are sent');
    const one = await post({ sub: sub('one'), get: true }); assert.deepEqual(one.body.alerts.map((a) => a.id), ['a2'], 'the alert added meanwhile is kept, the one sent is gone');
    assert.deepEqual((await post({ sub: sub('two'), get: true })).body.alerts, []);
    const files = [...SVC.origin.keys()].filter((k) => k.startsWith('push/')); assert.equal(files.length, 1, 'one record for device one, none for the device that removed itself');
  } finally { globalThis.fetch = realFetch; for (const k of Object.keys(env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
});

test('the user list: every save is a new file, so a changed password or a removed member is read at once by every instance', async () => {
  SVC = blobService('blob-fake'); const io = { list: fakeBlob.list, fetch: SVC.fetch }, env = { BLOB_READ_WRITE_TOKEN: 'blob-fake' };
  const U = require('../api/users.js'), builtIns = { fred: { name: 'Fred', hash: sha('fred-pw'), role: 'reviewer' } };
  const save = async (users) => { const { out, res } = resOf(); await U.handle({ method: 'POST', headers: {}, body: { users, ownerPw: 'x' } }, res, { env, builtIns, deps: { builtIns, blobUsers: () => A.blobUsers(env, io) }, load: async () => (await A.blobUsers(env, io)) || { users: {} } }); return out; };
  // the owner's session, made with a test secret
  const ENV = { ...env, CTRADER_LINK_KEY: 'link-key-fake-0123456789' }, cookie = `ms_session=${S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner'))}`;
  const saveAs = async (users) => { const { out, res } = resOf(); await U.handle({ method: 'POST', headers: { cookie }, body: { users } }, res, { env: ENV, builtIns, deps: { builtIns, blobUsers: () => A.blobUsers(env, io) }, load: async () => (await A.blobUsers(env, io)) || { users: {} } }); return out; };
  assert.equal((await save({})).code, 403, 'a wrong owner password saves nothing'); assert.equal(SVC.puts.length, 0);
  assert.equal((await saveAs({ fred: { name: 'Fred', role: 'reviewer' } })).code, 200); SVC.now += 10 * 60e3;
  const deps = { builtIns, blobUsers: () => A.blobUsers(env, io) }, tokOf = (pw) => S.verify(ENV, S.issue(ENV, 'fred', sha(pw), S.account('fred', builtIns.fred)));
  assert.equal((await S.current(ENV, deps, tokOf('fred-pw'))).u, 'fred'); SVC.now += 60e3;                 // another instance has read the list
  assert.equal((await saveAs({ fred: { name: 'Fred', role: 'reviewer', pw: 'a-new-password' } })).code, 200); SVC.now += 2e3;
  assert.equal(await S.current(ENV, deps, tokOf('fred-pw')), null, 'the old password\'s session ends at once');
  assert.equal((await S.login(deps, 'fred-pw')), null); assert.equal((await S.login(deps, 'a-new-password')).u, 'fred');
  assert.equal((await saveAs({ fred: { name: 'Fred', role: 'reviewer', disabled: true } })).code, 200); SVC.now += 2e3;
  assert.equal(await S.login(deps, 'a-new-password'), null, 'a removed member is refused at once');
  const names = SVC.puts.filter((k) => k.startsWith('users/')); assert.equal(new Set(names).size, 3, 'three saves, three file names');
  assert.equal([...SVC.origin.keys()].filter((k) => k.startsWith('users/')).length, 1, 'the older files are deleted');
});

test('no module overwrites a Blob file in place and reads it back through the CDN', () => {
  const files = fs.readdirSync(new URL('../api/', import.meta.url)).filter((f) => /\.js$/.test(f)), inPlace = [];
  for (const f of files) { const s = src(`api/${f}`); if (!/allowOverwrite: true/.test(s)) continue; inPlace.push(f);
    assert.match(s, /searchParams\.set\('cache', '0'\)/, `${f} overwrites a file in place: its reads must ask the origin`); }
  assert.deepEqual(inPlace.sort(), ['_academy-store.js', 'mosha-lessons.js', 'mosha.js', 'notify.js', 'profile.js', 'sounds.js']);
  for (const f of ['notify.js', 'profile.js', 'sounds.js', 'mosha.js']) assert.match(src(`api/${f}`), /await F\(fresh\(b\.url\)/, f);
  // every other writer saves under a new name each time (a new URL, which no CDN copy can exist for)
  for (const f of ['users.js', '_alerts.js', 'ctrader-link.js', 'tv-webhook.js', 'run.js', 'data.js']) { const puts = src(`api/${f}`).match(/\bput\(`[^`]+`[^;]*/g) || []; assert.ok(puts.length, f); for (const p of puts) assert.match(p, /addRandomSuffix: true/, `${f}: ${p.slice(0, 60)}`); }
});
