// tests/nearmiss-holdout.test.mjs - the near-miss holdout study: RESULT.md agrees with result.json; offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DIR = new URL('../research/edge/nearmiss-holdout/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const CELLS = ['S6', 'MC', 'SD', 'CB'];

test('pre-registration exists and names the cells, sets, gate and Holm', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['Set A', 'Set B', 'Set C', 'Gate', 'ASSUMED', 'Holm', 'grid6-session-range', 'grid5-mosha-cycle', 'grid5-sd-eg', 'grid5-cycle-box']) assert.ok(p.includes(w), w);
});

test('verdict line on line 3 matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  for (const c of CELLS) { const x = R.cells[c].primary.before;
    assert.ok(line.includes(`${c} ${f3(x.mean)}R (n ${x.n}, t ${x.t.toFixed(2)})`), c); }
});

test('every gate reproduced its grid exactly', () => {
  for (const c of CELLS) { const g = R.gate[c]; assert.equal(g.ok, true, c);
    assert.deepEqual([g.n1, g.n2], [g.want.n1, g.want.n2], c); }
  assert.deepEqual([R.gate.S6.n1, R.gate.MC.n2, R.gate.SD.n2, R.gate.CB.n1], [253, 131, 288, 3345]);
});

test('the cut test: one explained difference, nothing else', () => {
  let n = 0, diff = 0; for (const s of ['A', 'B', 'C']) { const c = R.cut[s]; assert.ok(c.length >= 40); for (const x of c) { n++; diff += x.missing + x.extra; } }
  assert.equal(n, 120); assert.equal(diff, 1); assert.ok(R.cutNote.includes('New Year'));
});

test('the verdict follows the pre-registered bar', () => {
  const adj = CELLS.map((c) => R.cells[c].primary.holm);
  const pass = CELLS.filter((c, i) => { const x = R.cells[c].primary.before; return R.gate[c].ok && x.n >= 100 && x.mean > 0 && x.t >= 2 && adj[i] < 0.05; });
  const gatesOk = CELLS.every((c) => R.gate[c].ok), few = CELLS.some((c) => R.cells[c].primary.before.n < 100);
  assert.equal(R.verdict, pass.length ? 'PASS' : !gatesOk || few ? 'INCONCLUSIVE' : 'FAIL');
  assert.ok(R.headline.startsWith(R.verdict));
});

test('RESULT.md table figures come from result.json', () => {
  for (const c of CELLS) { const P = R.cells[c].primary, S = R.cells[c].sets;
    assert.ok(md.includes(`| ${c} | ${P.before.n}, ${f3(P.before.mean)} (${P.before.t.toFixed(2)})`), c + ' primary');
    assert.ok(md.includes(`${f3(P.after.mean)} (${P.after.t.toFixed(2)})`), c + ' after');
    assert.ok(md.includes(`${f3(P.placebo.mean)} (${P.placebo.t.toFixed(2)})`), c + ' placebo');
    for (const s of ['A', 'B']) assert.ok(md.includes(`${f3(S[s].before.mean)} (${S[s].before.t.toFixed(2)})`), c + s);
    assert.ok(md.includes(`${f3(S.C.before.mean)} (${S.C.before.t.toFixed(2)}), n ${S.C.before.n}`), c + 'C'); }
  const e = R.cells.SD.eurusd; assert.ok(md.includes(`${f3(e.A.before.mean)}R (n ${e.A.before.n}, t ${e.A.before.t.toFixed(2)})`));
  assert.equal(R.cells.SD.sets.B.markets.eurusd, undefined);
});
