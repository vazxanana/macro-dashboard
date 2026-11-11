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
test('perms.ictApply (10 Nov): a boolean in perms only; no record flag is stored; off unless the owner saves true', () => {
  assert.deepEqual(cleanPerms({ ict: 'write', ictApply: true }), { ict: 'write', ictApply: true }); assert.deepEqual(cleanPerms({ ictApply: false }), { ictApply: false });
  assert.equal(cleanPerms({ ictApply: 'yes' }), null); assert.equal(cleanPerms({ ictApply: 1 }), null);
  const u = clean({ fred: { name: 'Fred', role: 'reviewer', hash: H, ict: true, mcp: true, ictApply: true } });
  assert.deepEqual(u.fred, { name: 'Fred', role: 'reviewer', hash: H, ict: true, mcp: true }, 'a record-level flag is dropped: only perms.ictApply counts');
  assert.deepEqual(clean({ fred: { name: 'Fred', role: 'reviewer', hash: H, ict: true, perms: { ict: 'write', ictApply: true } } }).fred.perms, { ict: 'write', ictApply: true });
});

// ── Users page, quality pass (11 Nov 2026) ──
const fs = await import('node:fs');
test('Users page: a failed save names its reason, puts the table back, and keeps keyboard focus', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /ENDED = 'Not saved: your owner session has ended\. Sign in again and retry\.'/);
  assert.match(html, /if \(g\.status === 401 \|\| g\.status === 403\) throw new Error\(ENDED\);/, 'an ended session is not "check your connection"');
  assert.match(html, /if \(r\.status === 401 \|\| r\.status === 403\) throw new Error\(ENDED\);/);
  assert.match(html, /Not saved: you are offline\. Connect and try again\./);
  assert.match(html, /catch \(e\) \{ const t = e\.message \|\| String\(e\); if \(msg\) msg\.textContent = t; renderUsers\(true\);/, 'a role select no longer shows the role that was refused');
  assert.match(html, /function uRefocus\(\)/); assert.match(html, /US\.fk = \[ae\.closest\('tr'\)\.dataset\.u, ae\.dataset\.act \|\| ''\]; setTimeout\(uRefocus, 0\);/);
});
test('Users page: "Back to role defaults" asks first and names the built-in settings that come back', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /#ms-perm-reset'\)\.onclick = async \(\) => \{/);
  assert.match(html, /B\.ictApply && 'applying ICT changes without your review'/);
  assert.match(html, /if \(!\(await msConfirm\(`Clear every box set for \$\{cur\.name \|\| k\} and go back to what a \$\{cur\.role\} gets\?[^\n]*\{ title: 'Back to role defaults', ok: 'Clear and go back', danger: true \}\)\)\) return;\s*d\.close\(\); saveUsers\(/);
});
test('Users page: no model name in the page text, and the owner note says where the password really lives', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8'), view = /<section class="view own adm" id="v-users"[\s\S]*?<\/section>/.exec(html)[0];
  assert.doesNotMatch(view, /Claude|ChatGPT|page code/);
  assert.match(view, /Its password is changed in the server code \(api\/_accounts\.js\), not on this page\./);
});
