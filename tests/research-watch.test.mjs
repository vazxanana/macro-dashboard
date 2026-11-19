// council/research-watch.mjs: the owner's briefs, research maps and news register checked on today's data (19 Nov 2026)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadDocs, register, hypIds, hypothesesFor, goldScenarios, japanCheck, fundingLadder, positioningNote, watch, DOCS } from '../council/research-watch.mjs';

const D = loadDocs(), DAY = 86400, now = Date.UTC(2026, 10, 19) / 1000;
const series = (end, d28, n = 60) => Array.from({ length: n }, (_, i) => ({ t: now - (n - 1 - i) * DAY, v: end - d28 * Math.max(0, (n - 1 - i)) / 28 }));

test('every document is on disk and the register parses to N1..N10', () => {
  for (const [k, f] of Object.entries(DOCS)) assert.ok(D[k], `missing ${f}`);
  const R = register(D.register);
  assert.deepEqual(R.map((r) => r.id), ['N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10']);
  for (const r of R) { assert.ok(r.rule.length > 40 && r.gate.length > 20, r.id); assert.ok(!/\]\(/.test(r.rule + r.gate), 'links stripped'); }
  assert.equal(R[0].priority, 'high'); assert.match(R[0].title, /CPI composition surprise/);
});

test('releases map to the register; speakers and other countries do not', () => {
  assert.deepEqual(hypIds('Core CPI m/m'), ['N1', 'N4']);
  assert.deepEqual(hypIds('Non-Farm Employment Change'), ['N2', 'N4']);
  assert.deepEqual(hypIds('FOMC Statement'), ['N3']);
  assert.deepEqual(hypIds('Unemployment Claims'), ['N5']);
  assert.deepEqual(hypIds('Core Retail Sales m/m'), ['N7']);
  assert.deepEqual(hypIds('Crude Oil Inventories'), ['N10']);
  assert.deepEqual(hypIds('FOMC Member Waller Speaks'), []);
  assert.deepEqual(hypIds('CPI y/y', 'EUR'), []);
  const h = hypothesesFor({ title: 'Core CPI m/m', titles: ['Core CPI m/m', 'CPI m/m'] }, register(D.register));
  assert.deepEqual(h.items.map((x) => x.id), ['N1', 'N4']); assert.match(h.status, /none is validated/);
});

test('gold brief: real yields and the dollar rising together below the October low read as its correction scenario', () => {
  const gold = [{ t: Date.UTC(2026, 9, 25) / 1000, v: 3900 }, { t: now, v: 3800 }];
  const r = goldScenarios({ md: D.gold, S: { DFII10: series(2.9, 0.25), dxy: series(104, 2) }, gold, now });
  assert.equal(r.lean, 'correction'); assert.equal(r.scenario, 'Correction resumes'); assert.ok(r.together);
  const up = goldScenarios({ md: D.gold, S: { DFII10: series(2.5, -0.3), dxy: series(100, -2) }, gold: [{ t: Date.UTC(2026, 9, 25) / 1000, v: 3900 }, { t: now, v: 4100 }], now });
  assert.equal(up.lean, 'recovery'); assert.equal(up.scenario, 'Recovery extends');
  // one condition alone (real yields up, dollar flat, price above) is not a correction
  const mix = goldScenarios({ md: D.gold, S: { DFII10: series(2.9, 0.25), dxy: series(104, 0) }, gold: [{ t: Date.UTC(2026, 9, 25) / 1000, v: 3900 }, { t: now, v: 3950 }], now });
  assert.notEqual(mix.lean, 'correction');
});

test('funding ladder: one flagged proxy is level 1 in the map\'s own words; the strategist\'s stress label gets the caution', () => {
  const r = fundingLadder({ md: D.funding, fc: { regime: { sofrEffrBps: 2, broadUsd20dPct: 0.5, vixTermRatio: 1.02, smile: 'left' } }, S: { BAMLH0A0HYM2: series(3, 0) }, now });
  assert.equal(r.level, 1); assert.match(r.text, /not enough to establish broad stress/); assert.match(r.caution, /repo does not/);
  const hard = fundingLadder({ md: D.funding, fc: { regime: { sofrEffrBps: 15, broadUsd20dPct: 3, vixTermRatio: 1.1 } }, S: { BAMLH0A0HYM2: series(4, 0.8) }, now });
  assert.equal(hard.level, 3); assert.equal(hard.caution, null);
  const calm = fundingLadder({ md: D.funding, fc: { regime: { sofrEffrBps: 1, broadUsd20dPct: 0, vixTermRatio: 0.9 } }, S: {}, now });
  assert.equal(calm.level, 0);
});

