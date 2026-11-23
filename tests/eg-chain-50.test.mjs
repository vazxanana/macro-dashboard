// node --test tests/eg-chain-50.test.mjs - the engulf chain study (research/edge/eg-chain-50), offline, on hand-made and
// seeded candles: the engulf definition, no look-ahead (cut the history, change every later price), every trade's stops on
// the losing side, and result.json against RESULT.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as E from '../research/edge/eg-chain-50/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'eg-chain-50');
const T0 = Date.UTC(2024, 0, 8) / 1000;
const bar = (i, o, h, l, c, sec = 300) => ({ t: T0 + i * sec, o, h, l, c, e: T0 + (i + 1) * sec });

// a seeded walk with trends, so engulf chains appear
function walk(n, seed = 5) {
  const r = K.rng(seed); const out = []; let p = 2000, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 400 === 0) drift = (r() - 0.5) * 0.6;
    const o = p; const c = o + drift + (r() - 0.5) * 4; const h = Math.max(o, c) + r() * 2; const l = Math.min(o, c) - r() * 2;
    out.push(bar(i, o, h, l, c)); p = c;
  }
  return out;
}
function chain(m5) {
  const m15 = K.resample(m5, 900), h1 = K.resample(m5, 3600);
  return E.runChain({ name: 'P', m5, b1: h1, b2: m15, b3: m5, sec2: 900, sec3: 300, span: 3, deadlineFn: (t) => t + 24 * 3600 });
}

test('engulf: a bullish close above the base high within 3 candles, base = last bearish candle, wicks never complete', () => {
  const B = [bar(0, 10, 11, 9, 9.5), bar(1, 9.5, 10.5, 9.2, 10), bar(2, 10, 12, 9.8, 10.9), bar(3, 10.9, 11.5, 10.5, 11.2)];
  const z = E.engulfZones(B, 3).filter((x) => x.side > 0);
  assert.equal(z.length, 1); assert.equal(z[0].bi, 0); assert.equal(z[0].ci, 3); assert.equal(z[0].h, 11); assert.equal(z[0].known, B[3].e);
  assert.equal(E.engulfZones(B, 1).filter((x) => x.side > 0).length, 0, 'next-candle reading: no zone');
  const late = [bar(0, 10, 11, 9, 9.5), bar(1, 9.5, 10.5, 9.2, 10), bar(2, 10, 10.6, 9.8, 10.5), bar(3, 10.5, 10.9, 10.2, 10.8), bar(4, 10.8, 12, 10.6, 11.5)];
  assert.equal(E.engulfZones(late, 3).filter((x) => x.side > 0).length, 0, 'a fourth candle is too late');
  const doji = [bar(0, 10, 11, 9, 9.5), bar(1, 10, 10.4, 9.6, 10), bar(2, 10, 11.4, 9.8, 11.2)];
  assert.equal(E.engulfZones(doji, 3).filter((x) => x.side > 0)[0].bi, 0, 'a doji is never a base');
});

test('zone death: the first close beyond the far side', () => {
  const B = [bar(0, 10, 11, 9, 9.5), bar(1, 9.5, 11.5, 9.4, 11.2), bar(2, 11.2, 11.4, 8.5, 9.2), bar(3, 9.2, 9.4, 8.5, 8.9)];
  const z = E.engulfZones(B, 3).find((x) => x.side > 0);
  assert.equal(z.die, B[3].e, 'a wick below the low does not kill it; the close below does');
});

test('no look-ahead: trades closed before a cut are identical when the history is cut or every later price changes', () => {
  const B = walk(30000);
  const full = chain(B).trades;
  assert.ok(full.length >= 5, 'the seeded walk gives trades: ' + full.length);
  for (const cutI of [9600, 18000, 26400]) { // H1 boundaries
    const cutT = B[cutI].t;
    const before = (xs) => xs.filter((x) => x.exitT <= cutT).map((x) => JSON.stringify(x));
    const A = chain(B.slice(0, cutI)).trades;
    assert.deepEqual(before(A), before(full), 'cut at ' + cutI);
    const P = B.map((b, i) => (i < cutI ? b : { ...b, o: b.o + 37, h: b.h + 80, l: b.l - 80, c: b.c - 25 }));
    assert.deepEqual(before(chain(P).trades), before(full), 'changed after ' + cutI);
  }
});

test('every trade: the hard stop and the cut level on the losing side, the target beyond the entry by 1R or more', () => {
  const check = (xs) => {
    for (const x of xs) {
      const s = x.side === 'buy' ? 1 : -1;
      assert.ok(s * (x.entry - x.stop) > 0, 'stop on the losing side ' + x.place);
      assert.ok(s * (x.entry - x.cut) > 0, 'cut on the losing side');
      assert.ok(x.oneR >= 1 - 1e-9, '1R at least $1');
      if (x.target != null) assert.ok(s * (x.target - x.entry) >= x.oneR - 1e-6, 'target 1R or more away');
      assert.ok(x.exitT >= x.fillT && x.fillT >= x.place, 'times in order');
    }
  };
  check(chain(walk(30000)).trades);
  const f = path.join(DIR, 'trades.json');
  if (fs.existsSync(f)) check(JSON.parse(fs.readFileSync(f, 'utf8')));
});

test('result.json matches RESULT.md and the pre-registered verdict rule', () => {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(r.verdict));
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp('\\*\\*' + r.verdict + '\\*\\*'));
  const p = r.chains.P;
  const expect = p.net.OOS.n < 30 || p.net.REP.n < 30 ? 'INCONCLUSIVE' : p.judge.pass ? 'PASS' : 'FAIL';
  assert.equal(r.verdict, expect);
  for (const k of ['P', 'S1', 'S2']) {
    const o = r.chains[k].net.OOS;
    assert.ok(md.includes(String(o.n)), k + ' OOS n in RESULT.md');
    assert.ok(md.includes(o.meanR.toFixed(3).replace('-', '−')) || md.includes(o.meanR.toFixed(3)), k + ' OOS mean in RESULT.md');
    assert.ok(md.includes(o.tMonth.toFixed(2).replace('-', '−')) || md.includes(o.tMonth.toFixed(2)), k + ' OOS month t in RESULT.md');
  }
});
