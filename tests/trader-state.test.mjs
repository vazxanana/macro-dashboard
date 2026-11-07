// Offline tests for the Trader's trade-state edge cases (council/fills.mjs helpers, used by council/trader.mjs):
// gaps through the stop, a candle that hits both the fill and the target, candles while spot is shut, missing candles.
//   node --test tests/trader-state.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stopFill, exitR, fillBarAmbiguous, spotClosed } from '../council/fills.mjs';

const ts = (iso) => Date.parse(iso) / 1000;

// A small manager with the Trader's own order of checks (council/trader.mjs, "Manage open trades"): skip shut-market candles,
// resting-limit fill (ambiguous fill candle = missed), stop before target, gap-aware stop price.
function manage(tr, bars, { crypto = false } = {}) {
  const s = tr.side === 'sell';
  for (const b of bars) {
    if (!crypto && spotClosed(b.time)) continue;
    if (tr.status === 'pending') {
      if (s ? b.high >= tr.entry : b.low <= tr.entry) {
        if (fillBarAmbiguous(b, s, tr.entry, tr.stop, tr.t1)) { tr.status = 'missed'; tr.R = 0; break; }
        tr.status = 'open'; tr.filled = b.time;
      } else if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'missed'; tr.R = 0; break; } else continue;
    }
    const r0 = Math.abs(tr.entry - tr.stop0);
    if (s ? b.high >= tr.stop : b.low <= tr.stop) {
      const px = stopFill(b, s, tr.stop, b.time > tr.filled);
      tr.R = tr.beMoved || px !== tr.stop ? exitR(s, tr.entry, px, r0) : -1; tr.status = tr.R < 0 ? 'loss' : 'be'; tr.exitPx = px; break;
    }
    if (s ? b.low <= tr.t1 : b.high >= tr.t1) { tr.status = 'win'; tr.R = tr.rr; tr.exitPx = tr.t1; break; }
  }
  return tr;
}
const bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });

test('weekend gap through the stop fills at the Monday open, not at the stop', () => {
  // buy 4000, stop 3990: Friday closes 3995, Sunday's reopen candle opens at 3970
  const fri = ts('2026-11-06T21:58:00Z'), sun = ts('2026-11-08T23:00:00Z');
  const tr = manage({ side: 'buy', entry: 4000, stop: 3990, stop0: 3990, t1: 4030, rr: 3, status: 'open', filled: fri - 3600 },
    [bar(fri, 3996, 3997, 3995, 3995), bar(sun, 3970, 3975, 3965, 3972)]);
  assert.equal(tr.status, 'loss'); assert.equal(tr.exitPx, 3970); assert.equal(tr.R, -3);
});

test('a sell gapped through its stop fills at the open too; a stop touched intrabar still fills at the stop', () => {
  const t0 = ts('2026-11-04T10:00:00Z');
  const a = manage({ side: 'sell', entry: 100, stop: 102, stop0: 102, t1: 94, rr: 3, status: 'open', filled: t0 - 60 }, [bar(t0, 103, 104, 102.5, 103)]);
  assert.equal(a.exitPx, 103); assert.equal(a.R, -1.5);
  const b = manage({ side: 'sell', entry: 100, stop: 102, stop0: 102, t1: 94, rr: 3, status: 'open', filled: t0 - 60 }, [bar(t0, 101, 102.4, 100.5, 101)]);
  assert.equal(b.exitPx, 102); assert.equal(b.R, -1);
});

test('breakeven stop gapped through is a loss at the open, not 0R', () => {
  const t0 = ts('2026-11-04T10:00:00Z');
  const tr = manage({ side: 'buy', entry: 100, stop: 100, stop0: 98, beMoved: true, t1: 106, rr: 3, status: 'open', filled: t0 - 600 }, [bar(t0, 99, 99.5, 98.8, 99.2)]);
  assert.equal(tr.status, 'loss'); assert.equal(tr.R, -0.5);
});

test('on the fill candle the open came before the fill: the stop price is used', () => {
  // buy limit 100 (stop 98), candle opens 101, trades down to 97: filled at 100 then stopped at 98
  const t0 = ts('2026-11-04T10:00:00Z');
  const tr = manage({ side: 'buy', entry: 100, stop: 98, stop0: 98, t1: 106, rr: 3, status: 'pending' }, [bar(t0, 101, 101.5, 97, 97.5)]);
  assert.equal(tr.status, 'loss'); assert.equal(tr.R, -1); assert.equal(stopFill(bar(t0, 97, 98, 96, 97), false, 98, false), 98);
});

test('a candle that hits both stop and target is a loss', () => {
  const t0 = ts('2026-11-04T10:00:00Z');
  const tr = manage({ side: 'buy', entry: 100, stop: 98, stop0: 98, t1: 106, rr: 3, status: 'open', filled: t0 - 60 }, [bar(t0, 100, 107, 97, 104)]);
  assert.equal(tr.status, 'loss'); assert.equal(tr.R, -1);
});

