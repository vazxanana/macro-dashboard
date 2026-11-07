// node --test tests/analyst-whatchanged.test.mjs — the Analyst's daily "What changed" block (fake trades)
import test from 'node:test';
import assert from 'node:assert/strict';
import { whatChangedSection, analystSections, stats, welchT, edgeWords, changeReasons, WC_START, WC_END, PM_START } from '../council/analyst.mjs';

const NOW = Date.UTC(2026, 10, 7, 12, 0) / 1000;
// n closed trades of setup k, one an hour ending `end` seconds before NOW, R from f(i)
const run = (k, n, f, o = {}, end = 3600) => Array.from({ length: n }, (_, i) => ({ id: `${k}-${o.tag || ''}${i}`, k, name: k.toUpperCase(), market: 'xau', label: 'XAU/USD', status: f(i) > 0 ? 'win' : 'loss', R: f(i),
  closed: NOW - end - (n - 1 - i) * 3600, shadow: i % 3 !== 0, feat: { session: o.session ? o.session(i) : 'london', d1: 'with' } }));

test('stats, Welch t and edge wording', () => {
  const s = stats([1, -1, 1, -1]); assert.equal(s.n, 4); assert.equal(s.mean, 0); assert.equal(s.wr, 0.5);
  assert.ok(welchT([2, 2.1, 1.9, 2], [0, 0.1, -0.1, 0]) > 10);
  assert.equal(welchT([], []), 0);
  assert.match(edgeWords({ n: 12, t: 3, mean: 1 }), /too few trades to judge an edge \(n 12, t 3\.0\)/);
  assert.match(edgeWords({ n: 40, t: 2.4, mean: 0.3 }), /unlikely to be luck \(n 40, t 2\.4\)/);
  assert.match(edgeWords({ n: 40, t: 1.2, mean: 0.3 }), /no proven edge \(n 40, t 1\.2\)/);
});

test('a setup whose last 20 lose after a winning record is decaying, with a reason and confidence', () => {
  // 60 earlier trades: 2 wins of +1.5 for each loss; last 20: mostly losses, in the overlap session
  const old = run('scalp', 60, (i) => (i % 3 === 0 ? -1 : 1.5), { tag: 'o' }, 21 * 3600);
  const rec = run('scalp', 20, (i) => (i % 5 === 0 ? 1.5 : -1), { tag: 'r', session: () => 'overlap' });
  const md = whatChangedSection({ trades: [...old, ...rec], now: NOW });
  assert.ok(md.startsWith(WC_START) && md.endsWith(WC_END));
  assert.match(md, /Daily, for 2026-11-07 \(UTC\)/);
  assert.match(md, /\| SCALP \(scalp\) \| 80 \(27\) \|/);
  assert.match(md, /\*\*decaying\*\* \| fair \(t -\d+\.\d, 20 vs 60\)/);
  assert.match(md, /SCALP\*\* \(scalp\) is decaying: −0\.50R a trade over the last 20 vs \+0\.67R before; won 20% of the last 20 \(was 67%\)/);
  assert.match(md, /biggest mover: no london session in the last 20 \(was 100% of trades, at \+0\.67R a trade\)/);
  assert.match(md, /Whole record: .*\(n 80, t /);
});

test('small samples are marked and never compared; no edge is claimed without n >= 30 and t >= 2', () => {
  const md = whatChangedSection({ trades: run('swing', 8, () => 2), now: NOW });
  assert.match(md, /\| SWING \(swing\) \| 8 \(3\) \| \+2\.00 \(t 0\.0\) \| \+2\.00 \(only 8\) \| — \| too few to compare \| small sample \(n 8\) \|/);
  assert.match(md, /no setup has a positive record with n ≥ 30 and t ≥ 2, so none is claimed/);
  const steady = run('intraday', 50, (i) => (i % 2 ? 1.2 : -1));
  const md2 = whatChangedSection({ trades: steady, now: NOW });
  assert.match(md2, /steady \(within noise\)/); assert.match(md2, /No setup moved beyond noise/);
  const edge = run('pos', 40, (i) => (i % 4 === 0 ? -1 : 1.5));
  assert.match(whatChangedSection({ trades: edge, now: NOW }), /\*\*Edge check:\*\* pos \+0\.88R a trade \(n 40, t \d+\.\d\)/);
});

test('open, missed and replay trades are ignored; last 24 h is counted live and in all', () => {
  const t = [...run('scalp', 3, () => -1), { id: 'o', k: 'scalp', status: 'open', R: null, closed: null }, { id: 'm', k: 'scalp', status: 'missed', R: 0, closed: NOW - 60 }, { id: 'rp', k: 'scalp', status: 'win', R: 5, closed: NOW - 60, replay: true }];
  const md = whatChangedSection({ trades: t, now: NOW });
  assert.match(md, /\*\*Last 24 h:\*\* 3 trades closed \(1 live\), −3\.00R \(live −1\.00R\)\./);
  assert.match(md, /\| SCALP \(scalp\) \| 3 \(1\) \|/);
});

test('cost-adjusted Rnet is used where recorded, and the header says so', () => {
  const t = run('scalp', 4, () => 1).map((x, i) => (i < 2 ? { ...x, Rnet: 0.8 } : x));
  const md = whatChangedSection({ trades: t, now: NOW });
  assert.match(md, /in R after costs for 2 of 4 trades \(raw R for the rest\)/);
  assert.match(md, /\| SCALP \(scalp\) \| 4 \(2\) \| \+0\.90 /);
  assert.match(whatChangedSection({ trades: t.map((x) => ({ ...x, Rnet: 0.5 })), now: NOW }), /in R after costs\. /);
});

test('changeReasons names the bucket that moved the mean, in its direction', () => {
  const pri = run('x', 30, (i) => (i % 2 ? 1 : -0.5), { session: (i) => (i % 2 ? 'london' : 'asia') });
  const rec = run('x', 20, (i) => (i < 15 ? -1 : 1), { session: (i) => (i < 15 ? 'asia' : 'london') });
  const r = changeReasons(rec, pri);
  assert.match(r[0], /won 25% of the last 20 \(was 50%\)/);
  assert.match(r[1], /asia session, 15 of the last 20 \(was 50% of trades\) at −1\.00R a trade \(was −0\.50R a trade\)/);
});

test('analystSections: What changed is rebuilt once a day; post-mortems refresh every time; other text is kept', () => {
  const base = '# Week\n\nintro\n\n## Top 3 to watch\n\n1. x\n';
  const one = analystSections(base, { trades: run('scalp', 5, () => -1), reviews: {}, now: NOW });
  assert.ok(one.includes(PM_START) && one.includes(WC_START) && one.includes('## Top 3 to watch\n\n1. x'));
  assert.ok(one.indexOf(WC_START) < one.indexOf('## Top 3'));
  const same = analystSections(one, { trades: run('scalp', 9, () => -1), reviews: {}, now: NOW + 3600 });
  assert.equal(same, one, 'same UTC day: What changed is not rebuilt');
  const next = analystSections(one, { trades: run('scalp', 9, () => -1), reviews: {}, now: NOW + 86400 });
  assert.match(next, /for 2026-11-08 \(UTC\)/); assert.equal(next.split(WC_START).length, 2, 'one block only');
  assert.equal(analystSections(null, {}), null);
});
