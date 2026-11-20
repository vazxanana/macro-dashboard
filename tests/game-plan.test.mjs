// The week as a plan to follow, and the source scorecard (council/game-plan.mjs, 20 Nov 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as G from '../council/game-plan.mjs';

const rd = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const T = Date.parse('2026-12-10T13:30:00Z') / 1000, NOW = Date.parse('2026-12-07T09:00:00Z') / 1000;
const hd = (actual = null) => ({ nowcast: { months: [{ month: '2026-11', now: { cpi: 0.07, coreCpi: 0.21 }, actual }] },
  priced: { items: { coreCpi: [{ close: '2026-12-10T13:25:00Z', likely: [{ v: 0.2, p: 0.41 }, { v: 0.3, p: 0.33 }] }], cpi: [{ close: '2026-12-10T13:25:00Z', likely: [{ v: -0.1, p: 0.44 }] }] } } });
const rel = (title, exp) => ({ t: T, title, country: 'USD', type: 'CPI', impact: 'high', exp, nowcast: { month: '2026-11', core: 0.21, head: 0.07 },
  record: { name: 'CPI', lines: ['Gold moved a median ±0.9% on the day of the last 60 (since 2018), up 55% of the time.', 'Above the consensus gold averaged −0.4% (n 20); below it +0.5% (n 18).'] } });
const wa = () => ({ days: [{ day: '2026-12-10', dow: 'Thursday', range: { text: 'A typical day\'s move is about $40. More words.' }, releases: [rel('CPI m/m', '0.1%'), rel('Core CPI m/m', '0.3%'), rel('CPI y/y', '2.9%')] }] });

test('the tested facts on the cards are the studies\' own numbers', () => {
  const a = rd('../research/edge/red-folder-surprise/result.json'), b = rd('../research/edge/gold-release-quotes/result.json');
  assert.equal(G.FACTS.firstFive.agree, a.T1.all.agree); assert.equal(G.FACTS.firstFive.n, a.T1.all.n);
  assert.match(a.verdict, /FAIL/); assert.match(G.FACTS.firstFive.text, /FAILED/);
  const A = b.partA.ALL;
  assert.equal(G.FACTS.spread.multiple, Math.round(A.marks['5'].median / A.hourMedianFrac)); assert.equal(G.FACTS.spread.n, A.marks['5'].n);
});

