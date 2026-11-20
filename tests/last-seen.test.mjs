// Last seen (owner, 20 Nov 2026): /api/me and /api/login mark the account, the owner's GET /api/users returns the marks. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const SEEN = require('../api/_seen.js');

const fake = (init = {}) => { let m = { ...init }, puts = 0; return { get: async () => ({ ...m }), put: async (x) => { m = { ...x }; puts++; }, get map() { return m; }, get puts() { return puts; } }; };

test('touch marks the account once per 5 minutes per instance and never throws', async () => {
  SEEN._reset(); const s = fake(), t0 = Date.parse('2026-11-20T10:00:00Z');
  assert.equal(await SEEN.touch({}, 'fred', t0, { store: s }), true); assert.equal(s.map.fred, '2026-11-20T10:00:00.000Z');
  assert.equal(await SEEN.touch({}, 'fred', t0 + 60e3, { store: s }), false, 'throttled');
  assert.equal(await SEEN.touch({}, 'fred', t0 + SEEN.TOUCH_MS, { store: s }), true); assert.equal(s.puts, 2);
  assert.equal(await SEEN.touch({}, 'Bad key!', t0, { store: s }), false);
  const broken = { get: async () => { throw new Error('down'); }, put: async () => { throw new Error('down'); } };
  assert.equal(await SEEN.touch({}, 'luxus', t0, { store: broken }), false);
  assert.equal(await SEEN.touch({}, 'carlos', t0, {}), false, 'no store configured: nothing, no error');
});

test('read cleans the file; an unreadable store is null (the page says so), never a made-up time', async () => {
  assert.deepEqual(await SEEN.read({}, { store: fake({ fred: '2026-11-20T10:00:00.000Z', 'x y': 'no', luxus: 'nope' }) }), { fred: '2026-11-20T10:00:00.000Z' });
  assert.equal(await SEEN.read({}, { store: { get: async () => { throw new Error('x'); } } }), null);
});

test('wiring: me and login touch after a valid account; only the owner\'s users answer carries seen; the page shows it', () => {
  const me = fs.readFileSync(new URL('../api/me.js', import.meta.url), 'utf8'), login = fs.readFileSync(new URL('../api/login.js', import.meta.url), 'utf8'), users = fs.readFileSync(new URL('../api/users.js', import.meta.url), 'utf8');
  assert.ok(me.indexOf('SEEN.touch(') > me.indexOf('if (!acct)'), 'only a checked account is marked');
  assert.ok(login.indexOf('SEEN.touch(') > login.indexOf('if (!who)'));
  assert.match(users, /if \(acct\.u === 'owner'\) \{ const seen = await SEEN\.read/);
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const fn = new Function('window', page.slice(page.indexOf('window.msSeenText = function'), page.indexOf('window.msFetchUsers = function')) + '; return window.msSeenText;')({});
  const now = Date.parse('2026-11-20T12:00:00Z');
  assert.equal(fn({ fred: '2026-11-20T11:58:00Z' }, 'fred', now), 'Online now');
  assert.match(fn({ fred: '2026-11-20T09:00:00Z' }, 'fred', now), /^Last seen 3 h ago \(/);
  assert.match(fn({ fred: '2026-11-17T12:00:00Z' }, 'fred', now), /^Last seen 3 days ago/);
  assert.equal(fn({}, 'fred', now), 'Not seen since 20 Nov 2026'); assert.equal(fn(null, 'fred', now), 'Last seen: could not be read'); assert.equal(fn(undefined, 'fred', now), '');
});
