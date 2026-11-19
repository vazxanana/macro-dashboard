// node --test tests/signup.test.mjs — sign-up, email verification, owner approval and password reset (17 Nov 2026), and the
// mail senders: the Cloudflare Email Service binding first, Gmail SMTP second (api/_smtp.js). Fake store, fake clock, fake
// binding and a fake SMTP socket; no network, no secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_session.js'), A = require('../api/_accounts.js'), G = require('../api/_guard.js'), M = require('../api/_smtp.js');
const signup = require('../api/signup.js'), login = require('../api/login.js'), me = require('../api/me.js'), users = require('../api/users.js');

const ENV = { CTRADER_LINK_KEY: 'link-key-fake-0123456789', BLOB_READ_WRITE_TOKEN: 'fake' };
const GMAIL = { ...ENV, GMAIL_USER: 'sender@example.com', GMAIL_APP_PASSWORD: 'app-pass-fake' };
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const builtIns = { fred: { name: 'Fred', hash: sha('fred-password'), role: 'reviewer', ict: true } };

// one fake world: the private store, the stored user list, a clock and an outbox
function world(o = {}) {
  const files = {}, W = { files, list: { users: {} }, out: [], t: Date.UTC(2026, 10, 17, 12), env: o.env || ENV };
  W.store = { async get(p) { return JSON.parse(JSON.stringify(files[p] || [])); }, async put(p, v) { files[p] = JSON.parse(JSON.stringify(v)); } };
  W.deps = { builtIns, blobUsers: async () => W.list };
  W.d = (extra = {}) => ({ env: W.env, store: W.store, deps: W.deps, builtIns, now: () => W.t, loadUsers: async () => W.list, saveUsers: async (data) => { W.list = data; },
    ...(o.mail === false ? {} : { send: async (to, subject, text, html) => { W.out.push({ to, subject, text, html }); return { ok: true }; } }), ...extra });
  return W;
}
function res() { const r = { code: 200, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; return r; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.end = () => { r.code = r.statusCode || r.code; return r; }; return r; }
let ipN = 0;
const call = async (W, req, extra) => { const r = res(); await signup.handle({ query: {}, ...req, headers: { host: 'aureumdesk.co.uk', 'x-real-ip': req.ip || `10.0.0.${++ipN % 250}`, ...(req.headers || {}) } }, r, W.d(extra)); return r; };
// a sign-up body without a username gets one from the name (18 Nov 2026: usernames are required; most tests are about other rules)
const unameOf = (n) => (String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '') + '000').slice(0, Math.max(3, String(n || '').replace(/[^A-Za-z0-9]/g, '').length));
const post = (W, body, extra, req = {}) => call(W, { method: 'POST', body: body && 'name' in body && !('username' in body) && body.name ? { ...body, username: unameOf(body.name) } : body, ...req }, extra);
const ownerCookie = () => `ms_session=${S.issue(ENV, 'owner', A.OWNER_HASH, S.account('owner'))}`;
const linkOf = (W) => { const m = /https:\/\/\S+?\/api\/signup\?verify=([A-Za-z0-9_-]+)/.exec(W.out[W.out.length - 1].text); return m && m[1]; };
const resetOf = (W) => { const m = /#reset=([A-Za-z0-9_-]+)/.exec(W.out[W.out.length - 1].text); return m && m[1]; };
const join = async (W, name = 'Maria', email = 'Maria@Example.com', password = 'maria-password-1') => post(W, { name, email, password });
test.beforeEach(() => G._reset());

test('off without a mail route: sign-up and forgot answer 503 with the sentence; GET says closed; nothing is stored', async () => {
  const W = world({ mail: false });
  const r = await join(W); assert.equal(r.code, 503); assert.deepEqual(r.body, { error: 'Sign-ups are not open yet.' });
  assert.equal((await post(W, { forgot: 'a@b.co' })).code, 503);
  assert.deepEqual((await call(W, { method: 'GET' })).body, { open: false });
  assert.deepEqual(W.files, {});
  // Gmail secrets without the Worker's socket, or a socket without both secrets: still off
  assert.equal((await post(W, { name: 'A', email: 'a@b.co', password: 'long-enough-1' }, { env: GMAIL })).code, 503);
  assert.equal((await post(W, { name: 'A', email: 'a@b.co', password: 'long-enough-1' }, { connect: () => ({}), env: { ...ENV, GMAIL_USER: 'x@y.co' } })).code, 503);
  const on = world(); assert.deepEqual((await call(on, { method: 'GET' })).body, { open: true });
});

test('validation: name, email and password', async () => {
  const W = world();
  for (const [b, m] of [[{ name: '', email: 'a@b.co', password: 'x'.repeat(10) }, /name/], [{ name: 'x'.repeat(25), email: 'a@b.co', password: 'x'.repeat(10) }, /name/],
    [{ name: 'A', email: 'not-an-email', password: 'x'.repeat(10) }, /email/], [{ name: 'A', email: `${'a'.repeat(250)}@b.co`, password: 'x'.repeat(10) }, /email/],
    [{ name: 'A', email: 'a@b.co\r\nBcc: x@y.co', password: 'x'.repeat(10) }, /email/], [{ name: 'A', email: 'a@b.co', password: 'short' }, /10 characters/]]) {
    const r = await post(W, b); assert.equal(r.code, 400, JSON.stringify(b)); assert.match(r.body.error, m);
  }
  assert.equal(W.out.length, 0);
  assert.equal((await post(W, { name: 'A', email: 'a@b.co', password: 'x'.repeat(10) }, {}, { headers: { origin: 'https://evil.test' } })).code, 403, 'a foreign Origin is refused');
});

test('a password of the owner or a built-in member is refused with a neutral sentence (it would sign in alone); others may repeat', async () => {
  const W = world();
  assert.equal((await join(W, 'Ana', 'ana@example.com', 'ana-password-1')).code, 200);
  const r = await post(W, { name: 'Bo', email: 'bo@example.com', password: 'fred-password' }, {}, { ip: '10.9.9.9' });
  assert.equal(r.code, 400); assert.deepEqual(r.body, { error: 'Choose another password.' });
  // another request's or a stored member's password no longer matters: a member signs in with a username or email
  assert.equal((await post(W, { name: 'Bea', email: 'bo2@example.com', password: 'ana-password-1' })).code, 200);
  W.list = { users: { maria: { name: 'Maria', role: 'viewer', hash: sha('stored-member-pw') } } };
  assert.equal((await post(W, { name: 'Cy', email: 'cy@example.com', password: 'stored-member-pw' })).code, 200);
  // ten refusals from one IP: the shared password-guess limit answers 429
  for (let i = 0; i < 10; i++) await post(W, { name: 'Bo', email: `bo${i}@example.com`, password: 'fred-password' }, {}, { ip: '10.7.7.7' });
  assert.equal((await post(W, { name: 'Bo', email: 'z@example.com', password: 'free-password-9' }, {}, { ip: '10.7.7.7' })).code, 429);
});

test('the same answer for a new, a pending, a confirmed and a member\'s email; only the token hash is stored', async () => {
  const W = world();
  const a = await join(W); assert.equal(a.code, 200); assert.equal(W.out.length, 1);
  assert.equal(W.out[0].to, 'maria@example.com', 'emails are lowercased');
  const t = linkOf(W); assert.ok(t && t.length >= 40);
  const rec = W.files['signups/pending.json'][0];
  assert.equal(rec.tokenHash, sha(t)); assert.equal(rec.hash, sha('maria-password-1')); assert.doesNotMatch(JSON.stringify(W.files), new RegExp(t)); assert.doesNotMatch(JSON.stringify(W.files), /maria-password-1/);
  assert.equal(rec.exp - rec.at, 24 * 3600e3);
  const same = (x, y) => { assert.match(x.watch, /^[A-Za-z0-9_-]{40,60}$/); assert.match(y.watch, /^[A-Za-z0-9_-]{40,60}$/); const { watch: w1, ...p } = x, { watch: w2, ...q } = y; assert.deepEqual(p, q); };   // a random watch code in every answer
  const again = await join(W, 'Maria', 'maria@example.com', 'other-password-2'); same(again.body, a.body); assert.equal(W.out.length, 1, 'no second email inside 10 minutes');
  W.list = { users: { old: { name: 'Old', role: 'viewer', hash: sha('old-member-pw'), email: 'old@example.com' } } };
  const known = await join(W, 'X', 'old@example.com', 'brand-new-pw-3'); same(known.body, a.body); assert.equal(W.out.length, 1);
  // after the cool-down a fresh link replaces the unconfirmed request
  W.t += 11 * 60e3; await join(W, 'Maria', 'maria@example.com', 'maria-password-1'); assert.equal(W.out.length, 2); assert.equal(W.files['signups/pending.json'].length, 1);
  // the link is built on the site's own host; another host gets the site's domain
  const W2 = world(); await call(W2, { method: 'POST', body: { name: 'N', username: 'nnn', email: 'n@example.com', password: 'n-password-12' }, headers: { host: 'evil.test' } });
  assert.match(W2.out[0].text, /https:\/\/aureumdesk\.co\.uk\/api\/signup\?verify=/);
});

test('verify: single use, expiry, bad tokens; the owner is told by email (name only)', async () => {
  const W = world({ env: { ...ENV, OWNER_EMAIL: 'owner@example.com' } }); await join(W); const t = linkOf(W);
  const bad = await call(W, { method: 'GET', query: { verify: 'nope' } }); assert.equal(bad.code, 302); assert.equal(bad.headers.location, '/market-structure.html?signup=expired');
  const ok = await call(W, { method: 'GET', query: { verify: t } }); assert.equal(ok.headers.location, '/market-structure.html?signup=verified');
  assert.equal(W.files['signups/pending.json'][0].verified, true); assert.equal(W.files['signups/pending.json'][0].tokenHash, undefined);
  assert.equal(W.out[1].to, 'owner@example.com'); assert.doesNotMatch(W.out[1].text, /maria@example\.com/);
  assert.equal((await call(W, { method: 'GET', query: { verify: t } })).headers.location, '/market-structure.html?signup=expired', 'used once');
  const X = world(); await join(X); const t2 = linkOf(X); X.t += 24 * 3600e3 + 1;
  assert.equal((await call(X, { method: 'GET', query: { verify: t2 } })).headers.location, '/market-structure.html?signup=expired');
  assert.equal(X.files['signups/pending.json'][0].verified, false, 'an expired link confirms nothing');
});

test('watch (18 Nov 2026): every sign-up answer carries a code; it reads waiting until the link is opened, then confirmed; nothing else leaks', async () => {
  const W = world(); const r = await join(W); assert.match(r.body.watch, /^[A-Za-z0-9_-]{40,60}$/);
  assert.equal(W.files['signups/pending.json'][0].watchHash, sha(r.body.watch), 'only the hash is stored');
  assert.doesNotMatch(JSON.stringify(W.files), new RegExp(r.body.watch));
  const ask = async (w) => (await call(W, { method: 'GET', query: { watch: w } })).body;
  assert.deepEqual(await ask(r.body.watch), { state: 'waiting' });
  await call(W, { method: 'GET', query: { verify: linkOf(W) } });
  assert.deepEqual(await ask(r.body.watch), { state: 'confirmed' });
  // an unknown code (and every repeat or member answer's code) reads waiting; a bad one is refused
  assert.deepEqual(await ask(crypto.randomBytes(32).toString('base64url')), { state: 'waiting' });
  const again = await join(W); assert.match(again.body.watch, /^[A-Za-z0-9_-]{40,60}$/); assert.notEqual(again.body.watch, r.body.watch);
  assert.deepEqual(await ask(again.body.watch), { state: 'waiting' });
  assert.equal((await call(W, { method: 'GET', query: { watch: 'x' } })).code, 400);
  assert.equal(Object.keys(await ask(r.body.watch)).join(), 'state', 'never a name or an email');
});

test('owner approval: list, approve (the member can sign in), refuse; members and guests cannot list or approve', async () => {
  const W = world(); await join(W); await call(W, { method: 'GET', query: { verify: linkOf(W) } });
  await join(W, 'Ned', 'ned@example.com', 'ned-password-1');   // not confirmed: not listed
  assert.equal((await call(W, { method: 'GET', query: { list: '1' } })).code, 401);
  const fred = `ms_session=${S.issue(ENV, 'fred', builtIns.fred.hash, S.account('fred', builtIns.fred))}`;
  assert.equal((await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: fred } })).code, 403);
  const L = await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: ownerCookie() } });
  assert.equal(L.body.items.length, 1); assert.equal(L.body.items[0].email, 'maria@example.com'); assert.doesNotMatch(JSON.stringify(L.body), /[0-9a-f]{64}|tokenHash|hash/);
  const id = L.body.items[0].id;
  assert.equal((await post(W, { approve: id }, {}, { headers: { cookie: fred } })).code, 403);
  const ap = await post(W, { approve: id, role: 'reviewer' }, {}, { headers: { cookie: ownerCookie() } });
  assert.equal(ap.code, 200); assert.equal(ap.body.key, 'maria'); assert.equal(ap.body.role, 'reviewer'); assert.equal(ap.body.emailed, true);
  assert.deepEqual(W.list.users.maria, { name: 'Maria', role: 'reviewer', hash: sha('maria-password-1'), email: 'maria@example.com' });
  assert.match(W.out[W.out.length - 1].subject, /seat .* is ready/);
  assert.equal(W.files['signups/pending.json'].filter((p) => p.verified).length, 0);
  // sign-in with that password now works through /api/login, and nothing the member reads carries the email
  const r = res(); await login.handle({ method: 'POST', headers: { host: 'x.test' }, body: { id: 'maria', password: 'maria-password-1' } }, r, { env: ENV, deps: W.deps });
  assert.equal(r.code, 200); assert.equal(r.body.account.u, 'maria'); assert.doesNotMatch(JSON.stringify(r.body), /example\.com/);
  const cookie = String(r.headers['set-cookie']).split(';')[0];
  const m = res(); await me.handle({ method: 'GET', headers: { host: 'x.test', cookie } }, m, { env: ENV, deps: W.deps }); assert.doesNotMatch(JSON.stringify(m.body), /example\.com/);
  const u = res(); await users.handle({ method: 'GET', headers: { host: 'x.test', cookie: ownerCookie() } }, u, { env: ENV, deps: W.deps, load: async () => W.list, builtIns });
  assert.doesNotMatch(JSON.stringify(u.body), /example\.com/, 'not even the owner\'s Users list carries it');
  assert.equal(A.publicRecord(W.list.users.maria).email, undefined);
  // a Users page save posts records without the email: the stored one stays
  const sv = res(); await users.handle({ method: 'POST', headers: { host: 'x.test', cookie: ownerCookie() }, body: { users: { maria: { name: 'Maria', role: 'viewer' } }, note: 'role' } }, sv, { env: ENV, deps: W.deps, load: async () => W.list, save: async (dd) => { W.list = dd; }, builtIns });
  assert.equal(sv.code, 200); assert.equal(W.list.users.maria.email, 'maria@example.com'); assert.equal(W.list.users.maria.role, 'viewer');
  // a second Maria: her username "maria" is taken (409), she picks another and gets it as her key; refuse removes a request
  W.t += 11 * 60e3; assert.equal((await join(W, 'Maria', 'maria2@example.com', 'maria-password-2')).code, 409);
  await post(W, { name: 'Maria', username: 'maria-two', email: 'maria2@example.com', password: 'maria-password-2' }); await call(W, { method: 'GET', query: { verify: linkOf(W) } });
  const L2 = await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: ownerCookie() } });
  assert.equal((await post(W, { approve: L2.body.items[0].id }, {}, { headers: { cookie: ownerCookie() } })).body.key, 'maria-two');
  await join(W, 'Zed', 'zed@example.com', 'zed-password-1'); await call(W, { method: 'GET', query: { verify: linkOf(W) } });
  const L3 = await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: ownerCookie() } });
  assert.equal((await post(W, { refuse: L3.body.items[0].id }, {}, { headers: { cookie: ownerCookie() } })).code, 200);
  assert.equal((await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: ownerCookie() } })).body.items.length, 0);
  assert.equal(W.list.users.zed, undefined);
});

