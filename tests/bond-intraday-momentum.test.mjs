// Intraday momentum on the bond CFDs (research/edge/bond-intraday-momentum): the copied rule pinned by sha256, DST-correct
// session times, the bond calendar, no look-ahead in the signal, a stop on every trade, the placebo windows, the bar, and the
// written report against result.json. Offline (synthetic candles only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  P, CFD, FUT, SESSION, PRIMARY, at, eligibleDays, fullDay, placeboStarts, toBars, dayPrices, signalOf, trade, runMarket,
  summarize, lines, build, render, holm, monthT,
} from '../research/edge/bond-intraday-momentum/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const SRC = rd('../research/edge/bond-intraday-momentum/run.mjs');
const PRE = rd('../research/edge/bond-intraday-momentum/PREREGISTRATION.md');
const U = (s) => Date.parse(s) / 1000;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function synth(from, days, seed = 11) {
  let s = seed, px = 120; const rows = [];
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let t = U(from + 'T00:00:00Z'); t < U(from + 'T00:00:00Z') + days * 86400; t += 300) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o + (rnd() - 0.5) * 0.05, h = Math.max(o, c) + rnd() * 0.01, l = Math.min(o, c) - rnd() * 0.01;
    px = c; rows.push([t, o, h, l, c]);
  }
  return rows;
}

test('signalOf and trade are intraday-momentum\'s, byte for byte (sha256)', () => {
  const sig = SRC.match(/^export const signalOf = .*$/m)[0];
  const i = SRC.indexOf('export function trade('), j = SRC.indexOf('\n}\n', i), tr = SRC.slice(i, j + 2);
  assert.equal(sha(sig), 'f247c555835757f7fb5c886ce9ae55b8ce5bb178be51c75002d926c45fec0433');
  assert.equal(sha(tr), '15872ad30157b2d1968a9d4e888b77df6469fd625403306841a00009fb344360');
});

test('the constants are the pre-registered ones', () => {
  assert.deepEqual([P.K, P.AVG, P.SEEDS, P.Q, P.ALPHA, P.MIN_B, P.MIN_A], [1.5, 20, 40, 0.95, 0.05, 1000, 500]);
  assert.deepEqual(CFD, { usb02y: 0.0002, usb05y: 0.0003, usb10y: 0.0003, usb30y: 0.0005, de10yb: 0.0003, uk10yb: 0.0004 });
  assert.deepEqual(FUT, { usb10y: 0.019325, usb30y: 0.03495 });
  assert.deepEqual(PRIMARY, ['usb10y', 'usb30y']);
  for (const s of ['usb10y', 'usb30y', 'usb02y', 'usb05y']) assert.deepEqual({ ...SESSION[s] }, { tz: 'America/New_York', open: '08:20', sig: '08:50', entry: '14:30', close: '15:00', cal: 'us' });
  assert.equal(SESSION.de10yb.close, '17:15'); assert.equal(SESSION.uk10yb.close, '16:15');
  assert.deepEqual(P.WIN, { A: ['2010-01-01', '2016-01-01'], B: ['2016-01-01', '2026-11-14'] });
  for (const re of [/08:20 to 15:00 New York/, /1\.5 × A/, /0\.03 %/, /0\.019325/, /0\.03495/, /month-sum t ≥ 2/, /2× cost > 0/, /95th percentile/, /40 seeds/, /random earlier half hour/, /NOT MEASURABLE/, /owner decision 44/])
    assert.match(PRE, re);
});

test('session times are DST-correct', () => {
  assert.equal(at('2026-01-15', '08:50', 'America/New_York'), U('2026-01-15T13:50:00Z'));
  assert.equal(at('2026-07-15', '15:00', 'America/New_York'), U('2026-07-15T19:00:00Z'));
  assert.equal(at('2026-03-09', '14:30', 'America/New_York'), U('2026-03-09T18:30:00Z'));   // after the US switch, before Europe's
  assert.equal(at('2026-03-09', '17:15', 'Europe/Berlin'), U('2026-03-09T16:15:00Z'));
  assert.equal(at('2026-07-15', '16:15', 'Europe/London'), U('2026-07-15T15:15:00Z'));
});

