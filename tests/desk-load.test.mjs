// Desk load (11 Nov 2026): one request per council-data file, late loading, a steady first screen. Offline.
//   - window.msData (the block between the ms-data markers in market-structure.html) run with a fake fetch and clock
//   - scripts/hoist-styles.mjs (build step: the body's <style> blocks go to the end of the head, order kept)
//   - the page's wiring: every council-data reader goes through msData, the app sleeps under the first-load sign-in card,
//     the first screen holds its place
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { hoist } from '../scripts/hoist-styles.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'market-structure.html'), 'utf8');
const require = createRequire(import.meta.url);

// the helper, lifted out of the page and run in a fake window
function make({ mode = 'admin', api = 'https://x/api/', answers = {} } = {}) {
  const a = PAGE.indexOf('/* ms-data:start */'), b = PAGE.indexOf('/* ms-data:end */');
  assert.ok(a > 0 && b > a, 'the ms-data block is in the page');
  const calls = [], timers = [], clock = { t: 1_800_000_000_000 };
  const W = { MS_CDATA: 'https://x/cdata/', MS_API: api, document: { documentElement: { dataset: { mode } } }, setTimeout: (f, ms) => { timers.push({ f, at: clock.t + ms }); },
    fetch: (url, opt) => { const file = url.slice(W.MS_CDATA.length).replace(/\?.*$/, ''); const c = { url, opt, file }; calls.push(c);
      return new Promise((res, rej) => { c.answer = (body, ok = true) => res({ ok, text: async () => body }); c.fail = () => rej(new Error('offline')); if (file in answers) c.answer(answers[file]); }); } };
  const window = {}; new Function('window', PAGE.slice(a, b))(window);
  const D = window.msDataMake(W, () => clock.t);
  const tick = (ms) => { clock.t += ms; for (const x of timers.splice(0)) (x.at <= clock.t ? x.f() : timers.push(x)); };
  return { D, W, calls, clock, tick };
}

test('msData: readers that ask for the same file while it loads share one request', async () => {
  const { D, calls } = make();
  const p1 = D.json('trades.json'), p2 = D.json('trades.json'), p3 = D.text('trades.json');
  assert.equal(calls.length, 1);
  // a signed-in member asks under his own address (&m=1, 11 Nov guest cut): the shared cache's guest copy is never his answer
  assert.match(calls[0].url, /^https:\/\/x\/cdata\/trades\.json\?v=\d+&m=1$/);
  assert.equal(calls[0].url, 'https://x/cdata/trades.json?v=' + Math.floor(1_800_000_000_000 / 60000) + '&m=1', 'the cache-buster changes once a minute');
  { const g = make({ mode: 'public' }); g.D.json('trades.json'); assert.equal(g.calls[0].url, 'https://x/cdata/trades.json?v=' + Math.floor(1_800_000_000_000 / 60000), 'a visitor asks the plain, publicly cached address'); }
  { const g = make({ mode: 'admin', api: '' }); g.D.json('trades.json'); assert.doesNotMatch(g.calls[0].url, /m=1/, 'no mark on the raw GitHub copy'); }
  assert.deepEqual(calls[0].opt, { cache: 'no-store' });
  calls[0].answer('[{"id":"a","R":1}]');
  const [a, b, t] = await Promise.all([p1, p2, p3]);
  assert.deepEqual(a, [{ id: 'a', R: 1 }]); assert.equal(t, '[{"id":"a","R":1}]');
  assert.notEqual(a, b, 'each reader has its own parsed copy');
  a[0].R = 99; assert.equal(b[0].R, 1, 'one reader cannot change what another sees');
});

test('msData: a finished read is reused for 45 s, then asked for again (every refresh timer still gets new data)', async () => {
  const { D, calls, tick } = make({ answers: { 'snapshot.json': '{"n":1}' } });
  await D.json('snapshot.json'); tick(44_000); await D.json('snapshot.json');
  assert.equal(calls.length, 1, 'inside 45 s: no new request');
  tick(2_000); await D.json('snapshot.json');
  assert.equal(calls.length, 2, 'after 45 s: a new request');
  tick(60_000); await D.json('snapshot.json');
  assert.equal(calls.length, 3, 'the shortest refresh timer on the page is a minute: it always reads again');
  assert.notEqual(calls[1].url, calls[2].url, 'a minute later the cache-buster is a new one');
});

