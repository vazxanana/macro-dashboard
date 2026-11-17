// The header switch Desk | Macro | ChronosTrade | Academy (17 Nov 2026, owner: "I want the switch button between chronos macro
// and desk and academy"). The Academy is owner only: its link is shown to the owner's session and to no one else.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const navOf = (html) => /<nav class="hdr-sw"[^>]*>([\s\S]*?)<\/nav>/.exec(html)[1];

test('every page with the switch links the Academy, owner only', () => {
  const pages = ['market-structure.html', 'macro-desk.html', 'backtest.html', 'edge-lab.html', 'scripts/veteran-library.html', 'academy.html'];
  for (const p of pages) {
    const nav = navOf(src(p));
    const a = /<a [^>]*href="\/academy"[^>]*>/.exec(nav);
    assert.ok(a, p + ': no Academy link in the switch');
    if (p === 'academy.html') continue;
    if (p === 'market-structure.html') assert.match(a[0], /class="[^"]*\badm\b[^"]*\bown\b/, p + ': the Desk gates it with adm own');
    else assert.match(a[0], /data-mx-owner hidden/, p + ': hidden until the owner is confirmed');
    assert.match(a[0], /title="[^"]+"/);
  }
});

test('the Academy link is unhidden for the owner only', () => {
  assert.match(src('assets/mx-nav.js'), /\[data-mx-owner\]'\)\.forEach\(function \(el\) \{ el\.hidden = !\(me && me\.role === 'owner'\); \}\)/);
  assert.match(src('macro-desk.html'), /if \(me\.role === 'owner'\) document\.querySelectorAll\('\[data-mx-owner\]'\)/);
  assert.match(src('backtest.html'), /if \(me\.role === 'owner'\) document\.querySelectorAll\('\[data-mx-owner\]'\)/);
  for (const [p, re] of [['assets/mx-page.css', /\.hdr-sw a\[hidden\] \{ display: none !important; \}/], ['macro-desk.html', /\.hdr-sw a\[hidden\] \{ display: none !important; \}/], ['backtest.html', /\.hdr-sw a\[hidden\] \{ display: none !important; \}/]])
    assert.match(src(p), re, p + ': a hidden link must not show');
});
