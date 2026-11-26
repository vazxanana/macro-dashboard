// Market switch without the wait (26 Nov 2026): the page that is left hands the next market's candles to the next page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
const block = (id) => { const m = new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>').exec(html); assert.ok(m, id); return m[1]; };

test('the switch module: display only, its two session keys, never for guests', () => {
  const js = block('ms-swap-js');
  assert.doesNotMatch(js, /localStorage|indexedDB|document\.cookie|placeOrder|\.stop\s*=|\/api\//);
  const keys = [...js.matchAll(/sessionStorage\.(?:setItem|removeItem|getItem)\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].sort(), ['ms-swap', 'ms-swap-at']);
  assert.match(js, /I\.pub/); assert.match(js, /k === I\.cur/);
  assert.match(js, /method|fetch\(/); assert.doesNotMatch(js, /method:\s*'(POST|PUT|DELETE)'/);
  assert.match(js, /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/, 'a modified click is the browser\'s own');
});

test('the arrival: only fresh candles of this market, read once, every other navigation untouched', () => {
  const head = block('ms-swap-head');
  assert.match(head, /p\[0\] === k && Date\.now\(\) - \+p\[1\] < 20000/);
  assert.match(head, /skipTransition\(\)/, 'a navigation that is not a switch gets no page transition');
  assert.match(head, /blocking', 'render'/);
  assert.ok(html.indexOf('id="ms-swap-head"') < html.indexOf('</head>'));
  assert.match(html, /boot\(\);\n\}\)\(\);\n<\/script>\n<span id="ms-swap-ready" hidden><\/span>/, 'the first paint waits for the app script only');
  const boot = html.slice(html.indexOf('async function boot()'), html.indexOf('G.source = ok[0].value.src'));
  assert.match(boot, /s\.k === instKey && Date\.now\(\) - s\.at < 20000/);
  assert.match(boot, /sessionStorage\.removeItem\('ms-swap'\); sessionStorage\.removeItem\('ms-swap-at'\)/, 'read once');
  assert.match(boot, /stash\[tf\.id\]\.length > 50 \? Promise\.resolve\(\{ src: 'OANDA', bars: stash\[tf\.id\] \}\) : fetchBars\(tf\)/, 'a timeframe without handed candles is fetched as always');
  assert.match(html, /@view-transition \{ navigation: auto; \}/);
  assert.match(html, /html\[data-vt="swap"\]::view-transition-new\(root\)/);
});

test('the pure flow on a fake page: prefetch on the press, hand over on the click', async () => {
  const js = block('ms-swap-js'); const store = new Map(); let now = 1e6, href = null; const handlers = {}; const fetched = [];
  const win = { msSwapInfo: () => ({ base: '/md/', on: true, tfs: ['1d', '1h'], n: 1500, md: (k) => ({ xau: 'xau', eurusd: 'eurusd' })[k] || null, cur: 'xau', pub: false }) };
  const ctx = {
    window: win, document: { addEventListener: (n, f) => { handlers[n] = f; } }, addEventListener() {},
    sessionStorage: { setItem: (k, v) => store.set(k, v), getItem: (k) => store.get(k) ?? null, removeItem: (k) => store.delete(k) },
    location: { origin: 'https://x', hash: '#charts', set href(v) { href = v; }, get href() { return href; } },
    fetch: (u) => { fetched.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ bars: Array.from({ length: 60 }, (_, i) => ({ time: i })) }) }); },
    setTimeout: (f) => { f(); return 0; }, clearTimeout() {}, Date: { now: () => now }, encodeURIComponent, Object, String, Array, JSON, Promise,
  };
  new Function(...Object.keys(ctx), js)(...Object.values(ctx));
  const a = (h) => ({ getAttribute: () => h, classList: { add() {} }, closest() { return this; } });
  handlers.pointerdown({ target: a('?s=eurusd#charts') });
  await new Promise((r) => setImmediate(r));
  assert.equal(fetched.length, 2); assert.match(fetched[0], /^https:\/\/x\/md\/bars\?sym=eurusd&tf=1d&n=1500$/);
  let stopped = false;
  handlers.click({ target: a('?s=eurusd#charts'), preventDefault() { stopped = true; } });
  assert.ok(stopped); assert.equal(href, '?s=eurusd#charts');
  assert.equal(store.get('ms-swap-at'), 'eurusd|1000000'); assert.deepEqual(Object.keys(JSON.parse(store.get('ms-swap')).tfs), ['1d', '1h']);
  // the market on screen is the link's own business
  stopped = false; handlers.click({ target: a('?s=xau#charts'), preventDefault() { stopped = true; } }); assert.ok(!stopped);
  assert.equal(win.msSwap().read.eurusd.done, 2);
});
