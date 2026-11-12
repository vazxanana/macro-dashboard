// Gold daily engulf reads trading days (12 Nov 2026, owner approved fidelity fix, docs/owner-decisions.md item 52).
// The case: on 10 Nov 2026 the live block took its zone from OANDA's Sunday 8 Nov daily candle, the ~2-hour stub between the
// 22:00 UTC reopen and midnight (volume 18,276 against 400,000+ on a weekday, range $19), so the stop sat about $21 under the
// entry (xau-geg-1794096000, stopped out). The pre-registered research/edge/gold-weekend study folds Saturday / Sunday candles into
// the next weekday ("ADOPT" for geg); this test runs the Trader's own engulf block (lifted from council/trader.mjs) on the real
// OANDA daily candles of that week (tests/fixtures/xau-d1-oanda-2026-11.json) and shows the stub no longer becomes a zone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { foldWeekend, gegFresh, spotClosed, ownStream } from '../council/fills.mjs';
import { rederiveGeg } from '../council/feed.mjs';

const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const TRADER = rd('council/trader.mjs');
const seg = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); assert.ok(i > 0 && j > i, 'block not found: ' + a.slice(0, 50)); return s.slice(i, j + b.length); };
const BLOCK = seg(TRADER, "    if (key === 'xau' && config.goldEG) {", '} catch (e) { snapshot.errors.goldEG = String(e.message || e); }') + '\n    }';
const D1 = JSON.parse(rd('tests/fixtures/xau-d1-oanda-2026-11.json')).rows.map(([time, open, high, low, close]) => ({ time, open, high, low, close }));
const ts = (s) => Date.parse(s) / 1000;
const SUN_STUB = ts('2026-11-08T00:00:00Z'), MON = ts('2026-11-09T00:00:00Z'), FRI = ts('2026-11-06T00:00:00Z');
const EG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 };