test('Japan brief and positioning note', () => {
  const j = japanCheck({ md: D.japan, S: { DGS10: series(4.6, 0.2) }, usdjpy: series(155, 3), now });
  assert.ok(j.dominates); assert.equal(j.scenario, 'Global yields dominate local signal');
  assert.ok(!japanCheck({ md: D.japan, S: { DGS10: series(4.6, 0.02) }, usdjpy: series(155, 3), now }).dominates);
  const p = positioningNote({ S: { cot: { net: 112341, chg4w: -5252, pct: 53, asOf: '2026-11-10' } } });
  assert.match(p.text, /53rd percentile/); assert.match(p.text, /fell by 5,252/); assert.match(p.caveat, /excludes OTC/);
});

test('watch(): no forecast words, nothing without its source; the veteran and the desk are wired', () => {
  const { watch: W } = watch({ docs: D, fc: { regime: { sofrEffrBps: 2, vixTermRatio: 1.02 } }, S: { DFII10: series(2.9, 0.25), dxy: series(104, 2), DGS10: series(4.6, 0.2) }, gold: [{ t: now, v: 3800 }], usdjpy: series(155, 3), now });
  assert.ok(W.items.length >= 3); for (const x of W.items) assert.ok(x.doc && x.text);
  assert.match(W.label, /Not a forecast, not a tested edge/);
  const txt = JSON.stringify(W); for (const w of [/\bwill (rise|fall)\b/i, /guarantee/i, /proven edge/i]) assert.ok(!w.test(txt), String(w));
  const vet = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(vet, /researchWatch\(/); assert.match(vet, /usdjpy: daily\.usdjpy/);
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.match(page, /id="c-res"/); assert.match(page, /renderResearch\(v\)/); assert.match(page, /What your news register says to test/);
  const mod = fs.readFileSync(new URL('../council/research-watch.mjs', import.meta.url), 'utf8');
  assert.ok(!/fetch\(|placeOrder|\.stop =/.test(mod));
});

test('NY Fed survey: the verified cells beside today\'s 2-year yield, with the clock caveat', async () => {
  const { nyfedSurvey } = await import('../council/research-watch.mjs');
  const r = nyfedSurvey({ json: D.nyfed, fc: { regime: { us2y: 4.8 } }, S: {}, now });
  assert.equal(r.gapBp, 117); assert.match(r.text, /3\.63%/); assert.match(r.text, /n 61/); assert.match(r.text, /3\.20%/);
  assert.match(r.caveat, /published after the 2026-09 meeting/);
  assert.equal(nyfedSurvey({ json: '{bad', fc: {}, S: {}, now }), null);
});

test('CPI plan on CPI cards: the matrix, the windows, the confounders the calendar shows', async () => {
  const { cpiPlan } = await import('../council/research-watch.mjs');
  const at = '2026-12-10T13:30:00.000Z', cal = [{ title: '10-y Bond Auction', country: 'USD', at: '2026-12-10T18:00:00.000Z' }, { title: 'Federal Funds Rate', country: 'USD', at: '2026-12-11T19:00:00.000Z' }, { title: 'CPI m/m', country: 'USD', at }];
  const p = cpiPlan(D.cpiPlan, { title: 'Core CPI m/m', titles: ['Core CPI m/m', 'CPI m/m'], country: 'USD', at }, cal);
  assert.equal(p.matrix.length, 5); assert.match(p.matrix[0].outcome, /Headline and core both hotter/);
  assert.equal(p.confounders.length, 2); assert.match(p.confounders[0], /Auction the same day/i);
  assert.match(p.rule, /no surprise/);
  assert.equal(cpiPlan(D.cpiPlan, { title: 'Non-Farm Employment Change', at }, cal), null);
  assert.equal(cpiPlan(D.cpiPlan, { title: 'CPI y/y', country: 'EUR', at }, cal), null);
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8'); assert.match(page, /Your CPI plan/);
});
