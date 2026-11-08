// node --test tests/research-fills.test.mjs — research (paper) rows follow the live fills rules (gold-fidelity, 8 Nov):
// a spot-shut candle (weekend, 17:00 NY rollover) decides nothing, and a fill candle that also reached the target is "missed"
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spotSkip, fillBarAmbiguous } from '../council/fills.mjs';

const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const loops = src.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /for \(const r of research\.filter\(\(x\) => x\.market === key && x\.k (===|!==) 'replica'/.test(l));

test('both research management loops skip spot-shut candles like the live loop', () => {
  assert.equal(loops.length, 2, 'the replica loop and the other-setups loop');
  for (const [n] of loops) {
    const body = src.split('\n').slice(n, n + 8).join('\n');
    assert.match(body, /if \(M\.group !== 'Crypto' && spotSkip\(b\.time\)\) continue;/, `loop at line ${n}`);
  }
});
test('a replica research fill that also reached the target in the same candle is missed, never a win', () => {
  const [n] = loops.find(([, l]) => /x\.k === 'replica'/.test(l));
  const body = src.split('\n').slice(n, n + 12).join('\n');
  assert.match(body, /fillBarAmbiguous\(b, s, r\.entry, r\.stop, r\.t1\)\) \{ r\.status = 'missed'; r\.R = 0;/);
  // the rule itself: a buy limit at 100, stop 99, target 102; the candle opens above the entry, dips to 99.5 and runs to 102.5
  assert.equal(fillBarAmbiguous({ open: 100.5, high: 102.5, low: 99.5, close: 102 }, false, 100, 99, 102), true);
  assert.equal(fillBarAmbiguous({ open: 100.5, high: 101, low: 99.5, close: 100.8 }, false, 100, 99, 102), false);
  // the 17:05 New York candle on a Tuesday is inside the rollover skip; a weekday 10:00 NY candle is not
  assert.equal(spotSkip(Math.floor(Date.parse('2026-11-03T22:05:00Z') / 1000)), true);
  assert.equal(spotSkip(Math.floor(Date.parse('2026-11-03T15:00:00Z') / 1000)), false);
});