test('the bond calendar: holidays, early closes and the previous-close chain', () => {
  const E = new Set(eligibleDays('usb10y', '2025-10-01', '2026-01-10').map((d) => d.date));
  for (const d of ['2025-10-13', '2025-11-11', '2025-11-27', '2025-11-28', '2025-12-01', '2025-12-24', '2025-12-25', '2025-12-26', '2025-12-31', '2026-01-01', '2026-01-02'])
    assert.ok(!E.has(d), d);   // Columbus, Veterans, Thanksgiving, early closes and the days whose previous close was one
  for (const d of ['2025-10-14', '2025-11-12', '2025-12-02', '2025-12-23', '2026-01-05']) assert.ok(E.has(d), d);
  assert.ok(!fullDay('usb10y', '2026-04-02'));   // Thursday before Good Friday: 14:00 close
  assert.ok(!fullDay('usb10y', '2026-05-22'));   // Friday before Memorial Day
  const prev = eligibleDays('usb10y', '2026-01-05', '2026-01-05')[0];
  assert.deepEqual(prev, { date: '2026-01-05', prev: '2026-01-02' });   // 2 Jan is a full day; its own previous (1 Jan) was not
  const G = new Set(eligibleDays('uk10yb', '2026-05-01', '2026-05-30').map((d) => d.date));
  assert.ok(!G.has('2026-05-04') && !G.has('2026-05-25') && G.has('2026-05-05') && G.has('2026-05-26'));
});

test('placebo windows lie after the signal and end by the entry', () => {
  const s = placeboStarts('usb10y');
  assert.equal(s.length, 63); assert.equal(s[0], '08:50'); assert.equal(s.at(-1), '14:00');
  assert.equal(placeboStarts('de10yb').at(-1), '16:15');
});

test('no look-ahead: the signal reads nothing after 08:50; every trade has a stop on the losing side', () => {
  const rows = synth('2025-06-01', 120), b = toBars(rows), d = { date: '2025-08-12', prev: '2025-08-11' };
  const px = dayPrices(b, 'usb10y', d), r1 = signalOf(px.p0, px.pS);
  const cut = at(d.date, '08:50', 'America/New_York');
  const rows2 = rows.map((r) => r[0] + 300 > cut ? [r[0], r[1] * 1.01, r[2] * 1.01, r[3] * 1.01, r[4] * 1.01] : r);
  const px2 = dayPrices(toBars(rows2), 'usb10y', d);
  assert.equal(signalOf(px2.p0, px2.pS), r1);
  const { recs } = runMarket(b, 'usb10y', eligibleDays('usb10y', '2025-06-01', '2025-09-25'));
  const tr = recs.filter((r) => r.tr);
  assert.ok(tr.length > 20);
  for (const r of tr) {
    assert.ok(r.tr.dist > 0); assert.equal(r.tr.side, Math.sign(r.r1));
    assert.ok(r.tr.side > 0 ? r.tr.stop < r.tr.entry : r.tr.stop > r.tr.entry);
    assert.ok(r.tr.R >= -1 - 1e-9 || r.tr.how === 'gap');
    assert.equal(r.pl.length, 63); assert.equal(r.alt.side, -r.tr.side);
  }
  const t = trade(b, { t1530: px.t1530, t16: px.t16, pE: px.pE, pX: px.pX }, 1, 0.01, 0);
  assert.ok(t.stop < t.entry);
});

test('the bar, Holm, month sums and the verdict on synthetic markets', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03, 0.5]).map((x) => +x.toFixed(2)), [0.04, 0.09, 0.09, 0.5]);
  assert.equal(monthT([{ date: '2020-01-02', x: 1 }, { date: '2020-01-03', x: 1 }, { date: '2020-02-03', x: 3 }]).months, 2);
  const A = { netRaw: 0.1, tMonthRaw: 1, net2xRaw: 0.05, hitRaw: 0.6, placebo: { hitQ95raw: 0.55 } };
  assert.deepEqual(lines(A, { ...A, tMonthRaw: 2.1 }), { l1: true, l2: true, l3: true, l4: true, ok: true });
  assert.equal(lines(A, { ...A, net2xRaw: -0.01 }).ok, false);
  const mk = {}; for (const [i, s] of ['usb10y', 'usb30y'].entries()) mk[s] = runMarket(toBars(synth('2025-06-01', 120, 3 + i)), s, eligibleDays(s, '2025-06-01', '2025-09-25'));
  const j = build(mk);
  assert.equal(j.verdict, 'NOT MEASURABLE'); assert.match(j.inconclusive, /need 1000/);
  assert.match(render(j), /NOT MEASURABLE \(inconclusive: /);
  const s = summarize(mk.usb10y.recs, ['2025-01-01', '2026-01-01'], { fut: true });
  assert.ok(s.futures && s.placebo.hitQ95raw != null);
});

test('the written report matches result.json', () => {
  const f = new URL('../research/edge/bond-intraday-momentum/result.json', import.meta.url);
  if (!fs.existsSync(f)) return;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(rd('../research/edge/bond-intraday-momentum/RESULT.md').split('\n## Primary test')[0].trim(), render(j).split('\n## Primary test')[0].trim());
  assert.ok(['PASS', 'FAIL', 'NOT MEASURABLE'].includes(j.verdict));
  assert.ok(j.primary.B.n >= 1000 && j.primary.A.n >= 500);
});
