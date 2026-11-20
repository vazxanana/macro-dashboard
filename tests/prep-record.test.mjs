// Nowcast against consensus, the forward record (council/prep-record.mjs, 20 Nov 2026): one capture per release before it prints,
// never rewritten; one resolution on the first print on file; in-line captures not judged; the score's words under and over 20;
// an unparsable file is kept; the wiring into the veteran's run and the Week ahead.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as PR from '../council/prep-record.mjs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const REL = T('2026-11-25T13:30:00Z'), NOW = T('2026-11-20T10:00:00Z');
const rel = (o = {}) => ({ type: 'PCE', title: 'Core PCE Price Index m/m', t: REL, exp: '0.2%', nowcast: { month: '2026-10', core: 0.27, head: 0.31 },
  prep: { core: true, nowcast: 0.27, consensus: 0.2, gap: 0.07, side: 'above' }, ...o });
const plan = (...rs) => ({ days: [{ day: '2026-11-25', releases: rs }] });
const HD = (actual) => ({ nowcast: { months: [{ month: '2026-10', now: { pce: 0.31, corePce: 0.27 }, actual }] } });
const done = (hit, i) => ({ id: 'CPI:x' + i + ':core', type: 'CPI', core: true, t: 1, side: 'above', consensus: 0.2, actual: 0.3, actualSide: hit ? 'above' : 'below', hit });

test('capture: one record the first time a prepared release is seen, with its id and the reading', () => {
  const L = PR.capture([], plan(rel(), rel({ title: 'PCE Price Index m/m', exp: '0.4%', prep: { core: false, nowcast: 0.31, consensus: 0.4, gap: -0.09, side: 'below' } })), NOW);
  assert.equal(L.length, 2);
  assert.deepEqual(L[0], { id: 'PCE:2026-10:core', type: 'PCE', core: true, month: '2026-10', title: 'Core PCE Price Index m/m', t: REL,
    capturedAt: '2026-11-20T10:00:00Z', nowcast: 0.27, consensus: 0.2, gap: 0.07, side: 'above' });
  assert.equal(L[1].id, 'PCE:2026-10:headline'); assert.equal(L[1].side, 'below');
  // the same build again: nothing added, nothing changed
  assert.deepEqual(PR.capture(L, plan(rel()), NOW + 4000), L);
  assert.equal(PR.IN_LINE, WA.IN_LINE);
});

test('capture: a later reading never rewrites the first; it goes to `last` only', () => {
  const L = PR.capture([], plan(rel()), NOW);
  const moved = rel({ prep: { core: true, nowcast: 0.18, consensus: 0.2, gap: -0.02, side: 'in line' } });
  const L2 = PR.capture(L, plan(moved), NOW + 86400);
  assert.equal(L2.length, 1);
  const { last, ...first } = L2[0];
  assert.deepEqual(first, L[0]);
  assert.deepEqual(last, { at: '2026-11-21T10:00:00Z', nowcast: 0.18, consensus: 0.2, gap: -0.02, side: 'in line' });
  assert.deepEqual(PR.capture(L2, plan(moved), NOW + 90000), L2);   // unchanged reading: no new stamp
  assert.deepEqual(L[0].last, undefined);   // the input list was not edited
});

test('capture: past releases, releases without prep, other types and yearly titles are not captured', () => {
  assert.equal(PR.capture([], plan(rel()), REL).length, 0);         // at the release time
  assert.equal(PR.capture([], plan(rel()), REL + 60).length, 0);    // after it
  assert.equal(PR.capture([], plan(rel({ prep: null })), NOW).length, 0);
  assert.equal(PR.capture([], plan(rel({ type: 'NFP' })), NOW).length, 0);
  assert.equal(PR.capture([], plan(rel({ title: 'Core PCE Price Index y/y' })), NOW).length, 0);
  assert.equal(PR.capture([], null, NOW).length, 0);
  // a record already there gets no `last` once its release time has passed
  const L = PR.capture([], plan(rel()), NOW);
  assert.deepEqual(PR.capture(L, plan(rel({ prep: { core: true, nowcast: 0.4, consensus: 0.2, gap: 0.2, side: 'above' } })), REL + 60), L);
});

