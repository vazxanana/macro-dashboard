// node --test tests/qa-sweep.test.mjs — post-merge QA sweep (9 Nov 2026, PRs #682-#705): one check per issue fixed, plus the
// owner's light-mode candle choice, so the next design pass cannot bring them back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const styles = (html) => [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
// WCAG contrast of two #rrggbb colours
const lum = (hex) => { const v = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// an rgba() over an opaque #rrggbb -> #rrggbb
const over = (rgba, bg) => { const [r, g, b, a] = rgba.match(/[\d.]+/g).map(Number), B = bg.replace('#', '').match(/../g).map((x) => parseInt(x, 16)); return '#' + [r, g, b].map((c, i) => Math.round(c * a + B[i] * (1 - a)).toString(16).padStart(2, '0')).join(''); };
const tok = (block, name) => { const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(block); return m && m[1].trim(); };

test('the Desk | Macro | ChronosTrade ring never animates forever, on any page (desk perf rule, 9 Nov)', () => {
  const files = { 'assets/mx-page.css': src('assets/mx-page.css') };
  for (const p of ['market-structure.html', 'macro-desk.html', 'backtest.html', 'edge-lab.html', 'index.html', 'scripts/veteran-library.html']) files[p] = styles(src(p));
  for (const [f, css] of Object.entries(files)) {
    // keyframes that animate a custom property (the ring's --hm-r): never with an infinite iteration count
    const custom = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{([^{}]*\{[^{}]*\})+\s*\}/g)].filter((m) => /\{\s*--[\w-]+\s*:/.test(m[0])).map((m) => m[1]);
    for (const k of custom) assert.doesNotMatch(css, new RegExp(`animation[^;}]*\\b${k}\\b[^;}]*infinite`), `${f}: ${k} animates a custom property forever`);
    for (const rule of css.match(/[^{}]*hdr-sw[^{}]*\{[^{}]*\}/g) || []) assert.doesNotMatch(rule, /infinite/, `${f}: ${rule.trim().slice(0, 80)}`);
  }
});

test('offline page: the card fits a 390 px phone (padding inside its width)', () => {
  const css = styles(src('offline.html'));
  const card = /\.card\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(card, /width:\s*100%/);
  assert.ok(/box-sizing:\s*border-box/.test(card) || /\*\s*(,[^{]*)?\{[^}]*box-sizing:\s*border-box/.test(css), '.card is width 100% plus padding and border unless border-box');
});

test('Edge lab donut: its small label stays at least 12 px on screen when the donut shrinks on phones', () => {
  const css = styles(src('edge-lab.html'));
  const vb = +/class="donut" viewBox="0 0 (\d+) \1"/.exec(src('edge-lab.html'))[1];
  const base = +/\.donut text\.s\s*\{[^}]*font:\s*\d+\s+([\d.]+)px/.exec(css)[1];
  const mq = /@media \(max-width: \d+px\) \{([\s\S]*?\.donut \{ width: (\d+)px[\s\S]*?)\n {2}\}/.exec(css);
  assert.ok(mq, 'the phone rule that shrinks the donut');
  const w = +mq[2], phone = /\.donut text\.s \{ font-size: ([\d.]+)px/.exec(mq[1]);
  assert.ok(base * 124 / vb >= 12, 'desktop size');
  assert.ok((phone ? +phone[1] : base) * w / vb >= 12, `phone: ${(phone ? +phone[1] : base) * w / vb} px`);
});

test('gold terminal: a way back to the desk (the installed app opens it from the "Gold" shortcut, with no browser Back)', () => {
  const html = src('gold-trading.html'), nav = /<nav class="primary-nav"[\s\S]*?<\/nav>/.exec(html)[0];
  assert.match(nav, /<a [^>]*href="(\.\/|\/)#home"[^>]*>[^<]*Desk/);
  assert.ok(JSON.parse(src('app.webmanifest')).shortcuts.some((s) => s.url === '/gold'), 'the shortcut this link is for');
});

test('macro desk: the story stays hidden until the first load decides which sections have data (no layout jump)', () => {
  const html = src('macro-desk.html');
  assert.match(html, /<main class="wrap" data-loading>/);
  assert.match(styles(html), /main\[data-loading\] \.story, main\[data-loading\] \.toc \{ display: none; \}/);
  const load = html.slice(html.indexOf('function load()'), html.indexOf('// ---- Veteran library'));
  assert.match(load, /\.finally\(function \(\) \{[^}]*delete m\.dataset\.loading/, 'cleared even when a render throws');
});

test('macro desk light theme: green, red and link text pass AA on the panel and on the inner tiles', () => {
  const css = styles(src('macro-desk.html'));
  const light = /:root\[data-theme="light"\] \{([^}]*)\}/.exec(css)[1];
  const auto = /@media \(prefers-color-scheme: light\) \{\s*:root:not\(\[data-theme="dark"\]\):not\(\[data-theme="midnight"\]\) \{([^}]*)\}/.exec(css)[1];
  for (const block of [light, auto]) {
    const panel = tok(block, 'panel'), well = over(tok(block, 'neutral-soft'), panel);
    for (const k of ['buy', 'sell', 'accent']) for (const bg of [panel, well]) assert.ok(ratio(tok(block, k), bg) >= 4.5, `--${k} ${tok(block, k)} on ${bg}: ${ratio(tok(block, k), bg).toFixed(2)}`);
  }
  assert.doesNotMatch(css, /tr\.dv td \{ opacity/, 'derived level rows: no opacity over the 12 px faint note');
});

test('ChronosTrade quick Buy / Sell: the white label passes AA in every theme', () => {
  const css = styles(src('backtest.html'));
  for (const k of ['buy', 'sell']) {
    const bg = new RegExp(`\\.qtr \\.${k} \\{ background: (#[0-9a-f]{6}); \\}`).exec(css);
    assert.ok(bg, `.qtr .${k} has a fixed background, not a theme token (dark --${k} failed AA)`);
    assert.ok(ratio('#ffffff', bg[1]) >= 4.5, `${k}: ${ratio('#ffffff', bg[1]).toFixed(2)}`);
  }
});

test('owner\'s choice (#686): light-mode desk candles are grey up / black down; dark themes stay green / red', () => {
  const html = src('market-structure.html');
  const cc = /const candleCols = \(\) => G\.theme === 'light'\s*\?\s*(\{[^}]*\})\s*:\s*(\{[^}]*\})/.exec(html);
  assert.ok(cc, 'candleCols picks by theme');
  assert.match(cc[1], /upColor: '#c9ccd2', downColor: '#131722', borderUpColor: '#131722', borderDownColor: '#131722', wickUpColor: '#131722', wickDownColor: '#131722'/);
  assert.match(cc[2], /upColor: UPC, downColor: DNC/);
  // every chart pane gets them when the theme is applied (panes are created green / red first)
  assert.match(html, /const K = candleCols\(\); Object\.values\(panes\)\.forEach\(\(p\) => \{ try \{ p\.series\.applyOptions\(K\)/);
});
