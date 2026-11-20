// Macro desk, Week ahead: the browser quality pass of 20 Nov 2026 pinned on the page source (offline).
// Found at 390 px touch and 1440 px in dark / light / midnight: the frame's lines ran together ("decisionKalshi:"), the
// study links were 16 px tall on touch, and a study link or verdict from the file reached an href / class unchecked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const md = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const block = md.slice(md.indexOf('var WA_DAY'), md.indexOf('function renderNext'));
const css = md.slice(md.indexOf('/* Week ahead (20 Nov 2026) */'), md.indexOf('.wa-quiet'));

test('every Week ahead line part is its own line, in the days and in the frame', () => {
  assert.match(css, /\.wa-day li \.wa-r, \.wa \.wa-r \{ display: block; \}/);
  assert.ok(md.includes('<article class="card wa" id="c-ahead"'));
});

test('a study link is 44 px tall on touch, and only ever a page of this site', () => {
  assert.match(css, /@media \(pointer: coarse\) \{ \.wa a\.wa-st \{[^}]*min-height: 44px/);
  const src = block.match(/var WA_HREF = (function[^;]+;[^;]+;\s*\})/);
  assert.ok(src, 'WA_HREF defined');
  const WA_HREF = new Function('return ' + src[1])();
  assert.equal(WA_HREF('/edge-lab.html#gold-pre-holiday'), '/edge-lab.html#gold-pre-holiday');
  assert.equal(WA_HREF('edge-lab.html#gotobi'), '/edge-lab.html#gotobi');
  for (const bad of ['//evil.example/x', '/evil.example/x', 'javascript:alert(1)', 'https://evil.example/', '/edge-lab.html#a"b', '']) assert.equal(WA_HREF(bad), '', bad);
  assert.ok(!/href="\/' \+ esc\(r\.link\)/.test(block), 'no unchecked study link');
  assert.ok(block.includes("WA_HREF(r.link) ? '<span class=\"wa-r\"><a class=\"wa-st\" href=\"' + esc(WA_HREF(r.link))"));
});

test('a verdict from the file becomes a class only when it is one of the three known ones', () => {
  assert.ok(!/wa-chip ' \+ esc\(r\.verdict\)/.test(block));
  assert.ok(block.includes("(WA_V[r.verdict] ? ' ' + r.verdict : '')"));
});

test('Week ahead text sizes stay at 12 px or more', () => {
  for (const m of css.matchAll(/(\d+(?:\.\d+)?)px\/[\d.]+ var\(--sans\)|font-size: (\d+(?:\.\d+)?)px/g)) assert.ok(+(m[1] || m[2]) >= 12, m[0]);
});

test('a release\'s nowcast-beside-consensus line is drawn as text', () => {
  assert.ok(md.includes("(r.prep && r.prep.text ? '<span class=\"wa-r wa-nc\"><b>Nowcast beside the consensus:</b> ' + esc(r.prep.text)"));
});

test('the day\'s gold range is labelled, in the readable ink, and the auctions sit in their own list', () => {
  // browser pass of 20 Nov 2026 with real next-week data: the range read like the faint "no release" note beside it
  assert.ok(block.includes("'<p class=\"wa-rg\"><b>Gold, typical move:</b> ' + esc(WA_RG(d.range.text)) + '</p>'"));
  assert.ok(!block.includes('wa-quiet wa-rg'));
  assert.match(css, /\.wa-rg \{[^}]*color: var\(--ink-dim\)/);
  assert.match(css, /\.wa-rg \{[^}]*var\(--fs-sm, 13px\)/);
  assert.ok(block.includes("'<ul class=\"wa-auc\">' + d.auctions.map(function (a) { return '<li><b>' + esc(a.text) + '</b>"));
});

test('the nowcast-against-consensus forward record is one line of text in the section note', () => {
  assert.ok(md.includes("$('wa-note').textContent = (A.label || '') + (A.prepRecord && A.prepRecord.text ? ' ' + A.prepRecord.text : '');"));
});

// Final browser check of 20 Nov 2026 with real next-week data (390 px touch, 1440 px, three themes). Display only.
const fn = (name) => { const m = block.match(new RegExp('var ' + name + ' = ([^\\n]+);\\n')); assert.ok(m, name); return m[1]; };

test('the day\'s range line does not echo its label, and its caveat is said once under the days', () => {
  // "Gold, typical move: A typical day's move is about ..." five times, each ending in the same caveat
  const WA_RG = new Function('var WA_RG_TAIL = ' + fn('WA_RG_TAIL') + '; return ' + fn('WA_RG') + ';')();
  assert.equal(WA_RG("A typical day's move is about ±$51 (±1.4%), close to close. A size for planning, not a forecast of direction."), 'about ±$51 (±1.4%), close to close.');
  assert.equal(WA_RG("A typical day's move is about ±$51 (±1.4%), close to close. Early close: thin trading later in the day. A size for planning, not a forecast of direction."), 'about ±$51 (±1.4%), close to close. Early close: thin trading later in the day.');
  assert.equal(WA_RG('Another wording.'), 'Another wording.');   // a text the builder words differently is shown whole
  assert.equal(WA_RG(null), '');
  assert.equal(block.split('wa-rgn').length, 2);                // one note, after the days
  assert.ok(block.includes("'<p class=\"wa-rgn wa-quiet\">Typical moves are close to close: a size for planning, not a forecast of direction.</p>'"));
  assert.ok(block.indexOf('wa-rgn') > block.indexOf("return h + '</div>'"));
});

test('the frame groups the positioning lines and says their shared caveat once', () => {
  const re = new Function('return ' + fn('WA_POS_TAIL') + ';')();
  const t = 'EUR/USD: Leveraged funds crowded short (1st percentile of 3 years); net −71,676 contracts, as of the 2026-11-10 report. Positioning, not a tested signal: the pre-registered COT test found no edge.';
  assert.equal(re.exec(t)[1], 'Positioning, not a tested signal: the pre-registered COT test found no edge.');
  assert.equal(t.replace(re, ''), 'EUR/USD: Leveraged funds crowded short (1st percentile of 3 years); net −71,676 contracts, as of the 2026-11-10 report.');
  assert.equal(re.exec('Silver: least long. Tested here: edge: tested (extreme 20d), not proven.'), null);   // another ending stays on its line
  assert.ok(block.includes("(F.lines || []).filter(function (l) { return pos.length < 2 || pos.indexOf(l) < 0; })"));   // one line alone is left as it is
  assert.ok(block.includes("'<li><b>Positioning (CFTC)</b>' + rows.join('')"));
  assert.ok(block.includes("'<span class=\"wa-r\">' + esc(m ? t.replace(WA_POS_TAIL, '') : t) + '</span>'"));   // still text, escaped
});

test('a viewer whose clock is UTC is not told the release time twice', () => {
  assert.ok(block.includes("var WA_LOC = function (iso) { return new Date(iso).getTimezoneOffset() === 0 ? '' : ' <small>(your time ' + esc(locWhen(iso)) + ')</small>'; };"));
  assert.ok(block.includes("esc(utcWhen(iso)) + WA_LOC(iso)"));
});

test('Daily reports: the two report tabs take the row on a phone and never wrap', () => {
  assert.match(md, /@media \(max-width: 640px\) \{ \.dr-top \.pl-tabs \{ flex: 1 1 100%; \} \.dr-top \.pl-tabs button \{ white-space: nowrap; \} \}/);
});
