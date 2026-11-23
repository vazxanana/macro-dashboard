// tests/grid6-dom-confirm.test.mjs - research/edge/grid6-dom-confirm: the cell index, the rejection candle, the
// confirmations read no later candle (cut test), every trade's stop on the losing side, and RESULT.md pinned to
// result.json. Offline (synthetic candles, committed files).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cellIndex, cellName, NCELL, isRejection, confirmations, lookups, runMarket, sessionOf } from '../research/edge/grid6-dom-confirm/run.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';

const DIR = new URL('../research/edge/grid6-dom-confirm/', import.meta.url);
function market(n, seed = 3, px = 100, t0 = Date.UTC(2010, 0, 4) / 1000) {
  let x = seed >>> 0; const r = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const out = []; let c = px;
  for (let i = 0; i < n; i++) { const o = c; c = o + (r() - 0.5) * 0.8 + Math.sin(i / 400) * 0.05; const h = Math.max(o, c) + r() * 0.3, l = Math.min(o, c) - r() * 0.3;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + (i + 1) * 300 }); }
  return out.filter((b) => { const wd = new Date(b.t * 1000).getUTCDay(); return wd !== 6; });
}

test('cell index is a bijection over the 5,760 cells', () => {
  assert.equal(NCELL, 5760);
  const seen = new Set();
  for (let ch = 0; ch < 6; ch++) for (let v = 0; v < 2; v++) for (let cf = 0; cf < 5; cf++) for (let ms = 0; ms < 3; ms++)
    for (let se = 0; se < 4; se++) for (let st = 0; st < 2; st++) for (let x = 0; x < 4; x++) seen.add(cellIndex(ch, v, cf, ms, se, st, x));
  assert.equal(seen.size, NCELL); assert.equal(Math.max(...seen), NCELL - 1);
  assert.deepEqual(cellName(cellIndex(5, 1, 4, 0, 1, 1, 3)), { chain: '1h>5m', visit: 2, conf: 'rej', msnr: 'with', session: 'ny', stop: 'swing', exit: 'trail' });
  assert.equal(sessionOf(Date.UTC(2012, 3, 3, 7) / 1000), 0); assert.equal(sessionOf(Date.UTC(2012, 3, 3, 20, 59) / 1000), 1); assert.equal(sessionOf(Date.UTC(2012, 3, 3, 21) / 1000), 2);
});

test('rejection candle: long wick into the zone, close back out on the trade side', () => {
  const z = { d: 1, bot: 99, top: 100 };
  assert.equal(isRejection({ o: 100.2, h: 100.4, l: 99.3, c: 100.3 }, z, 1), true);
  assert.equal(isRejection({ o: 100.2, h: 100.4, l: 99.3, c: 99.9 }, z, 1), false);   // closes inside
  assert.equal(isRejection({ o: 100.6, h: 101.4, l: 99.8, c: 100.9 }, z, 1), false);  // wick under 60 %
  const s = { d: -1, bot: 100, top: 101 };
  assert.equal(isRejection({ o: 99.8, h: 100.7, l: 99.6, c: 99.7 }, s, -1), true);
});

test('no look-ahead: a confirmation does not move when every later candle is changed', () => {
  const B = market(4000, 7), F = frames(B), T = F['15m'];
  let checked = 0;
  for (let k = 40; k < T.length - 20 && checked < 60; k += 3) {
    const z = { d: k % 2 ? 1 : -1, bot: T[k].l, top: T[k].l + (T[k].h - T[k].l) * 0.5, end: Infinity };
    const got = confirmations(T, lookups(T), z, k);
    for (let ci = 0; ci < got.length; ci++) { const c = got[ci]; if (!c) continue;
      const alt = T.map((b, j) => (j > c.j ? { ...b, o: b.o + 3, h: b.h + 7, l: b.l - 7, c: b.c - 3 } : b));
      assert.deepEqual(confirmations(alt, lookups(alt), z, k)[ci], c); checked++; }
  }
  assert.ok(checked > 20);
});

test('a seeded run: trades exist and every stop is on the losing side', () => {
  const B = market(60000, 11), F = frames(B); let n = 0;
  const o = runMarket('eurusd', B, F, { from: Date.UTC(2010, 1, 1) / 1000, to: Date.UTC(2011, 0, 1) / 1000, onTrade: (x) => {
    n++; assert.ok(x.risk > 0); assert.ok(x.t >= x.ts); assert.ok(x.R.every((r) => Number.isFinite(r))); } });
  assert.equal(o.wrong, 0); assert.ok(n > 0); assert.equal(n, o.trades);
});

test('RESULT.md is pinned to result.json', () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\. '));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict));
  assert.equal(res.cells, 5760);
  assert.ok(md.includes(String(res.real.discovery)) && md.includes(String(res.real.passed)));
  assert.ok(md.includes(String(res.placebo.discovery)));
  assert.ok(typeof res.headline === 'string' && res.headline.length > 20);
});
