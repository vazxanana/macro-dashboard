// gotobi-forward: the forward record of the gotobi study's T2 (research/edge/gotobi-forward). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { START, COST, SRC_SHA, CHECKS, build, bands, forwardTrades, report } from '../research/edge/gotobi-forward/run.mjs';

const DIR = new URL('../research/edge/gotobi-forward/', import.meta.url);
const base = JSON.parse(fs.readFileSync(new URL('baseline.json', DIR), 'utf8'));
const study = JSON.parse(fs.readFileSync(new URL('../research/edge/gotobi/result.json', import.meta.url), 'utf8')).tests.T2.decisive;
const exec = JSON.parse(fs.readFileSync(new URL('../research/edge/gotobi-exec/result.json', import.meta.url), 'utf8'));

test('gotobi forward: the rule is the pinned study file and the cost is gotobi-exec\'s measured median, frozen', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(new URL('../research/edge/gotobi/run.mjs', import.meta.url))).digest('hex');
  assert.equal(sha, SRC_SHA);
  assert.equal(COST, Math.round(exec.cost.medianPips * 0.01 * 1e6) / 1e6);
  assert.equal(START, '2026-11-21');
  assert.match(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8'), /2026-11-20 01:32 UTC/);
});

test('gotobi forward: the baseline is the study\'s decisive T2 set, gated, every day before the start', () => {
  assert.equal(base.gate.n, study.n); assert.equal(base.gate.netR, study.netR);
  assert.equal(base.rows.length, study.n);
  assert.ok(base.rows.every(([d]) => d >= '2016-01-01' && d <= '2026-11-11' && d < START));
  assert.ok(base.mean > study.netR, 'the measured cost is lower than the study\'s assumed one');
});

// a flat market with a gentle rise: the fade loses a little every gotobi day, never stopped
function bars(from, to) {
  const out = []; let p = 155;
  for (let t = Date.parse(from) / 1000; t < Date.parse(to) / 1000; t += 300) {
    const dow = new Date(t * 1000).getUTCDay(); if (dow === 0 || dow === 6) continue;
    const o = p, c = p + 0.0003 + ((t / 300) % 7 === 0 ? -0.01 : 0.002); out.push([t, o, Math.max(o, c) + 0.001, Math.min(o, c) - 0.001, c]); p = c;
  }
  return out;
}

test('gotobi forward: only gotobi days from the start whose 06:00 exit is on file count', () => {
  const ev = forwardTrades(bars('2026-10-01T00:00:00Z', '2026-11-30T03:00:00Z'));
  assert.deepEqual(ev.trades.map((x) => x.day), ['2026-11-25'], '20 Nov is before the start; 30 Nov has no 06:00 yet');
  const x = ev.trades[0];
  assert.ok(x.stop > x.entry, 'a sell with its stop above');
  assert.ok(Math.abs(x.net - (x.R - COST / x.D)) < 2e-3);
});

test('gotobi forward: readings and checkpoints; the first crossing stands', () => {
  const xs = base.rows.map((r) => r[1]);
  assert.deepEqual(bands(xs, 30), bands(xs, 30), 'seeded');
  const tr = (n, v) => Array.from({ length: n }, (_, i) => ({ day: `2027-${String(1 + (i % 12)).padStart(2, '0')}-${String(5 + (i % 4) * 5).padStart(2, '0')}`, net: v, R: v }));
  assert.equal(build({ trades: tr(5, 1), skipped: [], dataEnd: 'x' }, base, null).reading, 'too few');
  const f = build({ trades: tr(CHECKS[0] + 5, -1), skipped: [], dataEnd: 'x' }, base, null);
  assert.equal(f.crossed[CHECKS[0]].reading, 'fails'); assert.match(f.verdict, /^FAIL/);
  const later = build({ trades: tr(CHECKS[0] + 10, 1), skipped: [], dataEnd: 'y' }, base, f);
  assert.equal(later.crossed[CHECKS[0]].reading, 'fails', 'the first crossing stands');
  const ok = build({ trades: tr(CHECKS[1] + 1, 0.5).map((x, i) => ({ ...x, net: i % 2 ? 0.2 : 0.8 })), skipped: [], dataEnd: 'z' }, base, null);
  assert.equal(ok.crossed[CHECKS[1]].reading, 'confirmed');
});

test('gotobi forward: the report matches result.json', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(R.start, START);
  assert.equal(md, report(R));
  assert.ok(md.includes(`**Verdict: ${R.verdict}**`));
});
