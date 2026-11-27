// Quick type on the Charts and drawing undo / redo (27 Nov 2026): pure pieces and the page wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../assets/ms-quick.js');
const IDS = ['1s', '5s', '10s', '15s', '30s', '1m', '2m', '5m', '10m', '15m', '30m', '1h', '2h', '3h', '4h', '6h', '8h', '12h', '1d', '1w', '1M', '1Y'];

test('a typed timeframe reads as the terminal does', () => {
  const want = { 15: '15m', 1: '1m', 60: '1h', 240: '4h', 1440: '1d', '4h': '4h', '30s': '30s', d: '1d', '1d': '1d', w: '1w', '1M': '1M', '12h': '12h', y: '1Y' };
  for (const [s, id] of Object.entries(want)) assert.equal(Q.parseTf(s, IDS), id, s);
  for (const s of ['7', '90', '0', '2d', 'x', '', '15q']) assert.equal(Q.parseTf(s, IDS), null, s);
});

test('a typed market finds the key, the label and the name', () => {
  const L = [{ k: 'eurusd', label: 'EUR/USD', name: 'Euro' }, { k: 'xau', label: 'XAU/USD', name: 'Gold' }, { k: 'nas100', label: 'NAS100', name: 'Nasdaq 100' }, { k: 'eurjpy', label: 'EUR/JPY', name: 'Euro yen' }];
  assert.deepEqual(Q.matchMarkets('eur', L).map((x) => x.k), ['eurusd', 'eurjpy']);
  assert.deepEqual(Q.matchMarkets('EUR/JPY', L).map((x) => x.k), ['eurjpy']);
  assert.deepEqual(Q.matchMarkets('gold', L).map((x) => x.k), ['xau']);
  assert.deepEqual(Q.matchMarkets('zzz', L), []);
});

test('display only, wired on the Desk, the tool letters and "/" left alone', () => {
  const s = fs.readFileSync('assets/ms-quick.js', 'utf8'), h = fs.readFileSync('market-structure.html', 'utf8');
  assert.ok(!/fetch\(|localStorage|sessionStorage|placeOrder|msPaper/.test(s));
  assert.match(s, /TOOLS = 'fhtbpmr'/);
  assert.ok(!/k === '\/'/.test(s), '"/" is the command palette');
  assert.match(h, /<script src="\/assets\/ms-quick\.js" defer><\/script>/);
  assert.match(h, /\.ms-qk \{/);
});

test('drawings: undo and redo keep the previous saved state, in memory only', () => {
  const s = fs.readFileSync('assets/ms-draw.js', 'utf8');
  assert.match(s, /UNDO\.push\(\[mk, prev\]\)/);
  assert.match(s, /e\.code === 'KeyZ' \|\| e\.code === 'KeyY'/);
  assert.match(s, /data-m="undo"/);
  assert.match(s, /window\.msDrawUndo/);
});

test('a level from the right-click menu, and arrow keys on the chart', () => {
  const d = fs.readFileSync('assets/ms-draw.js', 'utf8'), q = fs.readFileSync('assets/ms-quick.js', 'utf8');
  assert.match(d, /data-m="hl">Horizontal line at/);
  assert.match(d, /data-m="al">Alert at/);
  assert.match(d, /if \(k === 'al'\) d\.alert = true; commit\(mk, d\)/);
  assert.match(q, /'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'End'/);
  assert.match(q, /document\.querySelector\('\.ch-rp\.on'\)/, 'a replay keeps its arrow keys');
});

test('the drawings list: every drawing of the market, select, lock, delete', () => {
  const d = fs.readFileSync('assets/ms-draw.js', 'utf8'), h = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(d, /window\.msDrawList = openList/);
  assert.match(d, /data-m="list">Drawings list/);
  assert.match(d, /e\.code === 'KeyL'/);
  assert.match(d, /data-rm="\$\{i\}"/);
  assert.match(h, /\.ms-dlist \{/);
  assert.match(h, /:not\(\.ms-dlist\)/, 'kept in full screen');
});

test('hide all drawings (Alt+Shift+H), and the tools\' messages float', () => {
  const d = fs.readFileSync('assets/ms-draw.js', 'utf8'), h = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(d, /const list = HIDE \? \[\] :/);
  assert.match(d, /if \(HIDE\) return null;/, 'a hidden drawing cannot be picked');
  assert.match(d, /e\.altKey && e\.shiftKey && !e\.ctrlKey && !e\.metaKey && e\.code === 'KeyH'/);
  assert.ok(!/KeyD/.test(d), 'Alt+D is the browser\'s address bar');
  assert.match(h, /#v-charts \.dr-note:not\(:empty\) \{ position: fixed;/);
});

test('the drawing strip has the list and the hide buttons (a phone has no keyboard or right-click)', () => {
  const d = fs.readFileSync('assets/ms-draw.js', 'utf8');
  assert.match(d, /data-dl title="Drawings list/);
  assert.match(d, /data-dh aria-pressed="false"/);
  assert.match(d, /b\.hasAttribute\('data-dh'\)\) \{ setHide\(!HIDE\)/);
});

test('what is drawn on a chart follows the chart\'s background, not the page theme', () => {
  const h = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(h, /:root:not\(\[data-theme="light"\]\) \.ms-live\[data-chart="light"\] :is\(\.ms-pane, \.mm-c\) \{ --au-bg: #f2f3f5;[^}]*--ink: #17191c;/);
  assert.match(h, /:root\[data-theme="light"\] \.ms-live\[data-chart="dark"\] :is\(\.ms-pane, \.mm-c\) \{ --au-bg: #121315;[^}]*--buy: #4cc38a;/);
  assert.match(h, /t = Object\.assign\(\{\}, THEMES\[G\.theme\], hexOk\(CUS\.bg\) \? \{ bg: CUS\.bg \} : \{\}\)/, 'label backings take the chart\'s own background');
});

test('Markets side by side: volume in the panes\' colours, the source label shrinks', () => {
  const h = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(h, /value: \+b\.volume \|\| 0, color: window\.msChartLight && window\.msChartLight\(\) \?/);
  assert.match(h, /\.mm-src \{[^}]*text-overflow: ellipsis;/);
});

test('charts polish 27 Nov: Structure is an icon at 1440-1799 px, crypto quotes in the watchlist, Markets candles above the volume', () => {
  const P = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(P, /@media \(min-width: 1440px\) and \(max-width: 1799px\) \{[^\n]*#ms-sa-btn \.sa-bl \{ display: none; \}/);
  assert.match(P, /fetch\('https:\/\/api\.kraken\.com\/0\/public\/Ticker\?pair=' \+ Object\.values\(KR\)\.join\(','\)/);
  assert.match(P, /ch: \(c - o\) \/ o \* 100, src: 'kraken'/);
  assert.match(P, /crypto: today\\'s 00:00 UTC open/);
  assert.match(P, /rightPriceScale: \{ borderVisible: false, scaleMargins: \{ top: 0\.1, bottom: 0\.18 \} \}/);
});
