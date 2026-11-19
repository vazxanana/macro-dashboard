// research/edge/blowoff-veto and its live check on the Macro desk (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { flagsAt, nwSlope, analyse, VETO } from '../research/edge/blowoff-veto/run.mjs';
import { blowoffCheck, BLOWOFF, loadDocs } from '../council/research-watch.mjs';

test('the veto flags: 50-day stretch, 20 and 7 session runs; the live check uses the same thresholds', () => {
  assert.deepEqual(BLOWOFF, VETO);
  const flat = Array(60).fill(100); assert.equal(flagsAt(flat, 59).any, false);
  const up7 = flat.slice(); up7[59] = 111; const f = flagsAt(up7, 59); assert.ok(f.up7 && f.any && !f.up20 && !f.sma);
  const g = up7.map((v, i) => ({ t: i * 86400, v }));
  const c = blowoffCheck({ gold: g, now: 59 * 86400, study: null }); assert.match(c.text, /ON/); assert.ok(c.readings[2].on);
  assert.match(blowoffCheck({ gold: flat.map((v, i) => ({ t: i * 86400, v })), now: 59 * 86400 }).text, /off/);
  assert.equal(blowoffCheck({ gold: g.slice(0, 20), now: 59 * 86400 }), null);
});

test('Newey-West slope on a dummy; the verdict rule', () => {
  const y = [0, 0, 0, 0, 1, 1, 1, 1], x = [0, 0, 0, 0, 1, 1, 1, 1]; assert.ok(Math.abs(nwSlope(y.map((v, i) => v + (i % 2) * 0.01), x).b - 1) < 0.02);
  const rows = Array.from({ length: 40 }, (_, i) => ({ day: '2010-01-' + String(1 + (i % 28)).padStart(2, '0'), score: 0.5, flag: false, f: {}, fwd: 0.01, w1: [0.0025, 0.0025, 0.0025, 0.0025] }));
  assert.equal(analyse(rows).verdict, 'FAIL');
});

test('the committed result: pre-registered first, the report quotes it, the desk reads it', () => {
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/blowoff-veto/result.json', import.meta.url), 'utf8'));
  assert.equal(R.verdict, 'FAIL'); assert.equal(R.parity.card, +R.parity.last.score.toFixed(2));
  const md = fs.readFileSync(new URL('../research/edge/blowoff-veto/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /Verdict: FAIL/); assert.ok(md.includes(String(R.test.buyWeeks)) && md.includes(R.dailyAfter.test.flaggedDays + ' days in ' + R.dailyAfter.test.episodes + ' episodes'));
  assert.ok(fs.existsSync(new URL('../research/edge/blowoff-veto/PREREGISTRATION.md', import.meta.url)));
  const D = loadDocs(); assert.equal(D.blowoff.verdict, 'FAIL');
  const c = blowoffCheck({ gold: [{ t: 0, v: 1 }].concat(Array.from({ length: 60 }, (_, i) => ({ t: (i + 1) * 86400, v: 1 }))), now: 61 * 86400, study: D.blowoff });
  assert.match(c.caveat, /a caution, not a tested edge/);
});
