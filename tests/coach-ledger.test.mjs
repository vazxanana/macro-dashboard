// node --test tests/coach-ledger.test.mjs — the Coach's change ledger and its analysis/latest.md block (council/coach.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CC, ledgerStart, ledgerFromHistory, settle, syncLedger, scopeOf, ledgerSection, LEDGER_START, LEDGER_END } from '../council/coach.mjs';
import { injectSection } from '../council/analyst.mjs';

const DAY = 86400, AT = '2026-11-08T06:00:00.000Z', T0 = Date.parse(AT) / 1000;
let seq = 0;
const tr = (R, d1, at, k = 'scalp', market = 'eurusd') => ({ id: `t${seq++}`, k, market, R, status: R > 0 ? 'win' : R < 0 ? 'loss' : 'be', opened: at, closed: at + 3600, feat: { d1, session: 'london', struct: 'main' } });

// the evidence sample (30 days before the change) and 30 days of forward signals
const sample = [], fwd = [];
for (let i = 0; i < 40; i++) sample.push(tr(i % 5 ? -1 : 1.5, 'with', T0 - (i + 1) * 3600 * 12));   // with D1: -0.50R each
for (let i = 0; i < 40; i++) sample.push(tr(i % 3 ? -1 : 3, 'against', T0 - (i + 1) * 3600 * 12));  // against D1: +0.40R each
for (let i = 0; i < 20; i++) fwd.push(tr(i % 4 ? -1 : 1, 'with', T0 + (i + 1) * DAY));               // with D1 keeps losing
for (let i = 0; i < 20; i++) fwd.push(tr(i % 2 ? -1 : 2, 'against', T0 + (i + 1) * DAY));

test('a trial entry carries the evidence and both rules on the same sample', () => {
  const e = ledgerStart({ at: AT, k: 'scalp', fe: 'd1', champion: null, challenger: 'against', what: 'scalp: only against D1', why: 'test', sample, group: sample.filter((t) => t.feat.d1 === 'with'), tau: 0.25 });
  assert.equal(e.id, `cc-scalp-d1-${T0}`); assert.equal(e.change, 'scalp: only against D1');
  assert.deepEqual(e.before, { n: 80, R: -4, exp: -0.05 });     // champion: every signal
  assert.deepEqual(e.after, { n: 40, R: 16, exp: 0.4 });       // challenger: against D1 only
  assert.equal(e.evidence.group.n, 40); assert.equal(e.evidence.group.exp, -0.5); assert.ok(e.evidence.group.shrunk > -0.5 && e.evidence.group.shrunk < 0);
  assert.equal(e.trial.status, 'running'); assert.equal(e.d30.due, '2026-12-08T06:00:00.000Z');
  // 30 days later: champion vs challenger on the forward signals
  assert.equal(settle(e, fwd, T0 + 10 * DAY), false, 'not due yet');
  assert.equal(settle(e, fwd, T0 + CC.days30 * DAY), true);
  assert.deepEqual(e.d30.champion, { n: 40, R: 0, exp: 0 });
  assert.deepEqual(e.d30.challenger, { n: 20, R: 10, exp: 0.5 });
  assert.equal(e.d30.deltaR, 10); assert.equal(e.d30.helped, true);
  assert.equal(settle(e, fwd, T0 + 40 * DAY), false, 'settled once');
});

test('scope of a history change', () => {
  assert.deepEqual(scopeOf('scalp, rscalp: skip the asia session'), { setups: ['scalp', 'rscalp'] });
  assert.deepEqual(scopeOf('Paused rintra for 3 days'), { setups: ['rintra'] });
  assert.deepEqual(scopeOf('Resumed market xau'), { market: 'xau' });
  assert.deepEqual(scopeOf('Minimum stop 1 → 1.1 ATR'), { all: true });
});

test('other Coach changes: before / after on their scope; history synced once, owner and trial entries skipped', () => {
  const pool = sample.concat(fwd, [tr(-1, 'with', T0 - DAY, 'rintra')]);
  const H = [
    { at: AT, by: 'coach-stats', change: 'Minimum stop 1 → 1.1 ATR', why: 'Reviews: 3 losses had a stop inside one normal candle.' },
    { at: AT, by: 'user', change: 'Scalp back to shadow (owner delegated)', why: '' },
    { at: AT, by: 'coach-trial', change: 'scalp: back to the champion rule (no D1 rule)', why: 'x', trial: 'cc-scalp-d1-1' },
    { at: '2026-11-07T06:00:00.000Z', by: 'coach-stats', change: 'rintra: dropped the D1 rule', why: 'y' },
  ];
  let L = syncLedger([], H, pool, T0 + DAY, { backfillBefore: AT });
  assert.equal(L.length, 2);
  const [rintra, stop] = L;
  assert.equal(rintra.backfilled, true); assert.equal(stop.backfilled, undefined);
  assert.deepEqual(stop.scope, { all: true }); assert.equal(stop.before.n, 81);
  assert.equal(stop.evidence.why, 'Reviews: 3 losses had a stop inside one normal candle.');
  L = syncLedger(L, H, pool, T0 + CC.days30 * DAY + 60);
  assert.equal(L.length, 2, 'no duplicates');
  assert.deepEqual(L[1].before, { n: 81, R: -5, exp: -0.06 });
  assert.deepEqual(L[1].d30.after, { n: 40, R: 0, exp: 0 });
  assert.equal(L[1].d30.deltaExp, 0.06); assert.equal(L[1].d30.helped, true);
});

test('the analysis/latest.md block: trials, ledger rows and the 30-day tally', () => {
  const e = ledgerStart({ at: AT, k: 'scalp', fe: 'd1', champion: null, challenger: 'against', what: 'scalp: only against D1', why: 'w', sample, group: sample.slice(0, 40) });
  e.trial = { status: 'running', n: 7, deltaR: 3.5, shrunk: 0.12 };
  const g = ledgerFromHistory({ at: AT, by: 'coach-stats', change: 'Minimum stop 1 → 1.1 ATR', why: 'Reviews' }, sample);
  const md0 = '# Week\n\nText.\n\n## Top 3 to watch\n- a\n';
  const sec = ledgerSection({ ledger: [g, e], trials: { 'scalp:d1': { id: e.id, k: 'scalp', fe: 'd1', champion: null, challenger: 'against', start: AT } }, now: T0 + DAY });
  assert.ok(sec.startsWith(LEDGER_START) && sec.endsWith(LEDGER_END));
  assert.match(sec, /\| scalp \| only against D1 \| no D1 rule \| 2026-11-08 \| 7 of 20 \| \+3\.50R/);
  assert.match(sec, /scalp: only against D1 \| 40 trades at −0\.50R/);
  assert.match(sec, /80 at −0\.05R → 40 at \+0\.40R/);
  assert.match(sec, /due 2026-12-08/);
  const md1 = injectSection(md0, sec, LEDGER_START, LEDGER_END);
  assert.ok(md1.indexOf(LEDGER_START) < md1.indexOf('## Top 3'));
  assert.equal(injectSection(md1, sec, LEDGER_START, LEDGER_END), md1, 'refreshing replaces the block in place');
  settle(e, fwd, T0 + 31 * DAY);
  assert.match(ledgerSection({ ledger: [e], now: T0 + 31 * DAY }), /helped \+10\.00R[\s\S]*1 change with a 30-day result: 1 helped/);
  assert.match(ledgerSection({ ledger: [] }), /No Coach changes recorded yet/);
});
