// research/edge/cb-days-other: the rule is the ecb-boj-days trade function byte for byte (sha256 pinned), each bank's
// decision minute in its own local time with daylight time, the clock check, the entry and stop read only candles up to
// D + 60 min, the stop side, the pass bar, and RESULT.md against result.json. Offline: synthetic candles and the committed
// result files only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { BANKS, DATES, P, eventDates, bannedOf, toBars, candidates, clockCheck, decision, trade } from '../research/edge/cb-days-other/frozen.mjs';
import { judge, standIns, headline, report, S } from '../research/edge/cb-days-other/run.mjs';

const DIR = new URL('../research/edge/cb-days-other/', import.meta.url);
const M5 = 300, H1 = 3600, T0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, U = (y, m, d, h, mi = 0) => Date.UTC(y, m - 1, d, h, mi) / 1000;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const SRC = fs.readFileSync(new URL('frozen.mjs', DIR), 'utf8');
const cut = (from, to) => { const a = SRC.indexOf(from); assert.ok(a >= 0, from); const b = SRC.indexOf(to, a); assert.ok(b > a, to); return SRC.slice(a, b + to.length); };

test('frozen: the trade, ATR and cost functions are byte for byte ecb-boj-days (run.mjs at 13ecff890, lines 113-130 and 91-105)', () => {
  assert.equal(sha(cut('export function trade(', '\n}')), '7c33d66b1e823ae3edb319bd4a5908eccd9e750f96b00210abb25d8ddeafac1c');
  assert.equal(sha(cut('export function atrAt(', 'P.COMM_RT * entry); }')), 'ea1798bee0a0a84f479aebe99badf4737ad99116a574ef5242e475c6f1812dbf');
  // the only new parameters: pairs, pips and exit times; the rest is ecb-boj-days' values
  assert.deepEqual([P.FIRST, P.ATR_N, P.ATR_DAYS, P.SPIKE, P.BASE_N, P.BASE_DAYS, P.COST_PIPS, P.COMM_RT], [3600, 14, 7, 2, 20, 45, 0.6, 45e-6]);
  assert.deepEqual({ ...P.EXIT }, { BOE: 21 * H1, BOC: 21 * H1, SNB: 21 * H1, RBA: 15 * H1, RBNZ: 15 * H1 });
  assert.deepEqual({ ...P.SYM }, { BOE: 'gbpusd', BOC: 'usdcad', SNB: 'usdchf', RBA: 'audusd', RBNZ: 'nzdusd' });
});

test('event list: weekdays, sorted, unscheduled kept apart, every bank has a source to check', () => {
  for (const bank of BANKS) {
    const ds = eventDates(bank);
    assert.deepEqual(ds, [...ds].sort());
    assert.ok(ds.length > 60, bank);
    for (const d of ds) assert.ok(![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay()), `${bank} ${d}`);
    for (const u of DATES[bank].unscheduled) assert.ok(!ds.includes(u) && bannedOf(bank).has(u), u);
    assert.ok(Object.keys(DATES[bank].unsure).length);
  }
  for (const w of ['bankofengland', 'bankofcanada', 'snb.ch', 'rba.gov.au', 'rbnz.govt.nz']) assert.ok(DATES.provenance.includes(w), w);
});

test('decision minute: each bank\'s local time to UTC with daylight time', () => {
  const at = (bank, date) => candidates(bank, date).map((x) => x.T);
  assert.deepEqual(at('BOE', '2024-08-01'), [U(2024, 8, 1, 11)]);            // 12:00 BST
  assert.deepEqual(at('BOE', '2024-12-19'), [U(2024, 12, 19, 12)]);          // 12:00 GMT
  assert.deepEqual(at('BOC', '2024-07-24'), [U(2024, 7, 24, 13, 45), U(2024, 7, 24, 14)]);   // EDT
  assert.deepEqual(at('BOC', '2024-12-11'), [U(2024, 12, 11, 14, 45), U(2024, 12, 11, 15)]); // EST
  assert.deepEqual(at('SNB', '2024-06-20'), [U(2024, 6, 20, 7, 30)]);        // 09:30 CEST
  assert.deepEqual(at('SNB', '2024-12-12'), [U(2024, 12, 12, 8, 30)]);       // 09:30 CET
  assert.deepEqual(at('RBA', '2024-08-06'), [U(2024, 8, 6, 4, 30)]);         // 14:30 AEST
  assert.deepEqual(at('RBA', '2024-02-06'), [U(2024, 2, 6, 3, 30)]);         // 14:30 AEDT
  assert.deepEqual(at('RBNZ', '2024-07-10'), [U(2024, 7, 10, 2)]);           // 14:00 NZST
  assert.deepEqual(at('RBNZ', '2024-02-28'), [U(2024, 2, 28, 1)]);           // 14:00 NZDT
  // before 2019 the RBNZ also has the 09:00 Wellington candidate, the UTC evening before
  assert.deepEqual(at('RBNZ', '2015-03-12'), [U(2015, 3, 11, 20), U(2015, 3, 12, 1)]);
  // Sydney left daylight time on 7 Apr 2019: 2 Apr is still AEDT, 7 May is AEST
  assert.deepEqual(at('RBA', '2019-04-02'), [U(2019, 4, 2, 3, 30)]);
  assert.deepEqual(at('RBA', '2019-05-07'), [U(2019, 5, 7, 4, 30)]);
});

// a flat market: every M5 candle (weekdays) of the 50 days before the end of lastDate has range r; `bars` add or replace
function flat(lastDate, r = 0.0002, px = 1.1, bars = []) {
  const rows = new Map(), end = T0(lastDate) + 86400;
  for (let t = end - 50 * 86400; t < end; t += M5) { const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue; rows.set(t, [t, px, px + r / 2, px - r / 2, px]); }
  for (const x of bars) rows.set(x[0], x);
  return toBars([...rows.values()].sort((a, b) => a[0] - b[0]));
}

