// Phone charts in an app look (28 Nov 2026): the dock, the Drawings sheet, the Analysis hub and the navy chart preset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const H = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const block = (id, tag) => { const a = H.indexOf(`<${tag} id="${id}">`); assert.ok(a > 0, id); return H.slice(a, H.indexOf(`</${tag}>`, a)); };
test('the app look is phone-only, simple view only, members only', () => {
  const css = block('ms-ps-css', 'style'), body = css.slice(css.indexOf('Phone charts in an app look'));
  // its rules live in the simple view's own block (#ms-ps-css, scoped and tested there); its parts carry .ps-only
  assert.ok(body.length > 2000 && body.includes('#ms-tvl') && body.includes('#ms-tvs'));
  assert.match(body, /\.sec-h \{ height: 0 !important;[^}]*visibility: hidden; \}/);   // folded, not removed: its popovers still open
  assert.match(body, /:is\(#ms-sty-pop, #ms-lay-pop\) \{ visibility: visible; \}/);
  assert.match(body, /\[data-role="public"\]\) #ms-wb \{/);
  const js = block('ms-tva-js', 'script');
  for (const v of ['left', 'right', 'sheet', 'fav']) assert.match(js, new RegExp(`${v}\\.className = 'ps-only'`));
});
test('the script presses the page\'s own controls, places no order and stores only a display preference', () => {
  const js = block('ms-tva-js', 'script');
  assert.doesNotMatch(js, /fetch\(|XMLHttpRequest|\/api\/|\border|\.stop\s*=/i);
  assert.deepEqual([...js.matchAll(/localStorage\.setItem\(([^,]+),/g)].map((m) => m[1]), ['FSK']);
  assert.match(js, /FSK = 'ms-tv-favshow'/);
  for (const id of ['ms-sty-btn', 'ms-ind-open', 'ms-sty-pop', 'ms-lay-btn', 'ms-mm-btn', 'ms-sty-clean', 'ms-dr-bar', 'ms-ch-one', 'ms-wb']) assert.ok(H.includes(`id="${id}"`) || H.includes(`'${id}'`), id);
  // its own data attributes never collide with the flags the page puts on <html> (data-ct, data-mode, data-role ...)
  for (const m of js.matchAll(/closest\('\[data-([a-z-]+)\]'\)/g)) assert.ok(/^tv/.test(m[1]), m[1]);
  assert.match(js, /window\.msRailFav\('dt:'/);   // favourites are the rail's own (ms-dr-fav)
});
test('the navy preset: in Style, and once per phone over the paper default only', () => {
  assert.match(H, /const NAVY = \{ bg: '#161b3f', up: '#5ac8fa', dn: '#2f6fe0', ln: '#5ac8fa', mono: false \};/);
  assert.match(H, /id="ms-sty-navy"/);
  assert.match(H, /ms-navy-v1[^\n]*max-width: 640px/);
  assert.match(H, /if \(!hexOk\(CUS\.bg\) \|\| \(CUS\.mono && CUS\.up === PAPER\.up && CUS\.dn === PAPER\.dn\)\)/);
});