// the block before item 52 (the two lines put back as they were on 11 Nov), for the comparison
const OLD = BLOCK.replace(/        \/\/ trading days \(owner[^\n]*\n[^\n]*\n        const EG = config\.goldEG, D = foldWeekend\(src\['1d'\]\.bars\.filter\(\(b\) => b\.time \+ 86400 <= now\)\),/,
  "        const EG = config.goldEG, D = src['1d'].bars.slice(0, -1),").replace('gegFresh(last.time, now)', 'now - (last.time + 86400) < 86400');

function run(block, now, price) {
  const trades = [], snapshot = { errors: {} };
  const fn = new Function('key', 'config', 'src', 'trades', 'now', 'price', 'M', 'CFG', 'FEED', 'snapshot', 'ownerSh', 'ownStream', 'foldWeekend', 'gegFresh', block);
  fn('xau', { goldEG: EG }, { '1d': { bars: D1.filter((b) => b.time <= now) } }, trades, now, price, { label: 'XAU/USD', dec: 1 }, { buf: 0.15 }, 'oanda', snapshot, () => false, ownStream, foldWeekend, gegFresh);
  assert.deepEqual(snapshot.errors, {});
  return { trades, state: snapshot.goldEG.state };
}

test('the lifted block really is the old rule without the change: on 10 Nov 00:05 UTC it took the Sunday 8 Nov stub as its base (the live trade)', () => {
  assert.notEqual(OLD, BLOCK);
  assert.ok(!OLD.includes('foldWeekend') && !OLD.includes('gegFresh'));
  const { trades } = run(OLD, 1794269093, 4139);   // the live order's opened time and the price then
  assert.equal(trades.length, 1);
  assert.equal(trades[0].id, `xau-geg-${SUN_STUB}`, 'the live id: xau-geg-1794096000');
  assert.deepEqual(trades[0].zone, [4054.39, 4073.45], "the live record's zone");
  assert.ok(trades[0].entry - trades[0].stop < 20, 'a stop under $20 away, from a two-hour candle');
});

test('with trading days the Sunday stub is never a zone: Monday carries it, and the base is the last real red day (Friday 6 Nov)', () => {
  const { trades, state } = run(BLOCK, 1794269093, 4139);
  assert.ok(trades.every((t) => new Date(+t.id.split('-').pop() * 1000).getUTCDay() % 6 !== 0), 'no weekend-dated base');
  assert.equal(trades.length, 1);
  assert.equal(trades[0].id, `xau-geg-${FRI}`);
  assert.deepEqual(trades[0].zone, [4029.83, 4107.09]);
  assert.equal(trades[0].stop, 4029.53, 'stop $0.30 under the base candle low');
  assert.ok(trades[0].entry - trades[0].stop > 75, 'a full trading day of range');
  assert.ok(trades[0].stop < trades[0].entry, 'every trade has its stop on the losing side');
  assert.equal(state.lastClose, 4138.915);
});

test('foldWeekend: a Saturday / Sunday candle goes into the next weekday (its time and close, first weekend open, high / low over all); a trailing weekend candle is left out', () => {
  const F = foldWeekend(D1);
  assert.ok(F.every((b) => { const d = new Date(b.time * 1000).getUTCDay(); return d >= 1 && d <= 5; }));
  const mon = F.find((b) => b.time === MON), stub = D1.find((b) => b.time === SUN_STUB), raw = D1.find((b) => b.time === MON);
  assert.deepEqual([mon.open, mon.high, mon.low, mon.close], [stub.open, Math.max(stub.high, raw.high), Math.min(stub.low, raw.low), raw.close]);
  assert.equal(foldWeekend([...D1.filter((b) => b.time < MON)]).at(-1).time, FRI, 'Sunday with no closed Monday after it belongs to the forming Monday');
  assert.deepEqual(foldWeekend([]), []); assert.deepEqual(foldWeekend(null), []);
  // the same fold as the study's replay-intended.mjs (its WEEKEND 1 lines), on the real candles
  const src = rd('research/edge/gold-weekend/replay-intended.mjs'), i = src.indexOf('const D1 = []; { let carry = null;'), j = src.indexOf('carry = null; } }', i);
  const study = new Function('D1raw', src.slice(i, j + 'carry = null; } }'.length) + '\nreturn D1;')(D1);
  assert.deepEqual(F.map((b) => [b.time, b.open, b.high, b.low, b.close]), study.map((b) => [b.time, b.open, b.high, b.low, b.close]));
});

test('gegFresh: 24 h from the reopen after the day (Monday-Thursday the day end; Friday the Sunday 17:00 New York reopen); never while spot is shut', () => {
  const mon = MON;
  assert.ok(gegFresh(mon, mon + 86400 + 60)); assert.ok(gegFresh(mon, mon + 2 * 86400 - 60)); assert.ok(!gegFresh(mon, mon + 2 * 86400 + 60));
  assert.ok(!gegFresh(FRI, FRI + 86400 + 3600), 'Saturday: shut');
  const reopen = ts('2026-11-08T22:00:00Z');
  assert.ok(spotClosed(reopen - 60) && !spotClosed(reopen));
  assert.ok(!gegFresh(FRI, reopen - 60)); assert.ok(gegFresh(FRI, reopen + 60)); assert.ok(gegFresh(FRI, reopen + 86400 - 60)); assert.ok(!gegFresh(FRI, reopen + 86400 + 60));
  assert.ok(!gegFresh(ts('2026-11-05T00:00:00Z'), ts('2026-11-06T22:30:00Z')), 'Thursday signal, Friday after the 17:00 New York close: shut');
});

test('a feed switch re-derives the zone on the same trading days: a Monday base carries the stub, a Sunday-dated base is cancelled', () => {
  const tr = (t) => ({ id: `xau-geg-${t}`, k: 'geg' });
  assert.equal(rederiveGeg(tr(SUN_STUB), D1, EG, 4139, 2), null, 'the stub is no base candle any more');
  const f = rederiveGeg(tr(FRI), D1, EG, 4139, 2);
  assert.deepEqual([f.entry, f.stop, f.zone], [4107.09, 4029.53, [4029.83, 4107.09]]);
});

test('scope: only the engulf reads trading days; the Gold trend legs keep the raw daily candles (gold-weekend: KEEP), and the docs carry item 52', () => {
  const legs = seg(TRADER, "    for (const LEG of [{ cfg: config.goldTrend, k: 'gtrend'", '} catch (e) { snapshot.errors[LEG.snap] = String(e.message || e); }');
  assert.ok(legs.includes("D = src['1d'].bars.slice(0, -1)") && !legs.includes('foldWeekend'));
  assert.equal((TRADER.match(/foldWeekend\(/g) || []).length, 1, 'one reader in the Trader: the engulf block');
  const od = rd('docs/owner-decisions.md');
  assert.match(od, /### \[x\] 52\. [^\n]*Sunday/); assert.match(od.slice(od.indexOf('### [x] 52.')), /approved 12 Nov 2026/);
  assert.match(rd('CLAUDE.md'), /## Gold daily engulf reads trading days \(12 Nov 2026/);
});