test('forgot and reset: the same answer always; the token works once in an hour; the new password ends old sessions', async () => {
  const W = world(); W.list = { users: { maria: { name: 'Maria', role: 'viewer', hash: sha('maria-password-1'), email: 'maria@example.com' } } };
  const known = await post(W, { forgot: 'MARIA@example.com' }), unknown = await post(W, { forgot: 'nobody@example.com' });
  assert.equal(known.code, 200); assert.deepEqual(known.body, unknown.body); assert.equal(W.out.length, 1); assert.equal(W.out[0].to, 'maria@example.com');
  const t = resetOf(W); assert.ok(t); assert.equal(W.files['signups/resets.json'][0].tokenHash, sha(t)); assert.doesNotMatch(JSON.stringify(W.files), new RegExp(t));
  // a session from before
  const old = `ms_session=${S.issue(ENV, 'maria', sha('maria-password-1'), S.account('maria', W.list.users.maria))}`;
  assert.deepEqual((await post(W, { reset: t, password: 'short' })).body, { error: 'Use a password of at least 10 characters.' });
  assert.deepEqual((await post(W, { reset: t, password: 'fred-password' })).body, { error: 'Choose another password.' });
  const ok = await post(W, { reset: t, password: 'maria-new-pass-2' }); assert.equal(ok.code, 200);
  assert.equal(W.list.users.maria.hash, sha('maria-new-pass-2')); assert.equal(W.list.users.maria.email, 'maria@example.com');
  assert.equal((await post(W, { reset: t, password: 'maria-new-pass-3' })).code, 400, 'used once');
  const m = res(); await me.handle({ method: 'GET', headers: { host: 'x.test', cookie: old } }, m, { env: ENV, deps: W.deps }); assert.equal(m.body.account, null, 'the old session has ended');
  // expiry
  W.t += 11 * 60e3; await post(W, { forgot: 'maria@example.com' }); const t2 = resetOf(W); W.t += 3600e3 + 1;
  assert.equal((await post(W, { reset: t2, password: 'maria-new-pass-4' })).code, 400);
  // bad tokens count as failed checks: 429 after ten from one IP
  for (let i = 0; i < 10; i++) await post(W, { reset: 'x'.repeat(43), password: 'whatever-123' }, {}, { ip: '10.5.5.5' });
  assert.equal((await post(W, { reset: 'x'.repeat(43), password: 'whatever-123' }, {}, { ip: '10.5.5.5' })).code, 429);
  // forgot is rate-limited per IP too, with the same words as every limit
  for (let i = 0; i < 5; i++) await post(W, { forgot: `n${i}@example.com` }, {}, { ip: '10.6.6.6' });
  assert.equal((await post(W, { forgot: 'n9@example.com' }, {}, { ip: '10.6.6.6' })).code, 429);
});

