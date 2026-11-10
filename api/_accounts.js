// Accounts, server side only (9 Nov 2026 security fix: the page used to carry the built-in users and their password hashes,
// and a hash worked as a session). The browser never sees a hash now: it signs in through /api/login and holds an HttpOnly
// session cookie (api/_session.js). Files starting with "_" under api/ are modules, not endpoints.
//
// Who can sign in: the owner (OWNER_HASH), the built-in members below, and members added or changed on the Users page (private
// Vercel Blob list users/…json, which overrides the built-ins key by key; `disabled: true` removes one). The list fails closed:
// when it cannot be read, nobody but the owner gets in (a removed built-in member never comes back on a Blob error).
const crypto = require('node:crypto');

const OWNER_HASH = '49c5624f2625ed8b42b6e1bf2819a3a41ddb9743aeca36ea34ea7eb96c252ca8';   // sha256 of the owner's password
// Built-in members (moved here from the page's window.MS_USERS). role: viewer | reviewer; ict: true (write) | 'read'; ct: demo
// accounts' results (labels only); mcp: ChatGPT connector on the profile. The Users page can override any field or disable one.
// No built-in record carries an apply flag: applying ICT changes without the owner's review (api/mcp.js canApply) is OFF for
// everyone until the owner ticks the box on the Users page (a stored perms.ictApply: true) and lists the name in
// council/ict-apply.json. tests/mcp-apply.test.mjs pins that.
const BUILT_IN = Object.freeze({
  fred: { name: 'Fred', hash: '370aed697dc503aecee7d8faad5de775f4f7019c86e672e8d93f3df590527058', role: 'reviewer', ict: true, ct: true, mcp: true },
  orlando: { name: 'Orlando', hash: '037617a451df6fb39614002d57502a5f7bc240221b1715ed48280534cc478a06', role: 'reviewer', ict: 'read', ct: true },
  luxus: { name: 'Luxus', hash: 'dccc5d01dabcd1c0b9fa89c91e7f4bde603121ee0172b4ff394e6bb30d295e41', role: 'viewer' },
  carlos: { name: 'Carlos', hash: '511d45febaa8559a9071091951613e559f0b8b12b3995e6c13c94c81fbee59f0', role: 'viewer', ct: true },
});
const KEY_RE = /^[a-z0-9-]{1,24}$/;
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
// constant-time compare of two hex hashes (false for anything that is not a 64-char hex string)
const same = (a, b) => /^[0-9a-f]{64}$/.test(String(a)) && /^[0-9a-f]{64}$/.test(String(b)) && crypto.timingSafeEqual(Buffer.from(String(a)), Buffer.from(String(b)));
const builtInUsers = () => JSON.parse(JSON.stringify(BUILT_IN));

// the stored list: the newest Blob users/…json, else council-data users.json (first run, read straight from GitHub on the
// server). Throws when a list exists but cannot be read; null only when there is none at all.
async function blobUsers(env, io = {}) {
  const list = io.list || ((...a) => require('@vercel/blob').list(...a)), fetchFn = io.fetch || fetch, token = env.BLOB_READ_WRITE_TOKEN;
  const { blobs } = await list({ prefix: 'users/', token }); blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  if (blobs.length) {
    const r = await fetchFn(blobs[0].url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`users blob ${r.status}`);
    return r.json();
  }
  const readFile = io.readFile || require('./data.js').readFile;
  const r = await readFile('users.json', env);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`users.json ${r.status}`);
  return JSON.parse(r.buf.toString('utf8'));
}
// built-in users overridden by the stored list, disabled ones removed. deps: { blobUsers: async () => list, builtIns? }.
// Fails closed: if the list cannot be read it throws (status 503), never falling back to the built-ins alone.
async function userList(deps) {
  const users = Object.assign(Object.create(null), deps.builtIns ? JSON.parse(JSON.stringify(deps.builtIns)) : builtInUsers());
  let r; try { r = await deps.blobUsers(); } catch (e) { const err = new Error('the user list could not be read'); err.status = 503; throw err; }
  for (const [k, u] of Object.entries((r && r.users) || {})) { if (u && u.disabled) delete users[k]; else users[k] = u; }
  delete users.owner;   // reserved: "owner" is never a member key
  return users;
}
// what the page may know about an account: never the hash
function publicRecord(R) {
  if (!R) return null;
  const out = { name: String(R.name || ''), role: R.role };
  if (R.ict) out.ict = R.ict === 'read' ? 'read' : true; if (R.ct) out.ct = true; if (R.mcp) out.mcp = true;
  if (R.perms && typeof R.perms === 'object') out.perms = R.perms; if (R.disabled) out.disabled = true;
  return out;
}
const stripHashes = (users) => { const out = {}; for (const [k, u] of Object.entries(users || {})) out[k] = publicRecord(u); return out; };

module.exports = { OWNER_HASH, BUILT_IN, KEY_RE, sha, same, builtInUsers, blobUsers, userList, publicRecord, stripHashes };