test('resolve: the first print is attached once, compared as published to one decimal, and never rewritten', () => {
  const L = PR.capture([], plan(rel()), NOW);
  assert.deepEqual(PR.resolve(L, HD({}), REL + 3600), L);                    // no print yet
  assert.deepEqual(PR.resolve(L, HD({ corePce: 0.3 }), REL - 60), L);        // never before the release time
  assert.deepEqual(PR.resolve(L, HD({ pce: 0.3 }), REL + 3600), L);          // another series is not this one's print
  const R = PR.resolve(L, HD({ corePce: 0.26 }), REL + 3600);
  assert.equal(R[0].actual, 0.26); assert.equal(R[0].print, 0.3); assert.equal(R[0].actualSide, 'above'); assert.equal(R[0].hit, true);
  assert.equal(R[0].resolvedAt, '2026-11-25T14:30:00Z'); assert.equal(R[0].side, 'above'); assert.equal(R[0].capturedAt, L[0].capturedAt);
  assert.deepEqual(PR.resolve(R, HD({ corePce: 0.12 }), REL + 90000), R);    // a revision changes nothing
  assert.deepEqual(PR.capture(R, plan(rel()), NOW), R);                      // and capture leaves a resolved record alone
  // 0.24 publishes as 0.2 = the consensus: in line, so a capture that leaned above missed
  const M = PR.resolve(L, HD({ corePce: 0.24 }), REL + 3600)[0];
  assert.equal(M.actualSide, 'in line'); assert.equal(M.hit, null);   // a print on the consensus is not judged
  assert.equal(PR.resolve(L, HD({ corePce: 0.1 }), REL + 3600)[0].hit, false);
  // the judged side is the FIRST capture's, not `last`
  const L2 = PR.capture(L, plan(rel({ prep: { core: true, nowcast: 0.1, consensus: 0.2, gap: -0.1, side: 'below' } })), NOW + 86400);
  assert.equal(PR.resolve(L2, HD({ corePce: 0.3 }), REL + 3600)[0].hit, true);
});

test('an in-line capture is resolved but not judged', () => {
  const L = PR.capture([], plan(rel({ prep: { core: true, nowcast: 0.22, consensus: 0.2, gap: 0.02, side: 'in line' } })), NOW);
  const R = PR.resolve(L, HD({ corePce: 0.3 }), REL + 3600);
  assert.equal(R[0].hit, null); assert.equal(R[0].actualSide, 'above');
  const S = PR.score(R);
  assert.equal(S.captured, 1); assert.equal(S.resolved, 1); assert.equal(S.judged, 0); assert.equal(S.inLine, 1);
});

test('score: too few under 20 judged; from 20 the hit rate with a two-sided binomial p, never an edge', () => {
  const few = PR.score([...Array.from({ length: 12 }, (_, i) => done(i < 9, i)), PR.capture([], plan(rel()), NOW)[0]]);
  assert.equal(few.judged, 12); assert.equal(few.hits, 9); assert.equal(few.captured, 13); assert.equal(few.open, 1); assert.equal(few.rate, null); assert.equal(few.p, null);
  assert.equal(few.text, 'Nowcast against consensus: too few to judge (n 12); 13 captured, 12 resolved. A forward record, not a tested edge.');
  assert.match(PR.score([]).text, /too few to judge \(n 0\)/);
  assert.match(PR.score({ records: Array.from({ length: 19 }, (_, i) => done(true, i)) }).text, /too few to judge \(n 19\)/);
  const S = PR.score(Array.from({ length: 20 }, (_, i) => done(i < 15, i)));
  assert.equal(S.rate, 0.75); assert.equal(S.p, 0.041);   // 2 x P(X >= 15 | n 20, 0.5) = 0.0414
  assert.equal(S.text, 'Nowcast against consensus: the nowcast pointed the right way on 15 of 20 releases (75%), two-sided binomial p 0.041 against 50%; a forward record, not a tested edge.');
  assert.equal(PR.score(Array.from({ length: 20 }, (_, i) => done(i < 10, i))).p, 1);
  assert.ok(Math.abs(PR.binomP(0, 10) - 2 / 1024) < 1e-12);
  assert.ok(Math.abs(PR.binomP(5, 20) - PR.binomP(15, 20)) < 1e-12);
  for (const t of [few.text, S.text]) assert.doesNotMatch(t.replace('not a tested edge', ''), /edge|proven|buy|sell/i);
});