test('the email never reaches a non-owner: the source of publicRecord, the guest cut and the data endpoint', () => {
  assert.doesNotMatch(fs.readFileSync('api/_accounts.js', 'utf8').match(/function publicRecord[\s\S]*?\n}/)[0], /email/);
  for (const f of ['api/_guestcut.js', 'api/data.js', 'api/me.js', 'api/login.js']) assert.doesNotMatch(fs.readFileSync(f, 'utf8'), /\.email\b/, f);
  assert.doesNotMatch(fs.readFileSync('api/signup.js', 'utf8').match(/console\.(log|error)\([^)]*\)/g).join('\n'), /\$\{(?!role\})|\.email|\bemail\b,/, 'logs carry no address');
});

// ---- the senders ----

// a fake SMTP server behind the socket shape of cloudflare:sockets (readable / writable / close)
function fakeSmtp(o = {}) {
  const log = [], seen = { data: '' }; let ctl, mode = 'cmd', buf = '';
  const readable = new ReadableStream({ start(c) { ctl = c; c.enqueue(new TextEncoder().encode('220 smtp.fake ESMTP\r\n')); } });
  const say = (s) => ctl.enqueue(new TextEncoder().encode(s));
  const writable = new WritableStream({ write(chunk) {
    buf += new TextDecoder().decode(chunk);
    for (;;) {
      if (mode === 'data') { const i = buf.indexOf('\r\n.\r\n'); if (i < 0) return; seen.data = buf.slice(0, i); buf = buf.slice(i + 5); mode = 'cmd'; log.push('<message>'); say('250 2.0.0 OK queued\r\n'); continue; }
      const i = buf.indexOf('\r\n'); if (i < 0) return; const line = buf.slice(0, i); buf = buf.slice(i + 2); log.push(line);
      if (/^EHLO/.test(line)) say('250-smtp.fake\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n');
      else if (/^AUTH PLAIN/.test(line)) { seen.auth = Buffer.from(line.slice(11), 'base64').toString(); say(o.authFail ? '535 5.7.8 bad credentials\r\n' : '235 2.7.0 Accepted\r\n'); }
      else if (/^MAIL FROM/.test(line) || /^RCPT TO/.test(line)) say('250 OK\r\n');
      else if (line === 'DATA') { mode = 'data'; say('354 Go ahead\r\n'); }
      else if (line === 'QUIT') say('221 bye\r\n');
    } } });
  const connect = (addr, opts) => { seen.addr = addr; seen.opts = opts; return { readable, writable, close() { seen.closed = true; } }; };
  return { connect, log, seen };
}

