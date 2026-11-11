// node --test tests/qa-sweep.test.mjs — post-merge QA sweeps (9 Nov 2026, PRs #682-#705; 11 Nov 2026, PRs #706-#722): one check per
// issue fixed, plus the owner's light-mode candle choice, so the next design pass cannot bring them back.
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

// ---- Post-merge QA sweep, 11 Nov 2026 (the Mosha desk, the ICT desk's executions, ChronosTrade's split view) ----
const rule = (css0, sel) => { const out = [], css = css0.replace(/\/\*[\s\S]*?\*\//g, ''); const re = /([^{}]+)\{([^{}]*)\}/g; let m; while ((m = re.exec(css))) if (m[1].split(',').some((x) => x.trim() === sel)) out.push(m[2]); return out.join(' '); };

test('desk switch: six desks never widen a desk view on a phone (it takes the room there is and scrolls inside itself)', () => {
  const css = styles(src('market-structure.html')), all = rule(css, '.desk-sw');
  assert.match(all, /overflow-x:\s*auto/);
  // the base rule's `width: max-content` is what made every desk view as wide as the switch: a later rule must take it back
  assert.ok(all.lastIndexOf('width: auto') > all.lastIndexOf('width: max-content'), 'width: auto comes after width: max-content');
  assert.match(all, /min-width:\s*0/); assert.match(all, /justify-self:\s*start/);
  const soon = rule(css, '.desk-sw a small'), px = [...soon.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(px[px.length - 1] >= 12, '"soon" is at least 12 px');
  const ink = /:root\[data-theme="light"\] \.desk-sw a small \{ color: (#[0-9a-f]{6}); \}/.exec(css);
  assert.ok(ink && ratio(ink[1], over('rgba(224,165,38,0.18)', '#ffffff')) >= 4.5, '"soon" passes AA on the light panel');
  // the page smoke test measures it in a browser
  assert.match(src('scripts/audit/smoke.cjs'), /view cut off on the right/);
});

test('Mosha desk: touch targets, 12 px text, fields that stay in their cell, AA green and red on the light theme', () => {
  const css = /<style id="ms-mosha-css">([\s\S]*?)<\/style>/.exec(src('market-structure.html'))[1];
  const coarse = [...css.matchAll(/@media \(pointer: coarse\)(?:, \(max-width: 760px\))? \{((?:[^{}]*\{[^{}]*\})+)\s*\}/g)].map((m) => m[1]).join(' ');
  for (const sel of ['#v-mosha #mo-lessons .ms-tbtn', '#v-mosha #mo-book .ms-tbtn', '#v-mosha #mo-rp-ct', '#v-mosha .mo-bar .u-btn', '.mo-tut .mt-go .ms-tbtn', '.mo-lv-dlg .own-acts button', '.mo-l-dlg form button'])
    assert.match(rule(coarse, sel), /min-height:\s*44px/, `${sel} is 44 px on a touch screen`);
  assert.match(rule(coarse, '.mo-tut .mt-x'), /width:\s*44px;\s*height:\s*44px/);
  for (const sel of ['#v-mosha .mo-tc-lv > summary small', '#v-mosha .mo-l-flt button small', '.mo-lv-dlg .mo-f small']) assert.match(rule(css, sel), /font-size:\s*12px/, sel);
  assert.match(rule(css, '#v-mosha .mo-f'), /grid-template-columns:\s*minmax\(0, 1fr\)/, 'a wide date-and-time input cannot push its label over the next field');
  const light = /:root\[data-theme="light"\] #v-mosha, :root\[data-theme="light"\] \.mo-tut, :root\[data-theme="light"\] \.mo-lv-dlg \{ --buy: (#[0-9a-f]{6}); --sell: (#[0-9a-f]{6}); \}/.exec(css);
  assert.ok(light, 'the light theme has its own green and red on the Mosha desk');
  const page = /:root\[data-theme="light"\] \{([^}]*)\}/.exec(styles(src('market-structure.html')))[1];
  for (const [k, c] of [['buy', light[1]], ['sell', light[2]]]) for (const bg of ['#ffffff', '#f7f8fb', over(tok(page, `${k}-soft`), '#ffffff')]) assert.ok(ratio(c, bg) >= 4.5, `${k} ${c} on ${bg}: ${ratio(c, bg).toFixed(2)}`);
  // a record with no drawdown says 0.00R, not "−0.00R"
  assert.match(src('assets/mosha-desk.js'), /\(s\.maxDD > 0 \? '−' : ''\) \+ s\.maxDD\.toFixed\(2\) \+ 'R'/);
});

test('ICT desk: the signal filters and the review fields are 44 px on touch, the result tiles\' small print is 12 px', () => {
  const css = styles(src('market-structure.html'));
  const touch = /\/\* touch: 44px targets \*\/\s*@media \(pointer: coarse\), \(max-width: 700px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  assert.match(rule(touch, '#v-ict .ict-f select'), /min-height:\s*44px/); assert.match(rule(touch, '#v-ict .ict-rv input'), /min-height:\s*44px/);
  const small = [...rule(css, '#v-ict .ict-kpi small').matchAll(/(?:font:[^;]*?|font-size:\s*)([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(small[small.length - 1] >= 12, `the won / lost / flat / near-flat line: ${small[small.length - 1]} px`);
  assert.match(css, /@media \(pointer: coarse\) \{ \.ict-ex-b \{ min-height: 44px; \} \}/, 'the execution chips');
});

test('ChronosTrade: the chosen timeframe chip passes AA in every theme, an open trade shows its whole stop, the teach dialog has no 10 px text', () => {
  const css = styles(src('backtest.html'));
  const on = /\.tfchips button\[aria-pressed="true"\] \{ background: (#[0-9a-f]{6}); border-color: \1; color: #fff; \}/.exec(css);
  assert.ok(on, 'a fixed background, not --accent (white on the dark themes\' accent was 3.2:1)'); assert.ok(ratio('#ffffff', on[1]) >= 4.5, ratio('#ffffff', on[1]).toFixed(2));
  assert.match(css, /@media \(pointer: coarse\) \{ \.tfchips button \{ min-height: 44px; min-width: 44px; \} \}/);
  const sess = /:root\[data-theme="light"\] \.tb-sess span \{ color: (#[0-9a-f]{6}); \}/.exec(css);
  assert.ok(sess && ratio(sess[1], '#ffffff') >= 4.5, 'the toolbar\'s timeframe on the light panel');
  assert.ok(css.includes(`@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]):not([data-theme="midnight"]) .tb-sess span { color: ${sess[1]}; } }`), 'and when the device picks the light theme');
  // `#open input { width: 60px }` (the old table) cut the stop and target of a position card to "4180."
  assert.match(css, /#open \.pos-l input \{ width: 100%; \}/);
  assert.ok(css.indexOf('#open .pos-l input { width: 100%; }') >= 0 && /#open input \{ width: 60px; \}/.test(css), 'the card rule is the more specific one');
  assert.match(rule(css, '.tch-f small'), /font-size:\s*12px/);
});

// ---- Second pass, 11 Nov 2026 (branch desk-polish) ----
const fnBody = (js, head) => { const i = js.indexOf(head); assert.ok(i >= 0, head); return js.slice(i, i + 2600); };

test('Mosha, the teacher\'s page: the studies\' figures and the desk\'s own "cycle" are not put to the teacher (the owner and readers keep them)', () => {
  const html = src('market-structure.html'), css = /<style id="ms-mosha-css">([\s\S]*?)<\/style>/.exec(html)[1];
  const hide = /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-rules, html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-cycle \{ display: none; \}/;
  assert.match(css, hide);
  // both cards still exist for the owner and for readers, and the studies are named nowhere else in what a teacher sees
  assert.match(html, /<div class="card mo-wide" id="mo-rules">/); assert.match(html, /<div class="card" id="mo-cycle">/);
  for (const m of html.matchAll(/<p class="ms-note mo-tch"[^>]*>([^<]*)</g)) assert.doesNotMatch(m[1], /stud(y|ies)|fixed rules|not an edge/i);
  for (const f of ['assets/mosha-teach.js', 'assets/mosha-tutor.js']) assert.doesNotMatch(src(f), /five studies|fixed rules said|look-alikes/i, f);
});

test('ICT desk typography: the pass that brings every label, chip and calendar text to 12 px, and nothing after it undoes it', () => {
  const css = styles(src('market-structure.html')), at = css.indexOf('/* ICT typography pass (11 Nov 2026)');
  assert.ok(at > 0, 'the pass is there');
  const pass = css.slice(at, css.indexOf('@media (max-width: 600px) { #v-ict .ict-cal-d { padding', at));
  for (const sel of ['#v-ict .ms-chip', '#v-ict .ict-a', '#v-ict .ict-g', '#v-ict .ict-pill', '#v-ict .ict-tag', '#v-ict .ict-few', '#v-ict .ict-trk-l span', '#v-ict .ict-lv dt', '#v-ict .ict-lv dd small', '#v-ict .ict-m .k small', '#v-ict #ict-eq-d', '#v-ict .ict-t td small', '#v-ict .ict-mine-k span', '#v-ict .ict-cal-h', '#v-ict .ict-cal-d .d', '#v-ict .ict-cal-d small', '#v-ict #ict-tv-ck li.h', '#v-ict #ict-rv-tags button'])
    assert.match(rule(pass, sel), /font-size:\s*12px/, sel);
  // after the pass no ICT rule sets a smaller size again (a later rule of the same weight would win)
  for (const m of css.slice(at).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*(?:#v-ict|\.ict-)[^{}]*)\{([^{}]*)\}/g)) for (const f of m[2].matchAll(/font(?:-size)?:[^;]*?([\d.]+)px/g)) assert.ok(+f[1] >= 12, `${m[1].trim().slice(0, 70)}: ${f[1]} px`);
  assert.match(src('scripts/audit/smoke.cjs'), /ICT desk text under 12 px/, 'and the smoke test measures the drawn desk');
  // light theme: buy / sell chips at AA on their own tint over the open-now card
  const chip = /:root\[data-theme="light"\] #v-ict \.ms-chip-buy \{ color: (#[0-9a-f]{6}); \} :root\[data-theme="light"\] #v-ict \.ms-chip-sell \{ color: (#[0-9a-f]{6}); \}/.exec(css);
  assert.ok(chip && ratio(chip[1], '#dae9ea') >= 4.5 && ratio(chip[2], '#fae6e9') >= 4.5);
});

test('ICT desk on a phone: a signal with two executions keeps its chips inside the row; "Replay through …" is never cut', () => {
  const css = styles(src('market-structure.html'));
  assert.match(css, /#v-ict \.ict-t tr:has\(\.ict-ex\) \{ grid-template-areas: "mk sd gr gr" "tm tm se en" "rs rs rs rs" "rv rv rv rv"; \}/);
  assert.match(rule(css, '#v-ict .ict-t .ict-ex-b'), /flex:\s*1 1 0;\s*min-width:\s*0;\s*white-space:\s*normal/);
  assert.match(css, /\.tv-h p\.ict-thru \{ display: block; overflow: visible; cursor: auto; \}/, 'the header clamps its other paragraphs to three lines on phones');
});

test('styled dialogs: the primary button is white on a fixed fill at AA in every theme (the themes\' --accent / --sell gave 3.2-4.5:1)', () => {
  const js = src('assets/ms-dialog.js');
  const pri = /\.msd button\.pri\{background:(#[0-9a-f]{6});border-color:\1;color:#fff\}/.exec(js), danger = /\.msd\.danger button\.pri,\.msd\.danger button\.pri:hover\{background:(#[0-9a-f]{6});/.exec(js);
  assert.ok(pri && ratio('#ffffff', pri[1]) >= 4.5); assert.ok(danger && ratio('#ffffff', danger[1]) >= 4.5);
  const own = /\.own-acts button\.pri \{ background: (#[0-9a-f]{6}); border-color: \1; color: #fff; \}/.exec(styles(src('market-structure.html')));
  assert.ok(own && ratio('#ffffff', own[1]) >= 4.5, 'the Desk\'s own dialogs (permissions, a lesson\'s levels)');
});

test('the Desk\'s light theme: green, red, faint and accent text pass AA on the page, the panel and the raised panel', () => {
  const light = /:root\[data-theme="light"\] \{([^}]*)\}/.exec(styles(src('market-structure.html')))[1];
  for (const k of ['buy', 'sell', 'ink-faint', 'accent']) for (const bg of ['bg', 'panel', 'panel-raised']) assert.ok(ratio(tok(light, k), tok(light, bg)) >= 4.5, `--${k} ${tok(light, k)} on --${bg}: ${ratio(tok(light, k), tok(light, bg)).toFixed(2)}`);
  assert.ok(ratio('#ffffff', tok(light, 'accent')) >= 4.5 && ratio('#ffffff', tok(light, 'buy')) >= 4.5 && ratio('#ffffff', tok(light, 'sell')) >= 4.5, 'and white on each as a fill');
  assert.match(styles(src('market-structure.html')), /:root\[data-theme="light"\] \.ch-cd\.up \{ color: #fff; \}/, 'the candle countdown: white on the darker green');
});

test('the address matches the view: a refused view is rewritten, a #trade link is left to the trade router', () => {
  const html = src('market-structure.html'), show = fnBody(html, '  function showView(hx) {');
  assert.match(show, /const HX = typeof hx === 'string' \? hx : location\.hash, \[h0, sub\] = HX\.slice\(1\)\.split\('\/'\)/);
  assert.match(show, /if \(h0 !== v && VIEWS\.includes\(h0\) && location\.hash === HX\) try \{ history\.replaceState\(null, '', location\.pathname \+ location\.search \+ '#' \+ v\); \}/);
  const nav = html.slice(html.indexOf("addEventListener('hashchange', () => {\n      // a #trade/<id> link is not a view"), html.indexOf('setInterval(() => { renderSessList(); renderHome(); }, 30e3)'));
  assert.match(nav, /if \(\/\^#trade\\\/\/\.test\(location\.hash\)\) return;/, 'drawing a view for a trade link sent the page home behind the sheet');
  assert.match(nav, /const at = location\.hash, t = document\.startViewTransition\(\(\) => showView\(at\)\); t\.ready\.catch\(\(\) => \{\}\)/, 'a view transition draws from the address of its own navigation; a skipped one is not an error');
  assert.match(html, /if \(el && !el\.hidden\) \{ if \(!push && parse\(location\.hash\)\) history\.replaceState\(null, '', hash\); return; \}/, 'a pasted trade link on its own desk: closing the sheet lands on the desk, not on the link again');
});

test('Mosha book in French: the desk\'s first wording of a corrected seed line is shown translated, like the line itself was', async () => {
  const { createRequire } = await import('node:module'); const require = createRequire(import.meta.url);
  const I = require('../assets/mosha-i18n.js'), L = require('../api/mosha-lessons.js');
  assert.match(src('assets/mosha-teach.js'), /L\('The desk had:'\) \+ ' ' \+ esc\(wasOf\(b\)\)/);
  assert.match(src('assets/mosha-teach.js'), /var wasOf = function \(b\) \{ var I = root\.MS_MOSHA_I18N; return I && I\.tr \? I\.tr\(b\.was\) : b\.was; \};/);
  for (const line of L.SEED) assert.ok(I.FR[line.text], `the seed line "${line.text.slice(0, 40)}…" has its French`);
});

test('Mosha forms on a phone: a date-and-time field takes the whole row (half a row cut the date off)', () => {
  const css = /<style id="ms-mosha-css">([\s\S]*?)<\/style>/.exec(src('market-structure.html'))[1];
  assert.match(css, /@media \(max-width: 760px\) \{ #v-mosha \.mo-f:has\(input\[type="datetime-local"\]\), \.mo-lv-dlg \.mo-f:has\(input\[type="datetime-local"\]\) \{ grid-column: 1 \/ -1; \}/);
});

// ---- Badge inks, 11 Nov 2026 (branch light-badges): status badges, chips and pills on Charts and Scanner ----
test('badge inks: every badge colour is a theme token, and each token passes AA on the tint it sits on (light, dark, midnight)', () => {
  const html = src('market-structure.html'), css = styles(html);
  const block = (sel) => [...css.matchAll(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}', 'g'))].map((m) => m[1]).join(' ');
  const base = block(':root'), light = block(':root[data-theme="light"]'), mid = block(':root[data-theme="midnight"]');
  // light: its own inks; text on a 18% tint of the colour over the panel, the page and a hovered row
  const T = { buy: 'rgba(8,153,129,.18)', sell: 'rgba(242,54,69,.18)', warn: 'rgba(240,165,0,.18)', accent: 'rgba(47,107,255,.18)' };
  for (const k of ['buy', 'sell', 'warn', 'accent']) for (const bg of ['panel', 'bg', 'panel-hover']) { const on = over(T[k], tok(light, bg)), ink = tok(light, `${k}-ink`); assert.match(ink, /^#[0-9a-f]{6}$/); assert.ok(ratio(ink, on) >= 4.5, `light --${k}-ink ${ink} on its tint over --${bg}: ${ratio(ink, on).toFixed(2)}`); }
  for (const bg of ['panel', 'bg']) assert.ok(ratio(tok(light, 'gold-ink'), tok(light, bg)) >= 4.5, 'the brand gold as text on light');
  assert.ok(ratio(tok(light, 'on-buy'), tok(light, 'buy')) >= 4.5 && ratio(tok(light, 'on-sell'), tok(light, 'sell')) >= 4.5, 'light: the ink on a solid green / red fill');
  // dark and midnight keep the theme's own green / red, with a dark ink on the solid fills (white was 2.5-3.6:1)
  assert.match(base, /--buy-ink: var\(--buy\); --sell-ink: var\(--sell\);/);
  for (const [name, b] of [['dark', base], ['midnight', mid]]) for (const k of ['buy', 'sell']) assert.ok(ratio(tok(base, `on-${k}`), tok(b, k)) >= 4.5, `${name}: --on-${k} on --${k}`);
  for (const bg of ['#121722', '#0d1630']) assert.ok(ratio(tok(base, 'warn-ink'), over(T.warn, bg)) >= 4.5 && ratio(tok(base, 'gold-ink'), bg) >= 4.5);
  // the components read the tokens (a hex here is how they drifted under AA)
  for (const r of [/\.ms-st\.ready \{ background: var\(--buy\); color: var\(--on-buy\); \}/, /\.ms-st\.near \{[^}]*color: var\(--warn-ink\); \}/, /\.ms-st\.bad \{[^}]*color: var\(--sell-ink\); \}/,
    /\.ms-al\.ok \{ color: var\(--buy-ink\);/, /\.ms-al\.against \{ color: var\(--sell-ink\);/, /\.ms-chip-buy \{ background: var\(--buy-soft\); color: var\(--buy-ink\);/, /\.ms-chip-sell \{ background: var\(--sell-soft\); color: var\(--sell-ink\);/,
    /\.ms-tag\.counter \{ color: var\(--warn-ink\);/, /\.ms-q\.weak \{ color: var\(--warn-ink\);/, /\.ms-srow \.lv-d\.at \{ color: var\(--accent-ink\);/, /\.pr-c\.up \{ color: var\(--buy-ink\); \} \.pr-c\.dn \{ color: var\(--sell-ink\); \}/,
    /\.btab-brand span \{[^}]*color: var\(--gold-ink\); \}/, /\.ch-cd \{[^}]*color: var\(--on-sell\); background: var\(--sell\);/, /\.g-s-st\.pending \{ color: var\(--warn-ink\);/,
    /\.md-vet-row\.agree \.md-vet-st \{[^}]*color: var\(--buy-ink\); \}/, /\.md-vet-row\.disagree \.md-vet-st \{[^}]*color: var\(--sell-ink\); \}/]) assert.match(css, r);
  assert.doesNotMatch(css, /:root\[data-theme="light"\] \.ms-al\.(ok|against) \{ color: #/);
  // the scanner's day change is coloured by class, not by the chart's candle colour inline; a sign stays beside the colour
  assert.match(html, /<small class="pr-c \$\{ch >= 0 \? 'up' : 'dn'\}" style="font-weight:600"/);
  // no badge text dimmed by opacity: the header's shadow count and the guest calendar's day numbers
  assert.doesNotMatch(css, /\.ho-sh\{opacity/);
  assert.match(css, /:is\(#v-guest, \.g-merged\) \.cal \.cal-d\.fut \.cn \{ opacity: 1; \}/);
});

// ── Sign-in card and guest page (11 Nov 2026): what a stranger sees is the main system only, and it is called what it is ──
const desk = () => src('market-structure.html');
const cut = (html, from, to) => { const i = html.indexOf(from); assert.ok(i >= 0, `missing: ${from}`); const j = html.indexOf(to, i); assert.ok(j > i, `missing end: ${to}`); return html.slice(i, j); };
const ROWS = [
  { id: 'a', market: 'xau', label: 'XAU/USD', k: 'geg', name: 'Gold daily engulf', pair: 'D1 engulf zone', side: 'buy', entry: 10, stop: 9, t1: 12, opened: 1000, status: 'pending', note: 'rule text', feat: { d1: 'with' } },
  { id: 'b', market: 'eth', label: 'ETH/USD', k: 'scalp', name: 'Scalp', pair: 'M15 → M1', side: 'sell', entry: 5, stop: 6, opened: 5000, status: 'open', shadow: true, blockedBy: ['focus', 'usd'], note: 'Shadow (…)' },
  { id: 'c', market: 'btc', label: 'BTC/USD', k: 'intraday', name: 'Intraday', side: 'buy', entry: 5, stop: 4, opened: 4000, status: 'open' },
  { id: 'd', market: 'xau', label: 'XAU/USD', k: 'replica', name: 'Gold replica', side: 'sell', entry: 5, stop: 6, opened: 3000, closed: 3500, status: 'win', R: 2, pm: { cause: 'x' } },
];

test('sign-in card: the proof counts and names main-system paper trades only, never a shadow or an older strategy', () => {
  const html = desk(), W = {};
  new Function('window', cut(html, 'window.msGateProof = function', '  // live proof for guests'))(W);
  const G = W.msGateProof(ROWS, { from: '2025-08-01', totals: { n: 815, wins: 308, R: 124.57 } }, 3600 * 3);
  assert.equal(G.open.v, '0', 'the open shadow and the older-strategy trade are not counted');
  assert.match(G.open.s, /^1 waiting for its entry$/);
  assert.equal(G.last.v, '▼ XAU/USD', 'the latest main-system trade, not the newer shadow signal');
  assert.doesNotMatch(JSON.stringify(G), /ETH|BTC|Scalp|replica|engulf|Intraday/i, 'no shadow market and no system name');
  // the ICT replay is called a backtest, with its n, its period and "before costs"
  assert.equal(G.ict.v, '+125R'); assert.match(G.ict.s, /^815 trades since Aug 2025 · before costs$/); assert.match(G.ict.tip, /backtest/i);
  assert.match(html, /<span>ICT replay · a backtest<\/span>/);
  assert.doesNotMatch(html, /since 2020<\/small>/, 'the replay starts in August 2025; the card said "since 2020" until the file loaded');
  // a file that did not load keeps its dash (it showed "Open now 0"); the boxes are in the page from the first paint (desk load)
  const none = W.msGateProof(null, null, 0); assert.deepEqual(none, { open: null, ict: null, last: null });
  assert.match(html, /set\('gs-p-open', G\.open \? G\.open\.v : '—'\)/);
  assert.match(html, /<div class="gs-proof" id="gs-proof">\n      <div class="gs-pk" id="gs-pk-open">/);
  assert.match(html, /window\.msGateProof\(null, I, 0\)\.ict/, 'the ICT line, read last, goes through the same function');
  // the same list of main systems as the page's SYS_K
  const sysK = /const SYS_K = (\[[^\]]+\]);\n  \/\/ guests: our main system only/.exec(html)[1], main = /var MAIN = (\[[^\]]+\])/.exec(html)[1];
  assert.equal(main, sysK);
});

test('guest page: only main-system rows, cut to the drawn fields, are kept in memory (nothing of the other books reaches the hidden views)', () => {
  const html = desk(), block = cut(html, "  const GUEST_F = [", "  if (PUB) for (const [key, cut] of Object.entries(GUEST_DATA))");
  const sysK = /const SYS_K = (\[[^\]]+\]);\n  \/\/ guests: our main system only/.exec(html)[1];
  const D = new Function(`const SYS_K = ${sysK}, nqSys = (x) => x.market !== 'nq' || ['nyflip'].includes(x.session);\n${block}\nreturn GUEST_DATA;`)();
  const T = D.trades(ROWS);
  assert.deepEqual(T.map((x) => x.id), ['a', 'd']);
  for (const x of T) for (const f of ['name', 'pair', 'note', 'feat', 'blockedBy', 'pm', 'shadow']) assert.ok(!(f in x), `a guest row carries ${f}`);
  assert.equal(T[1].R, 2); assert.equal(T[0].stop, 9, 'the stop stays on the row');
  const R = D.research([{ id: 'n1', market: 'nq', k: 'nq-open', session: 'nyflip', status: 'loss', R: -1, closed: 9, note: 'x' }, { id: 'n2', market: 'nq', k: 'nq-open', session: 'nyflip-trend', shadow: true }, { id: 'n3', market: 'nq', k: 'nq-open', session: '80pct' }, { id: 'r', market: 'xau', k: 'replica', status: 'win', R: 1 }]);
  assert.deepEqual(R.map((x) => x.id), ['n1']);
  const P = D.replay({ note: 'Replay of our systems … replica v5 …', from: 'a', to: 'b', trades: [{ id: 'p', market: 'xau', k: 'geg', name: 'Gold daily engulf', replay: true, status: 'loss', R: -1, closed: 5, note: 'x' }, { id: 'q', market: 'nq', k: 'nq-open', session: 'tokyo', replay: true }] });
  assert.deepEqual(Object.keys(P), ['from', 'to', 'trades']); assert.deepEqual(P.trades, [{ id: 'p', market: 'xau', k: 'geg', closed: 5, status: 'loss', R: -1, replay: true }]);
  const S = D.snap({ at: 't', lessons: { x: 1 }, ownerReviews: {}, moshaBo: {}, markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 4000, dec: 1, trend: {}, setups: [{ name: 'Position', next: 'Wait for H1 to break down (the CF)' }] } } });
  assert.deepEqual(S, { at: 't', nqLast: undefined, markets: { xau: { label: 'XAU/USD', name: 'Gold', price: 4000, dec: 1, open: undefined, setups: [] } } });
  assert.equal(D.trades(null), null, 'a file that did not load stays null (the page says so)');
  // installed for the public role before the first load, and the guest toasts name no system
  assert.match(html, /if \(PUB\) for \(const \[key, cut\] of Object\.entries\(GUEST_DATA\)\) \{ let val; Object\.defineProperty\(COUNCIL, key,/);
  assert.match(html, /trades\.filter\(\(x\) => !x\.shadow && \(!PUB \|\| SYS_K\.includes\(x\.k\)\)\)\.forEach/);
  assert.match(html, /gName = PUB \? 'Paper trade' : `\$\{x\.name\} \$\{x\.pair\}`/);
});

test('guest results: a backtest replay is counted, drawn and named apart from the trades taken forward on paper', () => {
  const html = desk();
  const split = new Function(`${cut(html, '  const guestSplit = (L) =>', '\n  function renderGuestCurve()')}\nreturn guestSplit;`)();
  const S = split([{ R: 2, closed: 10, replay: true }, { R: -1, closed: 20, replay: true }, { R: -1, closed: 30 }, { R: 0.5, closed: 25 }]);
  assert.deepEqual(S, { rp: { n: 2, R: 1, from: 10 }, fw: { n: 2, R: -0.5, from: 25 } });
  const fn = cut(html, '  function renderGuestCurve() {', "  ['g-cal-prev', 'g-cal-next']");
  assert.match(fn, /forward, <b>\$\{split\.rp\.n\}<\/b> replay/); assert.match(fn, /a backtest, not trades that were taken/); assert.match(fn, /g-cv-rp/);
  assert.match(fn, /Past results do not predict future ones\./);
  assert.match(fn, /new ResizeObserver\(again\)\.observe\(plot\)/, 'results that arrive before the section has a width are drawn when it gets one');
  assert.match(fn, /could not be loaded right now/);
  assert.match(html, /\.g-cv-line\.g-cv-rp \{ stroke-dasharray:/);
  const cal = cut(html, '  function renderGuestCal() {', '  // Guest results as a picture');
  assert.match(cal, /come from a replay of its rules on past candles \(a backtest\), not from trades that were taken/);
  // wording: paper, no promise
  const guest = cut(html, '<section class="view" id="v-guest"', '</section>\n  <!-- ─── Home');
  assert.doesNotMatch(guest, /nothing hidden/); assert.match(guest, /Paper trading only: no real money/); assert.doesNotMatch(guest, /<\/i>live<\/small>/);
  assert.doesNotMatch(guest, /id="g-setup" hidden/, 'the trade card says loading / none / unreachable instead of vanishing');
  assert.match(html, /No gold trade is open or waiting right now\./);
  assert.match(html, /const gOpen = \(\) =>/, 'an order waiting for its entry is not counted as open');
  assert.match(html, /og:description" content="[^"]*paper trades/);
});

test('sign-in card: the page behind is inert while it is up, closing returns focus, Caps Lock and the error never stack', () => {
  const html = desk(), css = styles(html);
  assert.match(html, /function msGateInert\(\) \{ var on = !!document\.documentElement\.dataset\.gate; \['\.skip', '#ms-live'\]\.forEach\(function \(q\) \{ var e = document\.querySelector\('body > ' \+ q\); if \(e\) e\.inert = on; \}\); \}/);
  const gate = cut(html, 'function msGate(show) {', '\n}\n');
  assert.match(gate, /msGate\.from = document\.activeElement/); assert.match(gate, /msGateInert\(\);/); assert.match(gate, /b\.focus\(\{ preventScroll: true \}\)/);
  assert.match(html, /<a class="skip" href="#ms-main-start">[^<]*<\/a>\n<div class="ms-live app" id="ms-live"/, 'the two siblings the card covers');
  assert.match(css, /\.gate-msg:has\(\.gate-err:not\(:empty\)\) \.gate-caps \{ display: none; \}/);
  assert.match(html, /Caps Lock is on: turn it off and try again\./);
});

test('guest page: "Gold trade and results" scrolls there itself (as a hash link the view router sent the page back to the top)', () => {
  const html = desk();
  assert.match(html, /<a class="pubonly g-back" href="#g-setup">/);
  assert.match(html, /const a = ev\.target\.closest && ev\.target\.closest\('a\.g-back'\); if \(!a\) return; const to = document\.getElementById\('g-merged'\); if \(!to\) return; ev\.preventDefault\(\);/);
  assert.match(html, /to\.scrollIntoView\(\{ block: 'start', behavior: matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 'auto' : 'smooth' \}\)/);
  // a guest's account menu has no profile entry, and a guest toast gives the target the trade card shows
  assert.match(styles(html), /html\[data-role="public"\] #ms-me-profile \{ display: none; \}/);
  assert.match(html, /gT \? `target \$\{fmtT\(x, x\.tp1\)\}`/);
});

// ---- Side pages quality pass (11 Nov 2026): macro desk, Edge lab, veteran library, gold terminal ----
// the text of `function name(…) { … }` in a page script (brace matched), to run it here
const fnSrc = (html, name) => { const i = html.indexOf(`function ${name}(`); assert.ok(i >= 0, `function ${name} is in the page`); let d = 0, j = html.indexOf('{', html.indexOf(')', i));
  for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && --d === 0) return html.slice(i, k + 1); } throw new Error(`${name}: no closing brace`); };

test('macro desk: the story is shown before its charts are drawn (they were blank on first load)', () => {
  const html = src('macro-desk.html');
  // main[data-loading] hides the story with display:none, and draw() skips a host with no width: the flag must be gone before redraw()
  assert.match(styles(html), /main\[data-loading\] \.story[^{]*\{ display: none; \}/);
  const load = fnSrc(html, 'load'), off = load.indexOf('delete m.dataset.loading'), re = load.indexOf('redraw()');
  assert.ok(off > 0 && re > off, 'load() removes data-loading, then calls redraw()');
  assert.ok(load.indexOf('syncStory()') < off, 'after the sections know whether they have data');
  assert.match(load, /\.finally\(/, 'a failed load still shows the page');
});

test('macro desk: "no hypothesis" is said once, the score\'s threshold names sit over the line, the switch is a 44 px target and hides when signed out', () => {
  const html = src('macro-desk.html'), css = styles(html);
  assert.equal(html.match(/No hypothesis this run/g).length, 1);
  const spark = fnSrc(html, 'sparkSvg'); assert.ok(spark.indexOf('<path class="ln"') < spark.lastIndexOf('+ lab'), 'labels are appended after the path');
  assert.match(css, /@media \(pointer: coarse\) \{ \.hdr-sw \{ padding: 0; \} \.hdr-sw a \{ min-width: 44px; justify-content: center; \} \}/);
  assert.match(css, /\.hdr-sw\[hidden\] \{ display: none; \}/);
  assert.match(html, /getElementById\('md-gate'\)\.hidden = false; var sw = document\.querySelector\('\.hdr-sw'\); if \(sw\) sw\.hidden = true;/);
  // dots only on phones: every link of the switch keeps a name
  const nav = /<nav class="hdr-sw"[^>]*>([\s\S]*?)<\/nav>/.exec(html)[1];
  for (const a of nav.match(/<a [^>]*>/g)) assert.match(a, /title="[^"]+"/, a);
});

test('Edge lab: a study whose `system` is not text shows no "[object Object]", and a joined headline has one mark between its parts', () => {
  const html = src('edge-lab.html');
  assert.match(html, /var sys = typeof d\.system === 'string' \? esc\(d\.system\) : '';/);
  const tidy = new Function(`${fnSrc(html, 'tidy')}; return tidy;`)();
  assert.equal(tidy('Scalp (live rule): FAIL.; Intraday: FAIL.; Swing: INCONCLUSIVE.'), 'Scalp (live rule): FAIL; Intraday: FAIL; Swing: INCONCLUSIVE.');
  assert.equal(tidy('t 0.55; n 62. Not an edge.'), 't 0.55; n 62. Not an edge.'); assert.equal(tidy(null), '');
  assert.ok(!/esc\(rec\.headline\)/.test(html), 'every headline goes through tidy()');
});

test('Edge lab: the report dialog renders the study\'s Markdown, escaped first, wide tables scrolling inside it', () => {
  const html = src('edge-lab.html'), css = styles(html);
  const md = new Function(`${fnSrc(html, 'esc')}; ${fnSrc(html, 'mdInline')}; ${fnSrc(html, 'md')}; return md;`)();
  const out = md('**Verdict: FAIL.** n 365, t -3.10\n\n# Title <script>alert(1)</script>\n\n| System | n |\n|---|---|\n| A `k` | 62 |\n\n- one\n- two *x*\n\n[site](https://example.org/a) and [file](run.mjs), 2 * 3 * 4\n');
  assert.match(out, /<p><b>Verdict: FAIL\.<\/b> n 365, t -3\.10<\/p>/);
  assert.match(out, /<h1>Title &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/h1>/, 'markup in a report is text');
  assert.match(out, /<div class="tbl" tabindex="0"><table><thead><tr><th scope="col">System<\/th><th scope="col">n<\/th><\/tr><\/thead><tbody><tr><td>A <code>k<\/code><\/td><td>62<\/td><\/tr>/);
  assert.match(out, /<ul><li>one<\/li><li>two <i>x<\/i><\/li><\/ul>/);
  assert.match(out, /<a href="https:\/\/example\.org\/a" target="_blank" rel="noopener">site<\/a> and file, 2 \* 3 \* 4/, 'a relative link stays text; a lone * is not emphasis');
  assert.match(html, /<div id="rep-body" class="rep-doc" tabindex="0">/); assert.match(html, /\$\('rep-body'\)\.innerHTML = md\(txt\)/);
  assert.match(css, /\.rep-doc \.tbl \{ overflow-x: auto;/);
  assert.match(css, /@media \(pointer: coarse\) \{ \.rep-h a \{ display: inline-flex; align-items: center; min-height: 44px; \} \}/);
});

test('veteran library: "Open raw" is a 44 px target on touch', () => {
  assert.match(styles(src('scripts/veteran-library.html')), /@media \(pointer: coarse\) \{[^}]*\} \.doc \.meta a \{ display: inline-flex; align-items: center; min-height: 44px; \} \}/);
});

test('gold terminal: nothing on a phone is cut off behind the page\'s sideways clip (bias banner, levels panels, edge summary table)', () => {
  const html = src('gold-trading.html'), css = styles(html);
  assert.match(css, /\.gx-scroll-x \{ overflow-x: auto;/);
  assert.match(html, /<div class="card glass gx-scroll-x">\s*<table style="width:100%; border-collapse:collapse; font-size:var\(--fs-xs\);">/);
  assert.match(css, /@media \(max-width: 1000px\) \{ \.levels-grid \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  const phone = css.slice(css.indexOf('.desk-banner { flex-direction: column;'));
  assert.ok(css.lastIndexOf('@media (max-width: 700px) {', css.indexOf('.desk-banner { flex-direction: column;')) > 0);
  assert.match(phone, /^\.desk-banner \{ flex-direction: column; align-items: stretch;[^}]*\}\s*\.desk-banner \.desk-vline \{ display: none; \}\s*\.desk-banner \.desk-details \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  // the later rules win over the first definitions
  assert.ok(css.indexOf('.levels-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }') > css.indexOf('.levels-grid {\n'));
});

test('gold terminal: entry-rule notes are readable in the dark theme, key-level labels sit above the candles, the MTF sentence reads', () => {
  const html = src('gold-trading.html'), css = styles(html);
  const m = /html\.dark \.edge-rule \{ background: (rgba\([^)]+\)); \}/.exec(css); assert.ok(m);
  const dark = /html\.dark[^{]*\{[^}]*--panel:\s*(#[0-9A-Fa-f]{6})/.exec(css) || [0, '#081011'];
  const text = '#A8B8B5';   // --text-secondary in the dark theme as measured on the page (rgb 168,184,181)
  assert.ok(ratio(text, over(m[1], dark[1].toLowerCase())) >= 4.5, 'note text on the slab');
  const key = fnSrc(html, 'makeKeyLevelsPrimitive');
  assert.match(key, /zOrder: \(\) => top \? 'top' : 'bottom'/); assert.match(key, /return \[pass\(false\), pass\(true\)\];/); assert.match(key, /ctx\.fillStyle = P\.plate;/);
  assert.match(fnSrc(html, 'gxPalette'), /plate: gxAlpha\(v\('--panel'/);
  assert.ok(!/into'\} the \$\{zoneTxt\}; full ticket/.test(html) && !html.includes('`wait for a pullback block to form on M15`'), 'no "into the wait for a pullback block"');
  assert.match(html, /No M15 \$\{L \? 'demand' : 'supply'\} block yet: wait for one to form before/);
  // locked features and the Yen carry row are untouched
  for (const f of ['structureMap', 'makeStructPrimitive', 'renderStructReadout', 'computeDailyBias', 'dollarSmileRegime']) assert.ok(html.includes(`function ${f}(`), f);
});

// ---- Home and Council reading pass (11 Nov 2026) ----
const deskHtml = src('market-structure.html');
// the small display helpers of the main script (window.MS_HC), lifted out by their own lines and run without a page
const hc = (() => {
  const mn = /^ {2}const mnTxt = .*$/m.exec(deskHtml), a = deskHtml.indexOf('  const rTxt = '), z = deskHtml.indexOf('window.MS_HC = {');
  assert.ok(mn && a > 0 && z > a, 'the MS_HC helpers are in the main script');
  const end = deskHtml.indexOf('\n', z), window = {};
  new Function('window', `${mn[0]}\n${deskHtml.slice(a, end)}`)(window);
  return window.MS_HC;
})();

test('Home / Council: one way to write R (sign, minus glyph, two decimals), never "-1R" beside "−1.05R"', () => {
  assert.equal(hc.rTxt(-1), '−1.00R'); assert.equal(hc.rTxt(2), '+2.00R'); assert.equal(hc.rTxt(-1.05), '−1.05R');
  assert.equal(hc.rTxt(0), '0.00R'); assert.equal(hc.rTxt(-0.001), '0.00R', 'no "−0.00R"'); assert.equal(hc.rTxt(-276, 1), '−276.0R');
  assert.equal(hc.rTxt(undefined), '—'); assert.equal(hc.rTxt(NaN), '—');
  // the templates that wrote raw numbers use it now
  assert.match(deskHtml, /\(x\.status === 'win' \|\| x\.status === 'loss' \|\| x\.status === 'be'\) \? ` \$\{rTxt\(x\.R\)\}` : ''\}\$\{liveR\(x\)\}/, 'the trade table wrote "-1R" / "+2R"');
  assert.doesNotMatch(deskHtml, /\$\{x\.R != null \? x\.R : -1\}R<\/b>/, 'the loss review wrote "-1R"');
  assert.doesNotMatch(deskHtml, /<b class="neg">\$\{R\.toFixed\(1\)\}R<\/b> · reviewed/, 'the loss review group total had a hyphen');
  assert.match(deskHtml, /Drawdown · worst <b>\$\{rTxt\(worst\)\}<\/b>/);
});

test('council-written text: a hyphen used as a minus sign is shown as the minus glyph; dates, ranges and arrows stay', () => {
  assert.equal(hc.mnTxt('-0.46R each over 135, the excluded side -0.37R (t -3.4)'), '−0.46R each over 135, the excluded side −0.37R (t −3.4)');
  assert.equal(hc.mnTxt('2026-11-07: 2004-26, entry 3983.29 -> 3971.36, 11-10 16:12'), '2026-11-07: 2004-26, entry 3983.29 -> 3971.36, 11-10 16:12');
  assert.equal(hc.mnTxt('- a bullet'), '- a bullet'); assert.equal(hc.mnTxt('z -.85'), 'z −.85');
});

test('Trades pane and Home tile: forward paper trades and the backtest replay are counted apart (was "Closed 715 · Total +497.9R" under Live)', () => {
  const closed = [{ status: 'win', R: 2, opened: 300 }, { status: 'loss', R: -1, opened: 200 }, { status: 'loss', R: -1.05, opened: 400 },
    { status: 'win', R: 1.39, replay: true, opened: 50 }, { status: 'loss', R: -1, replay: true, opened: 10 }, { status: 'win', R: 3, replay: true, opened: 20 }];
  const S = hc.fwdSplit(closed);
  assert.deepEqual([S.fwd.n, S.fwd.w, +S.fwd.R.toFixed(2)], [3, 1, -0.05]);
  assert.deepEqual([S.rp.n, S.rp.w, +S.rp.R.toFixed(2), S.rp.from], [3, 2, 3.39, 10]);
  assert.deepEqual(hc.fwdSplit([]).fwd, { n: 0, w: 0, R: 0, from: null });
  assert.match(deskHtml, /Backtest replay, not traded:/); assert.match(deskHtml, /kp\('Closed, forward', SP\.fwd\)/);
  assert.doesNotMatch(deskHtml, /our system, \$\{cl\.length\} trades \(live \+ replay\)/, 'the Home tile summed forward and replay into one figure');
  assert.match(deskHtml, /forward paper trade\$\{sp\.fwd\.n === 1 \? '' : 's'\}\$\{sp\.rp\.n \? ` · backtest replay /);
  assert.doesNotMatch(deskHtml, /live: 'Paper trades our system placed:/, 'the Live tab note called replay rows placed trades');
});

test('Council "as of" stamps name the time zone and say "Stale" in words past twice the writer\'s cadence', () => {
  const now = Date.parse('2026-11-11T14:00:00Z');
  const fresh = hc.stampTxt('2026-11-11T12:01:25Z', 6, now), old = hc.stampTxt('2026-11-10T20:00:00Z', 6, now), days = hc.stampTxt('2026-11-07T12:00:00Z', 6, now);
  assert.doesNotMatch(fresh, /Stale/); assert.match(fresh, /11 Nov/); assert.match(fresh, /\d\d:\d\d \S+$/, 'a zone name ends the stamp');
  assert.match(old, /^Stale: 10 Nov.*, 18 h old \(written every 6 h\)$/); assert.match(days, /^Stale: .*4 days old/);
  assert.equal(hc.stampTxt('not a date', 6, now), '');
  for (const id of ['ms-decay-js', 'ms-ex-js', 'ms-book-js']) assert.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`).exec(deskHtml)[1], /MS_HC\.stampTxt\((D|B)\.at, 6\)/, id);
  assert.match(deskHtml, /id="ms-c-tz"/, 'the trade table says whose clock its times use');
});

test('Edge decay card: the sentence counts what the rows show ("too few" is not healthy, a flagged shadow system is named)', () => {
  const js = /<script id="ms-decay-js">([\s\S]*?)<\/script>/.exec(deskHtml)[1], W = {};
  new Function('window', 'document', 'setTimeout', js)(W, { getElementById: () => null, addEventListener() {} }, (f) => f());
  const S = [{ id: 'replica', name: 'Gold replica', live: true, status: 'healthy' }, { id: 'mosha-bo', name: 'Mosha BO', live: true, status: 'healthy', few: true },
    { id: 'gtl', name: 'Gold H4 trendline', live: true, status: 'watch' }, { id: 'geg', name: 'Gold daily engulf', live: true, status: 'decaying' },
    { id: 'trend', name: 'Crypto trend', live: false, status: 'decaying' }, { id: 'gtrend5', name: 'Gold trend fast', live: false, status: 'healthy' }];
  const T = W.MS_DECAY_TALLY(S), ids = (a) => a.map((s) => s.id);
  assert.equal(T.live.length, 4); assert.deepEqual(ids(T.healthy), ['replica']); assert.deepEqual(ids(T.few), ['mosha-bo']);
  assert.deepEqual(ids(T.watch), ['gtl']); assert.deepEqual(ids(T.decaying), ['geg']); assert.deepEqual(ids(T.shadowFlag), ['trend']);
  assert.equal(T.healthy.length + T.few.length + T.watch.length + T.decaying.length, T.live.length, 'every live system is counted once');
  assert.doesNotMatch(js, /live\.length - dec\.length - wat\.length\) \+ ' healthy/, 'healthy was "everything else"');
});

test('Home / Council reading pass: text at 12 px, touch targets, and the cards that were cut on a phone (#ms-hc-css)', () => {
  const css = /<style id="ms-hc-css">([\s\S]*?)<\/style>/.exec(deskHtml)[1];
  assert.ok(deskHtml.indexOf('id="ms-hc-css"') > deskHtml.indexOf('id="ms-desk-css"'), 'after the blocks it corrects');
  // every size the block sets is 12 px or more, and it only speaks about the Home and Council views
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, m[0]);
  for (const sel of css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean))
    for (const one of sel.split(/,(?![^(]*\))/)) assert.match(one.trim(), /^(html\[data-deny~="council"\] )?(#v-home|#v-council|#ms-cp-macro)\b/, `scoped: ${one.trim().slice(0, 60)}`);
  assert.match(css, /html\[data-deny~="council"\] #v-council :is\(#ms-cn-macro, #ms-cn-week\) \{ display: none; \}/, 'no dead Macro / This week tabs for a member with the Overview only');
  // Systems on a phone: the broker table no longer stretches the mirror row (its log lines ended at 966 px)
  assert.match(css, /#v-council \.c-sleeve \.sl-row \{ grid-template-columns: minmax\(0, 1fr\); \}/); assert.match(css, /\.c-sleeve \.sl-row > \* \{ min-width: 0; \}/);
  // report tables scroll with readable columns; the Active list holds its place while loading; long tags wrap beside the R figure
  assert.match(css, /@media \(max-width: 760px\) \{\s*#v-council \.c-md-tw table \{ min-width: max-content; \}/);
  assert.match(css, /#v-council #ms-active:empty \{ min-height: 80vh; \}/);
  assert.match(css, /#v-council \.c-act li \{ grid-template-columns: auto minmax\(0, 1fr\) auto; \}/);
  // 44 px: the Data chip, the folded status line, the checkbox labels, the scoreboard's sort buttons and links
  const touch = /@media \(hover: none\), \(pointer: coarse\), \(max-width: 760px\) \{([\s\S]*?)\n\}/.exec(css)[1];
  for (const s of ['.c-dh { min-height: 44px', '.c-meta:not(.open) { line-height: 44px', '.sb-thin { min-height: 44px', '#ms-sb-h th button { min-height: 44px', '.md-full { display: inline-flex; align-items: center; min-height: 44px']) assert.ok(touch.includes(s), s);
  // a planned reward:risk is not written like a result
  assert.match(deskHtml, /<span title="Planned reward for 1R of risk, not a result">target \$\{\(\+t\.rr\)\.toFixed\(2\)\}R<\/span>/);
  assert.match(deskHtml, /deepest drawdown, day to day: live /); assert.doesNotMatch(deskHtml, /max drawdown ' \+ esc\(num\(B\.live\.dd\)/);
});

