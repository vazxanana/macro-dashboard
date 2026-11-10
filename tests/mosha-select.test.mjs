// Mosha selection study (research/edge/mosha-select): the conditions and the cell rule on hand-made inputs, and the committed
// result against the pre-registered verdict. Offline: no candle file is read here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { K, CELLS, PERIODS, sessionOf, periodOf, h4Info, conditions, holm, byPeriod, judge } from '../research/edge/mosha-select/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PRE = rd('../research/edge/mosha-select/PREREGISTRATION.md'), RES = rd('../research/edge/mosha-select/RESULT.md'), R = JSON.parse(rd('../research/edge/mosha-select/result.json'));
const U = (s) => Date.parse(s + 'Z') / 1000;

test('the constants, cells and periods are the pre-registered ones', () => {
  assert.deepEqual([K.W4, K.LEVEL_AGE, K.FAR, K.MIN_N, K.ALPHA], [3, 30 * 86400, 4, 100, 0.05]);
  assert.deepEqual([K.FROM, K.V_FROM, K.C_FROM].map((t) => new Date(t * 1000).toISOString().slice(0, 10)), ['2006-07-01', '2013-01-01', '2020-01-01']);
  assert.deepEqual(CELLS.map((c) => `${c[0]}=${c[1]}`), ['h4=with', 'h4=against', 'level=h4', 'level=h1 only', 'session=asia', 'session=london', 'session=new york', 'room=far', 'room=near']);
  assert.deepEqual(Object.keys(PERIODS), ['d', 'v', 'c']);
  for (const s of ['2006-07-01 to 2012-12-31', '2013-01-01 to 2019-12-31', '2020-01-01 to the end of the file', '`asia` 21:00-07:00 UTC', '`london` 07:00-12:00', '`new york` 12:00-21:00', '4R or more', '100 or more trades', 'Holm correction', 'Nine cells per entry, eighteen in all']) assert.ok(PRE.includes(s), s);
});

test('session and period of an order', () => {
  assert.equal(sessionOf(U('2026-10-29T00:05')), 'asia'); assert.equal(sessionOf(U('2026-10-29T06:59')), 'asia'); assert.equal(sessionOf(U('2026-10-29T21:00')), 'asia');
  assert.equal(sessionOf(U('2026-10-29T07:00')), 'london'); assert.equal(sessionOf(U('2026-10-29T11:59')), 'london');
  assert.equal(sessionOf(U('2026-10-29T12:00')), 'new york'); assert.equal(sessionOf(U('2026-10-29T20:59')), 'new york');
  assert.equal(periodOf(U('2006-06-30T23:55')), null); assert.equal(periodOf(U('2006-07-01T00:00')), 'd'); assert.equal(periodOf(U('2012-12-31T23:55')), 'd');
  assert.equal(periodOf(U('2013-01-01T00:00')), 'v'); assert.equal(periodOf(U('2019-12-31T23:55')), 'v'); assert.equal(periodOf(U('2020-01-01T00:00')), 'c');
});