test('SMTP: the dialogue in order, AUTH PLAIN, headers, dot-stuffing, implicit TLS on 465, the socket closed', async () => {
  const F = fakeSmtp();
  const r = await M.sendMail({ connect: F.connect, user: 'sender@example.com', pass: 'app-pass', to: 'maria@example.com', subject: 'Héllo', text: 'one\n.two\n..three\nend', now: Date.UTC(2026, 10, 17, 12) });
  assert.equal(r.ok, true);
  assert.deepEqual(F.log, ['EHLO aureumdesk.co.uk', `AUTH PLAIN ${Buffer.from('\u0000sender@example.com\u0000app-pass').toString('base64')}`, 'MAIL FROM:<sender@example.com>', 'RCPT TO:<maria@example.com>', 'DATA', '<message>', 'QUIT']);
  assert.deepEqual(F.seen.addr, { hostname: 'smtp.gmail.com', port: 465 }); assert.equal(F.seen.opts.secureTransport, 'on'); assert.ok(F.seen.closed);
  const msg = F.seen.data;
  assert.match(msg, /^From: "Aureum Desk" <sender@example\.com>\r\nTo: <maria@example\.com>\r\nSubject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\nDate: Tue, 17 Nov 2026 12:00:00 \+0000\r\nMessage-ID: <[^>]+@example\.com>\r\nMIME-Version: 1\.0\r\nContent-Type: text\/plain; charset=utf-8/);
  assert.match(msg, /\r\none\r\n\.\.two\r\n\.\.\.three\r\nend/, 'a line starting with a dot gets a second one');
  assert.doesNotMatch(msg, /[^\r]\n/, 'CRLF line ends only');
  // multipart with HTML
  const H = fakeSmtp(); await M.sendMail({ connect: H.connect, user: 'a@example.com', pass: 'p', to: 'b@example.com', subject: 's', text: 't', html: '<p>h</p>' });
  assert.match(H.seen.data, /multipart\/alternative; boundary="([^"]+)"[\s\S]*text\/plain[\s\S]*text\/html[\s\S]*<p>h<\/p>/);
});

