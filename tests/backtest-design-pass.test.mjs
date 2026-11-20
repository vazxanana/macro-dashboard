// node --test tests/backtest-design-pass.test.mjs — ChronosTrade design pass (20 Nov 2026). Offline, on the page's text: the
// rules that fixed real overlaps and unstyled or undersized controls stay as written. What they look like in a browser (the
// strip under the quick bar, Help inside a phone's screen, 44 px on touch) was measured with Playwright when the pass was made.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');
const css = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html.slice(0, html.indexOf('<body')))[1];
const A = css.indexOf('/* Design pass (20 Nov 2026)'), B = css.indexOf('/* end Design pass (20 Nov 2026) */');
const block = css.slice(A, B);
const simple = css.slice(css.indexOf('/* Simple phone view (11 Nov 2026'));

test('the design-pass block stands after the Graphite look and before the simple phone view, and never names that view', () => {
  assert.ok(A > 0 && B > A, 'the block and its end mark');
  assert.ok(A > css.indexOf('/* Graphite look (17 Nov 2026'), 'after the Graphite look, so it has the last word');
  assert.ok(B < css.indexOf('/* Simple phone view (11 Nov 2026'), 'before the simple phone view');
  assert.doesNotMatch(block, /data-phone|\.ps-/, 'the simple view keeps its own block');
});

