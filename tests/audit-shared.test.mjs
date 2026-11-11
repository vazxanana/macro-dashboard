// The browser audits' shared helper (scripts/audit/shared.cjs) and the two page faults their false failures came from
// (11 Nov 2026). Offline: no browser, no network (fetch is replaced).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const require = createRequire(import.meta.url);
const { measured, fetchRetry, SETTLE } = require('../scripts/audit/shared.cjs');

// a page whose evaluate() answers the settle call first, then the measurement
const page = (moving, reading) => { const calls = []; return { calls, evaluate: async (expr) => { calls.push(String(expr).slice(0, 12)); return calls.length === 1 ? moving : reading; } }; };

test('measured: waits for the page to settle, then reads once', async () => {
  const p = page([], { bad: ['2.10 button "Go"'], n: 40 });
  assert.deepEqual(await measured(p, 'EXPR'), ['2.10 button "Go"']);
  assert.equal(p.calls.length, 2);                                     // one settle, one reading: no second reading
  assert.deepEqual(await measured(page([], { bad: [], n: 3 }), 'EXPR'), []);
});

test('measured: a reading that measured nothing is a fault, not a pass', async () => {
  const out = await measured(page([], { bad: [], n: 0 }), 'EXPR', 'analytics text');
  assert.equal(out.length, 1); assert.match(out[0], /nothing was measured/); assert.match(out[0], /analytics text/);
});

test('measured: colours that never stop changing are a fault, and nothing is read from them', async () => {
  const p = page(['color on button#go'], { bad: [], n: 9 }), out = await measured(p, 'EXPR');
  assert.equal(out.length, 1); assert.match(out[0], /still changing/); assert.match(out[0], /button#go/);
  assert.equal(p.calls.length, 1);
});

test('measured: an expression in the old shape (a bare list) is refused', async () => {
  await assert.rejects(measured(page([], []), 'EXPR'), /\{ bad, n \}/);
});

test('the settle script parses and is a function of the time limit', () => {
  const f = new Function('return ' + SETTLE)();
  assert.equal(typeof f, 'function'); assert.equal(f.length, 1);
  assert.match(SETTLE, /getAnimations\(\)/); assert.match(SETTLE, /iterations !== Infinity/);   // an endless pulse is not waited for
});

test('fetchRetry: tries again on a network error and a 5xx, keeps a good answer, never keeps a failed one', async () => {
  const real = globalThis.fetch; let n = 0;
  const answer = (status, body) => ({ status, headers: { get: () => 'application/json' }, arrayBuffer: async () => Buffer.from(body) });
  try {
    globalThis.fetch = async () => { n++; if (n === 1) throw new Error('socket hang up'); if (n === 2) return answer(502, '{}'); return answer(200, '{"ok":1}'); };
    const a = await fetchRetry('https://example.test/a', { tries: 3 });
    assert.equal(a.status, 200); assert.equal(a.tries, 3); assert.equal(a.body.toString(), '{"ok":1}');
    const again = await fetchRetry('https://example.test/a'); assert.equal(n, 3); assert.equal(again.body.toString(), '{"ok":1}');   // kept for the run
    n = 0; globalThis.fetch = async () => { n++; throw new Error('down'); };
    const b = await fetchRetry('https://example.test/b', { tries: 2 }); assert.equal(b.status, 503); assert.equal(n, 2); assert.match(b.error, /down/);
    globalThis.fetch = async () => answer(200, 'back'); assert.equal((await fetchRetry('https://example.test/b')).status, 200);       // the failure was not kept
    globalThis.fetch = async () => answer(404, 'no'); assert.equal((await fetchRetry('https://example.test/c')).tries, 1);             // a 404 is an answer, not retried
  } finally { globalThis.fetch = real; }
});

test('every audit reads colours through the shared helper', () => {
  for (const f of ['scripts/audit/academy.cjs', 'scripts/audit/chronostrade.cjs']) {
    const s = src(f);
    assert.match(s, /require\('\.\/shared\.cjs'\)/, f); assert.match(s, /measured\(/, f);
    assert.doesNotMatch(s, /\.evaluate\(\s*CONTRAST/, f + ': a contrast reading outside measured()');
    assert.doesNotMatch(s, /evaluate\('\[' \+ CONTRAST/, f);
  }
  assert.doesNotMatch(src('scripts/audit/academy.cjs'), /fine 700 ms later/);   // the second reading is gone
  assert.doesNotMatch(src('scripts/audit/smoke.cjs'), /getComputedStyle\([^)]*\)\.(color|backgroundColor)/);   // the smoke test reads no colours
});

test('reduced motion starts no transition: 0s, never a tiny duration on every element', () => {
  // `* { transition-duration: .01ms }` gives every element a transition on every property; a theme change then runs down the
  // tree one level a frame and text keeps the old theme's colour on the new background for several frames
  const files = [...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')), ...fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => f.endsWith('.css')).map((f) => 'assets/' + f), 'scripts/veteran-library.html'];
  assert.ok(files.length > 8);
  for (const f of files) assert.doesNotMatch(src(f), /transition-duration:\s*0?\.0\d*ms/, f);
  for (const f of ['assets/mx-page.css', 'market-structure.html', 'edge-lab.html', 'gold-trading.html']) assert.match(src(f), /transition-duration: 0s !important/, f);
});

test('the Desk: a view change that skips the one before it leaves no rejected promise unhandled', () => {
  const s = src('market-structure.html'), calls = s.match(/document\.startViewTransition\([^\n]*/g) || [];
  assert.equal(calls.length, 1);                                  // one handler (the trade-link fix of the same day wrote it)
  assert.match(calls[0], /t\.ready\.catch\(/);
  // finally() hands a rejection on to a new promise: that one must be handled too
  assert.ok(!/finished\.finally\(/.test(calls[0]) || /finished\.finally\([^\n]*?\}\)\.catch\(/.test(calls[0]));
  assert.match(src('scripts/audit/smoke.cjs'), /views changed back to back/);
  assert.match(src('scripts/audit/smoke.cjs'), /the view did not open/);
});
