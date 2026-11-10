// node --test tests/histdata-clock.test.mjs
// The HistData M1 clock (council/histdata.mjs): the rule the pre-registered audit certified (research/edge/histdata-clock),
// checked against real release minutes, and the proof that every loader of the HistData files converts with it.
// Fixture: real M1 windows around known US release minutes (tests/fixtures/histdata/release-spikes.json, cut from
// council-data research/candles; every line was re-checked against the raw files on 10 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { histToUtc, histStampUtc, histOffsetH, euSummer, usDaylight, nyOffsetH, histStampFixedEst, histStampNewYork, NY_LABELS_BEFORE } from '../council/histdata.mjs';
import { RULES } from '../research/edge/histdata-clock/rules.mjs';

const ROOT = new URL('../', import.meta.url);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);
const read = (p) => fs.readFileSync(new URL(p, ROOT), 'utf8');
const FX = JSON.parse(read('tests/fixtures/histdata/release-spikes.json'));
const AUDIT = JSON.parse(read('research/edge/histdata-clock/result.json'));

test('offsets: UTC-5 in winter, UTC-4 in Europe\'s summer from 2019, New York time in 2018', () => {
  assert.equal(histOffsetH(2024, 1, 5), 5, 'January');
  assert.equal(histOffsetH(2024, 7, 11), 4, 'July');
  assert.equal(histOffsetH(2024, 3, 12), 5, 'US on daylight time, Europe not yet: still UTC-5');
  assert.equal(histOffsetH(2024, 3, 31), 4, 'the last Sunday of March itself (the Sunday evening reopen is already on summer time)');
  assert.equal(histOffsetH(2024, 3, 29), 5, 'the Friday before it');
  assert.equal(histOffsetH(2024, 10, 25), 4); assert.equal(histOffsetH(2024, 10, 27), 5, 'the last Sunday of October');
  assert.equal(histOffsetH(2024, 10, 30), 5, 'Europe back on winter time, the US still on daylight time');
  assert.equal(histOffsetH(2018, 3, 13), 4, '2018 follows New York: daylight time from 11 March');
  assert.equal(histOffsetH(2018, 3, 9), 5); assert.equal(histOffsetH(2018, 11, 2), 4, '2018: New York on daylight time until 4 November'); assert.equal(histOffsetH(2018, 11, 6), 5);
  assert.equal(NY_LABELS_BEFORE, 2019);
  assert.equal(iso(histToUtc(2024, 7, 11, 8, 30)), '2024-07-11T12:30');
  assert.equal(iso(histStampUtc('20240312 073000;1.09;1.09;1.09;1.09;0')), '2024-03-12T12:30');
  assert.equal(iso(histStampFixedEst('20240711 083000')), '2024-07-11T13:30', 'the label\'s documented +5 h is an hour late in summer');
  assert.equal(iso(histStampNewYork('20240312 073000')), '2024-03-12T11:30', 'New York time is an hour early in a mismatch week');
  // instants: Europe changes on Sunday 01:00 UTC, New York on Sunday 07:00 / 06:00 UTC
  assert.equal(euSummer(Date.UTC(2024, 2, 31, 0, 59) / 1000), false); assert.equal(euSummer(Date.UTC(2024, 2, 31, 1, 0) / 1000), true);
  assert.equal(euSummer(Date.UTC(2024, 9, 27, 0, 59) / 1000), true); assert.equal(euSummer(Date.UTC(2024, 9, 27, 1, 0) / 1000), false);
  assert.equal(usDaylight(Date.UTC(2024, 2, 10, 6, 59) / 1000), false); assert.equal(usDaylight(Date.UTC(2024, 2, 10, 7, 0) / 1000), true);
  assert.equal(usDaylight(Date.UTC(2024, 10, 3, 5, 59) / 1000), true); assert.equal(usDaylight(Date.UTC(2024, 10, 3, 6, 0) / 1000), false);
  assert.equal(nyOffsetH(Date.UTC(2024, 6, 1) / 1000), 4); assert.equal(nyOffsetH(Date.UTC(2024, 0, 15) / 1000), 5);
});

