// node --test tests/nq-open-r0.test.mjs — the NQ open-run management loop in council/trader.mjs measures R from |entry - stop|
// on every Trader run, and the runner trail moves `stop`, so once the stop has trailed, the loop's "1R" is no longer the
// opening risk (research/proposals/2026-11-12-nq-open-r0.md, docs/owner-decisions.md item 48). The loop is lifted from the
// trader's own text and run on hand-made one-minute candles; the "proposed" loop is the same text with the one-line change
// of the proposal. Offline. Nothing here edits the trader: the proposal waits for the owner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stopFill, exitR } from '../council/fills.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TRADER = read('../council/trader.mjs');
const M1 = '    for (const r of openNq) {\n', M2 = '    if (NQ_ON.ny && ny.m >= 570';
const LOOP = TRADER.slice(TRADER.indexOf(M1), TRADER.indexOf(M2));
const OLD = "      const s = r.side === 'sell', r0 = Math.abs(r.entry - r.stop);\n";
// the proposal's change, word for word (research/proposals/2026-11-12-nq-open-r0.md, "The proposed diff")
const NEW = "      // the OPENING risk (12 Nov 2026, item 48): the runner trail moves r.stop, so |entry - stop| is no longer 1R once it has moved\n"
  + "      if (!(r.r0 > 0)) r.r0 = r.trailMoved && r.tp1 != null ? Math.abs(r.tp1 - r.entry) / 2 : Math.abs(r.entry - r.stop);\n"
  + "      const s = r.side === 'sell', r0 = r.r0;\n";
const nyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
function nyParts(t) { const o = {}; for (const p of nyFmt.formatToParts(new Date(t * 1000))) o[p.type] = p.value; return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute, wd: o.weekday }; }
const mk = (body) => new Function('openNq', 'bars', 'nyParts', 'stopFill', 'exitR', body);
const current = mk(LOOP), proposed = mk(LOOP.replace(OLD, NEW));

// Monday 16 Nov 2026, 10:00 ET = 15:00 UTC. A buy at 100, stop 90 (1R = 10), the live push's levels: 2R mark 120, target 10R
// 200, trail [2, 1] (config.nqRun = { atR: 2, trail: 1 }), out at 11:00 ET.
const T0 = Date.parse('2026-11-16T15:00:00Z') / 1000;
const rec = () => ({ id: 'nq-nyflip-2026-11-16', k: 'nq-open', session: 'nyflip', day: '2026-11-16', side: 'buy', entry: 100, stop: 90, t1: 200, rr: 10, tp1: 120,
  trail: [2, 1], opened: T0, filled: T0, checked: T0, status: 'open', R: null, exitAt: T0 + 3600, exitLabel: '11:00 ET' });
const bar = (i, o, h, l, c) => ({ time: T0 + 60 * i, open: o, high: h, low: l, close: c });
// The Trader runs every minute (quick pass) or every 30 s (live runner) and each run reads the candles closed so far:
// `runs` = how many candles each run newly sees.
function play(loop, bars, runs) {
  const r = rec(), log = []; let n = 0;
  for (const k of runs) { n += k; if (r.status !== 'open') break; loop([r], bars.slice(0, n), nyParts, stopFill, exitR); if (r.status === 'open' && n) r.checked = bars[n - 1].time; log.push({ stop: r.stop, mfe: r.mfe }); }
  return { r, log };
}
const A = [bar(1, 100, 112, 99, 111), bar(2, 111, 124, 110, 123),   // up to +2.4R: the trail starts, stop to 114 (= 100 + 1.4 x 10)
  bar(3, 123, 124, 121, 122),                                       // no new high
  bar(4, 122, 122.5, 119, 120), bar(5, 120, 121, 118, 119)];        // dips to 118, above the rule's stop of 114

test('the lifted loop is the trader\'s loop, and the line the proposal replaces is in it once', () => {
  assert.ok(LOOP.length > 500 && LOOP.includes('r.trailMoved = true'), 'the open-run management loop was found');
  assert.equal(LOOP.split(OLD).length, 2, 'the r0 line is there exactly once');
  assert.notEqual(LOOP.replace(OLD, NEW), LOOP);
});

test('one run over every candle: the stop trails as the rule says and nothing is booked (the defect needs a second run)', () => {
  for (const loop of [current, proposed]) {
    const { r } = play(loop, A, [A.length]);
    assert.equal(r.status, 'open'); assert.equal(r.stop, 114); assert.equal(r.mfe, 2.4);
  }
});

