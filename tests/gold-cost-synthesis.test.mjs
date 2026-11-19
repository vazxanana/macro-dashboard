// gold-cost-synthesis: a descriptive table of 44 gold studies' own result files (no rule tested). Offline.
// Checks: RESULT.md is exactly the rendering of result.json (so every figure in it equals result.json); result.json is
// exactly what run.mjs builds from collected.json; spot rows of collected.json equal the source studies' files (hand-copied
// figures always; the source commits themselves when this checkout has them); the helpers on hand-made data.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build, render, headline, spearman, median, extract, get, BINS } from '../research/edge/gold-cost-synthesis/run.mjs';
import { STUDIES } from '../research/edge/gold-cost-synthesis/studies.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';

const DIR = path.resolve('research/edge/gold-cost-synthesis');
const R = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const C = JSON.parse(fs.readFileSync(path.join(DIR, 'collected.json'), 'utf8'));
const MD = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');

test('RESULT.md is the rendering of result.json, figure for figure', () => {
  assert.equal(MD, render(R));
});

test('result.json is what run.mjs builds from collected.json', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(build(C))), R);
});

test('the fixed list: 44 studies, one excluded with its reason, every commit recorded', () => {
  assert.equal(STUDIES.length, 44);
  assert.equal(R.studies.length, 44);
  assert.deepEqual(R.studies.filter((s) => s.excluded).map((s) => s.topic), ['gold-vol-target']);
  for (const s of R.studies) assert.match(s.commit, /^[0-9a-f]{40}$/, s.topic);
  // the one study whose own verdict line reads PASS
  assert.deepEqual(R.studies.filter((s) => s.passed).map((s) => s.topic), ['gold-vol-breakout-replicate']);
});

// figures copied by hand from the source branches' result.json (read on 14 Nov 2026)
const SPOT = [
  ['gold-vol-breakout', 'T1', 'oos', { n: 1121, gross: 0.121, net: 0.072, tGross: 3.21, tNet: 1.86, stop: 13.49, costStored: 0.049 }],
  ['gold-vol-breakout', 'T1', 'is', { n: 935, gross: 0.111, net: 0.009, tGross: 2.87, tNet: 0.22, stop: 6.49 }],
  ['gold-vol-breakout-replicate', 'R1', 'single', { n: 1657, gross: 0.203, net: 0.111, tGross: 5.96, tNet: 3.19, stop: 7.76 }],
  ['gold-london-orb', 'T1', 'is', { n: 2317, gross: 0.15, net: -0.041, tGross: 3.28, tNet: -0.88, stop: 3.49 }],
  ['gold-streak', 'T2', 'oos', { n: 349, gross: -0.029, net: -0.049, tGross: -1.13, tNet: -1.82, stop: null }],
  ['gold-oil-lead', 'T1', 'oos', { n: 126, gross: -0.006, net: -0.028, tGross: -0.1, tNet: -0.47, stop: 82.21, stopKind: 'mean' }],
  ['gold-china-holidays', 'T1', 'oos', { n: 10, gross: 0.2949, net: 0.224, tGross: 1.805, tNet: 1.3787 }],
  ['mmxm-pdhl-raid-gold', 'T1', 'oos', { n: 7, gross: -0.081, net: -0.131, tGross: null, tNet: -0.32, stop: 6.1 }],
  ['gold-hourly-shock', 'T1', 'oos', { n: 1051, gross: 0.069, net: -0.349, tGross: 1.1, tNet: -5.56, stop: 2.11 }],
];

test('spot rows equal the source studies\' own figures', () => {
  for (const [topic, t, w, want] of SPOT) {
    const r = R.rows.find((x) => x.topic === topic && x.test === t && x.window === w);
    assert.ok(r, `${topic} ${t} ${w}`);
    for (const [k, v] of Object.entries(want)) assert.equal(r[k], v, `${topic} ${t} ${w} ${k}`);
    // cost R is gross minus net, never estimated
    assert.equal(r.costR, Math.round((r.gross - r.net) * 1000) / 1000);
  }
});

