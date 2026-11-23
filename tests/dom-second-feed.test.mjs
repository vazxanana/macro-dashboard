// tests/dom-second-feed.test.mjs - research/edge/dom-second-feed: the HistData reader, the cut test, RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHist, tradesOn, summ, paired } from '../research/edge/dom-second-feed/run.mjs';
import { histStampUtc } from '../council/histdata.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'dom-second-feed');

test('HistData lines go to UTC through histStampUtc and group to 5-minute candles', () => {
  const text = ['20200106 100000;1.1000;1.1005;1.0995;1.1001;0', '20200106 100100;1.1001;1.1010;1.1000;1.1008;0',
    '20200106 100100;9;9;9;9;0', '20200106 100500;1.1008;1.1009;1.0990;1.0992;0'].join('\n');
  const st = parseHist(text);
  const t0 = histStampUtc('20200106 100000');
  assert.equal(t0, Date.UTC(2020, 0, 6, 15, 0) / 1000);        // winter label + 5 h
  assert.equal(st.out.length, 2); assert.equal(st.dropped, 1);   // a repeated time is dropped
  assert.deepEqual(st.out[0], { t: t0, o: 1.1, h: 1.101, l: 1.0995, c: 1.1008, e: t0 + 300 });
  assert.equal(st.out[1].t, t0 + 300);
});

// a seeded market with H1 dominant pairs and pullbacks
function market(seed = 3, n = 40000) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let px = 100, t = Date.UTC(2021, 0, 4) / 1000, drift = 0;
  for (let i = 0; i < n; i++) {
    if (i % 400 === 0) drift = (rnd() - 0.5) * 0.02;
    const o = px, c = o + drift + (rnd() - 0.5) * 0.12, h = Math.max(o, c) + rnd() * 0.05, l = Math.min(o, c) - rnd() * 0.05;
    out.push({ t, o, h, l, c, e: t + 300 }); px = c; t += 300;
  }
  return out;
}

test('cut test: trades from candles cut at a moment are the full run\'s trades finished by then; every stop on the losing side', () => {
  const M = market(), from = M[600].t, to = M[M.length - 1].e;
  const full = tradesOn(M, 'xau', from, to, { cost: 0.01 }).trades;
  assert.ok(full.length > 30, 'enough trades: ' + full.length);
  for (const r of full) assert.ok(r.side * (r.entry - r.stop) > 0);
  for (const k of [15000, 26000, 33333]) {
    const cut = M.slice(0, k), c = cut[cut.length - 1].e;
    const part = tradesOn(cut, 'xau', from, c, { cost: 0.01 }).trades;
    const byT = new Map(full.map((r) => [r.t + ':' + r.side + ':' + r.entry, r]));
    for (const r of part) { const f = byT.get(r.t + ':' + r.side + ':' + r.entry); assert.ok(f, 'a cut trade not in the full run');
      for (const x of ['trail', '1R', '2R', '3R', '4R']) assert.equal(r[x], f[x]); }
    assert.ok(part.length >= full.filter((r) => r.t < c - 3 * 86400).length * 0.9);
  }
});

test('month statistics and the paired difference', () => {
  const rows = [{ t: Date.UTC(2021, 0, 5) / 1000, trail: 1, cr: 0.1 }, { t: Date.UTC(2021, 1, 5) / 1000, trail: -1, cr: 0.1 }, { t: Date.UTC(2021, 2, 5) / 1000, trail: 2, cr: 0.1 }];
  const s = summ(rows); assert.equal(s.n, 3); assert.equal(s.before, 0.6667); assert.equal(s.after, 0.5667);
  const p = paired(rows, rows); assert.equal(p.meanDiff, 0); assert.equal(p.months, 3);
});

test('RESULT.md states the verdict and figures of result.json', () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(res.verdict));
  assert.match(md.split('\n')[2], new RegExp('^\\*\\*Verdict: ' + res.verdict + '\\.'));
  for (const v of [res.T1.n, res.T1.before, res.T1.tBefore, res.T3.n, res.T3.before, res.T3.tBefore, res.T2.oanda.n, res.T2.oanda.before, res.T2.oanda.tBefore, res.T2.pairedBefore.t])
    assert.ok(md.includes(String(v).replace('-', '−')) || md.includes(String(v)), 'RESULT.md lacks ' + v);
  assert.equal(res.verdict, res.passes.T1 && res.passes.T3 ? 'PASS' : res.passes.T1 ? 'INCONCLUSIVE' : 'FAIL');
  assert.ok(fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8').includes('Holm over T1 and T3'));
});