test('a limit fill and the target in one candle, order unknown: missed, never a win', () => {
  const t0 = ts('2026-11-04T10:00:00Z');
  // buy limit 100, target 103, stop 99: candle opens 101.5 (above the entry), low 100, high 103.5
  const amb = manage({ side: 'buy', entry: 100, stop: 99, stop0: 99, t1: 103, rr: 3, status: 'pending' }, [bar(t0, 101.5, 103.5, 100, 102)]);
  assert.equal(amb.status, 'missed'); assert.equal(amb.R, 0);
  // the candle opened at/through the entry: the fill came first, the target after it: a win
  const ok = manage({ side: 'buy', entry: 100, stop: 99, stop0: 99, t1: 103, rr: 3, status: 'pending' }, [bar(t0, 99.8, 103.5, 99.6, 103)]);
  assert.equal(ok.status, 'win');
  // fill, stop and target in one candle: the stop wins (conservative)
  const all = manage({ side: 'buy', entry: 100, stop: 99, stop0: 99, t1: 103, rr: 3, status: 'pending' }, [bar(t0, 101.5, 103.5, 98.5, 100)]);
  assert.equal(all.status, 'loss');
  assert.equal(fillBarAmbiguous(bar(t0, 97.5, 99, 96.5, 97), true, 98, 100, 97), true);   // sell limit 98: opens under it, up to 99, down to the 97 target
});

test('spot market hours follow New York time (Fri 17:00 to Sun 17:00), daylight saving included', () => {
  assert.equal(spotClosed(ts('2026-11-06T21:59:00Z')), false);   // Fri 16:59 EST
  assert.equal(spotClosed(ts('2026-11-06T22:00:00Z')), true);    // Fri 17:00 EST
  assert.equal(spotClosed(ts('2026-11-07T12:00:00Z')), true);    // Saturday
  assert.equal(spotClosed(ts('2026-11-08T21:59:00Z')), true);    // Sun 16:59 EST
  assert.equal(spotClosed(ts('2026-11-08T22:00:00Z')), false);   // Sun 17:00 EST
  assert.equal(spotClosed(ts('2026-07-10T21:00:00Z')), true);    // Fri 17:00 EDT
  assert.equal(spotClosed(ts('2026-07-10T20:59:00Z')), false);
  assert.equal(spotClosed(ts('2026-11-04T03:00:00Z')), false);   // midweek
});

test('weekend PAXG candles (Kraken fallback) cannot stop a gold trade; crypto keeps trading', () => {
  const sat = ts('2026-11-07T12:00:00Z'), mon = ts('2026-11-09T08:00:00Z');
  const g = manage({ side: 'buy', entry: 4000, stop: 3990, stop0: 3990, t1: 4030, rr: 3, status: 'open', filled: sat - 86400 }, [bar(sat, 3995, 3996, 3980, 3992), bar(mon, 3993, 4000, 3992, 3998)]);
  assert.equal(g.status, 'open');
  const c = manage({ side: 'buy', entry: 4000, stop: 3990, stop0: 3990, t1: 4030, rr: 3, status: 'open', filled: sat - 86400 }, [bar(sat, 3995, 3996, 3980, 3992)], { crypto: true });
  assert.equal(c.status, 'loss'); assert.equal(c.R, -1);
});

test('missing candles: the first candle after a hole carries the gap', () => {
  const t0 = ts('2026-11-04T10:00:00Z');
  const tr = manage({ side: 'buy', entry: 100, stop: 98, stop0: 98, t1: 106, rr: 3, status: 'open', filled: t0 - 60 }, [bar(t0, 100, 100.5, 99.5, 100), bar(t0 + 3 * 3600, 97, 97.5, 96, 97)]);
  assert.equal(tr.exitPx, 97); assert.equal(tr.R, -1.5);
});

test('the Trader wires the helpers into every stop check it makes', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{[^}]*stopFill[^}]*\} from '\.\/fills\.mjs'/);
  assert.equal((src.match(/stopFill\(b, s, (tr|r)\.stop/g) || []).length, 4, 'main loop, replica research, other research, NQ');
  assert.match(src, /fillBarAmbiguous\(b, s, tr\.entry, tr\.stop, tr\.t1\)/);
  assert.match(src, /spotClosed\(b\.time\)/);
  assert.match(src, /annotateCosts\(trades, MARKETS, model\)/);
  // no stop check left that books a flat -1R without looking at the candle's open
  assert.doesNotMatch(src, /b\.low <= r\.stop\) \{ r\.status = 'loss'; r\.R = -1;/);
  assert.doesNotMatch(src, /else \{ tr\.status = 'loss'; tr\.R = -1; \}/);
});