test('CONFIRMED: across runs the current loop re-reads 1R from the trailed stop, over-tightens the trail and books the exit in the wrong unit', () => {
  const runs = [2, 1, 1, 1];   // a Trader run after each new candle, as the quick pass does
  const cur = play(current, A, runs), pro = play(proposed, A, runs);
  // current code: run 2 takes r0 = |100 - 114| = 14 ("1R" is now 14 points), so the trail puts the stop at 100 + 1.4 x 14 = 119.6
  assert.deepEqual(cur.log.map((x) => x.stop), [114, 119.6, 119.6]);
  // run 3 takes r0 = 19.6: candle 4 (low 119) hits 119.6 and the trade is booked +1.00R
  assert.equal(cur.r.status, 'win'); assert.equal(cur.r.exit, 'trailing stop'); assert.equal(cur.r.closed, T0 + 240);
  assert.equal(cur.r.R, 1, 'booked +1.00R for an exit 19.6 points (1.96 x the opening 10-point risk) above the entry');
  assert.equal(exitR(false, 100, 119.6, 10), 1.96, 'the same exit price measured in the opening risk');
  // with the opening risk the stop stays where the rule puts it (114) and the dips to 119 and 118 do not reach it
  assert.deepEqual(pro.log.map((x) => x.stop), [114, 114, 114, 114]);
  assert.equal(pro.r.status, 'open'); assert.equal(pro.r.r0, 10, 'the opening risk is kept on the record (a new field)');
  // the result depends on how often the Trader runs: one run over the same candles never moved the stop past 114
  assert.equal(play(current, A, [A.length]).r.status, 'open');
});

test('CONFIRMED: mfe is understated once the stop has trailed, and the trail ratchets on its own wrong mfe', () => {
  const B = [...A.slice(0, 3), bar(4, 122, 130, 120, 129),            // a new high, +3.0R in the opening risk
    bar(5, 129, 129.5, 127, 128)];
  const runs = [2, 1, 1, 1];
  const cur = play(current, B, runs), pro = play(proposed, B, runs);
  // current: run 3 has r0 = 19.6, the high of 130 reads (130 - 100) / 19.6 = 1.53 "R" < 2.4 stored, so mfe stays 2.4 ...
  assert.equal(cur.log[2].mfe, 2.4, 'mfe 2.4 although price reached +3.0R');
  // ... and the trail places the stop at 100 + (2.4 - 1) x 19.6 = 127.44, which candle 5 (low 127) hits: booked 1.00R
  assert.equal(cur.log[2].stop, 127.44); assert.equal(cur.r.status, 'win'); assert.equal(cur.r.R, 1);
  assert.equal(exitR(false, 100, 127.44, 10), 2.74, 'that exit in the opening risk');
  // with the opening risk: mfe 3.0, stop 100 + (3 - 1) x 10 = 120, candle 5 does not reach it
  assert.equal(pro.log[2].mfe, 3); assert.equal(pro.log[2].stop, 120); assert.equal(pro.r.status, 'open');
});

test('the time exit after a trail is booked in the trailed unit too', () => {
  const C = [...A.slice(0, 3), bar(61, 125, 125, 125, 125)];            // the 11:00 ET candle opens at 125 (+2.5R)
  const cur = play(current, C, [2, 1, 1]), pro = play(proposed, C, [2, 1, 1]);
  // current: run 2 moved the stop to 119.6 (no candle reached it), run 3 books (125 - 100) / 19.6 = 1.28R
  assert.equal(cur.r.exit, '11:00 ET'); assert.equal(cur.r.R, 1.28);
  assert.equal(pro.r.exit, '11:00 ET'); assert.equal(pro.r.R, 2.5);
});

test('nothing changes before the stop has moved: a straight stop-out, a target and a time exit book the same R either way', () => {
  const D = [bar(1, 100, 101, 89, 90)], E = [bar(1, 100, 112, 99, 111), bar(2, 111, 119, 110, 118), bar(61, 105, 105, 105, 105)];
  for (const [bars, runs] of [[D, [1]], [E, [1, 1, 1]], [E, [3]]]) {
    const a = play(current, bars, runs).r, b = play(proposed, bars, runs).r;
    assert.equal(a.R, b.R); assert.equal(a.status, b.status); assert.equal(a.stop, b.stop); assert.equal(a.closed, b.closed);
  }
  // a sell mirrors it
  const s = rec(); Object.assign(s, { side: 'sell', stop: 110, t1: 0, tp1: 80 });
  const F = [bar(1, 100, 101, 88, 89), bar(2, 89, 90, 76, 77), bar(3, 77, 82, 76.5, 81), bar(4, 81, 83, 80, 82)];
  const runS = (loop) => { const r = structuredClone(s); for (let n = 2; n <= F.length && r.status === 'open'; n++) { loop([r], F.slice(0, n), nyParts, stopFill, exitR); if (r.status === 'open') r.checked = F[n - 1].time; } return r; };
  const cs = runS(current), ps = runS(proposed);
  // current: stop 86, then 100 - 1.4 x 14 = 80.4; candle 4 opens 81 above it and fills there: booked (100 - 81) / 19.6 = 0.97R
  assert.equal(cs.status, 'win'); assert.equal(cs.R, 0.97); assert.equal(exitR(true, 100, 81, 10), 1.9, 'that exit in the opening risk');
  assert.equal(ps.status, 'open'); assert.equal(ps.stop, 86);
});

test('a record that has already trailed without r0 takes its opening risk from the 2R mark (tp1), never from the trailed stop', () => {
  const r = rec(); Object.assign(r, { stop: 114, trailMoved: true, mfe: 2.4 });
  proposed([r], [bar(1, 123, 124, 121, 122)], nyParts, stopFill, exitR);
  assert.equal(r.r0, 10); assert.equal(r.stop, 114);
});
