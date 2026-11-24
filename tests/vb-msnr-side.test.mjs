// tests/vb-msnr-side.test.mjs - the breakout split by the key-level direction call: the pre-registration, RESULT.md agrees with
// result.json, the verdict follows the bar, the call is known before the day opens (no look-ahead on seeded candles), and
// every breakout trade has its stop on the losing side. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { calls, callAt, groupOf, d0Of, tag, evaluate, verdictOf, gateOf, SETS, GROUPS, MIN_N, WIN } from '../research/edge/vb-msnr-side/run.mjs';
import { buildDays, daySkip, vbTrade } from '../research/edge/gold-vol-breakout-hourcost/original.mjs';

const DIR = new URL('../research/edge/vb-msnr-side/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

// a seeded 5-minute market, weekdays only, 24 hours a day
function market(seed, days = 150, start = Date.UTC(2020, 0, 6) / 1000) {
  const rnd = K.rng(seed), B = []; let p = 1800, drift = 0;
  for (let d = 0; d < days; d++) {
    const d0 = start + d * 86400; if ([0, 6].includes(new Date(d0 * 1000).getUTCDay())) continue;
    if (d % 9 === 0) drift = (rnd() - 0.5) * 0.25;
    for (let i = 0; i < 288; i++) { const o = p, c = o + drift + (rnd() - 0.5) * 2.4, h = Math.max(o, c) + rnd() * 0.8, l = Math.min(o, c) - rnd() * 0.8; p = c; B.push({ t: d0 + i * 300, o, h, l, c, e: d0 + i * 300 + 300 }); }
  }
  return B;
}

test('pre-registration names the cells, the windows, the costs, the gate and the bar', () => {
  for (const w of ['xau WITH', 'usdjpy AGAINST', 'both WITH', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch t >= 2', 'n >= 300', 'Harness gate', '0.000045', 'C1', 'CLOSED at or before'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(WIN, { disc: ['2005-01-01', '2014-12-31'], conf: ['2015-01-01', '2026-10-31'] });
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `), line);
  assert.ok(line.includes(R.headline.slice(1)), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar, and the gate held', () => {
  assert.deepEqual(R.cells.map((c) => c.cell), SETS.flatMap((s) => GROUPS.map((g) => `${s} ${g}`)));
  for (const c of R.cells) {
    const profit = c.disc.n >= MIN_N && c.conf.n >= MIN_N && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.profit, profit, c.cell);
    const d = R.diffs[c.set], adds = d.disc.diff > 0 && d.conf.diff > 0 && d.disc.t >= 2 && d.conf.t >= 2;
    assert.equal(c.pass, c.group === 'WITH' && profit && adds, c.cell);
  }
  assert.equal(R.verdict, verdictOf(R.cells, R.gateOk));
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.equal(R.gateOk, true); assert.equal(R.gate.length, 6);
  for (const g of R.gate) assert.ok(g.ok, g.market + ' ' + g.from);
  // WITH + AGAINST + NONE = all trades of the set and window
  for (const s of SETS) for (const w of ['disc', 'conf']) {
    const n = (g) => R.cells.find((c) => c.cell === `${s} ${g}`)[w].n;
    assert.equal(n('WITH') + n('AGAINST') + R.extra[s][w].none.n, R.extra[s][w].all.n, s + ' ' + w);
  }
});

test('RESULT.md lists every cell and every difference from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of ['disc', 'conf']) assert.ok(row.includes(`| ${c[w].n} | ${f3(c[w].gross)} | ${f3(c[w].mean)} | ${c[w].t.toFixed(2)} |`), c.cell + ' ' + w);
  }
  for (const s of SETS) { const d = R.diffs[s]; assert.ok(md.includes(`| ${s} | ${f3(d.disc.diff)} | ${d.disc.t.toFixed(2)} | ${f3(d.conf.diff)} | ${d.conf.t.toFixed(2)} |`), s); }
});

test('the call of a day never reads a candle at or after its 00:00 UTC', () => {
  const B = market(7, 700), C = calls(B);
  assert.ok(C.events > 3, 'the seeded market gives direction switches');
  const dayStarts = [...new Set(B.map((b) => Math.floor(b.t / 86400) * 86400))];
  let seen = new Set(), checked = 0;
  for (const d0 of dayStarts.slice(20)) {
    const want = callAt(C, d0); seen.add(want);
    if (checked++ % 7) continue;
    // cut: only candles before d0
    assert.equal(callAt(calls(B.filter((b) => b.t < d0)), d0), want, 'cut at ' + d0);
    // change every later price
    if (checked % 3 === 1) { const rnd = K.rng(d0 % 1000), X = B.map((b) => (b.t < d0 ? b : { ...b, o: b.o * (1 + rnd()), h: b.h * 2.5, l: b.l * 0.4, c: b.c * (0.5 + rnd()) }));
      assert.equal(callAt(calls(X), d0), want, 'later prices changed, ' + d0); }
  }
  assert.ok(seen.has(1) && seen.has(-1), 'both calls occur');
  assert.equal(callAt(C, B[0].t), 0);                                   // nothing closed yet
  assert.equal(d0Of('2020-01-07'), Date.UTC(2020, 0, 7) / 1000);
  assert.equal(groupOf(1, 1), 'WITH'); assert.equal(groupOf(-1, 1), 'AGAINST'); assert.equal(groupOf(1, 0), 'NONE'); assert.equal(groupOf(-1, -1), 'WITH');
});

test('every breakout trade has its stop on the losing side, and tagging splits them by the call', () => {
  const B = market(11, 700), C = calls(B), days = buildDays(B.map((b) => [b.t, b.o, b.h, b.l, b.c])), tr = [];
  for (const d of days) { if (daySkip(d)) continue; const x = vbTrade(d.bars, { k: 0.5, sides: 'both', prevRange: d.prevRange, cost: 0 }); if (x.skip) continue;
    assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry, 'stop side ' + d.day); assert.ok(x.r > 0);
    assert.ok(x.fillT >= d.d0, 'filled inside its day'); assert.ok(x.R >= -1 - 1e-9 || x.how === 'stop');
    tr.push({ mk: 'xau', day: d.day, side: x.side, R: x.R, net: x.R - 0.02 }); }
  assert.ok(tr.length > 50);
  tag(tr, C);
  for (const x of tr) { assert.equal(x.call, callAt(C, d0Of(x.day))); assert.equal(x.group, groupOf(x.side, x.call)); }
  assert.ok(tr.some((x) => x.group === 'WITH') && tr.some((x) => x.group === 'AGAINST'));
  const E = evaluate(tr.map((x) => ({ ...x, day: x.day })));
  assert.equal(E.cells.length, 6);
  assert.ok(E.cells.every((c) => !c.pass), 'under 300 trades a window cannot pass');
  assert.equal(verdictOf(E.cells, true), 'INCONCLUSIVE'); assert.equal(verdictOf(E.cells, false), 'INCONCLUSIVE');
  assert.equal(gateOf('usdjpy', []).every((g) => !g.ok), true);
});
