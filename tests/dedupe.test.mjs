// One order is recorded once (12 Nov 2026, owner approved "count duplicates once"): council/dedupe.mjs, the Trader's
// recordOnce step, the one-time repair voidExactTwins and the cTrader mirror's guard. Offline.
//   node --test tests/dedupe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sameOrder, twinOf, recordOnce, dropTwins, findDuplicates, isDup, DUP_TOL } from '../council/dedupe.mjs';
import { voidExactTwins, EXACT_TWINS_KEY } from '../council/repairs.mjs';
import { alertable } from '../council/alerts.mjs';

const NOW = 1794482833, ISO = '2026-11-12T16:00:00.000Z';
const mk = (k, extra = {}) => ({ id: `gbpusd-${k}-${extra.opened ?? NOW}`, market: 'gbpusd', k, side: 'sell', entry: 1.3269, stop: 1.3279, t1: 1.32488,
  opened: NOW, checked: NOW, status: 'pending', R: null, shadow: true, blockedBy: ['focus'], note: 'Shadow (focus)', ...extra });
const DONE = new Set(['win', 'loss', 'be']);

test('the definition: same market, side, second, entry, stop and target; anything else is another trade', () => {
  const a = mk('intraday'), b = mk('scalp');
  assert.ok(sameOrder(a, b) && sameOrder(b, a));
  assert.ok(sameOrder(a, mk('scalp', { stop: 1.3279 + 1.3269 * DUP_TOL / 2 })), 'float noise is the same price');
  for (const [why, x] of [['another target', mk('rscalp', { t1: 1.3259 })], ['a tick away', mk('scalp', { stop: 1.32791 })],
    ['another entry', mk('scalp', { entry: 1.32691 })], ['another second', mk('scalp', { opened: NOW + 1 })], ['other side', mk('scalp', { side: 'buy' })],
    ['other market', mk('scalp', { market: 'eurusd' })], ['a pyramid add', mk('scalp', { addOf: 'x' })]]) assert.equal(sameOrder(a, x), false, why);
  assert.equal(sameOrder(a, a), false, 'a record is not its own twin');
  // an existing duplicate or void record is never the original
  assert.equal(twinOf(b, [a]), a); assert.equal(twinOf(b, [{ ...a, status: 'duplicate', dupOf: 'z' }]), null); assert.equal(twinOf(b, [{ ...a, void: true }]), null);
});

test('recordOnce: the second record of the same order becomes a duplicate, never managed, alerted or counted', () => {
  const T = [mk('intraday')], tr = mk('scalp');
  const d = recordOnce(T, tr, NOW); T.push(tr);
  assert.equal(d, tr);
  assert.equal(tr.status, 'duplicate'); assert.equal(tr.dupOf, T[0].id); assert.ok(tr.void && tr.shadow && tr.blockedBy.includes('duplicate'));
  assert.equal(tr.R, null); assert.equal(tr.closed, NOW); assert.match(tr.note, /^Duplicate of gbpusd-intraday-/);
  assert.equal(T[0].status, 'pending', 'the kept record is untouched'); assert.equal(T[0].dupOf, undefined);
  // a third record of the same order is a duplicate of the kept one, not of the duplicate
  const t3 = mk('rintra'); recordOnce(T, t3, NOW); assert.equal(t3.dupOf, T[0].id);
  // nothing new for a different target
  const other = mk('rscalp', { t1: 1.3259 }); assert.equal(recordOnce(T, other, NOW), null); assert.equal(other.status, 'pending');
});

test('recordOnce never hides a live trade: a live second record keeps the order, the shadow first one is the duplicate', () => {
  const sh = mk('intraday', { shadow: true }), live = mk('scalp', { shadow: false, blockedBy: [], note: 'live' });
  const T = [sh]; const d = recordOnce(T, live, NOW); T.push(live);
  assert.equal(d, sh); assert.equal(sh.status, 'duplicate'); assert.equal(sh.dupOf, live.id);
  assert.equal(live.status, 'pending'); assert.equal(live.shadow, false);
  assert.deepEqual(alertable(T, []).map((x) => x.id), [live.id], 'one live record reaches the alerts');
  // two live records: the second is the duplicate (and leaves the live book)
  const a = mk('intraday', { shadow: false }), b = mk('scalp', { shadow: false });
  const U = [a]; recordOnce(U, b, NOW); U.push(b);
  assert.deepEqual(alertable(U, []).map((x) => x.id), [a.id]);
});

test('the Trader calls recordOnce right before it pushes a new setup trade, and the repair once after loading', () => {
  const src = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ recordOnce \} from '\.\/dedupe\.mjs'/);
  assert.match(src, /recordOnce\(trades, tr, now\);\n\s*trades\.push\(tr\);/);
  const load = src.indexOf("let trades = rd('trades.json'"), call = src.indexOf('voidExactTwins(trades, config, nowISO)');
  assert.ok(load > 0 && call > load, 'repair after the trades are loaded');
  assert.ok(call < src.indexOf('// ─── Take new Ready setups ───'));
});