test('a card per release type: the three sources, whether they agree, the tested facts, the record', () => {
  const P = G.planOf(wa().days, hd());
  assert.equal(P.cards.length, 1, 'core, headline and y/y rows of one release share a card');
  const c = P.cards[0];
  assert.equal(c.title, 'Core CPI m/m');
  assert.match(c.before[0], /calendar consensus is \+0\.3%; the Cleveland Fed nowcast is \+0\.21%; a prediction market's most likely print is \+0\.2% \(41%\)/);
  assert.match(c.before[1], /The sources differ \(\+0\.3% against \+0\.2%\)/);
  assert.match(c.before[2], /Above the consensus gold averaged .* Decide now/);
  assert.equal(c.at.length, 2); assert.match(c.at[0], /60 of 83/); assert.match(c.at[1], /18 times/);
  assert.match(c.after[0], /median/); assert.equal(c.after[1], 'A typical day\'s move is about $40.'); assert.match(c.after[2], /scorecard/);
  assert.ok(P.routine.length >= 5 && P.routine.every((s) => s.when && s.what && s.where));
  const all = JSON.stringify(P);
  assert.ok(!/\b(guarantee|will rise|will fall|sure thing|proven edge)\b/i.test(all));
  // a release with no test of its first minutes says so; no scorecard line for it
  const g = G.planOf([{ day: '2026-11-25', dow: 'Wednesday', releases: [{ t: T, title: 'Prelim GDP q/q', country: 'USD', type: 'GDP', exp: '2.8%' }] }], hd()).cards[0];
  assert.match(g.at[0], /No test of the first minutes/); assert.match(g.after.at(-1), /no scorecard/); assert.match(g.before[0], /2\.8%/);
  assert.equal(G.planOf([{ day: 'x', dow: 'Monday', releases: [{ t: T, title: 'Cash Rate', country: 'AUD', type: null }] }], null).cards.length, 0);
});

test('the scorecard: each source captured once before the release, the print attached once, misses measured', () => {
  let R = G.capture([], wa(), hd(), NOW);
  assert.deepEqual(R.map((x) => x.id), ['CPI:2026-11:headline', 'CPI:2026-11:core'], 'the y/y row is not scored');
  const core = R[1];
  assert.deepEqual([core.consensus, core.nowcast, core.priced], [0.3, 0.21, 0.2]);
  // a later reading never changes a figure already written; a source missing at first is added when first seen
  const later = wa(); later.days[0].releases[1].exp = '0.4%'; later.days[0].releases[1].nowcast.core = 0.33;
  assert.deepEqual(G.capture(R, later, hd(), NOW + 3600)[1], core);
  const noCons = wa(); noCons.days[0].releases[1].exp = null;
  let S = G.capture([], noCons, hd(), NOW); assert.equal(S[1].consensus, undefined);
  S = G.capture(S, wa(), hd(), NOW + 7200); assert.equal(S[1].consensus, 0.3); assert.notEqual(S[1].at.consensus, S[1].at.nowcast);
  // a row from the council's own schedule (no calendar yet) stands for the core figure: the same id the calendar row will have
  const sch = { days: [{ day: '2026-12-10', dow: 'Thursday', releases: [{ t: T, title: 'CPI', country: 'USD', type: 'CPI', src: 'schedule', exp: null, nowcast: { month: '2026-11', core: 0.21, head: 0.07 } }] }] };
  let E = G.capture([], sch, hd(), NOW); assert.equal(E.length, 1); assert.equal(E[0].id, 'CPI:2026-11:core'); assert.deepEqual([E[0].nowcast, E[0].priced, E[0].consensus], [0.21, 0.2, undefined]);
  E = G.capture(E, wa(), hd(), NOW + 60); assert.equal(E.find((x) => x.id === 'CPI:2026-11:core').consensus, 0.3);
  assert.match(G.planOf(sch.days, hd()).cards[0].before[0], /nowcast is \+0\.21%; a prediction market's most likely print is \+0\.2%/);
  // nothing is captured at or after the release time
  assert.equal(G.capture([], wa(), hd(), T).length, 0);
  // not resolved before the release, nor without a print
  assert.equal(G.resolve(R, hd({ cpi: 0.1, coreCpi: 0.24 }), T - 1)[1].actual, undefined);
  assert.equal(G.resolve(R, hd(), T + 60)[1].actual, undefined);
  R = G.resolve(R, hd({ cpi: 0.12, coreCpi: 0.24 }), T + 60);
  assert.equal(R[1].print, 0.2); assert.deepEqual(R[1].exact, { consensus: false, nowcast: true, priced: true });
  assert.deepEqual(R[1].err, { consensus: 0.06, nowcast: 0.03, priced: 0.04 }); assert.equal(R[1].closest, 'nowcast');
  assert.deepEqual(G.resolve(R, hd({ cpi: 0.5, coreCpi: 0.9 }), T + 9999), R, 'a later revision changes nothing');
  const sc = G.score(R);
  assert.equal(sc.resolved, 2); assert.match(sc.text, /too few to judge \(2 releases scored, 10 needed\)/); assert.match(sc.text, /not a tested edge/);
  const many = Array.from({ length: 10 }, (_, i) => ({ ...R[1], id: 'x' + i }));
  assert.match(G.score(many).text, /over 10 releases: the Cleveland Fed nowcast missed by 0\.03 points on average and had the exact print 10 of 10 times; the prediction market missed by 0\.04/);
});

test('the file is append-only and a broken file is never overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-')), f = path.join(dir, 'source-record.json');
  const a = G.updateFile(f, wa(), hd(), NOW); assert.equal(a.records.length, 2); assert.ok(a.written);
  assert.equal(G.updateFile(f, wa(), hd(), NOW + 60).written, false);
  fs.writeFileSync(f, '{ not json'); const b = G.updateFile(f, wa(), hd(), NOW); assert.ok(b.error); assert.equal(fs.readFileSync(f, 'utf8'), '{ not json');
});

test('wiring: the Week ahead carries the plan, the veteran keeps the record, the desk draws both as text', async () => {
  const W = await import('../council/week-ahead.mjs');
  const out = W.build({ now: Date.parse('2026-11-20T20:00:00Z') / 1000, cal: [], rf: null, fc: null, v: null });
  assert.ok(out.plan && Array.isArray(out.plan.cards) && out.plan.routine.length);
  const vet = fs.readFileSync(new URL('../council/veteran.mjs', import.meta.url), 'utf8');
  assert.match(vet, /sourceUpdate\(path\.join\(M, 'source-record\.json'\), WA, hd, now\)/); assert.match(vet, /WA\.sources = SR\.score/);
  assert.match(fs.readFileSync(new URL('../council/datahealth.mjs', import.meta.url), 'utf8'), /macro\/source-record\.json/);
  const page = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.match(page, /id="wa-plan"/); assert.match(page, /stepL\('At the print', c\.at\)/); assert.match(page, /A\.sources\.text/);
  const src = fs.readFileSync(new URL('../council/game-plan.mjs', import.meta.url), 'utf8');
  assert.deepEqual([...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]), ['./jsonio.mjs'], 'no council, mirror or order code is imported');
});
