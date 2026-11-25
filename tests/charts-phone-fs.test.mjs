// Charts on a phone (20 Nov 2026, owner on an iPhone): the full-screen button is reachable, full screen works without the
// browser's Fullscreen API, and the Style panel stays on the screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');

test('the full-screen button hides only in the pane header on a phone, never in the chart toolbar', () => {
  assert.match(page, /@media \(max-width: 700px\) \{ \.ms-ph \.ch-fs \{ display: none; \} \}/);
  assert.doesNotMatch(page, /@media \(max-width: 700px\) \{ \.ch-fs \{ display: none; \} \}/);
  assert.match(page, /const TOOLS = \[[^\]]*'\.ch-fs'/);
});

test('one toggle: the browser full screen where it exists, else the page covers the screen with an exit button', () => {
  assert.match(page, /tl\.querySelector\('\.ch-fs'\)\.addEventListener\('click', \(\) => window\.msChartsFs && window\.msChartsFs\(\)\)/);
  const js = page.slice(page.indexOf('window.msChartsFs = '), page.indexOf('window.msChartsFsState'));
  assert.match(js, /vc\.requestFullscreen \|\| vc\.webkitRequestFullscreen/);
  assert.match(js, /if \(!req\) return fake\(true\)/);
  assert.match(js, /r\.catch\(\(\) => fake\(true\)\)/);
  const css = page.slice(page.indexOf('<style id="ms-cfs-css">'), page.indexOf('</style>', page.indexOf('<style id="ms-cfs-css">')));
  assert.match(css, /#v-charts\.ch-fake-fs \{ position: fixed; inset: 0; z-index: 900; height: 100dvh;/);
  assert.match(css, /:not\(\.ch-fs-x\):not\(\.ch-fs-tb\) \{ display: none !important; \}/, 'the exit button is not hidden with the rest');
  assert.doesNotMatch(css.replace(/:is\(#v-charts:fullscreen, #v-charts\.ch-fake-fs\)/g, ''), /#v-charts:fullscreen/, 'every full-screen rule also covers the page\'s own');
  assert.match(css, /\.ch-row > \.ch-col \{ flex: 1 1 auto; \}/, 'without the rail the chart column still takes the height');
});

test('the Style panel: a sheet across a phone, kept inside a wider screen', () => {
  assert.match(page, /@media \(max-width: 640px\) \{ \.sty-pop \{ position: fixed; left: 10px; right: 10px;[^}]*overflow-y: auto;/);
  assert.match(page, /const open = \(on\) => \{ pop\.hidden = !on; btn\.setAttribute\('aria-expanded', String\(on\)\); if \(on\) place\(\); \};/);
});

test('full screen: Exit and Hide toolbar buttons exist in both full screens and are not hidden with the rest', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /className = 'ch-fs-x'/); assert.match(html, /className = 'ch-fs-tb'/);
  assert.match(html, /document\.addEventListener\('fullscreenchange', bar\)/);
  assert.match(html, /#v-charts\.ch-fs-tb-off > \.sec-h \{ display: none !important; \}/);
});
