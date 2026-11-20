// The week in review (council/week-review.mjs) and its Macro desk section: pure maths on hand-made closes, and the page wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../council/week-review.mjs';

const DAY = 86400, T = (y, m, d) => Date.UTC(y, m - 1, d) / 1000;
// weekdays from Mon 3 Aug 2026, each close = f(i); a Sunday stub is added to prove it is ignored
function series(n, f) { const out = []; let t = T(2026, 8, 3), i = 0; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w >= 1 && w <= 5) out.push({ t, c: f(i++) }); t += DAY; } return out; }

test('the week is Monday to Friday of the last close; the move is from the Friday before; a normal week is the year\'s median', () => {
  // 15 flat-ish weeks of +1% a week, then a week that falls 4%
  const rows = series(80, (i) => (i < 75 ? 100 * Math.pow(1.01, Math.floor(i / 5)) : 100 * Math.pow(1.01, 14) * (1 - 0.008 * (i - 74))));
  rows.push({ t: T(2026, 11, 22), c: 1 });                      // a Sunday stub: never a day of the week
  const now = rows[79].t + DAY + 3600;
  const R = W.build({ now, series: { gold: rows } });
  assert.equal(R.from, '2026-11-16'); assert.equal(R.to, '2026-11-20'); assert.equal(R.complete, true);
  const g = R.markets[0];
  assert.equal(g.k, 'gold'); assert.equal(g.fromDay, '2026-11-13'); assert.equal(g.days.length, 5);
  assert.equal(g.pct, -4); assert.equal(g.dir, 'down'); assert.equal(g.streak, 1);
  assert.ok(g.normal > 0.9 && g.normal <= 1.01, 'the weeks before moved 0 or +1%'); assert.ok(g.times > 3.9);
  assert.equal(g.past.length, 8); assert.equal(g.past[7].pct, -4);
  assert.match(R.lines[0], /^Gold fell 4\.0% \(\$115 to \$110\), 4\.\d times a normal week \(1\.0%\)\.$/);
  assert.match(R.lines.find((l) => /biggest day/.test(l)), /^Gold's biggest day was (Monday|Tuesday|Wednesday|Thursday|Friday) \(−0\.8%\)\.$/);
});

test('a week still running says so, never reads the forming day, and a market without a prior close is left out', () => {
  const rows = series(72, (i) => 100 + i);                      // ends on a Tuesday
  const now = rows[71].t + DAY + 60;
  const R = W.build({ now, series: { gold: rows, dxy: rows.slice(-2), eurusd: [{ t: rows[71].t + DAY, v: 1.1 }] } });
  assert.equal(R.complete, false); assert.equal(R.last, R.markets[0].toDay); assert.equal(R.markets[0].days.length, 2);
  assert.deepEqual(R.markets.map((m) => m.k), ['gold'], 'two closes inside the week have no close before it; the forming day is no close');
  assert.equal(W.build({ now, series: {} }), null);
  // { t, v } rows (the council's close rows) read like { t, c }
  const V = W.build({ now, series: { gold: rows.map((r) => ({ t: r.t, v: r.c })) } });
  assert.equal(V.markets[0].pct, R.markets[0].pct);
});

test('releases, calls and the score come only from the week; a streak counts weeks the same way', () => {
  const rows = series(80, (i) => 100 - Math.floor(i / 5));       // every week lower
  const now = rows[79].t + DAY + 60;
  const rf = { study: { CPI: { name: 'CPI', rows: [
    { day: '2026-11-17', at: '2026-11-17T13:30:00.000Z', fields: [{ name: 'Core CPI m/m', unit: '%', exp: '0.2%', actual: 0.3, prev: 0.3, surprise: 0.1 }], goldDay: -1, usdDay: 0.3 },
    { day: '2026-11-10', fields: [{ name: 'Core CPI m/m', unit: '%', actual: 0.2 }] }] } } };
  const calls = [{ claim: 'Gold closes above $90', p: 0.6, hit: true, by: '2026-11-20' }, { claim: 'old', p: 0.5, hit: false, by: '2026-11-13' }, { claim: 'open', p: 0.5, by: '2026-11-19' }];
  const fc = { goldScore: { hist: [['2026-11-13', 0.1], ['2026-11-20', 0.4], ['2026-11-27', 9]] }, regime: { label: 'x' } };
  const R = W.build({ now, series: { gold: rows }, rf, calls, fc });
  assert.equal(R.releases.length, 1); assert.equal(R.days.find((d) => d.day === '2026-11-17').releases[0].text, 'CPI: Core CPI m/m 0.3% against 0.2% expected');
  assert.deepEqual([R.calls.n, R.calls.hits, R.calls.expected], [1, 1, 0.6]);
  assert.deepEqual([R.score.from, R.score.to, R.score.above], [0.1, 0.4, true]);
  assert.ok(R.markets[0].streak >= 8); assert.match(R.lines[0], /its \d+th down week in a row\.$/);
  assert.match(R.note, /not a signal/);
});

test('descriptive only: the module imports nothing and names no order or rule; the veteran writes the file; data health lists it', () => {
  const src = fs.readFileSync(new URL('../council/week-review.mjs', import.meta.url), 'utf8');
  assert.ok(!/^import /m.test(src) && !/fetch\(/.test(src));
  const vet = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(vet, /w\('week-review\.json', WR\)/); assert.match(vet, /Week review skipped/);
  assert.match(fs.readFileSync(new URL('../council/datahealth.mjs', import.meta.url), 'utf8'), /macro\/week-review\.json/);
});

test('Macro desk: the section, its contents chip, the loader and the folded line; every value written as text', () => {
  const h = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.match(h, /<section class="story sfold" id="s-review"/); assert.match(h, /<a href="#s-review">Week in review<\/a>/);
  assert.match(h, /get\('macro\/week-review\.json'\)/); assert.match(h, /renderReview\(wr\)/); assert.match(h, /'s-review':/);
  const fn = h.slice(h.indexOf('function renderReview'), h.indexOf('function renderAhead'));
  for (const m of fn.matchAll(/\+ (m|d|c|r|g|u)\.(name|text|claim|dow)\b/g)) assert.fail('unescaped ' + m[0]);
  const css = h.slice(h.indexOf('/* Week in review'), h.indexOf('.wa-nc {'));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(css), 'tokens only'); for (const m of css.matchAll(/font(?:-size)?:[^;]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12);
});
