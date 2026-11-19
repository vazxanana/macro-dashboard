// Owner, 18 Nov 2026: "the first page for user macro will be the macro area not the desk".
// The server marks the account "macro" with home 'macro'; the Desk's first script sends it to /macro-desk once per tab.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../api/_session.js'), A = require('../api/_accounts.js');

test('the "macro" account carries home: macro; other members do not, and a stored home survives only as macro or mosha', () => {
  assert.equal(S.account('macro', { name: 'Macro', role: 'viewer' }).home, 'macro');
  assert.equal(S.account('carlos', { name: 'Carlos', role: 'viewer' }).home, undefined);
  assert.equal(A.publicRecord({ name: 'X', role: 'viewer', home: 'macro' }).home, 'macro');
  assert.equal(A.publicRecord({ name: 'X', role: 'viewer', home: 'users' }).home, undefined);
});

test('the Desk sends a macro-home member to the Macro desk once per tab, never a link to a view, never without the macro permission', () => {
  const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const line = page.split('\n').find((l) => l.includes("R.home === 'macro'"));
  assert.ok(line, 'the landing line is in the head script');
  assert.match(line, /E\.macro && !location\.hash/); assert.match(line, /sessionStorage\.getItem\('ms-landed'\)/); assert.match(line, /location\.replace\('\/macro-desk'\)/);
  assert.ok(page.indexOf("R.home === 'macro'") < page.indexOf('<body'), 'before the first paint');
});
