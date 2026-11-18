// The signed-in screen (18 Nov 2026): both sign-in paths (password, passkey) play msGateWelcome before the reload, the
// screen sits inside the card, names the account only as text, and has a reduced-motion end state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const H = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
test('gate welcome: markup, both paths, reduced motion, text only, the photo from the account\'s own profile', () => {
  assert.match(H, /<div class="gate-ok" id="ms-gate-ok" hidden>/);
  assert.equal((H.match(/window\.msGateWelcome \? window\.msGateWelcome\(j\.account\) : Promise\.resolve\(\)\)\.then\(function \(\) \{ location\.reload\(\); \}\)/g) || []).length, 2);
  const css = H.slice(H.indexOf('<style id="ms-gate-ok-css">'), H.indexOf('</style>', H.indexOf('<style id="ms-gate-ok-css">')));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /infinite/);
  const js = H.slice(H.indexOf('<script id="ms-gate-ok-js">'), H.indexOf('</script>', H.indexOf('<script id="ms-gate-ok-js">')));
  assert.doesNotMatch(js, /innerHTML|localStorage\.setItem|method: 'POST'/);
  assert.equal((js.match(/fetch\(/g) || []).length, 1, 'one read: the account\'s own profile');
  assert.match(js, /fetch\(window\.MS_API \+ 'profile'/);
  assert.match(js, /data:image\\\/\(jpeg\|png\|webp\);base64,/, 'a photo is a data: image only');
  assert.match(js, /catch \(e\) \{ done\(\); \}/);
});

test('sign-in by email or username (18 Nov 2026): the card asks for both, the page sends id, sign-up asks for a username', () => {
  assert.match(H, /<label for="ms-gate-u">Email or username<\/label>/);
  assert.match(H, /id="ms-gate-u"[^>]*autocomplete="username"/);
  assert.match(H, /JSON\.stringify\(uid \? \{ id: uid, password: pw \} : \{ password: pw \}\)/);
  assert.match(H, /<label for="ms-su-u">Username<\/label>/);
  assert.match(H, /username: \$\('ms-su-u'\)\.value\.trim\(\)\.toLowerCase\(\)/);
});
