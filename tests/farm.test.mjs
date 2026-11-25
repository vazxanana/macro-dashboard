// node --test tests/farm.test.mjs: the Agent Farm page (25 Nov 2026): display only, signed-in members, built and routed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const page = read('farm.html');
test('the page is built, routed and offered as a home-screen shortcut', () => {
  assert.match(read('scripts/build.sh'), /farm\.html/);
  assert.match(read('vercel.json'), /"source": "\/farm"[\s\S]{0,40}"destination": "\/farm\.html"/);
  assert.match(read('app.webmanifest'), /"url": "\/farm#widget"/);
});
test('only a signed-in member sees it, and it reads research files only', () => {
  assert.match(page, /fetch\('\/api\/me'/);
  assert.match(page, /\$\('gate'\)\.hidden = false/);
  const urls = [...page.matchAll(/'\/cdata\/' \+ file/g)]; assert.equal(urls.length, 1);
  assert.match(page, /'research\/auto\/worker-'/);
  assert.ok(!/research\/auto\/(?!worker-)/.test(page));
});
test('display only: no order, broker, storage or post to the server', () => {
  for (const bad of [/method:\s*'(POST|PUT|DELETE)'/i, /localStorage|sessionStorage|indexedDB/, /ctrader|broker|placeOrder|\.stop\s*=/i, /eval\(|new Function/]) assert.ok(!bad.test(page), String(bad));
});
test('km per hour and the made-up scale are named on the page', () => {
  assert.match(page, /kmh = function \(d\) \{ return Math\.round\(d\.rate \* 3\.6\)/);
  assert.match(page, /one try is one metre/);
});
test('the jokes and the race change nothing in the research', () => {
  assert.match(page, /for fun only; they change nothing in the research/);
  assert.match(page, /Nothing here trades\./);
});