test('the open-trades strip is placed from the quick Buy / Sell bar, never at a fixed top', () => {
  assert.match(block, /\.qpos \{ top: calc\(var\(--qt, 60px\) \+ var\(--qh\)\); width: max-content; max-width: calc\(100% - 16px\); white-space: nowrap; \}/);
  assert.match(block, /\.chartc \{ --qh: 44px; --qp: 34px; \} @media \(pointer: coarse\) \{ \.chartc \{ --qh: 53px; --qp: 52px; \} \.qtr \.qb \{ min-height: 46px; \}/, 'the bar\'s height per pointer');
  // the page sets --qt in the statement after the bar's own top, from the same number
  assert.match(html, /\$\('qtr'\)\.style\.top = \(ct \+ 10\) \+ 'px'; host\.closest\('\.chartc'\)\.style\.setProperty\('--qt', \(ct \+ 10\) \+ 'px'\);/);
  assert.equal((css.slice(B).match(/\.qpos \{[^}]*top:/g) || []).length, 0, 'no later rule moves the strip');
});

test('the legend ends before the quick bar, and drops under the strip on a phone while a trade is open', () => {
  assert.match(block, /@media \(min-width: 701px\) \{ body:not\(\.fs\) \.chartc:not\(\.nodata\) \.legend \{ max-width: max\(150px, calc\(100% - 418px - var\(--mr, 0px\)\)\); \}/);
  assert.match(block, /@media \(max-width: 700px\) \{ body:not\(\.fs\) \.chartc:has\(\.qpos:not\(\[hidden\]\)\) \.legend \{ margin-top: calc\(var\(--qh\) \+ var\(--qp\) \+ 8px\); \} \}/);
});

test('every text button of the page has a style (none is a bare browser button)', () => {
  const parents = { 'q-setup': '.qdef', 'rl-done': '.rules', 'rl-edit': '.rules', 'co-deb': '.cr-score' };
  const ids = [...html.matchAll(/class="lnk[^"]*" id="([\w-]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 4, 'the text buttons were found');
  for (const id of ids) { const par = parents[id]; assert.ok(par, `a new text button #${id}: give its parent a .lnk rule and list it here`); assert.match(css, new RegExp(par.replace('.', '\\.') + ' \\.lnk \\{[^}]*background: none; border: 0;'), `${par} .lnk is styled`); }
});

test('the session plan is one row a limit, and its fields cannot leave the card', () => {
  assert.match(block, /\.pl-f > label:not\(\.full\) \{ grid-column: 1 \/ -1; grid-template-columns: minmax\(0, 1fr\) 96px; align-items: center;/);
  assert.match(block, /\.pl-f input:not\(\[type="checkbox"\]\) \{ width: 100%; min-width: 0; \}/);
});

test('dialogs: actions keep a gap, the wider dialogs get their width, none leaves a phone\'s screen', () => {
  assert.match(block, /\.hkd \.own-acts \{ display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; \}/);
  assert.match(block, /\.repd \{ max-width: min\(96vw, 760px\); \} \.deb \{ max-width: min\(96vw, 640px\); \} \.btd \{ max-width: min\(640px, calc\(100vw - 32px\)\); \} \.teachd \{ max-width: min\(94vw, 620px\); \}/);
  assert.match(block, /@media \(max-width: 520px\) \{ dialog\.hkd \{ box-sizing: border-box; max-width: calc\(100vw - 16px\); max-height: calc\(100dvh - 16px\); overflow-y: auto; \}/);
  assert.match(block, /#hk tr \{ display: grid; grid-template-columns: 112px minmax\(0, 1fr\);/, 'Help\'s keys and their meaning stack in two columns on a phone');
  assert.match(block, /\.btd input:placeholder-shown \+ #bt-join \{ background: transparent;/, 'one primary in the battle dialog until a code is typed');
});

test('toasts stand at the bottom centre from 761 px and let taps through; in full screen the coach is at the lower left', () => {
  assert.match(block, /@media \(min-width: 761px\) \{ #toasts \{ right: auto; left: 50%; transform: translateX\(-50%\);[^}]*pointer-events: none; \} \}/);
  assert.match(block, /@media \(min-width: 701px\) \{ body\.fs \.lc \{ right: auto; left: 64px; \} \}/);
  assert.match(html, /tbMove\(pos \? pos\.x : \(\$\('dstrip'\)\.offsetWidth \? 72 : 24\), pos \? pos\.y : ch\.offsetTop \+ 64\);/, 'a floating toolbar starts clear of the legend and the drawing strip');
});

test('nothing under 12 px, and the lens box is a well like the older inner cards', () => {
  assert.match(block, /\.pos-h small, \.rp-h small, \.dr-more summary small, \.bv-leg small \{ font-size: 12px; \}/);
  assert.match(block, /\.ln \{ background: var\(--au-well\);/);
  for (const m of block.matchAll(/font-size: ([\d.]+)px/g)) assert.ok(+m[1] >= 12, 'a size under 12 px in the block: ' + m[0]);
});

test('touch: one coarse block gives the cards, tabs, journal and dialogs 44 px controls', () => {
  const m = /\/\* 12\. touch[\s\S]*?@media \(pointer: coarse\) \{([\s\S]*?)\n  \}\n/.exec(block); assert.ok(m, 'the coarse block');
  const t = m[1];
  for (const sel of ['.tk input', '.tk .btn', '#draft .btn.sm', '#riskq .btn.sm', '.pos-l input', '.pos-a .btn.sm', '.pf-head select', '.pf-head .btn', '.chips button', '.jf input', '.mc-f .btn', '#tab-data .btn', '.hkd .btn', '.tabs button', '.dchip button', '.ptag button', '.jt td input', '.jt th[data-k] button', '.jgo', '.shot-add', '.qdef .lnk', '.top a.back'])
    assert.ok(t.includes(sel), sel + ' is in the 44 px list');
  assert.match(t, /\{ min-height: 44px; \}/); assert.match(t, /\{ min-width: 44px; \}/);
  assert.match(t, /#how > summary, #acctcard details > summary, #pfcard details > summary, \.vfold > summary, \.allnum > summary \{ padding-block: 13px;/, 'fold headings are 44 px tall too');
});

test('the simple phone view: the session title ends in an ellipsis beside an icon-only Battle button', () => {
  assert.match(simple, /html\[data-phone="simple"\] #sess\.folded \.sess-sum b \{ max-width: 100%; \}/);
  assert.match(simple, /html\[data-phone="simple"\] #sess\.folded \.bt-open \{ display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0; font-size: 0; \}/);
  assert.match(html, /id="bt-open" title="Battle:[^"]*"[^>]*>\s*<svg[^>]*aria-hidden="true"[\s\S]{0,400}?<\/svg>Battle<\/button>/, 'the word stays in the button for assistive technology');
});