test('findDuplicates and voidExactTwins: exact twins are marked (never deleted), R kept, the live one kept, once', () => {
  const T = [
    mk('intraday', { status: 'win', R: 1.65, Rnet: 1.56, closed: NOW + 3600 }), mk('scalp', { status: 'win', R: 1.65, Rnet: 1.56, closed: NOW + 3600 }),
    mk('position', { opened: NOW - 60, t1: 1.30, status: 'loss', R: -1 }), mk('swing', { opened: NOW - 60, t1: 1.31, status: 'win', R: 0.4 }),   // other target: distinct
    mk('intraday', { opened: NOW - 120, status: 'open', shadow: true }), mk('scalp', { opened: NOW - 120, status: 'open', shadow: false }),     // the live one is kept
    mk('scalp', { opened: NOW - 180, status: 'loss', R: -1 }), mk('scalp', { opened: NOW - 180 + 600, status: 'loss', R: -1 }),               // 10 min apart: distinct
  ];
  T[5].id = 'gbpusd-scalp-live';
  assert.equal(findDuplicates(T).length, 2);
  const config = {}, n0 = T.length;
  assert.equal(voidExactTwins(T, config, ISO), 2);
  assert.equal(T.length, n0, 'nothing deleted');
  const dup = T.filter(isDup);
  assert.deepEqual(dup.map((x) => x.k + '@' + x.opened), [`scalp@${NOW}`, `intraday@${NOW - 120}`]);
  assert.equal(dup[0].dupOf, T[0].id); assert.equal(dup[0].R, 1.65, 'R kept for the record');
  assert.equal(dup[1].dupOf, 'gbpusd-scalp-live'); assert.equal(dup[1].closed, Date.parse(ISO) / 1000, 'an open duplicate is closed at the repair');
  assert.ok(dup.every((x) => x.void && /same order as/.test(x.voidWhy)));
  assert.equal(T[5].status, 'open', 'the live twin keeps the order');
  assert.ok(['loss', 'win'].includes(T[2].status) && ['loss', 'win'].includes(T[3].status), 'another target is never touched');
  const closed = T.filter((x) => DONE.has(x.status));
  assert.equal(closed.reduce((a, x) => a + x.R, 0).toFixed(2), (1.65 - 1 + 0.4 - 1 - 1).toFixed(2), 'every closed-trade tally counts the order once');
  assert.deepEqual(config.repairs, [EXACT_TWINS_KEY]); assert.equal(config.history.length, 1); assert.match(config.history[0].change, /2 exact duplicate records .*1 scalp of intraday, 1 intraday of scalp; 0 live; \+1\.65R gross/);
  const snap = JSON.stringify(T); assert.equal(voidExactTwins(T, config, ISO), 0); assert.equal(JSON.stringify(T), snap, 'a second run changes nothing');
});

test('the cTrader mirror never copies one order twice', () => {
  const a = mk('intraday', { status: 'open' }), b = mk('scalp', { status: 'open' }), c = mk('rscalp', { status: 'open', t1: 1.3259 });
  const none = () => false;
  assert.deepEqual(dropTwins([a, b, c], [a, b, c], none).map((x) => x.k), ['intraday', 'rscalp'], 'the second twin of a round is dropped');
  assert.deepEqual(dropTwins([b, c], [a, b, c], (id) => id === a.id).map((x) => x.k), ['rscalp'], 'a twin of a copied order is dropped');
  assert.deepEqual(dropTwins([{ ...b, status: 'duplicate', dupOf: a.id }], [], none), [], 'a duplicate record is never a candidate');
  const src = fs.readFileSync(new URL('../council/ctrader-mirror.mjs', import.meta.url), 'utf8');
  assert.match(src, /import \{ dropTwins, sameOrder \} from '\.\/dedupe\.mjs'/);
  assert.match(src, /\.filter\(\(t, i, arr\) => dropTwins\(\[t\], trades, \(id\) => !!\(st\.map\[id\] \|\| st\.orders\[id\] \|\| \(exclude && exclude\.has\(id\)\)\)\)\.length && !arr\.slice\(0, i\)\.some\(\(u\) => sameOrder\(u, t\)\)\);/);
});

test('the pinned council-data copy: the repair finds only exact twins and leaves every other record as it was', () => {
  const T = JSON.parse(fs.readFileSync(new URL('./fixtures/council/trades.json', import.meta.url), 'utf8'));
  const before = T.map((x) => JSON.stringify(x));
  const found = findDuplicates(T);
  for (const { dup, keep } of found) assert.ok(sameOrder(dup, keep));
  voidExactTwins(T, {}, ISO);
  const changed = T.filter((x, i) => JSON.stringify(x) !== before[i]);
  assert.equal(changed.length, found.length);
  assert.ok(changed.every((x) => x.status === 'duplicate' && x.dupOf));
});
