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