test('SMTP: header injection refused; a refused AUTH and a silent server fail; no socket, no mail', async () => {
  const F = fakeSmtp();
  await assert.rejects(M.sendMail({ connect: F.connect, user: 'a@example.com', pass: 'p', to: 'b@example.com\r\nBcc: c@example.com', subject: 's', text: 't' }), /plain email address/);
  await assert.rejects(M.sendMail({ connect: F.connect, user: 'a@example.com', pass: 'p', to: 'b@example.com>, <c@example.com', subject: 's', text: 't' }), /plain email address/);
  const msg = M.build({ from: 'a@example.com', fromName: 'Evil\r\nBcc: x@example.com', to: 'b@example.com', subject: 'Hi\r\nBcc: x@example.com', text: 't' });
  assert.equal(msg.split('\r\n\r\n')[0].split('\r\n').filter((l) => /^Bcc:/i.test(l)).length, 0, 'no header line made from a name or subject');
  assert.match(msg, /^Subject: Hi Bcc: x@example\.com$/m);
  await assert.rejects(M.sendMail({ connect: fakeSmtp({ authFail: true }).connect, user: 'a@example.com', pass: 'p', to: 'b@example.com', subject: 's', text: 't' }), (e) => e.code === 535);
  const silent = () => ({ readable: new ReadableStream({}), writable: new WritableStream({}), close() {} });
  await assert.rejects(M.sendMail({ connect: silent, user: 'a@example.com', pass: 'p', to: 'b@example.com', subject: 's', text: 't', timeoutMs: 50 }), (e) => e.code === 'timeout');
  await assert.rejects(M.sendMail({ user: 'a@example.com', pass: 'p', to: 'b@example.com', subject: 's', text: 't' }), (e) => e.code === 'no-socket');
});

