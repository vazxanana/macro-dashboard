// node --test tests/users-perms.test.mjs — per-member permissions on the user list (api/users.js clean / cleanPerms)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { clean, cleanPerms } = createRequire(import.meta.url)('../api/users.js');
const H = 'a'.repeat(64);
test('perms are whitelisted keys with boolean values, ict false | read | write', () => {
  assert.deepEqual(cleanPerms({ charts: true, ict: 'read', mcp: false }), { charts: true, ict: 'read', mcp: false });
  assert.deepEqual(cleanPerms({ ict: true }), { ict: 'write' });
  assert.equal(cleanPerms({ charts: 'yes' }), null); assert.equal(cleanPerms({ admin: true }), null); assert.equal(cleanPerms({ ict: 'owner' }), null); assert.equal(cleanPerms([]), null); assert.equal(cleanPerms(undefined), null);
});
test('a record keeps ict / ct / mcp flags and perms; a bad perms object rejects the whole save', () => {
  const u = clean({ carlos: { name: 'Carlos', role: 'viewer', hash: H, ct: true, mcp: true, ict: 'read', perms: { charts: true, desks: false } } });
  assert.deepEqual(u.carlos, { name: 'Carlos', role: 'viewer', hash: H, ict: 'read', ct: true, mcp: true, perms: { charts: true, desks: false } });
  assert.equal(clean({ carlos: { name: 'Carlos', role: 'viewer', hash: H, perms: { nope: true } } }), null);
  assert.deepEqual(clean({ luxus: { name: 'Luxus', role: 'viewer', hash: H } }).luxus, { name: 'Luxus', role: 'viewer', hash: H });
});