test('conditions: only what was known when the order was placed', () => {
  const info = { bo: [{ t: 1000, dir: 1 }, { t: 5000, dir: -1 }],
    levels: [{ side: -1, p: 110, born: 100, dead: Infinity }, { side: -1, p: 120, born: 200, dead: 3000 }, { side: 1, p: 90, born: 300, dead: Infinity }, { side: -1, p: 105, born: 9000, dead: Infinity }] };
  const c = (o) => conditions({ side: -1, placed: 4000, sweep: 3500, ext: 111, rr: 2.5, ...o }, info);
  assert.deepEqual(c({}), { h4: 'against', level: 'h4', session: 'asia', room: 'near' });                 // last H4 BO at 1000 was a buy; the high at 110 was live and taken
  assert.equal(c({ placed: 5000 }).h4, 'with');                                                            // the sell BO that closed at 5000 counts from 5000
  assert.equal(c({ placed: 4999 }).h4, 'against');
  assert.equal(c({ placed: 999 }).h4, null);                                                               // no H4 BO yet: in neither cell
  assert.equal(c({ ext: 109.9 }).level, 'h1 only');                                                        // did not go beyond the H4 high
  assert.equal(c({ ext: 121, sweep: 2500 }).level, 'h4');
  assert.equal(conditions({ side: -1, placed: 4000, sweep: 3500, ext: 109, rr: 4 }, { ...info, levels: info.levels.slice(1) }).level, 'h1 only');   // the 120 high died at 3000, the 105 high is born later
  assert.equal(conditions({ side: -1, placed: 100 + K.LEVEL_AGE + 500, sweep: 100 + K.LEVEL_AGE + 1, ext: 111, rr: 3 }, { ...info, levels: info.levels.slice(0, 1) }).level, 'h1 only');   // older than 30 days
  assert.equal(conditions({ side: -1, placed: 100 + K.LEVEL_AGE + 500, sweep: 100 + K.LEVEL_AGE, ext: 111, rr: 3 }, { ...info, levels: info.levels.slice(0, 1) }).level, 'h4');
  assert.equal(c({ side: 1, ext: 89, placed: 4000 }).level, 'h4'); assert.equal(c({ side: 1, ext: 89 }).h4, 'with'); assert.equal(c({ side: 1, ext: 91 }).level, 'h1 only');
  assert.equal(c({ rr: 4 }).room, 'far'); assert.equal(c({ rr: 3.99 }).room, 'near');
});

test('h4Info: BO events and levels come from H4 candles built from M5', () => {
  const M5 = []; let t = 0; const leg = (n, a, b) => { for (let i = 0; i < n; i++, t += 300) { const o = a + ((b - a) * i) / n, cl = a + ((b - a) * (i + 1)) / n; M5.push({ time: t, open: o, high: Math.max(o, cl) + 0.1, low: Math.min(o, cl) - 0.1, close: cl }); } };
  leg(48 * 4, 100, 104); leg(48, 104, 110); leg(48 * 4, 110, 103); leg(48 * 3, 103, 112); leg(48 * 2, 112, 111);
  const info = h4Info(M5), top = info.levels.find((l) => l.side < 0 && Math.abs(l.p - 110.1) < 1e-9);
  assert.ok(top, 'the H4 swing high at 110.1'); assert.ok(top.dead < Infinity, 'an H4 close above it ends it');
  const up = info.bo.find((e) => e.dir === 1 && Math.abs(e.level - 110.1) < 1e-9); assert.ok(up, 'the H4 BO buy through 110.1'); assert.equal(up.t, top.dead);
  assert.ok(info.bo.every((e, i) => i === 0 || e.t >= info.bo[i - 1].t));
});

test('Holm and the rule for a cell', () => {
  assert.deepEqual(holm([['a', 0.01], ['b', 0.04], ['c', 0.03]]), { a: 0.03, c: 0.06, b: 0.06 });
  const s = (n, avg, p) => ({ n, avg, p, t: 0 });
  const rows = [
    { key: 'confirmed', d: s(150, 0.1), v: s(150, 0.1, 0.001), c: s(150, 0.05) },
    { key: 'validated', d: s(150, 0.1), v: s(150, 0.1, 0.004), c: s(150, -0.05) },
    { key: 'holm fails', d: s(150, 0.1), v: s(150, 0.1, 0.06), c: s(150, 0.2) },
    { key: 'thin on discovery', d: s(99, 0.5), v: s(150, 0.5, 0.0001), c: s(150, 0.5) },
    { key: 'negative on discovery', d: s(500, -0.01), v: s(500, 0.3, 0.0001), c: s(500, 0.3) },
    { key: 'thin on confirmation', d: s(150, 0.1), v: s(150, 0.1, 0.002), c: s(99, 0.3) },
  ];
  assert.equal(judge(rows), 'PASS');
  assert.deepEqual(rows.map((r) => r.state), ['confirmed', 'validated', 'selected only', 'not selected', 'not selected', 'validated']);
  assert.equal(rows[2].pHolm, 0.06); assert.equal(rows[3].pHolm, null);                                    // Holm runs over the four selected cells only
  assert.equal(judge(rows.slice(1)), 'INCONCLUSIVE'); assert.equal(judge(rows.slice(2, 5)), 'FAIL'); assert.equal(judge([]), 'FAIL');
});