test('msData: { fresh: 0 } always reads again but still shares a request in flight; a longer wish is capped', async () => {
  const { D, calls, tick } = make({ answers: { 'ict/desk.json': '{}', 'coach.json': '{}' } });
  await D.json('ict/desk.json', { fresh: 0 }); await D.json('ict/desk.json', { fresh: 0 });
  assert.equal(calls.length, 2);
  const a = D.json('ict/trades.json', { fresh: 0 }), b = D.json('ict/trades.json', { fresh: 0 });
  assert.equal(calls.length, 3, 'in flight: shared'); calls[2].answer('[]'); await Promise.all([a, b]);
  await D.json('coach.json'); tick(50_000); await D.json('coach.json', { fresh: 3_600_000 });
  assert.equal(calls.filter((c) => c.file === 'coach.json').length, 2, 'no reader can keep a file longer than the default');
});

test('msData: the ICT replay record (written once a day, 2 MB) is reused for ten minutes', async () => {
  const { D, calls, tick } = make({ answers: { 'ict/replay.json': '{"totals":{"n":1}}' } });
  await D.json('ict/replay.json'); tick(9 * 60_000); await D.json('ict/replay.json');
  assert.equal(calls.length, 1);
  tick(61_000); await D.json('ict/replay.json');
  assert.equal(calls.length, 2);
});

test('msData: a failed read answers null and is never reused', async () => {
  const { D, calls } = make();
  const p = D.json('health.json'); calls[0].answer('{"error":"x"}', false); assert.equal(await p, null);
  const q = D.json('health.json'); assert.equal(calls.length, 2, 'asked again at once'); calls[1].fail(); assert.equal(await q, null);
  const r = D.json('health.json'); calls[2].answer('not json'); assert.equal(await r, null, 'a file that does not parse is null, as before');
  const t = D.text('health.json'); assert.equal(calls.length, 3, 'the text was read fine and is shared'); assert.equal(await t, 'not json');
});

test('msData: the text is dropped from memory once it can no longer be reused', async () => {
  const { D, calls, tick } = make({ answers: { 'trades.json': '[]' } });
  await D.text('trades.json'); tick(45_000); await D.text('trades.json');
  assert.equal(calls.length, 2);
});

test('msData: a visitor who is not signed in is only ever asked the guest allowlist of api/data.js', async () => {
  const { GUEST_OK } = require('../api/data.js');
  const { D, calls } = make({ mode: 'public', answers: { 'trades.json': '[]' } });
  assert.deepEqual([...D.GUEST].sort(), [...GUEST_OK].sort(), 'the page list is the server list');
  for (const f of ['config.json', 'coach.json', 'ict/trades.json', 'ict/desk.json', 'macro/forecast.json', 'ctrader/accounts.json', 'reviews/losses.json', 'users.json', '']) {
    assert.equal(await D.json(f), null, f); assert.equal(await D.text(f), null, f); }
  assert.equal(calls.length, 0, 'nothing outside the list was requested');
  D.warm(['trades.json', 'config.json']); assert.deepEqual(calls.map((c) => c.file), ['trades.json']);
  for (const f of GUEST_OK) assert.equal(D.allowed(f), true, f);
  // signed in: every file
  const m = make({ mode: 'admin', answers: { 'config.json': '{}' } }); assert.deepEqual(await m.D.json('config.json'), {});
  // GitHub Pages / local copy (no API, the public branch is read directly): as before, no list
  const g = make({ mode: 'public', api: null, answers: { 'config.json': '{}' } }); assert.deepEqual(await g.D.json('config.json'), {});
});

