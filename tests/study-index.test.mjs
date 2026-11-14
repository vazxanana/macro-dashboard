// scripts/study-index.mjs on a small git repository made here (an "origin" with main and two branches, then a clone), so the
// test never depends on this repository's own branches. Offline: no gh call (pull requests are handed in).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildIndex, toMarkdown, figuresOf, assetClass, titleOf } from '../scripts/study-index.mjs';

const ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
const g = (cwd, ...args) => execFileSync('git', args, { cwd, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const put = (root, file, text) => { const p = path.join(root, file); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };

function makeRepo() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'study-index-'));
  const src = path.join(base, 'src');
  fs.mkdirSync(src);
  g(src, 'init', '-q', '-b', 'main');
  put(src, 'README.md', 'x\n');
  // on main: a gold study
  put(src, 'research/edge/gold-thing/PREREGISTRATION.md', '# Pre-registration: gold thing\n\n## The rule\nBuy gold after a strong close, stop under the low.\n');
  put(src, 'research/edge/gold-thing/RESULT.md', '# Gold thing: result\n\n**Verdict: FAIL.** Nothing passes.\n');
  put(src, 'research/edge/gold-thing/result.json', JSON.stringify({ verdict: 'FAIL: -0.12R a trade net (n 300, t -1.40)' }));
  g(src, 'add', '-A'); g(src, 'commit', '-q', '-m', 'main');
  // branch fx-study: a forex study, plus a folder with no result (left out)
  g(src, 'checkout', '-q', '-b', 'fx-study');
  put(src, 'research/edge/fx-fade/PREREGISTRATION.md', '# Pre-registration: EUR/USD fade\n\n## The rule\nFade the EUR/USD move into the London fix.\n');
  put(src, 'research/edge/fx-fade/RESULT.md', '# EUR/USD fade into the fix (12 Nov 2026)\n\n**Verdict: PASS.** +0.10R a trade net (n 120, t 2.31).\n');
  put(src, 'research/edge/half-done/PREREGISTRATION.md', '# Pre-registration: not run yet\n');
  g(src, 'add', '-A'); g(src, 'commit', '-q', '-m', 'fx');
  // branch btc-replicate: a crypto replication that could not be measured, made from main
  g(src, 'checkout', '-q', 'main');
  g(src, 'checkout', '-q', '-b', 'btc-replicate');
  put(src, 'research/edge/btc-replicate/RESULT.md', '# Bitcoin weekend rule, replicated\n\n**Verdict: NOT MEASURABLE.** The feed has no weekend candles.\n');
  g(src, 'add', '-A'); g(src, 'commit', '-q', '-m', 'btc');
  g(src, 'checkout', '-q', 'main');
  const clone = path.join(base, 'clone');
  g(base, 'clone', '-q', src, clone);
  return { base, clone };
}

test('study index: extraction from main and from branches', () => {
  const { base, clone } = makeRepo();
  try {
    const idx = buildIndex({ repo: clone, pulls: new Map([['fx-study', { number: 7, draft: true }]]) });
    const by = Object.fromEntries(idx.studies.map((r) => [r.topic, r]));
    assert.deepEqual(Object.keys(by).sort(), ['btc-replicate', 'fx-fade', 'gold-thing'], 'three topics, the folder without a result left out');
    assert.equal(by['gold-thing'].merged, true);
    assert.equal(by['gold-thing'].branch, 'main');
    assert.equal(by['gold-thing'].verdict, 'fail');
    assert.deepEqual(by['gold-thing'].figures, { n: 300, R: -0.12, Rper: 'trade', t: -1.4 });
    assert.equal(by['gold-thing'].title, 'Gold thing');
    assert.match(by['gold-thing'].rule, /Buy gold after a strong close/);
    assert.equal(by['fx-fade'].merged, false);
    assert.equal(by['fx-fade'].branch, 'fx-study');
    assert.equal(by['fx-fade'].pr, 7);
    assert.equal(by['fx-fade'].verdict, 'pass');
    assert.deepEqual(by['fx-fade'].figures, { n: 120, R: 0.1, Rper: 'trade', t: 2.31 });
    assert.equal(by['btc-replicate'].pr, null, 'no open pull request: left blank');
    assert.equal(by['btc-replicate'].verdict, 'nm');
    assert.equal(by['btc-replicate'].replicate, true);
    assert.equal(idx.counts.total, 3);
    assert.deepEqual(idx.counts.verdict, { pass: 1, fail: 1, inc: 0, nm: 1, '': 0 });
    assert.equal(idx.counts.replicate, 1);
    assert.equal(idx.counts.merged, 1);
    assert.equal(idx.branchesRead, 2);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('study index: grouping by asset class and the markdown', () => {
  const { base, clone } = makeRepo();
  try {
    const idx = buildIndex({ repo: clone, pulls: null });
    const cls = Object.fromEntries(idx.studies.map((r) => [r.topic, r.assetClass]));
    assert.deepEqual(cls, { 'gold-thing': 'gold', 'fx-fade': 'forex', 'btc-replicate': 'crypto' });
    assert.equal(idx.counts.byClass.gold, 1); assert.equal(idx.counts.byClass.forex, 1); assert.equal(idx.counts.byClass.crypto, 1);
    assert.equal(idx.prsRead, null);
    const md = toMarkdown(idx);
    assert.match(md, /\*\*3 studies\*\* \(1 on main, 2 only on a branch\): 1 PASS · 1 FAIL · 0 inconclusive · 1 not measurable · 1 replicate-type/);
    assert.match(md, /git fetch origin && node scripts\/study-index\.mjs/);
    const gold = md.indexOf('## Gold (1)'), fx = md.indexOf('## Forex (1)'), cr = md.indexOf('## Crypto (1)');
    assert.ok(gold > 0 && fx > gold && cr > fx, 'groups in the fixed order');
    assert.ok(!md.includes('## Indices'), 'empty groups are left out');
    assert.match(md, /\| `fx-fade` \| branch `fx-study` \|/);
    assert.match(md, /n 300, -0\.12R a trade, t -1\.4/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('study index: pure pieces', () => {
  assert.deepEqual(figuresOf('FAIL. 0 of 3; target 3R'), {}, 'a bare "3R" target is not a result');
  assert.deepEqual(figuresOf('−0.059R a position net (n 827, monthly t −0.89)'), { n: 827, R: -0.059, Rper: 'position', t: -0.89 });
  assert.equal(assetClass('gold-carry', 'What it costs to hold a gold buy', ''), 'meta');
  assert.equal(assetClass('nr7-breakout', 'NR7 breakout on gold, two US indices and three currency pairs', ''), 'cross-asset');
  assert.equal(assetClass('silver-rsi', 'the RSI pullback on silver', ''), 'commodities');
  assert.equal(assetClass('gold-silver-book', 'gold and silver', ''), 'gold');
  assert.equal(titleOf('# Pre-registration: the thing\n'), 'the thing');
  assert.equal(titleOf('# The thing: result\n'), 'The thing');
});