test('the converter is the rule the audit certified (R4), for every label hour 2018 to 2026', () => {
  let n = 0;
  for (let L = Date.UTC(2018, 0, 1) / 1000; L < Date.UTC(2027, 0, 1) / 1000; L += 3600) {
    const d = new Date(L * 1000), want = RULES.R4.off(L);
    if (histOffsetH(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) !== want) assert.fail(`label ${iso(L)}: converter ${histOffsetH(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())}, audit rule ${want}`);
    n++;
  }
  assert.equal(n, 9 * 365 * 24 + 2 * 24);   // 2020 and 2024 are leap years
  // New York's own clock agrees with Intl on every hour (the helper the loaders use for New York sessions)
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit' });
  for (let t = Date.UTC(2018, 0, 1) / 1000; t < Date.UTC(2027, 0, 1) / 1000; t += 3600) { const h = +f.format(new Date(t * 1000)), u = new Date(t * 1000).getUTCHours(); if ((u - nyOffsetH(t) + 24) % 24 !== h) assert.fail(`New York hour at ${iso(t)}`); }
});

test('the audit: R4 is certified, nothing certifies a conflicting rule, every decisive OANDA week agrees', () => {
  const syms = Object.keys(AUDIT.symbols); assert.equal(syms.length, 11);
  let cert = 0, bAgree = 0, bN = 0, bMis = 0, bMisN = 0, aAgree = 0, aN = 0;
  for (const s of syms) for (const [y, Y] of Object.entries(AUDIT.symbols[s].years)) {
    const r = Y.rules.R4; bAgree += r.B.agree; bN += r.B.decisive; bMis += r.B.mismatchAgree; bMisN += r.B.mismatch; aAgree += r.A.agree; aN += r.A.clear;
    if (Y.status === 'CERTIFIED') { cert++; assert.ok(Y.certified.includes('R4'), `${s} ${y}: certified for ${Y.certified}`); }
    else assert.deepEqual(Y.certified, [], `${s} ${y}`);
  }
  assert.deepEqual([cert, bAgree, bN, bMis, bMisN, aAgree, aN], [73, 4755, 4755, 327, 327, 2191, 2195]);
  // the weekly record the Academy reads: one character per week, the offset the week shows
  for (const s of syms) { const B = AUDIT.symbols[s].B; assert.equal(B.read.length, B.weeks); assert.match(B.read, /^[3456?-]+$/);
    for (let i = 0; i < B.read.length; i++) { const c = B.read[i]; if (c === '?' || c === '-') continue; const L = Date.UTC(2018, 0, 1) / 1000 + i * 7 * 86400 + 2 * 86400 + 12 * 3600; assert.equal(+c, RULES.R4.off(L), `${s} week ${i}`); } }
});

// the release minute's bar is the window's largest; each window spans both candidate file minutes (UTC-5 and UTC-4)
const bars = (e, conv) => e.lines.map((ln) => { const p = ln.split(';'); return { t: conv(p[0]), r: +p[2] - +p[3] }; });
const spikeAt = (B) => B.reduce((a, b) => (b.r > a.r ? b : a)).t;

test('release spikes: the largest 1-minute bar converts to the release minute (10 real windows, 2018-26)', () => {
  assert.equal(FX.events.length, 10);
  for (const e of FX.events) {
    const rel = Date.parse(e.releaseUtc) / 1000, at = spikeAt(bars(e, histStampUtc));
    assert.ok(at >= rel && at <= rel + 120, `${e.sym} ${e.type} ${e.releaseUtc} (${e.note}): spike at ${iso(at)}`);
  }
});

test('release spikes: the two older readings each misplace releases by an hour', () => {
  const miss = (conv) => FX.events.filter((e) => { const rel = Date.parse(e.releaseUtc) / 1000, off = spikeAt(bars(e, conv)) - rel; if (off >= 0 && off <= 120) return false;
    assert.ok(Math.abs(off) >= 3480 && Math.abs(off) <= 3720, `${e.sym} ${e.releaseUtc}: ${off / 60} min off`); return true; }).map((e) => e.releaseUtc.slice(0, 10));
  assert.deepEqual(miss(histStampFixedEst), ['2024-07-11', '2019-06-12', '2018-03-13', '2018-11-02', '2026-07-14'], 'fixed +5 h: an hour late every summer');
  assert.deepEqual(miss(histStampNewYork), ['2024-03-12', '2024-11-01', '2021-11-03', '2019-03-12'], 'New York time: an hour early in the weeks the US and Europe differ (2019 on)');
});

