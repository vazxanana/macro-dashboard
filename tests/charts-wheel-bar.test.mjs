import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const js = page.match(/<script id="ms-wb-js">([\s\S]*?)<\/script>/)[1];
const css = page.match(/<style id="ms-wb-css">([\s\S]*?)<\/style>/)[1];

test('the wheel bar script parses and uses the page\'s own setters', () => {
  new Function(js);
  assert.match(js, /window\.msOneTf/); assert.match(js, /msTfGroups/); assert.match(js, /msMarkets/);
  assert.match(page, /window\.msMarkets = /);
});
test('it only draws and navigates: no order, stop or storage', () => {
  assert.doesNotMatch(js, /localStorage|sessionStorage|fetch\(|\.stop\s*=|placeOrder|\/api\//);
});
test('every rule is for a phone width and hidden for guests', () => {
  assert.match(css, /#ms-wb, #ms-wb-sheet \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\[data-role="public"\]\) #ms-wb \{ display: flex/);
  assert.ok(!/@media \(min-width/.test(css));
});
