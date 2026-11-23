// The Charts' market phase panel (assets/ms-phase.js) is a copy of the research phase reader (research/edge/_lib/phase.mjs)
// and the edgekit pieces it uses: both must give the same reading on the same candles. Also the page wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as PH from '../research/edge/_lib/phase.mjs';
import * as EK from '../research/edge/_lib/edgekit.mjs';

const require = createRequire(import.meta.url);
const MP = require('../assets/ms-phase.js');
const T0 = Date.UTC(2024, 0, 1) / 1000;

function market(seed, n, vol) {
  const rand = EK.rng(seed); const m5 = []; let p = 100;
  for (let i = 0; i < n; i++) {
    const t = T0 + i * 300, o = p; p = p * (1 + (rand() - 0.5) * vol + (i % 2000 < 1000 ? 0.00004 : -0.00004));
    m5.push({ t, o, h: Math.max(o, p) * (1 + rand() * 0.0004), l: Math.min(o, p) * (1 - rand() * 0.0004), c: p, e: t + 300 });
  }
  return { '1d': EK.resample(m5, 86400), '4h': EK.resample(m5, 14400), '1h': EK.resample(m5, 3600), '15m': EK.resample(m5, 900), '5m': m5 };
}

test('the edgekit copies equal edgekit', () => {
  const B = market(3, 12 * 24 * 30, 0.002);
  for (const k of ['1h', '15m']) {
    assert.deepEqual(MP.swings(B[k], 3), EK.swings(B[k], 3));
    assert.deepEqual(MP.structure(B[k], 3), EK.structure(B[k], 3));
    assert.deepEqual(MP.boxesHL(B[k], 3), EK.boxesHL(B[k], 3));
    assert.deepEqual(MP.qms(B[k], 3), EK.qms(B[k], 3));
    assert.deepEqual(MP.closedBy(B[k], B[k][100].e + 7), EK.closedBy(B[k], B[k][100].e + 7));
  }
});

test('readPhase and readTf equal the research reader on the same candles', () => {
  let n = 0;
  for (const [seed, vol] of [[1, 0.002], [7, 0.004], [21, 0.0012]]) {
    const B = market(seed, 12 * 24 * 90, vol);
    const end = B['5m'][B['5m'].length - 1].e;
    for (const frac of [0.25, 0.5, 0.77, 1]) {
      const t = Math.floor(T0 + (end - T0) * frac) + 61;
      assert.deepEqual(JSON.parse(JSON.stringify(MP.readPhase(B, t))), JSON.parse(JSON.stringify(PH.readPhase(B, t))));
      n++;
    }
    assert.deepEqual(MP.readTf(B['1h']), PH.readTf(B['1h']));
  }
  // without M5 the timeframe's own one-candle structure stands in on both
  const B = market(5, 12 * 24 * 40, 0.002); delete B['5m'];
  assert.deepEqual(JSON.parse(JSON.stringify(MP.readPhase(B, 2e9))), JSON.parse(JSON.stringify(PH.readPhase(B, 2e9))));
  assert.equal(n, 12);
  assert.deepEqual(MP.TFS, PH.TFS); assert.deepEqual(MP.BELOW, PH.BELOW); assert.deepEqual(MP.NAME, PH.NAME);
});

test('fromChart: chart candles to reader candles, closed by now only', () => {
  const TZ = 3600, bars = [0, 1, 2].map((i) => ({ time: T0 + i * 900 + TZ, open: 1, high: 2, low: 0.5, close: 1.5 }));
  const out = MP.fromChart(bars, 900, TZ, T0 + 2 * 900 + 10);   // the third candle is still forming
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { t: T0, o: 1, h: 2, l: 0.5, c: 1.5, e: T0 + 900 });
});

test('page wiring: loaded with defer, styled with tokens, hidden for guests, display only', () => {
  const PAGE = fs.readFileSync('market-structure.html', 'utf8');
  assert.match(PAGE, /<script src="\/assets\/ms-phase\.js" defer><\/script>/);
  const css = PAGE.slice(PAGE.indexOf('<style id="ms-phase-css">'), PAGE.indexOf('</style>', PAGE.indexOf('<style id="ms-phase-css">')));
  assert.ok(css.length > 100);
  assert.match(css, /html\[data-role="public"\] #ms-phase \{ display: none !important; \}/);
  assert.match(css, /pointer: coarse\) \{ \.mph > summary \{ min-height: 44px; \}/);
  for (const m of css.matchAll(/font-size: ([\d.]+)px|font: \d+ ([\d.]+)px/g)) assert.ok(+(m[1] || m[2]) >= 12, 'text under 12 px: ' + m[0]);
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}\b/i, 'no hex colour: tokens only');
  const A = fs.readFileSync('assets/ms-phase.js', 'utf8');
  assert.doesNotMatch(A, /fetch\(|localStorage|sessionStorage|XMLHttpRequest|innerHTML/);
});

test('review 23 Nov 2026: the panel opens only on a click and reads again quickly until the candles are in (no late jump)', () => {
  const A = fs.readFileSync('assets/ms-phase.js', 'utf8');
  assert.doesNotMatch(A, /box\.open = true/, 'never opened by the script: it pushed the charts down after load');
  assert.match(A, /const fast = setInterval\(\(\) => \{ if \(!doc\.hidden\) tick\(\); if \(last \|\| \+\+n >= 40\) clearInterval\(fast\); \}, 1500\)/);
});