test('updateFile: writes only on change, appends, and never overwrites a file that does not parse', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prep-')), f = path.join(dir, 'prep-record.json');
  const none = PR.updateFile(f, plan(), null, NOW);
  assert.equal(none.written, false); assert.ok(!fs.existsSync(f));   // nothing to record: no file made
  const a = PR.updateFile(f, plan(rel()), HD({}), NOW);
  assert.equal(a.written, true); assert.equal(a.score.captured, 1);
  const J = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(J.v, 1); assert.equal(J.records.length, 1); assert.match(J.label, /not a tested edge/);
  const before = fs.statSync(f).mtimeMs;
  assert.equal(PR.updateFile(f, plan(rel()), HD({}), NOW + 4000).written, false);
  assert.equal(fs.statSync(f).mtimeMs, before);
  const c = PR.updateFile(f, plan(), HD({ corePce: 0.3 }), REL + 3600);   // the release left the plan: resolved from the file alone
  assert.equal(c.written, true); assert.equal(c.score.resolved, 1); assert.equal(c.score.hits, 1);
  assert.equal(JSON.parse(fs.readFileSync(f, 'utf8')).records[0].capturedAt, '2026-11-20T10:00:00Z');
  for (const bad of ['{ "v": 1, "records": [ {"id": "PCE:2026-10:co', '{"v":1}']) {
    fs.writeFileSync(f, bad);
    const e = PR.updateFile(f, plan(rel({ nowcast: { month: '2026-11' } })), HD({}), NOW);
    assert.ok(e.error && /left as it is/.test(e.error)); assert.equal(e.score, undefined);
    assert.equal(fs.readFileSync(f, 'utf8'), bad);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test('from a real Week ahead build: the prepared release is captured, a schedule-only one is not', () => {
  const cal = [{ title: 'Core PCE Price Index m/m', country: 'USD', at: REL, impact: 'High', forecast: '0.2%', previous: '0.3%' }];
  const hd = { nowcast: { months: [{ month: '2026-10', now: { cpi: 0.3, coreCpi: 0.25, pce: 0.31, corePce: 0.27 }, actual: null, asOf: '2026-11-20' }] } };
  const L = PR.capture([], WA.build({ now: NOW, cal, rf: null, fc: null, v: null, hd }), NOW);
  assert.equal(L.length, 1); assert.equal(L[0].id, 'PCE:2026-10:core'); assert.equal(L[0].side, 'above'); assert.equal(L[0].t, REL);
  assert.equal(PR.capture([], WA.build({ now: NOW, cal: [], rf: null, fc: null, v: null, hd }), NOW).length, 0);
});

test('wiring: the veteran runs it after the Week ahead, data health lists the file, the module trades nothing', () => {
  const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const vet = rd('council/veteran.mjs');
  assert.match(vet, /import \{ updateFile as prepUpdate \} from '\.\/prep-record\.mjs'/);
  const i = vet.indexOf('const WA = weekAhead('), j = vet.indexOf("prepUpdate(path.join(M, 'prep-record.json'), WA, hd, now)"), k = vet.indexOf("w('week-ahead.json', WA)");
  assert.ok(i > 0 && j > i && k > j, 'week ahead built, then the record, then the plan written');
  assert.match(vet, /WA\.prepRecord = PR\.score/);
  assert.match(rd('council/datahealth.mjs'), /file: 'macro\/prep-record\.json'/);
  const src = rd('council/prep-record.mjs');
  assert.deepEqual([...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]), ['./jsonio.mjs']);
  assert.doesNotMatch(src, /fetch\(|trades\.json|config\.json/);
  assert.match(rd('CLAUDE.md'), /## Nowcast against consensus: a forward record \(20 Nov 2026\)/);
});
