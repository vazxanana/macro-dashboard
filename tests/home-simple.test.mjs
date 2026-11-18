// Simpler Home (17 Nov 2026, owner: "Simpler home page, and improve the design"): from 641 px Home leads with one sentence,
// two columns (open now | waiting on you), the places, then ONE closed disclosure holding everything Home showed before.
// The phone (both views) is the page as it was: the new parts are never drawn up to 640 px and the wrapper is display: contents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DESK = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const HOME = DESK.slice(DESK.indexOf('<section class="view" id="v-home"'), DESK.indexOf('<!-- ─── Setup: checklist'));
const CSS = DESK.match(/<style id="ms-hs-css">([\s\S]*?)<\/style>/)[1];
const JS = DESK.match(/<script id="ms-hs-js">([\s\S]*?)<\/script>/)[1];

test('simpler Home: the answer, the two columns, the places and one closed disclosure', () => {
  const hs = HOME.indexOf('id="hs-home"'), more = HOME.indexOf('id="hs-more-b"');
  assert.ok(hs > 0 && more > hs, 'the answer block comes first, the old Home after it');
  assert.match(HOME, /<div class="hs-only hs-home" id="hs-home">\s*<header class="hs-head">[^]*?<h1 class="hs-a" id="hs-a">/, 'one sentence as the page title');
  assert.match(HOME, /Forward paper record of the main systems, before costs\. Backtest replays are not counted here\./, 'the basis is said: forward, before costs, no replay');
  assert.match(HOME, /<section class="hs-card hs-open" aria-labelledby="hs-o-k">[^]*?<ul class="hs-rows" id="hs-o-list"[^]*?<div class="hs-sh" id="hs-sh" hidden>[^]*?Shadow, followed on paper/, 'our open trades, the shadow ones in their own list');
  assert.match(HOME, /<section class="hs-card hs-need adm" aria-labelledby="hs-n-k">/, 'what waits is gated like the phone\'s #ps-need');
  assert.match(CSS, /html\[data-role="viewer"\] #v-home \.hs-need \{ display: none; \}/, 'and hidden for viewers');
  const go = HOME.match(/<nav class="hs-go" id="hs-go" aria-label="Places">([^]*?)<\/nav>/)[1];
  assert.deepEqual([...go.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Charts', 'Council', 'Desks', 'Macro desk', 'ChronosTrade']);
  assert.match(go, /class="dsk" data-desks/, 'Desks keeps the desks gate and the last-desk link');
  assert.match(CSS, /html\[data-deny~="charts"\] #v-home \.hs-go \[data-hs="charts"\], html\[data-deny~="macro"\] #v-home \.hs-go \[data-hs="macro"\] \{ display: none; \}/);
  // one disclosure, closed, and everything Home had is inside it (folded, not removed)
  assert.equal((HOME.match(/class="hs-more-t"/g) || []).length, 1);
  assert.match(HOME, /<button type="button" class="hs-more-t" id="hs-more-t" aria-expanded="false" aria-controls="hs-more-b"><span>More on the desk<\/span>/);
  const inside = HOME.slice(more);
  for (const id of ['h-head', 'h-today', 'h-mk', 'h-act-list', 'h-ring', 'h-ready', 'h-council', 'h-pulse', 'ps-home', 'ps-need', 'h-warn']) assert.ok(inside.includes(`id="${id}"`), `${id} is still on Home, inside the disclosure`);
  assert.match(inside, /<nav class="h-quick"/);
});

test('simpler Home: nothing of it is drawn on a phone, and the old Home is folded only from 641 px', () => {
  const before = CSS.slice(0, CSS.indexOf('@media (min-width: 641px)'));
  assert.equal(before.replace(/\/\*[^]*?\*\//g, '').replace(/\s+/g, ' ').trim(), '.hs-only { display: none; } .hs-more-b { display: contents; }');
  assert.match(CSS, /#v-home:not\(\.hs-open\) \.hs-more-b \{ display: none; \}/);
  assert.match(CSS, /html:not\(\[data-role="public"\]\) #v-home \.hs-home \{ display: grid;/, 'never for a guest');
  assert.doesNotMatch(CSS, /data-phone|\.ps-/, 'the simple phone view is styled in #ms-ps-css only');
  assert.doesNotMatch(CSS, /#[0-9a-f]{3,8}\b/i, 'tokens only');
  for (const m of CSS.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `text under 12 px: ${m[0]}`);
  assert.match(CSS, /@media \(pointer: coarse\) \{ #v-home :is\(\.hs-go a, \.hs-link\) \{ min-height: 44px;/);
  assert.doesNotMatch(CSS, /infinite/);
  // the desktop order rules of the old Home follow it into the wrapper
  assert.match(DESK, /#v-home \.hs-more-b > \.h-mk \{ order: 2; \}/);
});

test('simpler Home: the script reuses MS_PS, fetches nothing, keeps ours and shadow apart', () => {
  assert.doesNotMatch(JS, /\bfetch\(|msData|XMLHttpRequest|localStorage/);
  for (const f of ['P.answer(', 'P.openRows(', 'P.rowHTML', 'P.needs(']) assert.ok(JS.includes(f), f);
  // run it against fake page state
  const el = () => ({ _h: null, innerHTML: '', textContent: '', hidden: false, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, addEventListener() {}, classList: { contains: () => false, toggle() {} } });
  const ids = {}; ['v-home', 'hs-home', 'hs-a', 'hs-s-w', 'hs-o-list', 'hs-o-n', 'hs-sh', 'hs-sh-list', 'hs-sh-n', 'hs-o-all', 'hs-need-list', 'hs-need-n', 'hs-need-go', 'hs-date', 'hs-warn', 'hs-more-s', 'hs-more-t', 'h-date', 'h-clock', 'h-head', 'h-warn'].forEach((k) => { ids[k] = el(); });
  ids['h-head'].textContent = 'Gold is in a sell setup';
  const P = { answer: (T) => ({ head: 'Today: +0.40R', sub: 'This week +0.40R.' }), openRows: (items) => items, rowHTML: (g) => `<li>${g.x.label}${g.sh ? ' shadow' : ''}</li>`, needs: () => ['make scalp live'], rT: (v) => v.toFixed(2) + 'R' };
  const w = { MS_PS: P, MS_TODAY: { D: {}, W: {} }, MS_WHO: 'owner', MS_COUNCIL: { at: 1 },
    MS_LIVE: { items: [{ x: { label: 'XAU/USD' }, sh: false, n: 1 }, { x: { label: 'EUR/USD' }, sh: true, n: 2 }] }, FLOAT: { open: 1, sh: 2, liveTot: 0.5, tot: 1.5 } };
  vm.runInNewContext(JS, { window: w, document: { getElementById: (k) => ids[k] || null, addEventListener() {} }, setTimeout() {}, MutationObserver: undefined, Date, String, Math, parseInt, Object, Event: class {} });
  assert.equal(ids['hs-a'].innerHTML, 'Today: +0.40R');
  assert.equal(ids['hs-o-list'].innerHTML, '<li>XAU/USD</li>', 'ours only in the first list');
  assert.equal(ids['hs-sh-list'].innerHTML, '<li>EUR/USD</li>', 'the shadow rows in their own list');
  assert.match(ids['hs-o-n'].innerHTML, /^1 trade · floating <b class="pos">0\.50R<\/b>$/);
  assert.match(ids['hs-sh-n'].innerHTML, /^2 trades · floating <b class="pos">1\.00R<\/b>$/, 'shadow floating = total less ours, never one figure');
  assert.equal(ids['hs-need-list'].innerHTML, '<li>Make scalp live</li>');
  assert.match(ids['hs-more-s'].innerHTML, /^Gold is in a sell setup · /);
});
