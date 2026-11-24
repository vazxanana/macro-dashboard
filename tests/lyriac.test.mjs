// node --test tests/lyriac.test.mjs
// Lyriac (24 Nov 2026): the passing rules as one Equinox desk, and its demo jobs on the Shadows + LIT demo account.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D2 from '../council/edge-desks-2.mjs';
import * as GB from '../research/edge/gotobi/run.mjs';
import { clean } from '../council/mosha-desk.mjs';
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// seeded USD/JPY 5-minute candles, weekdays only, 70 days
function seeded(days = 70, start = Date.parse('2026-08-03T00:00:00Z') / 1000) {
  let s = 11; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; const out = []; let p = 150;
  for (let d = 0; d < days; d++) { const d0 = start + d * 86400, w = new Date(d0 * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    for (let i = 0; i < 288; i++) { const o = p, c = o + (rnd() - 0.5) * 0.08, h = Math.max(o, c) + rnd() * 0.03, l = Math.min(o, c) - rnd() * 0.03; out.push({ time: d0 + i * 300, open: o, high: h, low: l, close: c }); p = c; } }
  return out;
}

test('the gotobi leg is the study\'s own trade: same days, entry, stop and R; every record has its stop above a sell', () => {
  const B = { '5m': seeded() }, from = B['5m'][0].time + 35 * 86400, L = D2.gotobiTrades(B, { from, market: 'usdjpy' });
  assert.ok(L.length >= 4, 'several gotobi days in the window: ' + L.length);
  const ix = GB.index(B['5m'].map((b) => [b.time, b.open, b.high, b.low, b.close])), moveOf = (d) => GB.windowMove(ix, 'fade', d);
  for (const r of L) { const day = new Date(r.t * 1000).toISOString().slice(0, 10), x = GB.trade(ix, 'fade', day, GB.stopDist(moveOf, day));
    assert.ok(x, day); assert.equal(r.side, -1); assert.equal(r.entry, x.entry); assert.ok(Math.abs(r.stop - x.stop) < 1e-9); assert.ok(r.stop > r.entry, 'stop on the losing side');
    assert.ok(Math.abs(r.R - x.R) < 1e-9, `${day}: ${r.R} vs ${x.R}`); assert.equal(r.status, x.how === 'time' ? 'time' : 'stopped'); assert.equal(r.kind, 'lyriac-gotobi'); }
  const set = GB.gotobiSet(2026, 2026); for (const r of L) assert.ok(set.has(new Date(r.t * 1000).toISOString().slice(0, 10)));
  assert.deepEqual(D2.gotobiTrades(B, { from, market: 'xau' }), []);
});

test('no look-ahead: a gotobi day cut before 06:00 UTC is open (or stopped), with the same entry and stop', () => {
  const all = seeded(), from = all[0].time + 35 * 86400, full = D2.gotobiTrades({ '5m': all }, { from, market: 'usdjpy' }), r = full[full.length - 1];
  const cut = all.filter((b) => b.time < r.t + 3600), L = D2.gotobiTrades({ '5m': cut }, { from, market: 'usdjpy' }), c = L.find((x) => x.id === r.id);
  assert.ok(c, 'the record exists an hour after the entry'); assert.equal(c.entry, r.entry); assert.equal(c.stop, r.stop);
  if (c.status === 'open') { assert.equal(c.R, null); assert.ok(Number.isFinite(c.float)); } else assert.equal(c.status, 'stopped');
  assert.equal(D2.gotobiTrades({ '5m': all.filter((b) => b.time < r.t) }, { from, market: 'usdjpy' }).some((x) => x.id === r.id), false, 'nothing before 00:55 UTC');
});

test('the desk: gold and USD/JPY, the breakouts by the breakout desks\' own code, records the tracker stores', () => {
  assert.deepEqual(D2.DESKS2.lyriac.markets, ['xau', 'usdjpy']); assert.deepEqual(D2.DESKS2.lyriac.extra, { '5m': 40 });
  const B = { '5m': seeded() }, from = B['5m'][0].time + 35 * 86400, L = D2.lyriacTrades(B, { from, market: 'usdjpy' }), J = D2.jpyTrades(B, { from, market: 'usdjpy' });
  const vb = L.filter((r) => r.kind === 'lyriac-t1'); assert.equal(vb.length, J.length); assert.ok(vb.length > 5);
  vb.forEach((r, i) => { assert.equal(r.entry, J[i].entry); assert.equal(r.stop, J[i].stop); assert.equal(r.R, J[i].R); assert.equal(r.id, J[i].id.replace('jpyvb-', 'lyriac-')); });
  assert.ok(L.some((r) => r.kind === 'lyriac-gotobi'));
  assert.equal(new Set(L.map((r) => r.id)).size, L.length, 'ids are unique');
  for (const r of L) { const c = clean({ ...r, first: r.t, src: 'replay' }); assert.ok(c, 'the store keeps ' + r.id); assert.equal(c.kind, r.kind); assert.ok((r.side > 0 ? 1 : -1) * (r.entry - r.stop) > 0); }
  assert.deepEqual(D2.lyriacTrades(B, { from, market: 'eurusd' }), []);
});

test('wiring: the Equinox tab, the loop line, data health, and the demo jobs on the Shadows + LIT account', () => {
  const page = rd('equinox.html'); assert.match(page, /id="v-lyriac"/); assert.match(page, /window\.EQ_DESKS = \[\{"k": "lyriac", "name": "Lyriac"\}/);
  assert.match(rd('assets/desk-trades.js'), /lyriac: \{ file: 'lyriac\/desk\.json', title: 'Lyriac trades'/); assert.match(rd('assets/desk-trades.js'), /describes the past and is not proof/);
  assert.match(rd('.github/workflows/council.yml'), /--only fade,bigfade,roundfade,boxfade,fvg,goldvb,jpyvb,lyriac,dom/);
  assert.match(rd('council/datahealth.mjs'), /file: 'lyriac\/desk\.json'/);
  assert.doesNotMatch(rd('council/trader.mjs'), /id: 'lyriac-155'/, 'the jobs stay on their default account');
  assert.match(rd('council/gotobi.mjs'), /find\(\(x\) => \(x\.books \|\| \[\]\)\.includes\('lit'\)\)/, 'the default is the LIT book\'s account');
  const sm = rd('council/trader.mjs').match(/\{ id: 'shadow-mirror-off', apply: (\(c\) => \{[^\n]*\}),\n/); assert.ok(sm, 'Lyriac alone: no new shadow copies');
  const cc = { mirrorIct: false }; (0, eval)(sm[1])(cc); assert.deepEqual(cc, { mirrorIct: false, mirrorShadow: false });
  assert.match(rd('council/ctrader-mirror.mjs'), /const shadows = cfg\.mirrorShadow !== false;/); assert.match(rd('council/ctrader-mirror.mjs'), /const fresh = trades\.filter\(\(t\) => \(!t\.shadow \|\| shadows\)/, 'only NEW copies are held back; open ones are still managed');
  assert.match(rd('council/vb-demo.mjs'), /cfg\.vb && cfg\.vb\.account && String\(cfg\.vb\.account\)/); assert.match(rd('council/gotobi.mjs'), /cfg\.gotobi\.account\) return String\(cfg\.gotobi\.account\)/);
});
