// node --test tests/backtest-phone.test.mjs — ChronosTrade's simple phone view (11 Nov 2026, owner: "On the mobile there's too
// much, we need a simpler version for the phone"). Offline, on the page's text: the view is the default only up to 640 px, uses the
// Desk's key and attribute, every rule of it is scoped so a wider screen and the Full view are the page as it was, each fold points
// at a real card, and the code that fills it only reads. The behaviour itself (first screen, result line, folds, Full view,
// remembered) is checked in a browser by scripts/audit/chronostrade.cjs, section 34.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');
const css = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html.slice(0, html.indexOf('<body')))[1];   // the page's own sheet (the print report's sheet lives in the script)
const lum = (hex) => { const v = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// the top-level rules of a CSS text: [prelude, body] pairs (comments dropped, braces balanced)
const commas = (sel) => { const out = []; let d = 0, c = ''; for (const ch of sel) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(c); c = ''; } else c += ch; } out.push(c); return out; };   // a selector list, not the commas inside :is( )
function rules(text) { const t = text.replace(/\/\*[\s\S]*?\*\//g, ''), out = []; let i = 0;
  while (i < t.length) { const o = t.indexOf('{', i); if (o < 0) break; let d = 1, j = o + 1; while (j < t.length && d) { if (t[j] === '{') d++; else if (t[j] === '}') d--; j++; } out.push([t.slice(i, o).trim(), t.slice(o + 1, j - 1)]); i = j; }
  return out; }

test('the phone view is set in the head before the first paint, with the Desk\'s key and attribute (one choice covers the site)', () => {
  const m = /<script>\s*\/\* Simple phone view[\s\S]*?<\/script>/.exec(html); assert.ok(m, 'the head script');
  assert.ok(html.indexOf(m[0]) < html.indexOf('lightweight-charts'), 'before the chart library, so before any paint');
  assert.ok(html.indexOf(m[0]) < html.indexOf('<body'), 'in the head');
  const s = m[0];
  assert.match(s, /matchMedia\('\(max-width: 640px\)'\)/); assert.match(s, /localStorage\.getItem\('ms-phone'\) === 'full'/);
  assert.match(s, /if \(mq && mq\.matches && !full\) R\.dataset\.phone = 'simple'; else delete R\.dataset\.phone;/, 'simple only on a phone that did not choose Full');
  assert.match(s, /window\.msPhoneView = function \(v\) \{ try \{ if \(v === 'full'\) localStorage\.setItem\('ms-phone', 'full'\); else localStorage\.removeItem\('ms-phone'\); \}/);
  assert.match(s, /mq\.addEventListener\('change'/, 'a rotated or resized screen is followed');
});

test('every rule of the simple view is scoped: nothing of it reaches a wider screen or the Full view', () => {
  const at = css.indexOf('/* Simple phone view (11 Nov 2026, owner'); assert.ok(at > 0); const before = css.slice(0, at), block = css.slice(at);
  assert.ok(!/data-phone|\.ps-/.test(before), 'no rule outside the block names the view or its parts');
  const top = rules(block);
  assert.deepEqual(top.map((r) => r[0]), ['.ps-only, .ps-sw', '@media (max-width: 640px)'], 'hidden by default, then one phone media query, nothing after it');
  assert.equal(top[0][1].trim(), 'display: none;');
  const bad = [];
  for (const [sel, body] of rules(top[1][1])) {
    if (sel.startsWith('@media')) { for (const [s2] of rules(body)) if (!commas(s2).every((x) => x.trim().startsWith('html[data-phone="simple"]'))) bad.push(s2); continue; }
    for (const x of commas(sel)) { const one = x.trim(); if (!(one.startsWith('html[data-phone="simple"]') || /^\.ps-(sw|sw-b|fold|all|last|sess-more)\b/.test(one))) bad.push(one); }
  }
  assert.deepEqual(bad, [], 'inside the query a rule starts with html[data-phone="simple"] or with one of the view\'s own parts');
  // the parts the view adds are drawn nowhere else: outside the simple view only the switch is shown, and only on a phone
  const shown = rules(top[1][1]).filter(([sel, body]) => !sel.startsWith('@media') && /^\.ps-/.test(sel) && /display:\s*(flex|inline-flex|block|grid)/.test(body)).map((r) => r[0]);
  assert.deepEqual(shown, ['.ps-sw', '.ps-sw-b'], 'only the Simple | Full switch shows without the attribute');
});

test('the chart takes the height the screen has left; the session, the result and the cards are one line each', () => {
  assert.match(css, /html\[data-phone="simple"\] #panes\[data-n="1"\] > #chart \{ height: calc\(100vh - \d+px\); height: calc\(100dvh - \d+px\); min-height: 300px; \}/, 'one chart only: a split keeps its own heights');
  assert.match(css, /html\[data-phone="simple"\] #sess\.folded \.sess-sum \.hint, html\[data-phone="simple"\] #sess\.folded #strip-k \{ display: none; \}/);
  assert.match(html, /\$\('sess-body'\)\.hidden = !open; \$\('sess'\)\.classList\.toggle\('folded', !open\);/, 'the session card says when its form is folded');
  assert.match(css, /html\[data-phone="simple"\] \.side > \[data-ps\]:not\(\[data-ps-open\]\) \{ display: none; \}/, 'folded cards are not drawn (and only inside the side column: the full-screen Trade dock is untouched)');
  assert.match(css, /html\[data-phone="simple"\] \.ps-fold \{[^}]*min-height: 48px;/); assert.match(css, /html\[data-phone="simple"\] \.ps-all \{[^}]*min-height: 44px;/);
  assert.match(css, /html\[data-phone="simple"\] \.ps-last button \{[^}]*min-height: 44px;/); assert.match(css, /\.ps-sw button \{ min-height: 44px;/);
  assert.match(css, /html\[data-phone="simple"\] \.tabs button \{ flex: none; min-height: 44px; \}/);
  for (const m of css.slice(css.indexOf('/* Simple phone view (11 Nov 2026, owner')).matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, 'no text under 12 px: ' + m[0]);
});

test('each fold is a button that names a real card; each tab has its headline and one button for the rest; the switch has both views', () => {
  const folds = [...html.matchAll(/<button type="button" class="ps-only ps-fold" aria-controls="([\w-]+)" aria-expanded="false"><b>([^<]+)<\/b><span id="([\w-]+)"><\/span>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(folds, [['acctcard', 'Account'], ['tradecard', 'Trade'], ['pfcard', 'Challenge']]);
  for (const [id] of folds) { const n = html.indexOf(`<section class="card" id="${id}" data-ps>`); assert.ok(n > 0, id + ' is a card that folds'); assert.ok(html.lastIndexOf(`aria-controls="${id}"`, n) > html.lastIndexOf('</section>', n) || id === 'acctcard', 'the line sits right before its card'); }
  assert.match(html, /<div class="ps-only ps-last" id="ps-last"><span id="ps-last-t" role="status"><\/span><button type="button" id="ps-last-j" hidden>Journal ›<\/button><\/div>\s*<\/section>\s*<aside class="side">/, 'the result line closes the chart card');
  for (const id of ['ps-hl-j', 'ps-hl-s', 'ps-hl-l']) assert.ok(html.includes(`<p class="ps-only ps-hl" id="${id}"></p>`), id);
  const all = [...html.matchAll(/<button type="button" class="ps-only ps-all" aria-expanded="false" data-more="([^"]+)">([^<]+)<\/button><\/section>/g)]; assert.equal(all.length, 3); for (const m of all) assert.equal(m[1], m[2]);
  assert.match(html, /<div class="ps-sw" id="ps-sw" role="group" aria-label="Phone view"><span>Phone view<\/span><span class="ps-sw-b"><button type="button" data-v="simple" aria-pressed="true">Simple<\/button><button type="button" data-v="full" aria-pressed="false">Full<\/button><\/span><\/div>\s*<\/main>/);
});

test('the code that fills the simple view only reads: it returns at once outside the view and never touches an order, a stop or the account', () => {
  const a = html.indexOf('// ---- simple phone view (11 Nov 2026)'), b = html.indexOf('// The desk leaves it in localStorage `btLab:handoff`'); assert.ok(a > 0 && b > a); const js = html.slice(a, b);
  assert.match(js, /function ps\(\) \{ if \(!PS\(\)\) return;/);
  assert.match(js, /function PS\(\) \{ return document\.documentElement\.dataset\.phone === 'simple'; \}/);
  for (const w of ['BT.place', 'BT.advance', 'BT.close', 'instant(', 'startDraft(', '.stop =', '.target =', 'S.acct =', '.closed.push', '.positions.push', 'save(', 'localStorage']) assert.ok(!js.includes(w), 'the block does not use ' + w);
  assert.match(js, /const a = S\.acct, last = a\.closed\[a\.closed\.length - 1\];/, 'the last result is the account\'s own last closed record');
  assert.match(js, /BTR\.sR\(last\.R\)[\s\S]*money\(last\.net\)/, 'shown as R and $');
  assert.match(js, /`\$\{s\.n\} trade\$\{s\.n === 1 \? '' : 's'\}, \$\{Math\.round\(\(s\.winRate \|\| 0\) \* 100\)\}% won, \$\{esc\(BTR\.sR\(s\.netR\)\)\}/, 'the headline: n, % won, net R');
  assert.match(js, /Journal filters are on/, 'and it says when the journal filters narrow it');
  // wired where the page already has the numbers
  assert.match(html, /setH\('legend', lgHTML\(c, pb \? pb\.close : null\)\); \} ps\(\); CO\.tick\(\); \}/, 'panels() ends with ps()');
  assert.equal(html.split('psHl(st);').length, 2, 'the journal hands its own statistics over'); assert.equal(html.split('psHl(s); $(\'afilt\')').length, 2, 'so does Statistics');
  assert.match(html, /if \(a === 'pf'\) \{ psOpen\('pfcard', true\);/, '"Go to the challenge card" opens the folded card first');
  assert.match(js, /if \(on\) \{ JD\.j = JD\.s = true; flushTabs\(\);/, 'charts folded away are redrawn at their real width when shown');
});

test('the view\'s link colour passes AA on the light panel (the accent itself is 4.50:1 there)', () => {
  const m = /html\[data-phone="simple"\]\[data-theme="light"\] \{ --ps-link: (#[0-9a-f]{6}); \}/.exec(css); assert.ok(m);
  assert.ok(css.includes(`@media (prefers-color-scheme: light) { html[data-phone="simple"]:not([data-theme]) { --ps-link: ${m[1]}; } }`), 'and when the device picks the light theme');
  assert.match(css, /:root\[data-theme="light"\] \{ --bg: #f4f6f9; --panel: #fff;/, 'the light panel is white');
  assert.ok(ratio(m[1], '#ffffff') >= 4.6, ratio(m[1], '#ffffff').toFixed(2));
  const blk = css.slice(css.indexOf('/* Simple phone view (11 Nov 2026, owner')); assert.ok(!/[^-]color: var\(--accent\)/.test(blk), 'no text of the view uses the bare accent');
});
