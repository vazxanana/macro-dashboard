// Macro desk design pass (20 Nov 2026): the rules the pass fixed, read from the page source. Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const rule = (sel) => { const i = css.indexOf(sel + ' {'); assert.ok(i >= 0, 'no rule for ' + sel); return css.slice(i, css.indexOf('}', i) + 1); };
const pass = css.slice(css.indexOf('Design pass (20 Nov 2026)'), css.indexOf('Simple phone view (11 Nov 2026'));
const simple = css.slice(css.indexOf('Simple phone view (11 Nov 2026'));

test('every custom property the stylesheet reads is one the page defines', () => {
  const def = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]));
  const missing = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1]).filter((v) => !def.has(v)))];
  assert.deepEqual(missing, [], 'undefined tokens: ' + missing.join(', '));
});

test('no token is read with a literal colour as its fallback', () => {
  const bad = [...css.matchAll(/var\(--[a-z0-9-]+\s*,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi)].map((m) => m[0]);
  assert.deepEqual(bad, []);
});

test('the red folder table: gain and loss in the page tokens, small print never dimmed by opacity', () => {
  assert.match(rule('.rf-t .up'), /color: var\(--buy\)/);
  assert.match(rule('.rf-t .dn'), /color: var\(--sell\)/);
  for (const sel of ['.rf-next .lab', '.rf-t caption', '.rf-t td small, .rf-t th small', '.res-doc']) { const r = rule(sel); assert.doesNotMatch(r, /opacity/, sel); assert.match(r, /color: var\(--ink-faint\)/, sel); }
});

test('week ahead: detail lines break in the frame too, day tiles are wells without a border, chips are tints', () => {
  assert.match(css, /\.wa \.wa-r \{ display: block; \}/);
  assert.doesNotMatch(css, /\.wa-day li \.wa-r \{/);
  assert.match(html, /<article class="card wa" id="c-ahead"/);   // the frame (#wa-frame-b) sits inside .wa
  const day = rule('.wa-day'); assert.doesNotMatch(day, /border:/); assert.match(day, /background: var\(--well\)/);
  assert.match(rule('.wa-day h3'), /font: 600 var\(--fs-md\)/);
  const chip = rule('.wa-chip'); assert.doesNotMatch(chip, /border:/);
  assert.match(rule('.wa-chip.pass'), /color-mix\(in srgb, var\(--buy\) 14%, var\(--panel\)\)/);
  assert.match(css, /\.wa-chip\.fail \{ color: var\(--sell\); background: color-mix\(in srgb, var\(--sell\) 14%, var\(--panel\)\); \}/);
});

test('daily reports: the summary box is a plain well with a sentence-case label, and the text keeps a readable measure', () => {
  const box = rule('.dr-ai'); assert.doesNotMatch(box, /border-left/); assert.match(box, /background: var\(--well\)/);
  assert.doesNotMatch(rule('.dr-ai b'), /uppercase|letter-spacing/);
  assert.match(pass, /\.dr-sec ul, \.dr-ai p, \.dr-ai-l \{ max-width: 88ch; \}/);
});

test('tabs never wrap a label; on a phone the red folder row scrolls inside itself', () => {
  assert.match(pass, /\.pl-tabs button \{ white-space: nowrap; \}/);
  const phone = pass.slice(pass.indexOf('@media (max-width: 640px)'));
  assert.match(phone, /\.rf-tabs \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/);
  assert.match(phone, /\.pl-tabs\.rf-tabs button \{ flex: none; \}/);
  // the chosen tab is brought into view by the row's own scroll position, never by scrolling the page
  assert.match(html, /rt\.scrollLeft = Math\.max\(0, rb\.offsetLeft - rt\.offsetLeft - 24\)/);
  assert.doesNotMatch(html.slice(html.indexOf('function renderRed'), html.indexOf('function renderAhead')), /scrollIntoView/);
});

test('the red folder "Show all" button does not float over the note', () => {
  assert.match(pass, /#c-red \.rf-all \{ float: none;/);
});

test('a table that scrolls sideways keeps its first column in place', () => {
  assert.match(pass, /\.tc-tw th:first-child, \.tc-tw td:first-child \{ position: sticky; left: 0;[^}]*background: var\(--panel\); \}/);
  assert.match(html, /class="tc-tw" role="region" tabindex="0"/);
});

test('touch targets: study links, source links and library documents are 44 px', () => {
  assert.match(pass, /@media \(pointer: coarse\) \{ \.wa-day li a, \.src h4 a \{[^}]*min-height: 44px; \} \.vlib-nav button \{ min-height: 44px; \} #news a \{ padding-block: 4px; \} \}/);
});

test('the pass adds nothing to the simple phone view block and never names its attribute', () => {
  assert.doesNotMatch(pass, /data-phone/);
  assert.doesNotMatch(simple, /wa-chip|tc-tw|dr-ai|rf-tabs \{/);
});

test('no text size under 12 px in the stylesheet', () => {
  const small = [...css.matchAll(/font(?:-size)?:[^;}]*?\b(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]).filter((n) => n < 12);
  assert.deepEqual(small, []);
});
