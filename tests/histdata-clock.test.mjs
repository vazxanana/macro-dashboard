// node --test tests/histdata-clock.test.mjs — the HistData M1 clock (council/histdata.mjs): every loader of the council-data
// HistData files converts with it. Fixtures: real M1 windows around known US release minutes (tests/fixtures/histdata/
// release-spikes.json, cut from council-data research/candles on 9 Nov 2026), so the rule is checked against the data itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { histToUtc, histStampUtc, histStampFixedEst, histOffsetH, euSummer, usDaylight } from '../council/histdata.mjs';

const iso = (t) => new Date(t * 1000).toISOString().slice(0, 16);
const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/histdata/release-spikes.json', import.meta.url), 'utf8'));

test('offsets: UTC−5 in winter, UTC−4 in Europe\'s summer from 2019, New York time in 2018', () => {
  assert.equal(histOffsetH(2024, 1, 5, 8, 30), 5, 'January');
  assert.equal(histOffsetH(2024, 7, 11, 8, 30), 4, 'July');
  assert.equal(histOffsetH(2024, 3, 12, 7, 30), 5, 'US on daylight time, Europe not yet: still UTC−5');
  assert.equal(histOffsetH(2024, 4, 2, 8, 30), 4, 'Europe switched on 31 Mar 2024');
  assert.equal(histOffsetH(2024, 10, 30, 8, 30), 5, 'Europe back on winter time (27 Oct), US still on daylight time');
  assert.equal(histOffsetH(2018, 3, 13, 8, 30), 4, '2018 follows New York: US daylight time from 11 Mar');
  assert.equal(histOffsetH(2018, 3, 9, 8, 30), 5);
  assert.equal(histOffsetH(2018, 11, 2, 8, 30), 4, '2018: New York still on daylight time until 4 Nov');
  assert.equal(histOffsetH(2018, 11, 6, 8, 30), 5);
  assert.equal(histOffsetH(2018, 12, 31, 16, 0), histOffsetH(2019, 1, 2, 16, 0), 'both rules agree around the switch');
  // the instants
  assert.equal(iso(histToUtc(2024, 7, 11, 8, 30)), '2024-07-11T12:30');
  assert.equal(iso(histStampUtc('20240312 073000;1.09;1.09;1.09;1.09;0')), '2024-03-12T12:30');
  assert.equal(iso(histStampFixedEst('20240711 083000')), '2024-07-11T13:30', 'the label\'s +5 h is an hour late in summer');
  // the clock switches are Sunday 01:00 UTC (Europe) and Sunday 07:00 / 06:00 UTC (US), while the markets are shut
  assert.equal(euSummer(Date.UTC(2024, 2, 31, 0, 59) / 1000), false); assert.equal(euSummer(Date.UTC(2024, 2, 31, 1, 0) / 1000), true);
  assert.equal(euSummer(Date.UTC(2024, 9, 27, 0, 59) / 1000), true); assert.equal(euSummer(Date.UTC(2024, 9, 27, 1, 0) / 1000), false);
  assert.equal(usDaylight(Date.UTC(2024, 2, 10, 7, 0) / 1000), true); assert.equal(usDaylight(Date.UTC(2024, 10, 3, 6, 0) / 1000), false);
});

// the release minute's bar is the window's largest; the window spans both candidate file minutes (UTC−5 and UTC−4)
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
  // the label (fixed +5 h) and New York wall-clock time (the 5 Nov 2026 convention)
  const nyLocal = (s) => { const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8), t5 = Date.UTC(y, mo - 1, d, +s.slice(9, 11), +s.slice(11, 13)) / 1000 + 5 * 3600; return usDaylight(t5 - 3600) ? t5 - 3600 : t5; };
  const miss = (conv) => FX.events.filter((e) => { const rel = Date.parse(e.releaseUtc) / 1000, off = spikeAt(bars(e, conv)) - rel; if (off >= 0 && off <= 120) return false;
    assert.ok(Math.abs(off) >= 3480 && Math.abs(off) <= 3720, `${e.sym} ${e.releaseUtc}: ${off / 60} min off`); return true; }).map((e) => e.releaseUtc.slice(0, 10));
  assert.deepEqual(miss(histStampFixedEst), ['2024-07-11', '2019-06-12', '2018-03-13', '2018-11-02', '2026-07-14'], 'fixed +5 h: an hour late every summer');
  assert.deepEqual(miss(nyLocal), ['2024-03-12', '2024-11-01', '2021-11-03', '2019-03-12'], 'New York time: an hour early in the weeks the US and Europe differ (2019 on)');
});

test('every loader of the HistData files converts with the shared clock (no fixed +5 h left)', () => {
  const root = new URL('../', import.meta.url), seen = [];
  const walk = (rel) => { for (const f of fs.readdirSync(new URL(rel, root), { withFileTypes: true })) { const p = rel + f.name; if (f.isDirectory()) { if (!/node_modules|fixtures/.test(p)) walk(p + '/'); } else if (/\.(mjs|js)$/.test(f.name)) seen.push(p); } };
  for (const d of ['research/', 'ict/', 'council/', 'scripts/']) walk(d);
  // clock-neutral: an engine parity check that compares two analysers on the same bars
  const NEUTRAL = new Set(['research/edge/setups-promote/check.mjs']);
  const bad = [], loaders = [];
  for (const p of seen) {
    const s = fs.readFileSync(new URL(p, root), 'utf8');
    if (!/csv\.gz|_M1_/.test(s) || NEUTRAL.has(p)) continue;
    // parses a HistData stamp ("YYYYMMDD HHMMSS": the hour is characters 9-11) or calls the shared clock
    if (!/\.slice\(9, ?11\)|histStampUtc\(|histToUtc\(/.test(s)) continue;
    loaders.push(p);
    if (!/from '(\.\.\/)+council\/histdata\.mjs'/.test(s) || /slice\(9, ?11\)[^\n]*\/ ?1000 ?\+ ?(5 ?\* ?3600|nyOffset)/.test(s)) bad.push(p);
  }
  assert.deepEqual(bad, []);
  assert.ok(loaders.length >= 20, `found ${loaders.length} HistData loaders`);
});