test('byPeriod: closed trades by the time the order was placed, marked trades left out', () => {
  const o = (placed, net, extra = {}) => ({ status: 'closed', exit: 'stop', placed: U(placed), closed: U(placed) + 600, net, ...extra });
  const S = byPeriod([o('2006-06-15T00:00', 9), o('2010-01-04T00:00', -1), o('2012-12-31T23:00', 2), o('2015-06-01T00:00', -1), o('2021-06-01T00:00', 3), o('2026-11-09T00:00', 5, { exit: 'end (marked)' }), o('2022-01-01T00:00', 0, { status: 'missed' })]);
  assert.equal(S.d.n, 2); assert.equal(S.d.avg, 0.5); assert.equal(S.v.n, 1); assert.equal(S.c.n, 1); assert.equal(S.all.n, 4);
});

test('the committed result follows the pre-registration', () => {
  assert.equal(R.topic, 'mosha-select'); assert.equal(R.cells.length, 18); assert.equal(R.variantsTried, 18);
  assert.deepEqual(R.cells.map((c) => c.key), ['CF', 'ZONE'].flatMap((k) => CELLS.map((c) => `${k}:${c[0]}=${c[1]}`)));
  const rows = R.cells.map((c) => ({ key: c.key, d: c.d, v: c.v, c: c.c })), verdict = judge(rows);
  assert.ok(R.verdict.startsWith(verdict + ':')); assert.ok(RES.includes(`**Verdict: ${verdict}.`));
  assert.deepEqual(rows.filter((r) => r.selected).map((r) => r.key), R.selected); assert.deepEqual(rows.filter((r) => r.validated).map((r) => r.key), R.validated); assert.deepEqual(rows.filter((r) => r.confirmed).map((r) => r.key), R.confirmed);
  // what the report says in words: no cell positive in any period
  const all = R.cells.flatMap((c) => [c.d, c.v, c.c]); assert.equal(all.length, 54); assert.ok(all.every((s) => s.n >= 100 && s.avg < 0)); assert.equal(verdict, 'FAIL');
  assert.ok(RES.includes('54 period results, 54 negative'));
  // the two cells of a two-way condition cover every candidate of the entry; H4 direction may leave out the few before the first H4 BO
  for (const k of ['CF', 'ZONE']) { const n = (cond) => R.cells.filter((c) => c.entry === k && c.cond === cond).reduce((a, c) => a + c.candidates, 0), tot = R.baseline[k].candidates;
    assert.equal(n('level'), tot); assert.equal(n('session'), tot); assert.equal(n('room'), tot); assert.ok(n('h4') <= tot && n('h4') > tot - 50); }
  // the unfiltered stream is mosha-sweep's own
  const SW = JSON.parse(rd('../research/edge/mosha-sweep/result.json'));
  for (const k of ['CF', 'ZONE']) { assert.equal(R.baseline[k].all.n, SW.entries[k].all.n); assert.equal(R.baseline[k].all.avg, SW.entries[k].all.avg); assert.equal(R.baseline[k].c.n, SW.entries[k].b.n); assert.equal(R.baseline[k].d.n + R.baseline[k].v.n, SW.entries[k].a.n); }
  // every report figure for a cell is the result's
  const f = (s) => `${s.avg < 0 ? '−' : '+'}${Math.abs(s.avg).toFixed(2)} (${s.n.toLocaleString('en-US')}, t ${s.t < 0 ? '−' : ''}${Math.abs(s.t).toFixed(2)})`;
  for (const c of R.cells) assert.ok(RES.includes(`| ${f(c.d)} | ${f(c.v)} | ${f(c.c)} |`), c.key);
});

test('paper only: the study imports nothing live', () => {
  const RUN = rd('../research/edge/mosha-select/run.mjs'), imports = [...RUN.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['node:fs', 'node:path', 'node:zlib', 'node:url', '../mosha-sweep/run.mjs', '../mosha-retrace/run.mjs', '../mosha-level/run.mjs']);
  assert.ok(!/council\/|ctrader|trader\.mjs/.test(RUN));
});