test('clock check: the larger of the two candidate candles; an RBNZ 09:00 pick gives no trade', () => {
  const date = '2024-12-11', [A, B] = candidates('BOC', date).map((x) => x.T);
  let m = clockCheck(flat(date, 0.0002, 1.4, [[B, 1.4, 1.403, 1.399, 1.402]]), 'BOC', date, new Set());
  assert.equal(m.local, '10:00'); assert.equal(m.T, B); assert.equal(m.confirmed, true);
  m = clockCheck(flat(date, 0.0002, 1.4, [[A, 1.4, 1.403, 1.399, 1.402]]), 'BOC', date, new Set());
  assert.equal(m.local, '09:45'); assert.equal(m.T, A);
  const d2 = '2015-03-12', [E, L] = candidates('RBNZ', d2).map((x) => x.T);
  assert.match(decision(flat(d2, 0.0002, 0.75, [[E, 0.75, 0.753, 0.749, 0.752]]), 'RBNZ', d2, new Set()).skip, /early clock/);
  assert.equal(decision(flat(d2, 0.0002, 0.75, [[L, 0.75, 0.753, 0.749, 0.752]]), 'RBNZ', d2, new Set()).D, L);
});

test('trade: direction, entry, stop and ATR read only candles up to D + 60 min; stop on the losing side', () => {
  const date = '2024-08-01', D = U(2024, 8, 1, 11);
  const spike = [D, 1.28, 1.284, 1.279, 1.283], hour = [];
  for (let t = D + M5; t < D + H1; t += M5) hour.push([t, 1.283, 1.2845, 1.2825, 1.284]);
  const base = flat(date, 0.0004, 1.28, [spike, ...hour]);
  const x = trade(base, 'BOE', 'gbpusd', date, new Set());
  assert.equal(x.d, 1); assert.equal(x.D, D); assert.equal(x.entry, 1.284); assert.equal(x.ref, 1.28);
  assert.ok(x.stop < x.entry && Math.abs(x.entry - x.stop - x.atr) < 1e-12);
  // every candle from D + 60 min on replaced by a crash: entry, direction, stop and ATR stay the same
  const later = []; for (let t = D + H1; t < T0(date) + 86400; t += M5) later.push([t, 1.2, 1.21, 1.19, 1.2]);
  const y = trade(flat(date, 0.0004, 1.28, [spike, ...hour, ...later]), 'BOE', 'gbpusd', date, new Set());
  for (const k of ['d', 'D', 'ref', 'entry', 'stop', 'atr']) assert.equal(y[k], x[k], k);
  assert.equal(y.why, 'gap'); assert.ok(y.R < -1);
  // a falling first hour sells, with the stop above
  const down = []; for (let t = D + M5; t < D + H1; t += M5) down.push([t, 1.279, 1.2795, 1.2765, 1.277]);
  const z = trade(flat(date, 0.0004, 1.28, [[D, 1.28, 1.2805, 1.276, 1.279], ...down]), 'BOE', 'gbpusd', date, new Set());
  assert.equal(z.d, -1); assert.ok(z.stop > z.entry);
  // the RBA exit is 15:00 UTC: a time exit never closes later
  const dR = '2024-08-06', DR = U(2024, 8, 6, 4, 30), up = [];
  for (let t = DR + M5; t < DR + H1; t += M5) up.push([t, 0.651, 0.6512, 0.6509, 0.6511]);
  for (let t = DR + H1; t < T0(dR) + 86400; t += M5) up.push([t, 0.6511, 0.65115, 0.65105, 0.6511]);   // quiet: no stop
  const w = trade(flat(dR, 0.0002, 0.65, [[DR, 0.65, 0.6512, 0.6499, 0.651], ...up]), 'RBA', 'audusd', dR, new Set());
  assert.equal(w.why, 'time'); assert.equal(w.exitT, U(2024, 8, 6, 15));
});

test('placebo stand-ins: weekdays near the event, inside the window, away from every decision of that bank', () => {
  const ds = standIns('2024-08-01', S.W.dec, 'BOE'), ban = [...bannedOf('BOE')].map((d) => T0(d) / 86400);
  assert.ok(ds.length > 150);
  for (const d of ds) { const n = T0(d) / 86400; assert.ok(ban.every((b) => Math.abs(b - n) > 3), d); assert.ok(![0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay())); }
});

test('pass bar: every pooled condition must hold, 2x cost included', () => {
  const ok = { n: 300, mean: 0.2, mt: 2.5, mean2: 0.1 }, rep = { mean: 0.1 };
  assert.equal(judge(ok, rep, 0.05).pass, true);
  assert.equal(judge({ ...ok, mt: 1.9 }, rep, 0.05).pass, false);
  assert.equal(judge({ ...ok, mean2: -0.01 }, rep, 0.05).pass, false);
  assert.equal(judge(ok, { mean: -0.01 }, 0.05).pass, false);
  assert.equal(judge(ok, rep, 0.25).pass, false);
  assert.equal(judge(ok, rep, 0.05, 0.2).pass, false);   // a bank row also needs Holm
});

test('RESULT.md is the report of result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(md, report(r));
  assert.ok(md.includes(headline(r)));
  assert.equal(r.verdict, r.pooled.pass ? 'PASS' : 'FAIL');
  assert.deepEqual(r.banks.map((x) => x.bank), BANKS);
  assert.equal(r.pooled.n, r.banks.reduce((a, x) => a + x.n, 0));
  assert.equal(r.pooled.repN, r.banks.reduce((a, x) => a + x.repN, 0));
});