test('the senders: the Email Service binding first, from MAIL_FROM; Gmail when the binding is missing or fails; neither = off', async () => {
  const sent = [], binding = { async send(m) { sent.push(m); return { messageId: 'm1' }; } };
  const run = async (W, extra) => { const r = await post(W, { name: 'Maria', email: 'maria@example.com', password: 'maria-password-1' }, { send: undefined, ...extra }); return r; };
  // binding only: the site's address, default and from MAIL_FROM
  let W = world(); delete W.d; const base = world(); W = base;
  let r = await call(W, { method: 'POST', body: { name: 'Maria', username: 'maria', email: 'maria@example.com', password: 'maria-password-1' } }, { send: undefined, binding });
  assert.equal(r.code, 200); assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].from, { email: 'help@aureumdesk.co.uk', name: 'Aureum Desk' }); assert.equal(sent[0].to, 'maria@example.com'); assert.match(sent[0].text, /verify=/); assert.match(sent[0].html, /Confirm email address/);
  const W2 = world({ env: { ...ENV, MAIL_FROM: 'hello@aureumdesk.co.uk' } }); await run(W2, { binding }); assert.equal(sent[1].from.email, 'hello@aureumdesk.co.uk');
  // binding + Gmail: the binding is used; Gmail stays untouched
  const F = fakeSmtp(), W3 = world({ env: GMAIL }); await run(W3, { binding, connect: F.connect }); assert.equal(sent.length, 3); assert.equal(F.log.length, 0);
  // a binding that throws: one try through Gmail
  const F2 = fakeSmtp(), W4 = world({ env: GMAIL }), broken = { async send() { throw Object.assign(new Error('not onboarded'), { code: 'E_SENDER' }); } };
  assert.equal((await run(W4, { binding: broken, connect: F2.connect })).code, 200); assert.ok(F2.log.includes('<message>'));
  // Gmail only
  const F3 = fakeSmtp(), W5 = world({ env: GMAIL }); assert.equal((await run(W5, { binding: null, connect: F3.connect })).code, 200); assert.ok(F3.log.includes('<message>'));
  assert.match(F3.seen.data, /^From: "Aureum Desk" <sender@example\.com>/);
  // a binding that throws with no Gmail: the email could not be sent, nothing stored
  const W6 = world(); const r6 = await run(W6, { binding: broken, connect: null }); assert.equal(r6.code, 502); assert.equal(W6.files['signups/pending.json'], undefined);
  // neither: off
  assert.equal((await run(world({ env: GMAIL }), { binding: null, connect: null })).code, 503);
  // a binding refused before it is called (bad sender address) never reaches send
  const W7 = world({ env: { ...ENV, MAIL_FROM: 'bad address' } }); const n = sent.length; await run(W7, { binding }); assert.equal(sent.length, n);
});