// ── every loader of the HistData files goes through the converter ──
// A file "parses a stamp itself" when it slices the hour out of a "YYYYMMDD HHMMSS" label (characters 9-11). Only these may:
const MAY_PARSE = {
  'council/histdata.mjs': 'the converter',
  'research/edge/histdata-clock/run.mjs': 'the audit: reads the raw labels on purpose and tests every candidate rule',
  'research/edge/setups-promote/check.mjs': 'an engine parity check on one stretch of bars: no clock is read',
  'ict/replay.mjs': 'LIVE code (the ICT desk replay): not changed here; docs/owner-decisions.md has the item',
};
// Loaders not converted yet: none. A new loader must import the converter, not join this list.
const PENDING = [];
test('every loader of the HistData files converts with the shared clock', () => {
  const files = [];
  const walk = (rel) => { for (const f of fs.readdirSync(new URL(rel, ROOT), { withFileTypes: true })) { const p = rel + f.name; if (f.isDirectory()) { if (!/node_modules|fixtures|\/out\/$/.test(p + '/')) walk(p + '/'); } else if (/\.(mjs|js|cjs)$/.test(f.name)) files.push(p); } };
  for (const d of ['research/', 'academy/', 'ict/', 'council/', 'scripts/', 'api/', 'ml/']) walk(d);
  const parses = [], uses = [];
  for (const p of files) {
    const s = read(p);
    if (/\.slice\(9, ?11\)/.test(s) && /\.slice\(11, ?13\)/.test(s)) parses.push(p);
    if (/from '(\.\.\/)+council\/histdata\.mjs'/.test(s)) uses.push(p);
    // nobody else re-implements the label clock: no "label + 5 h" and no private New York offset on a parsed stamp
    if (!MAY_PARSE[p] && !PENDING.includes(p)) assert.ok(!/slice\(9, ?11\)[^\n]*(5 ?\* ?3600|18000|nyOffset)/.test(s), `${p} converts a HistData stamp by itself`);
  }
  assert.deepEqual(parses.filter((p) => !MAY_PARSE[p] && !(uses.includes(p) && /hist(ToUtc|StampUtc)\(/.test(read(p)))).sort(), PENDING.slice().sort(), 'files that parse a HistData stamp without the shared converter');
  for (const p of Object.keys(MAY_PARSE)) assert.ok(files.includes(p), `${p} exists`);
  // the converter stays a pure helper: no import, no I/O, no environment
  const conv = read('council/histdata.mjs'); assert.ok(!/^\s*import\s/m.test(conv) && !/process\.|require\(|fetch\(|readFile/.test(conv));
  // and nothing that trades or runs live imports it
  for (const p of uses) assert.ok(/^(research|academy)\//.test(p), `${p} imports the research clock`);
  assert.ok(uses.length >= 23, `found ${uses.length} files on the shared clock`);
  // the 22 study loaders that used to convert by themselves, by name
  for (const p of ['confluence/lib.mjs', 'costs/load.mjs', 'event-reaction/build.mjs', 'event-risk/build.mjs', 'gold-systems/data.mjs', 'ict-concepts/run.mjs', 'ict-exits-replay/hist.mjs', 'ict-exits/sim.mjs',
    'ict-filters/driver.mjs', 'ict-index-longonly/run.mjs', 'ict-smile/build.mjs', 'ict-trend-side/run.mjs', 'ict-universe/universe.mjs', 'ict-variants/run.mjs', 'nq-open-oos/load.mjs', 'portfolio/ict-stream.mjs',
    'regime/replay.mjs', 'robustness/lib.mjs', 'scalp-exits/lib.mjs', 'scalp-filters/scalp-long.mjs', 'setups-promote/replay.mjs', 'timing/replay.mjs']) assert.ok(uses.includes('research/edge/' + p), `${p} converts with the shared clock`);
});
