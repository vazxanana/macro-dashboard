// 9 Nov audit: guards for defects found in the browser at 390px and with the price feeds down.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ms = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const md = readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const tv = readFileSync(new URL('../api/tv-webhook.js', import.meta.url), 'utf8');

test('desk header fits a 390px phone (account menu reachable)', () => {
  assert.match(ms, /@media \(max-width: 430px\) \{ \.top-actions \{ --tap: 40px; \}[^\n]*#ms-focus-btn \{ display: none !important; \}[^\n]*\.desk-sw a \{ padding: 0 10px; \}/);
});

test('macro desk switcher collapses to dots on phones', () => {
  assert.match(md, /@media \(max-width: 760px\) \{ \.hdr-sw a span \{ display: none; \}/);
  assert.match(md, /\.ch td:first-child \{ white-space: normal; \}/);
});

test('home headline leaves "Loading live candles" when the feeds fail', () => {
  const i = ms.indexOf("'No live candles: the price feeds could not be reached from this page.'");
  assert.ok(i > 0);
  assert.match(ms.slice(i, i + 600), /getElementById\('h-head'\)[^\n]*textContent = 'Live prices are not reachable right now'/);
});

test('tv-webhook owner check is constant time, length capped and null-body safe', () => {
  // 9 Nov hardening: the null-body check comes first, then the shared password-guess limit (api/_guard.js), then the compare
  assert.match(tv, /if \(!b \|\| !b\.ownerPw\) return res\.status\(403\)/);
  assert.match(tv, /String\(b\.ownerPw\)\.length <= 200 && eq\(/);
});
