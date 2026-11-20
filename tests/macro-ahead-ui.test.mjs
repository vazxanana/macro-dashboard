// Macro desk, Week ahead: the browser quality pass of 20 Nov 2026 pinned on the page source (offline).
// Found at 390 px touch and 1440 px in dark / light / midnight: the frame's lines ran together ("decisionKalshi:"), the
// study links were 16 px tall on touch, and a study link or verdict from the file reached an href / class unchecked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const block = md.slice(md.indexOf('var WA_DAY'), md.indexOf('function renderNext'));
const css = md.slice(md.indexOf('/* Week ahead (20 Nov 2026) */'), md.indexOf('.wa-quiet'));

test('every Week ahead line part is its own line, in the days and in the frame', () => {
  assert.match(css, /\.wa-day li \.wa-r, \.wa \.wa-r \{ display: block; \}/);
  assert.ok(md.includes('<article class="card wa" id="c-ahead"'));
});

test('a study link is 44 px tall on touch, and only ever a page of this site', () => {
  assert.match(css, /@media \(pointer: coarse\) \{ \.wa a\.wa-st \{[^}]*min-height: 44px/);
  const src = block.match(/var WA_HREF = (function[^;]+;[^;]+;\s*\})/);
  assert.ok(src, 'WA_HREF defined');
  const WA_HREF = new Function('return ' + src[1])();
  assert.equal(WA_HREF('/edge-lab.html#gold-pre-holiday'), '/edge-lab.html#gold-pre-holiday');
  assert.equal(WA_HREF('edge-lab.html#gotobi'), '/edge-lab.html#gotobi');
  for (const bad of ['//evil.example/x', '/evil.example/x', 'javascript:alert(1)', 'https://evil.example/', '/edge-lab.html#a"b', '']) assert.equal(WA_HREF(bad), '', bad);
  assert.ok(!/href="\/' \+ esc\(r\.link\)/.test(block), 'no unchecked study link');
  assert.ok(block.includes("WA_HREF(r.link) ? '<span class=\"wa-r\"><a class=\"wa-st\" href=\"' + esc(WA_HREF(r.link))"));
});

test('a verdict from the file becomes a class only when it is one of the three known ones', () => {
  assert.ok(!/wa-chip ' \+ esc\(r\.verdict\)/.test(block));
  assert.ok(block.includes("(WA_V[r.verdict] ? ' ' + r.verdict : '')"));
});

test('Week ahead text sizes stay at 12 px or more', () => {
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px\/[\d.]+ var\(--sans\)|font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
});
