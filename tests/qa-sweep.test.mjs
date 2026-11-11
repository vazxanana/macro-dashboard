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
