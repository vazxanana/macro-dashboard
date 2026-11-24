// vb-news-days: result figures, the gates, and the release tagging (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { releases, byDay, tag, monthDiff, holm } from '../research/edge/vb-news-days/run.mjs';

const R = JSON.parse(fs.readFileSync(new URL('../research/edge/vb-news-days/result.json', import.meta.url)));
const CH = JSON.parse(fs.readFileSync(new URL('../council/consensus-history.json', import.meta.url)));
const md = fs.readFileSync(new URL('../research/edge/vb-news-days/RESULT.md', import.meta.url), 'utf8');

test('gates passed and the verdict matches the tests', () => {
  assert.equal(R.gate.ok, true);
  assert.deepEqual(R.gate.gold.got, { n: 1121, netR: 0.105, t: 2.79 });
  assert.deepEqual(R.gate.usdjpy.got, { n: 2079, netR: 0.063 });
  assert.equal(R.tests.filter((t) => t.holds).length, 0);
  assert.match(R.verdict, /^NO DIFFERENCE SHOWN, 0 of 3/);
  assert.match(md, /NO DIFFERENCE SHOWN, 0 of 3/);
  assert.equal(R.cells.gold.CONF.delta, -0.189);
  assert.equal(R.cells.gold.CONF.monthDiff.t, -1.31);
  assert.equal(R.cells.usdjpy.CONF.monthDiff.t, 0.81);
  assert.equal(R.cells.pooled.CONF.monthDiff.t, -0.39);
});

test('release list: 2018 on, CPI / NFP / FOMC once per day', () => {
  const rel = releases(CH, '2026-11-20');
  assert.equal(rel[0].day.slice(0, 4), '2018');
  assert.equal(rel.length, R.releases.n);
  const keys = new Set(rel.map((r) => r.type + r.day)); assert.equal(keys.size, rel.length);
  assert.ok(rel.every((r) => ['CPI', 'NFP', 'FOMC'].includes(r.type)));
  assert.ok(!rel.some((r) => r.day > '2026-11-20'));     // no scheduled release after the data end
});

test('tag: a fill candle ending at the release minute is "before"; scheduled times only', () => {
  const rd = byDay([{ day: '2024-03-12', t: Date.parse('2024-03-12T12:30:00Z') / 1000, type: 'CPI' }]);
  assert.equal(tag({ day: '2024-03-12', fillMin: 12 * 60 + 25 }, rd).before, true);
  assert.equal(tag({ day: '2024-03-12', fillMin: 12 * 60 + 30 }, rd).before, false);
  assert.equal(tag({ day: '2024-03-13', fillMin: 600 }, rd).rel, false);
});

test('monthDiff and holm on a toy series', () => {
  const tr = [{ day: '2024-01-02', rel: true, net: 1 }, { day: '2024-01-03', rel: false, net: 0 }, { day: '2024-02-02', rel: true, net: 2 }, { day: '2024-02-03', rel: false, net: 0 }, { day: '2024-03-03', rel: false, net: 5 }];
  const m = monthDiff(tr); assert.equal(m.months, 2); assert.equal(m.d, 1.5);
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((v) => Math.round(v * 100) / 100), [0.03, 0.08, 0.5]);
});