test('spot rows against the source commits themselves, when this checkout has them', (t) => {
  const have = (sha) => { try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; } };
  let checked = 0;
  for (const topic of ['gold-vol-breakout', 'gold-london-orb', 'gold-streak', 'gold-oil-lead', 'gold-ibs', 'gold-vwap']) {
    const c = C.studies.find((s) => s.topic === topic);
    if (!have(c.commit)) continue;
    const json = JSON.parse(execFileSync('git', ['show', `${c.commit}:research/edge/${topic}/result.json`], { maxBuffer: 1 << 26 }).toString());
    // every collected value at its recorded path
    for (const row of c.rows) for (const v of Object.values(row.values)) if (v) assert.equal(get(json, v.path), v.v, `${topic} ${v.path}`);
    // and extraction from the source today gives the same rows
    assert.deepEqual(extract(STUDIES.find((s) => s.topic === topic), json), c.rows);
    checked++;
  }
  if (!checked) t.skip('source commits not in this checkout (CI clones main only); the hand-copied spot figures above still ran');
});

test('missing figures stay missing: "not reported", never estimated', () => {
  const mm = R.rows.filter((r) => r.topic === 'mmxm-pdhl-raid-gold');
  assert.ok(mm.length && mm.every((r) => r.tGross === null));
  assert.match(MD, /\| mmxm-pdhl-raid-gold \| T1 [^\n]*\| not reported \|/);
  // a study with no $ stop shows its stop rule and no number
  const ibs = R.rows.find((r) => r.topic === 'gold-ibs');
  assert.equal(ibs.stop, null);
  assert.match(MD, /\| gold-ibs \| T1 [^\n]*not reported \(rule: 2 x ATR\(20\)\)/);
});

test('bins, counts and the correlation follow from the rows', () => {
  const med = R.rows.filter((r) => r.stopKind === 'median');
  assert.equal(R.bins.reduce((s, b) => s + b.rows, 0), med.length);
  assert.equal(R.counts.rowsMedianStop, med.length);
  for (const [i, [lo, hi]] of BINS.entries()) {
    const b = med.filter((r) => r.stop >= lo && r.stop < hi);
    assert.equal(R.bins[i].rows, b.length);
    assert.equal(R.bins[i].cost, Math.round(median(b.map((r) => r.costR)) * 1000) / 1000);
  }
  assert.equal(R.corr.medianOnly.stopVsCost, Math.round(spearman(med.map((r) => r.stop), med.map((r) => r.costR)) * 1000) / 1000);
  assert.deepEqual(R.counts.testsBothTg2List, ['gold-vol-breakout T1', 'gold-vol-breakout T2']);
});

test('helpers on hand-made data', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  assert.ok(Math.abs(spearman([1, 2, 2, 3], [1, 2, 3, 4]) - 0.9486832980505138) < 1e-12);   // ties averaged
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  // extraction: a field map on a made-up result file, gross read from its own window object
  const st = { f: { n: 'n', g: 'g:mean', net: 'mean', tn: 'monthT' }, w: { is: 'x.{T}.is', oos: 'x.{T}.oos' }, wg: { is: 'x.{T}.isG', oos: 'x.{T}.oosG' }, tests: [{ id: 'T1', key: 'A' }] };
  const rows = extract(st, { x: { A: { is: { n: 5, mean: -0.1, monthT: -1 }, isG: { mean: 0.05 }, oos: { n: 6, mean: 0.2 }, oosG: {} } } });
  assert.deepEqual(rows[0].values, { n: { v: 5, path: 'x.A.is.n' }, g: { v: 0.05, path: 'x.A.isG.mean' }, net: { v: -0.1, path: 'x.A.is.mean' }, tn: { v: -1, path: 'x.A.is.monthT' } });
  assert.equal(rows[1].values.g, null);
  assert.equal(rows[1].values.tn, null);
});

test('verdict line: descriptive, under 220 characters, read by the Edge lab as neither pass nor fail', () => {
  const h = headline(R);
  assert.ok(h.length <= 220, `${h.length}`);
  assert.equal(R.verdict, h);
  assert.ok(MD.includes(`**Verdict: ${h}**`));
  const v = studyVerdict(R, MD);
  assert.equal(v.verdict, 'inc');
  assert.equal(v.headline, h);
  // no claim of an edge or a proposal
  assert.ok(MD.includes('No row below is an edge.'));
  assert.equal((MD.match(/\bis an edge\b/gi) || []).length, 1);
  assert.doesNotMatch(MD, /we propose|proposal:/i);
});