test('wiring: the Worker routes the handler and hands in the socket and the binding; nothing under api/ imports the socket module', () => {
  const w = fs.readFileSync('cloudflare/src/worker.mjs', 'utf8');
  assert.match(w, /import signup from '\.\.\/\.\.\/api\/signup\.js'/); assert.match(w, /import \{ connect \} from 'cloudflare:sockets'/);
  assert.match(w, /signup\.useSmtp\(connect\)/); assert.match(w, /signup\.useMail\(env && env\.EMAIL\)/);
  for (const f of fs.readdirSync('api')) assert.doesNotMatch(fs.readFileSync(`api/${f}`, 'utf8'), /from 'cloudflare:|require\('cloudflare:/, f);
  assert.ok(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).functions['api/signup.js']);
  const wr = fs.readFileSync('cloudflare/wrangler.jsonc', 'utf8'); assert.doesNotMatch(wr, /GMAIL_APP_PASSWORD"\s*:/, 'no secret in the config');
});

test('page: the sign-in card offers both links and three panels; the panel script keeps nothing in the browser; the Users page lists requests', () => {
  const h = fs.readFileSync('market-structure.html', 'utf8');
  for (const id of ['ms-gate-su', 'ms-gate-fg', 'ms-gp-su', 'ms-gp-fg', 'ms-gp-rs', 'ms-gate-ban', 'ms-u-wait-card', 'ms-u-wait']) assert.match(h, new RegExp(`id="${id}"`), id);
  const js = h.match(/<script id="ms-su-js">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/, 'no token or password in browser storage');
  assert.match(js, /history\.replaceState/, 'the reset token leaves the address at once');
  assert.match(js, /'Sign-ups are not open yet\.'/);
  assert.doesNotMatch(js, /\bprompt\(|\balert\(|\bconfirm\(/, 'no native boxes');
  assert.match(h, /\.gate-lk \{[^}]*min-height: 44px[^}]*font: 500 14px/, '44 px targets, 14 px text');
  assert.match(h, /fetch\(window\.MS_API \+ 'signup\?list=1'/);
});

test('usernames (18 Nov 2026): required, 3-24 of a-z 0-9 -, reserved words refused, unique against members, built-ins and other requests; approval uses it; login by username or email', async () => {
  const W = world();
  for (const [u, m] of [[undefined, /username of 3 to 24/], ['ab', /username of 3 to 24/], ['-abc', /username of 3 to 24/], ['a b c', /username of 3 to 24/], ['owner', /kept for the desk/], ['Admin', /kept for the desk/]]) {
    const r = await call(W, { method: 'POST', body: { name: 'Zed', ...(u === undefined ? {} : { username: u }), email: 'zed@example.com', password: 'zed-password-1' } });
    assert.equal(r.code, 400); assert.match(r.body.error, m); }
  W.list = { users: { maria: { name: 'Maria', role: 'viewer', hash: sha('maria-password-1'), email: 'maria@example.com' } } };
  for (const u of ['maria', 'FRED']) { const r = await call(W, { method: 'POST', body: { name: 'Zed', username: u, email: 'zed@example.com', password: 'zed-password-1' } }); assert.equal(r.code, 409); assert.equal(r.body.field, 'username'); }
  assert.equal((await call(W, { method: 'POST', body: { name: 'Zed', username: 'Zed-1', email: 'zed@example.com', password: 'zed-password-1' } })).code, 200);
  const other = await call(W, { method: 'POST', body: { name: 'Zoe', username: 'zed-1', email: 'zoe@example.com', password: 'zoe-password-1' } });
  assert.equal(other.code, 409, 'a waiting request holds its username');
  const rec = W.files['signups/pending.json'].find((p) => p.email === 'zed@example.com'); assert.equal(rec.username, 'zed-1');
  const v = await call(W, { method: 'GET', query: { verify: linkOf(W) } }); assert.equal(v.code, 302);
  const L = await call(W, { method: 'GET', query: { list: '1' }, headers: { cookie: ownerCookie() } }); assert.equal(L.body.items[0].username, 'zed-1');
  const ap = await post(W, { approve: L.body.items[0].id }, {}, { headers: { cookie: ownerCookie() } }); assert.equal(ap.code, 200); assert.equal(ap.body.key, 'zed-1');
  assert.match(W.out[W.out.length - 1].text, /username "zed-1"/);
  const log = async (body) => { const r = res(); await login.handle({ method: 'POST', headers: { host: 'x.test' }, body }, r, { env: ENV, deps: W.deps }); return r; };
  assert.equal((await log({ id: 'Zed-1', password: 'zed-password-1' })).body.account.u, 'zed-1');
  assert.equal((await log({ id: ' ZED@example.com ', password: 'zed-password-1' })).body.account.u, 'zed-1');
  assert.equal((await log({ id: 'maria', password: 'zed-password-1' })).code, 401, 'right password, other account');
  assert.equal((await log({ id: 'nobody', password: 'zed-password-1' })).code, 401);
  assert.deepEqual((await log({ id: 'zed-1', password: 'wrong-password' })).body, (await log({ id: 'nobody', password: 'x' })).body, 'the same answer for every miss');
  assert.equal((await log({ id: 'owner', password: 'zed-password-1' })).code, 401);
  assert.equal((await log({ password: 'zed-password-1' })).code, 401, 'password only: built-in members and the owner alone');
  assert.equal((await log({ password: 'fred-password' })).body.account.u, 'fred', 'a built-in member signs in with the password alone');
  assert.equal((await log({ id: 'fred', password: 'fred-password' })).body.account.u, 'fred');
  // 19 Nov 2026 (owner: "macro should be able to login only with password"): the stored "macro" account signs in with the password
  // alone; its password is kept unique (a sign-up with it is refused); with a wrong password or as another stored member it is not
  W.list.users.macro = { name: 'Macro', role: 'viewer', hash: sha('macro-password-1') };
  assert.equal((await log({ password: 'macro-password-1' })).body.account.u, 'macro', 'macro: the password alone');
  assert.equal((await log({ id: 'macro', password: 'macro-password-1' })).body.account.u, 'macro', 'macro: with its username too');
  assert.equal((await log({ password: 'maria-password-1' })).code, 401, 'other stored members still need a username or email');
  const clash = await call(W, { method: 'POST', body: { name: 'Mac', username: 'mac-2', email: 'mac@example.com', password: 'macro-password-1' } });
  assert.equal(clash.code, 400); assert.match(clash.body.error, /another password/, 'a sign-up may not take the macro password');
});

test('every email shows the Aureum Desk logo from the site (a PNG with its size and alt text)', async () => {
  const W = world(); await join(W);
  const h = W.out[W.out.length - 1].html;
  assert.match(h, /<img src="https:\/\/aureumdesk\.co\.uk\/icons\/email-logo\.png" width="195" height="32" alt="Aureum Desk"/);
  assert.ok(fs.existsSync('icons/email-logo.png'));
});