test('page: every council-data reader goes through msData', () => {
  // the only direct fetches left: files nobody else reads, behind a button or a desk of their own
  const REST = PAGE.slice(0, PAGE.indexOf('/* ms-data:start */')) + PAGE.slice(PAGE.indexOf('/* ms-data:end */'));   // the helper's own fetch is the one request
  const direct = [...REST.matchAll(/fetch\([^\n]{0,60}MS_CDATA[^\n]{0,60}/g)].map((m) => m[0]);
  const LEFT = ['mt5/signals.csv', 'ctrader/accounts.json', 'ctrader/account.json', 'lit/replay.json'];
  for (const d of direct) assert.ok(LEFT.some((f) => d.includes(f)), 'direct council-data fetch: ' + d);
  assert.equal(direct.length, LEFT.length);
  assert.ok(!/fetch\(\s*(`\$\{CDATA\}|CDATA \+|ROOT \+|base \+ f)/.test(PAGE), 'no reader builds its own council-data URL');
  for (const f of ['trades.json', 'snapshot.json', 'ict/replay.json']) assert.ok(!new RegExp(`fetch\\([^\\n]*${f.replace(/[./]/g, '\\$&')}`).test(PAGE), f + ' is never fetched directly');
  assert.match(PAGE, /const get = \(f, json\) => PUB && window\.MS_API && !GUEST_FILES\.includes\(f\) \? Promise\.resolve\(null\) : json \? window\.msData\.json\(f\) : window\.msData\.text\(f\);/);
  assert.match(PAGE, /const GUEST_FILES = \['trades\.json', 'snapshot\.json', 'research\/replay-2w\.json', 'research\.json'\];/);
  assert.match(PAGE, /const get = \(f\) => window\.msData\.json\('ict\/' \+ f, f === 'replay\.json' \? null : \{ fresh: 0 \}\);/, 'the ICT desk reads its own files again every time');
});

test('page: the first screen asks only for what it shows, and the council draws the home strip before the other ten files', () => {
  const warm = PAGE.match(/window\.msData\.warm\(window\.msBootGate \? (\[[^\]]*\]) : (\[[^\]]*\])\);/);
  assert.ok(warm, 'the early request line');
  assert.deepEqual(JSON.parse(warm[1].replace(/'/g, '"')), ['trades.json', 'snapshot.json']);
  assert.deepEqual(JSON.parse(warm[2].replace(/'/g, '"')), ['trades.json', 'snapshot.json', 'research/replay-2w.json', 'research.json']);
  const { GUEST_OK } = require('../api/data.js');
  for (const f of JSON.parse(warm[2].replace(/'/g, '"'))) assert.ok(GUEST_OK.has(f), f + ' is a guest file (a guest gets the same early requests)');
  assert.ok(PAGE.indexOf('window.msData.warm(') > PAGE.indexOf('<body>'), 'asked from the body, after the styles of the first paint');
  assert.match(PAGE, /if \(!COUNCIL\.at && !COUNCIL\.early\) \{ const \[t0, s0, rp0, rs0\] = await Promise\.all\(\[all\[0\], all\[3\], all\[7\], all\[8\]\]\);/);
  const all = PAGE.match(/const all = \[(get\('[^\]]+)\];/)[1].split(/,\s*(?=get\()/).map((x) => x.match(/get\('([^']+)'/)[1]);
  assert.equal(all.length, 14);
  assert.deepEqual([all[0], all[3], all[7], all[8]], ['trades.json', 'snapshot.json', 'research/replay-2w.json', 'research.json']);
});

test('page: under the first-load sign-in card the app sleeps, and the card reads the 2 MB replay record last', () => {
  assert.match(PAGE, /window\.msBootGate = \(function \(\) \{ var R = document\.documentElement; if \(!R\.dataset\.gate/);
  assert.match(PAGE, /async function boot\(\) \{\n(\s*\/\/[^\n]*\n)*\s*if \(window\.msBootGate\) await window\.msBootGate;/);
  assert.match(PAGE, /if \(!document\.getElementById\('v-council'\) \|\| window\.msBootGate\) return;/);
  assert.match(PAGE, /councilReady = window\.msBootGate \? window\.msBootGate\.then\(loadCouncil\) : loadCouncil\(\)/);
  assert.match(PAGE, /if \(!MD\.base \|\| MD\.on === false \|\| window\.msBootGate\) return Promise\.resolve\(\{\}\);/);
  // leaving that card always reloads: the close button and Escape only work for a visitor who already chose the guest view
  assert.match(PAGE, /html\[data-gate\]\[data-guest\] \.gate-x \{ display: inline-block; \}/);
  assert.match(PAGE, /if \(was\) msGate\(false\); else location\.reload\(\);/);
  const proof = PAGE.slice(PAGE.indexOf('function proof() {'), PAGE.indexOf('sess(); px(); proof();'));
  assert.ok(!/get\('ict\/replay\.json'\)/.test(proof) && /later\(ictProof\)/.test(proof), 'the replay record is asked for after the page has loaded');
  assert.ok(PAGE.indexOf('// Login 2: caps-lock hint') < PAGE.indexOf('id="ms-live"'), 'the card\'s script sits under the card, not at the end of the page');
});

test('page: the first screen holds its place', () => {
  assert.match(PAGE, /<div class="gs-proof" id="gs-proof">/, 'the proof boxes are there from the first paint');
  // the early markets row draws as many empty cards as the app script will
  const n = +PAGE.match(/el\.innerHTML = new Array\((\d+) \+ 1\)\.join\('<span class="h-mk-i h-mk-sk"/)[1];
  const inst = PAGE.slice(PAGE.indexOf('const INSTRUMENTS = {'), PAGE.indexOf('let instKey = null;'));
  assert.equal(n, (inst.match(/\bmd: '/g) || []).length, 'one card per market with live quotes');
  const card = (s) => s.match(/<span class="h-mk-i h-mk-sk"[^']*/)[0];
  assert.equal(card(PAGE.slice(PAGE.indexOf('new Array('))), card(PAGE.slice(PAGE.indexOf('el.innerHTML = Array.from({ length: n }'))), 'the same empty card as the app script');
  // the charting library no longer blocks the first paint: its tag is in the body, right before the app script
  const head = PAGE.slice(0, PAGE.indexOf('</head>'));
  assert.ok(!/<script[^>]*lightweight-charts/.test(head) && !/rel="preload"/.test(head));
  assert.match(PAGE, /<script src="\/assets\/lightweight-charts-4\.1\.3\.js"><\/script>\n<script>window\.LightweightCharts \|\| document\.write\([^\n]*\n<script>\n\/\/ public \/ admin mode/);
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts/build.sh'), 'utf8'), /cp market-structure\.html out\/index\.html\nnode scripts\/hoist-styles\.mjs out\/market-structure\.html out\/index\.html\n/);
});

test('hoist-styles: body styles go to the end of the head in order; scripts, comments and head styles stay', () => {
  const src = '<html><head><style>a{}</style><script>var s = "<style>x</style></head>";</script></head>\n<body><p>1</p>\n<style id="b1">b{}</style>\n<script>var t = \'<style>no</style>\';</script><!-- <style>c</style> -->\n<div><style media="print">d{}</style></div>\n</body></html>';
  const out = hoist(src);
  assert.equal(out, '<html><head><style>a{}</style><script>var s = "<style>x</style></head>";</script><style id="b1">b{}</style>\n<style media="print">d{}</style>\n</head>\n<body><p>1</p>\n<script>var t = \'<style>no</style>\';</script><!-- <style>c</style> -->\n<div></div>\n</body></html>');
  assert.equal(hoist(out), out, 'running it twice changes nothing');
  assert.equal(hoist('<p><style>x{}</style></p>'), '<p><style>x{}</style></p>', 'no head: untouched');
  assert.equal(hoist('<head><style>x{}</style></head><body></body>'), '<head><style>x{}</style></head><body></body>');
});

test('hoist-styles: on the Desk every rule keeps its order, nothing is lost, and no style is left in the body', () => {
  const out = hoist(PAGE), styles = (h) => [...h.matchAll(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|(<style\b[^>]*>[\s\S]*?<\/style\s*>)/gi)].map((m) => m[1]).filter(Boolean);
  const a = styles(PAGE), b = styles(out);
  assert.ok(a.length > 30); assert.deepEqual(b, a, 'same blocks, same order');
  const body = out.slice(out.indexOf('<body>'));
  assert.equal(styles(body).length, 0);
  const rest = (h) => h.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, (m) => (/^<style/i.test(m) ? '' : m)).replace(/\n/g, '');
  assert.equal(rest(out), rest(PAGE), 'only the style blocks moved: markup, scripts and comments are untouched');
});
