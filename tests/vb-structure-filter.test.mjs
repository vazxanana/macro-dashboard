// node --test tests/vb-structure-filter.test.mjs - the H4 structure filter on the two breakout rules (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as V from '../research/edge/vb-structure-filter/run.mjs';

const DIR = new URL('../research/edge/vb-structure-filter/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000; // a Monday
function walk(nDays, seed = 5) {
  const r = K.rng(seed), out = []; let p = 2000;
  for (let i = 0; i < nDays * 288; i++) {
    const t = T0 + i * 300, wd = new Date(t * 1000).getUTCDay(); if (wd === 6 || wd === 0) continue;
    const o = p, c = o + (r() - 0.5) * 4 + Math.sin(i / 400) * 0.6, h = Math.max(o, c) + r() * 2, l = Math.min(o, c) - r() * 2;
    out.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return out;
}

test('no look-ahead: a day\'s H4 side does not move when every price from its 00:00 UTC on changes', () => {
  const m5 = walk(60), S = V.h4Side(m5);
  assert.ok(S.side.filter((s) => s !== 0).length > 50, 'the walk has structure');
  let checked = 0;
  for (let d = 5; d < 58; d += 3) {
    const d0 = T0 + d * 86400;
    const changed = m5.map((b) => (b.t < d0 ? b : { ...b, o: b.o + 300, h: b.h + 500, l: b.l - 500, c: b.c - 250 }));
    const cut = m5.filter((b) => b.t < d0);
    const a = V.sideAt(S, d0), b = V.sideAt(V.h4Side(changed), d0), c = cut.length ? V.sideAt(V.h4Side(cut), d0) : 0;
    assert.equal(a, b, 'later prices changed the side'); assert.equal(a, c, 'cut series gives another side'); checked++;
  }
  assert.ok(checked > 10);
});

test('the H4 candle holding 00:00 UTC is never read; thin blocks are dropped', () => {
  const m5 = walk(10), S = V.h4Side(m5), d0 = T0 + 3 * 86400;
  const n = K.closedCount(S.h4, d0);
  assert.ok(S.h4[n - 1].e <= d0 && (n === S.h4.length || S.h4[n].e > d0));
  assert.ok(S.h4.every((b) => b.n >= V.MIN_M5));
});

test('costs: the larger of the study\'s and the toolkit\'s', () => {
  assert.equal(V.costOf('xau', 2000), 0.60);
  assert.ok(Math.abs(V.costOf('usdjpy', 150) - (0.000045 * 150 + 0.005)) < 1e-12);
  assert.equal(V.costOf('usdjpy', 40), 0.008);
});

test('every recorded trade has its stop on the losing side; kept = first fill on the H4 side', () => {
  const tr = JSON.parse(fs.readFileSync(new URL('trades.json', DIR)));
  assert.ok(tr.length > 6000);
  for (const x of tr) {
    assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the wrong side');
    assert.equal(x.kept, x.h4Side !== 0 && x.h4Side === x.side);
    assert.ok(x.exitT >= x.entryT);
    assert.ok(['xau', 'usdjpy'].includes(x.market));
  }
});

test('result.json: the harness gate holds and RESULT.md says the same', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR))), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.ok(R.gateOk && R.gate.every((g) => g.ok));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
  assert.equal(R.verdictWord, R.decision.T1.verdict);
  const sg = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  for (const k of ['T1', 'T2', 'T3']) {
    const o = R.tests[k].windows.OOS;
    assert.ok(md.includes(`| ${o.filtered.n} | ${sg(o.filtered.netR)} |`), k + ' kept OOS row');
    assert.ok(md.includes(`| ${k} | ${R.decision[k].p} | ${R.decision[k].pHolm} |`), k + ' bar row');
    assert.equal(o.filtered.n + o.against.n + o.droppedSide0, o.unfiltered.n);
  }
});
