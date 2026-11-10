// node --test tests/academy-tabs.test.mjs — the Academy sections beside Train (assets/academy-tabs.js, window.MXAT).
// Offline. The pure helpers (the review schedule, the summaries, the formatters), the file's static promises, and the
// stored-data flows those sections rest on, run on the real API handler with an in-memory store, real candidates and the
// recorded candles (tests/fixtures/academy). The browser side is scripts/audit/academy.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../assets/academy-tabs.js');
const MXAC = require('../assets/academy-ui.js');
const MXR = require('../assets/academy-replay.js');
const MXA = require('../assets/academy-core.js');
const MXK = require('../assets/academy-risk.js');
const { handle, _t } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const { EDGES } = await import('../academy/edges.mjs');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const json = (f) => JSON.parse(src(f));
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString();

// ---- the review schedule -----------------------------------------------------------------------------------------------------
const T0 = Date.UTC(2026, 10, 2, 9);
const cor = (cand, at, o = {}) => ({ id: 'co_' + cand + at, candidateId: cand, at: iso(at), verdict: 'change', action: 'WAIT', was: { action: 'SELL' }, errorClass: 'premature-entry', reasons: ['session'], text: 'too early', ...o });
const att = (cand, at, action, mode = 'replay-same', t = 1714600000) => ({ id: 'at_' + cand + at, candidateId: cand, at: iso(at), mode, decision: { action, t } });
test('spaced repetition: a mistake is due 1, 3, 7, 21 days after its last review; a wrong answer starts again; four passes retire it', () => {
  assert.deepEqual(T.SCHEDULE_DAYS, [1, 3, 7, 21]);
  const q = (corrections, attempts, days) => T.reviewQueue({ corrections, attempts, now: T0 + days * DAY });
  const first = [att('a', T0 - 1000, 'SELL', 'train')];
  // never reviewed: due one day after the correction
  let r = q([cor('a', T0)], first, 0.5); assert.equal(r.due.length, 0); assert.equal(r.upcoming.length, 1); assert.equal(r.upcoming[0].dueAt, T0 + DAY); assert.equal(r.upcoming[0].passes, 0); assert.equal(r.upcoming[0].want, 'WAIT'); assert.equal(r.upcoming[0].t, 1714600000);
  r = q([cor('a', T0)], first, 1); assert.equal(r.due.length, 1); assert.equal(r.due[0].candidateId, 'a'); assert.equal(r.due[0].reviews, 0);
  // one pass: due three days after that review; two: seven; three: twenty-one; four: retired
  const pass = (n) => first.concat(Array.from({ length: n }, (_, i) => att('a', T0 + (i + 1) * 3600000, 'WAIT')));
  r = q([cor('a', T0)], pass(1), 2); assert.equal(r.due.length, 0); assert.equal(r.upcoming[0].dueAt, T0 + 3600000 + 3 * DAY); assert.equal(r.upcoming[0].passes, 1);
  r = q([cor('a', T0)], pass(2), 6); assert.equal(r.upcoming[0].dueAt, T0 + 2 * 3600000 + 7 * DAY);
  r = q([cor('a', T0)], pass(3), 30); assert.equal(r.due[0].dueAt, T0 + 3 * 3600000 + 21 * DAY); assert.equal(r.due[0].passes, 3);
  r = q([cor('a', T0)], pass(4), 400); assert.deepEqual([r.due.length, r.upcoming.length, r.retired], [0, 0, 1]);
  // a wrong answer in a review starts the schedule again from that review
  r = q([cor('a', T0)], pass(2).concat(att('a', T0 + 5 * DAY, 'SELL')), 5.5); assert.equal(r.upcoming[0].passes, 0); assert.equal(r.upcoming[0].dueAt, T0 + 6 * DAY); assert.equal(r.upcoming[0].reviews, 3);
  // a later sitting in the Train tab counts as a review whatever its mode; an attempt before the correction never does
  r = q([cor('a', T0)], first.concat(att('a', T0 + 1000, 'WAIT', 'train')), 1.5); assert.equal(r.upcoming[0].passes, 1);
  // the latest verdict on a setup decides: an approval after a correction takes it off the list
  assert.deepEqual(q([cor('a', T0), cor('a', T0 + 1000, { verdict: 'approve', action: 'WAIT' })], first, 9).due, []);
  // a rejected trade with no action asked for expects WAIT; a rejected WAIT expects anything but WAIT
  r = q([cor('a', T0, { verdict: 'reject', action: null })], first.concat(att('a', T0 + 1000, 'WAIT')), 0); assert.equal(r.upcoming[0].passes, 1); assert.equal(r.upcoming[0].want, 'WAIT');
  r = q([cor('b', T0, { verdict: 'reject', action: null, was: { action: 'WAIT' } })], [att('b', T0 - 1, 'WAIT', 'train'), att('b', T0 + 1000, 'BUY')], 0); assert.equal(r.upcoming[0].passes, 1); assert.equal(r.upcoming[0].want, null);
  // train pool only: a setup with a test or a blind attempt is never queued
  assert.deepEqual(q([cor('x', T0)], [att('x', T0 - 1, 'SELL', 'exam')], 9), { due: [], upcoming: [], retired: 0 });
  assert.deepEqual(q([cor('x', T0)], [att('x', T0 - 1, 'SELL', 'blind')], 9).due, []);
  // sorted by due date; the setup time comes from the list of setups when it is given; empty input is an empty queue
  r = T.reviewQueue({ corrections: [cor('late', T0 + DAY), cor('early', T0)], attempts: [], times: { early: 111, late: 222 }, now: T0 + 9 * DAY }); assert.deepEqual(r.due.map((x) => [x.candidateId, x.t]), [['early', 111], ['late', 222]]);
  assert.deepEqual(T.reviewQueue({}), { due: [], upcoming: [], retired: 0 }); assert.deepEqual(T.reviewQueue(null), { due: [], upcoming: [], retired: 0 });
  assert.equal(T.dueText({ due: true, dueAt: T0 }, T0 + 1000), 'due now'); assert.equal(T.dueText({ due: true, dueAt: T0 }, T0 + 3.2 * DAY), 'due 3 days ago'); assert.equal(T.dueText({ due: false, dueAt: T0 + 2.5 * DAY }, T0), 'due in 3 days (2026-11-04)'); assert.equal(T.dueText({ due: false, dueAt: T0 + 1000 }, T0), 'due in 1 day (2026-11-02)');
});

// ---- progress ------------------------------------------------------------------------------------------------------------------
test('agreement by week: the share of verdicts that were approvals, with n, and "too few" under 20', () => {
  assert.equal(T.MIN_N, 20); assert.equal(T.weekOf('2026-11-10T12:00:00Z'), '2026-W46'); assert.equal(T.weekOf('2021-01-03T00:00:00Z'), '2020-W53'); assert.equal(T.weekOf('nope'), null);
  assert.equal(T.weekOf('2026-11-10T12:00:00Z'), _t.weekOf('2026-11-10T12:00:00Z'), 'the same week name as the API');
  const rows = [cor('a', T0, { verdict: 'approve' }), cor('b', T0 + 1, { verdict: 'approve' }), cor('c', T0 + 2), cor('d', T0 + 8 * DAY, { verdict: 'reject' })], a = T.agreementByWeek(rows);
  assert.deepEqual([a.n, a.approve, a.rate, a.tooFew], [4, 2, 0.5, true]); assert.deepEqual(a.weeks.map((w) => [w.week, w.n, w.approve, w.rate, w.tooFew]), [['2026-W45', 3, 2, 0.667, true], ['2026-W46', 1, 0, 0, true]]);
  const many = T.agreementByWeek(Array.from({ length: 20 }, (_, i) => cor('m' + i, T0 + i, { verdict: i < 15 ? 'approve' : 'change' }))); assert.equal(many.tooFew, false); assert.equal(many.rate, 0.75);
  assert.deepEqual(T.agreementByWeek(null), { n: 0, approve: 0, rate: null, tooFew: true, weeks: [] });
  assert.equal(T.rateText(3, 4), '3 of 4 (too few to judge)'); assert.equal(T.rateText(15, 20), '15 of 20 (75 %)'); assert.equal(T.rateText(0, 0), 'none yet');
  assert.match(T.fewText(3, 'graded setup'), /^Too few to judge: 3 graded setups, and 20 is the least/);
});
test('recall and new setups are two records, never merged', () => {
  const p = { replaySame: { n: 3, graded: 2, pass: 2, fail: 0 }, exam: { n: 3, graded: 3, ungraded: 0, agree: 1, withLessons: { netR: 0 }, withoutLessons: { netR: 1.42 }, deltaNetR: -1.42 } }, r = T.recallVsNew(p);
  assert.deepEqual(r.recall, { n: 3, graded: 2, pass: 2, fail: 0, rate: 1, tooFew: true }); assert.deepEqual(r.fresh, { n: 3, graded: 3, ungraded: 0, agree: 1, netWith: 0, netWithout: 1.42, delta: -1.42, tooFew: true });
  assert.ok(!('total' in r) && !('n' in r), 'there is no combined number'); assert.equal(T.recallVsNew(null).recall.rate, null); assert.equal(T.recallVsNew({}).fresh.n, 0);
});
test('mistakes by class: counted, most frequent first, the latest examples with what was asked for', () => {
  const rows = [cor('a', T0), cor('b', T0 + 1000, { errorClass: 'late-entry', action: 'BUY', was: { action: 'WAIT' } }), cor('c', T0 + 2000), cor('d', T0 + 3000), cor('e', T0 + 4000, { verdict: 'approve' }), cor('f', T0 + 5000, { errorClass: null, verdict: 'reject', action: null })];
  const g = T.mistakeGroups(rows, null, 2);
  assert.deepEqual(g.map((x) => [x.cls, x.n, x.examples.map((e) => e.candidateId)]), [['premature-entry', 3, ['d', 'c']], ['late-entry', 1, ['b']], ['unclassified', 1, ['f']]]);
  assert.deepEqual([g[1].examples[0].was, g[1].examples[0].want], ['WAIT', 'BUY']); assert.equal(g[2].examples[0].want, 'WAIT', 'a rejected trade asks for WAIT');
  assert.equal(T.mistakeGroups(rows, { 'premature-entry': 40, 'poor-stop': 2 })[0].n, 40, 'the server\'s full count wins over the rows read'); assert.deepEqual(T.mistakeGroups(rows, { 'poor-stop': 2 }).find((x) => x.cls === 'poor-stop').examples, []);
  assert.deepEqual(T.mistakeGroups([], {}), []); assert.equal(T.CLASS_WORD('failure-to-wait'), 'failure to wait'); assert.equal(T.CLASS_WORD(null), 'unclassified');
});

// ---- lessons ---------------------------------------------------------------------------------------------------------------------
const L1 = { id: 'ls_1', root: 'ls_1', edge: 'gmp', version: 1, active: false, title: 'Wait in Asia', text: '', when: [{ f: 'session', op: 'eq', v: 'asia' }], then: { action: 'WAIT', adjust: {}, note: '' }, source: { correctionId: 'co_1', attemptId: 'at_1' }, createdAt: iso(T0), updatedAt: iso(T0 + 5000), supersededBy: 'ls_2', stats: { applied: 2, replayPass: 2, replayFail: 1, examN: 3, examAgree: 1, examNetWith: 0, examNetWithout: 1.42 } };
const L2 = { ...L1, id: 'ls_2', version: 2, active: true, title: 'Wait in Asia and London', when: [{ f: 'session', op: 'in', v: ['asia', 'london'] }], then: { action: 'SKIP', adjust: {}, note: 'not here' }, supersedes: 'ls_1', supersededBy: null, updatedAt: iso(T0 + 5000), stats: {} };
test('lessons: version chains, the diff between two versions in words, where a lesson came from, its two records', () => {
  const other = { ...L1, id: 'ls_9', root: 'ls_9', title: 'Other', updatedAt: iso(T0 + 9000), supersededBy: null };
  assert.deepEqual(T.lessonChains([L1, other, L2]).map((c) => c.map((l) => l.id)), [['ls_9'], ['ls_2', 'ls_1']], 'newest chain first, newest version first');
  assert.deepEqual(T.lessonDiff(L1, L2), [{ field: 'Title', from: 'Wait in Asia', to: 'Wait in Asia and London' }, { field: 'When', from: 'session = asia', to: 'session is one of asia, london' }, { field: 'Then', from: 'WAIT', to: 'REFUSE the setup (wait)' }, { field: 'Note', from: '', to: 'not here' }]);
  assert.deepEqual(T.lessonDiff(L1, JSON.parse(JSON.stringify(L1))), []); assert.equal(T.lessonDiff(L1, { ...L1, edge: '*' })[0].to, 'all edges');
  assert.equal(T.lessonOrigin(L1), 'mentor correction'); assert.equal(T.lessonOrigin({ source: { kind: 'research', studyId: 'cond:gtl:ltfAlign:neutral' } }), 'research study cond:gtl:ltfAlign:neutral'); assert.equal(T.lessonOrigin({ source: { sessionId: 'se_1' } }), 'mentor note in a session'); assert.equal(T.lessonOrigin({}), 'not recorded');
  const rec = T.lessonRecord(L1); assert.equal(rec.recallText, 'Recall on the same trade: passed 2, failed 1 (n = 3).'); assert.match(rec.freshText, /^New setups it matched: n = 3, same answer as without it on 1; net 0\.00R with lessons against \+1\.42R without\. Too few to judge\.$/);
  assert.equal(T.lessonRecord(L2).recallText, 'Recall on the same trade: not replayed yet.'); assert.equal(T.lessonRecord(L2).freshText, 'New setups: it has matched none in a test yet.');
});
test('research drafts: the evidence is given with n and t in both parts, and a draft\'s state comes from the stored lessons', () => {
  const R = json('academy/data/research.json'), p = R.proposedLessons[0]; assert.ok(p, 'the generated research offers a draft');
  const ev = T.evidenceText(p.evidence);
  assert.match(ev, /^Discovery \(\d{4}-\d\d-\d\d to \d{4}-\d\d-\d\d\): n \d+ at [+-]\d\.\d{3}R a trade against n \d+ at [+-]\d\.\d{3}R, t -?\d+\.\d\d\. Confirmation \(.+\): n \d+ at .+ against n \d+ at .+, t -?\d+\.\d\d\. Status: out-of-sample only, did not survive the correction for \d+ tests \(adjusted p 0\.\d\d\)\.$/);
  assert.equal(T.evidenceText(null), 'No evidence is attached to this draft.');
  assert.equal(T.draftStatus(p, []).state, 'new');
  const saved = { id: 'ls_r', version: 1, active: false, source: { kind: 'research', studyId: p.source.studyId }, createdAt: iso(T0), updatedAt: iso(T0) };
  assert.equal(T.draftStatus(p, [saved, L1]).state, 'saved'); assert.match(T.draftStatus(p, [saved]).text, /^Saved as an inactive lesson on 2026-11-02\./);
  assert.equal(T.draftStatus(p, [{ ...saved, deactivatedWhy: 'Dismissed research draft', deactivatedAt: iso(T0 + DAY) }]).state, 'dismissed'); assert.equal(T.draftStatus(p, [{ ...saved, active: true }]).state, 'on');
  assert.equal(T.draftStatus({ source: {} }, [saved]).state, 'new', 'a draft without a study never matches a stored lesson');
});

// ---- research, models, costs, audit -------------------------------------------------------------------------------------------------
test('studies filter by edge, kind and validation; the policy table has one row an edge and one for the book', () => {
  const R = json('academy/data/research.json'), E = json('academy/data/eval.json');
  assert.equal(T.filterStudies(R.studies, {}).length, R.studies.length); assert.ok(T.filterStudies(R.studies, { edge: 'gtl' }).every((s) => s.edge === 'gtl'));
  const book = T.filterStudies(R.studies, { edge: 'book' }); assert.ok(book.length >= 2 && book.every((s) => s.edge == null) && ['book', 'policy'].every((k) => book.some((s) => s.kind === k)), 'studies of the whole book, not of one edge');
  assert.equal(T.filterStudies(R.studies, { kind: 'baseline' }).length, R.studies.filter((s) => s.kind === 'baseline').length);
  assert.equal(T.filterStudies(R.studies, { validation: 'out-of-sample' }).length, R.counts.byValidation['out-of-sample']); assert.equal(T.filterStudies(R.studies, { edge: 'gtl', kind: 'condition', validation: 'out-of-sample' }).length, 1);
  const rows = T.policyRows(E); assert.deepEqual(rows.map((r) => r.edge), EDGES.map((e) => e.id).concat('all'));
  const rep = rows.find((r) => r.edge === 'replica'); assert.deepEqual([rep.every.n, rep.every.avg, rep.every.t, rep.take.n, rep.wait.n, rep.t, rep.verdict], [303, 0.428, 2.34, 153, 150, -1.21, 'no measurable difference']);
  assert.equal(rows[rows.length - 1].name, 'All seven'); assert.equal(rows[rows.length - 1].every.n, 1421); assert.deepEqual(T.policyRows(null), []);
});
test('a study table becomes sections a page can draw: records as rows, plain values as pairs', () => {
  const R = json('academy/data/research.json'), base = R.studies.find((s) => s.id === 'base:replica'), secs = T.tableSections(base.table);
  assert.equal(secs[0].title, 'Summary'); assert.ok(secs[0].pairs.some(([k, v]) => k === 'n' && v === '303'));
  const byYear = secs.find((s) => s.title === 'byYear'); assert.deepEqual(byYear.cols, ['year', 'n', 'avg', 'total', 't', 'win']); assert.equal(byYear.rows.length, 7); assert.equal(byYear.rows[1][4], 'n/a', 'a missing t is said, not left blank');
  assert.ok(secs.some((s) => s.title === 'split · first70' && s.pairs)); assert.ok(secs.every((s) => (s.pairs || s.rows).length > 0));
  for (const s of R.studies) assert.ok(T.tableSections(s.table).length > 0, `${s.id} has something to show`);
  assert.deepEqual(T.tableSections(null), []); assert.deepEqual(T.tableSections([1, 2]), [{ title: 'Values', pairs: [['values', '1, 2']] }]);
});
test('a notebook note needs its required fields, and a sample size before it may claim out-of-sample or validated', () => {
  const ok = { title: 't', hypothesis: 'h', dataset: 'd', method: 'm', validation: 'hypothesis' };
  assert.deepEqual(T.noteProblems(ok), []); assert.equal(T.noteProblems({}).length, 5); assert.match(T.noteProblems({ ...ok, validation: 'validated' }).join(' '), /never an edge without n/);
  assert.deepEqual(T.noteProblems({ ...ok, validation: 'out-of-sample', sampleSize: '120' }), []); assert.match(T.noteProblems({ ...ok, sampleSize: '1.5' }).join(' '), /whole number/); assert.match(T.noteProblems({ ...ok, validation: 'out-of-sample', sampleSize: 0 }).join(' '), /needs its sample size/);
});
test('the training report: every scorer with its walk-forward numbers, its verdict and its separate exam block; none promoted', () => {
  const rows = T.modelRows(json('ml/models/index.json')); assert.deepEqual(rows.map((r) => r.scope), ['replica', 'gtl', 'gmp', 'nq-open', 'pooled']);
  assert.ok(rows.every((r) => r.promoted === false && r.beats === false && r.status === 'rejected challenger' && /no improvement over taking every setup/.test(r.verdict)));
  const rep = rows[0]; assert.deepEqual([rep.rows, rep.n, rep.auc, rep.kept.n, rep.skipped.n, rep.t], [303, 182, 0.5615, 181, 1, null]); assert.deepEqual([rep.exam.n, rep.exam.auc], [50, 0.6007]); assert.match(rep.exam.what, /read once after the walk-forward verdict was fixed/);
  assert.deepEqual(T.modelRows(null), []); assert.deepEqual(T.modelRows({ models: [{ id: 'x' }] })[0].exam, null);
});
test('costs: off without a key says so with the money spent; the ledger is by day, newest first', () => {
  const off = T.costView({ enabled: false, reason: 'no language-model key configured', budgets: { dailyUsd: 0.5, monthlyUsd: 5, hardUsd: 25, stop: false }, today: {}, month: {}, total: { usd: 0 }, days: {} });
  assert.equal(off.head, 'Off. No key is set. Spent: $0.00'); assert.deepEqual(off.ledger, []); assert.equal(off.enabled, false);
  const on = T.costView({ enabled: true, reason: null, budgets: { dailyUsd: 0.5, monthlyUsd: 5, hardUsd: 25, stop: false }, today: { usd: 0.002, requests: 1 }, month: { usd: 0.012, requests: 3 }, total: { usd: 0.012, requests: 3, cacheHits: 1 }, days: { '2026-11-09': { usd: 0.01, requests: 2 }, '2026-11-10': { usd: 0.002, requests: 1 } } });
  assert.equal(on.head, 'On. Spent: $0.01.'); assert.deepEqual(on.ledger.map((d) => d.day), ['2026-11-10', '2026-11-09']); assert.deepEqual([on.today.usd, on.today.budget, on.month.requests, on.total.cacheHits], [0.002, 0.5, 3, 1]);
  assert.match(T.costView({ enabled: true, budgets: { stop: true }, total: { usd: 1 } }).head, /stopped by the kill switch/); assert.match(T.costView({ enabled: false, reason: 'the language-model endpoint must be an https address', total: {} }).head, /^Off: the language-model endpoint must be an https address\. Spent: \$0\.00$/);
  assert.equal(T.fmtUsd(0.0021), '$0.0021'); assert.equal(T.fmtUsd(12), '$12.00'); assert.equal(T.fmtUsd(null), '$0.00');
});
test('audit: the actions of a month, a filter by action, the month list', () => {
  const rows = [{ action: 'attempt', at: 'x' }, { action: 'correct' }, { action: 'attempt' }, {}];
  assert.deepEqual(T.auditActions(rows), ['attempt', 'correct']); assert.equal(T.filterAudit(rows, 'attempt').length, 2); assert.equal(T.filterAudit(rows, '').length, 4); assert.deepEqual(T.filterAudit(null, 'x'), []);
  assert.deepEqual(T.monthList(Date.UTC(2026, 0, 31), 3), ['2026-01', '2025-12', '2025-11']); assert.equal(T.monthList(Date.UTC(2026, 10, 10)).length, 12);
});

// ---- blind arena and sessions ----------------------------------------------------------------------------------------------------------
test('blind arena: answers are graded as the API grades them, "closer" needs both graded, the table carries n', () => {
  const out = { netR: 1.9, R: 2 };
  assert.equal(T.gradeLite({ action: 'WAIT' }, 'sell', out), 0); assert.equal(T.gradeLite({ action: 'SELL' }, 'sell', out), 1.9); assert.equal(T.gradeLite({ action: 'BUY' }, 'sell', out), null, 'the other side is not graded'); assert.equal(T.gradeLite({ action: 'SELL' }, 'sell', null), null);
  for (const [d, side] of [[{ action: 'WAIT' }, 'buy'], [{ action: 'BUY' }, 'buy'], [{ action: 'SELL' }, 'buy'], [null, 'buy']]) assert.equal(T.gradeLite(d, side, out), _t.gradeR(d, side, out), 'the same grade as the API');
  assert.equal(T.closer(0, 1.9), 'engine'); assert.equal(T.closer(1.9, -1), 'mentor'); assert.equal(T.closer(0, 0), 'tie'); assert.equal(T.closer(null, 1), null);
  const rows = [{ mentor: { action: 'WAIT' }, engine: { action: 'SELL' }, rMentor: 0, rEngine: 1.9 }, { mentor: { action: 'BUY' }, engine: { action: 'BUY' }, rMentor: -1.05, rEngine: -1.05 }, { mentor: { action: 'SELL' }, engine: { action: 'WAIT' }, rMentor: null, rEngine: 0 }, { mentor: { action: 'WAIT' }, engine: null, rMentor: 0, rEngine: null }];
  assert.deepEqual(T.blindTable(rows), { n: 4, withEngine: 3, agree: 1, graded: 2, mentorR: -1.05, engineR: 0.85, mentorCloser: 0, engineCloser: 1, ties: 1, tooFew: true });
  assert.equal(T.blindTable(Array.from({ length: 20 }, () => rows[0])).tooFew, false); assert.equal(T.blindTable(null).n, 0);
});
test('a trade answer needs its stop on the losing side and, where asked, a reason', () => {
  assert.deepEqual(T.answerProblems({}, true), ['Choose an answer.']); assert.deepEqual(T.answerProblems({ action: 'WAIT', text: 'x' }, true), []); assert.match(T.answerProblems({ action: 'WAIT' }, true).join(), /Say why/); assert.deepEqual(T.answerProblems({ action: 'approve' }, false), []);
  assert.match(T.answerProblems({ action: 'BUY', entry: 10 }, false).join(), /every trade has a stop/); assert.match(T.answerProblems({ action: 'BUY', entry: 10, stop: 11 }, false).join(), /stop must be below/); assert.match(T.answerProblems({ action: 'SELL', entry: 10, stop: 11, target: 12 }, false).join(), /target must be below/);
  assert.deepEqual(T.answerProblems({ action: 'SELL', entry: 10, stop: 11, target: 8, text: 'because' }, true), []);
});
test('a session summary counts decisions, agreement (with n), misses, right waits and lessons', () => {
  const ev = [{ kind: 'decision', action: 'SELL', verdict: 'approve' }, { kind: 'decision', action: 'WAIT', verdict: 'change' }, { kind: 'decision', action: 'WAIT', verdict: null }, { kind: 'missed' }, { kind: 'right-wait' }, { kind: 'right-wait' }, { kind: 'lesson' }, { kind: 'draft' }], s = T.sessionSummary(ev);
  assert.deepEqual([s.decisions, s.takes, s.waits, s.judged, s.agreed, s.disagreed, s.noVerdict, s.missed, s.rightWait, s.lessons, s.drafts, s.tooFew], [3, 1, 2, 2, 1, 1, 1, 1, 2, 1, 1, true]);
  assert.equal(s.text, '3 decisions (1 taken, 2 waited) · you agreed with 1 of 2 (too few to judge), 1 left without a verdict · 1 missed opportunity · 2 right waits · 1 lesson saved, 1 draft'); assert.ok(s.text.length < 400, 'fits the session summary field');
  assert.equal(T.sessionSummary([]).text, '0 decisions (0 taken, 0 waited) · you agreed with none yet · 0 missed opportunities · 0 right waits · 0 lessons saved');
});

// ---- the stored-data flows, on the real handler ------------------------------------------------------------------------------------------
const MAN = json('tests/fixtures/academy/manifest.json'), EDGE = EDGES.find((e) => e.id === MAN.edge);
const SERIES = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))]));
const TRAIN = json(`academy/data/cand-${MAN.edge}.json`).filter((c) => c.t >= MAN.from && c.t < MAN.to && c.pool !== 'exam' && !(c.rule && (c.rule.clockShift || c.rule.pre2020))).sort((a, b) => a.t - b.t);
function mkApi() {
  const store = ST.memoryStore(), base = _t.fileData(new URL('..', import.meta.url).pathname); let clock = Date.UTC(2026, 10, 10, 12);
  const deps = { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, now: () => (clock += 1000), data: base };
  const call = async (method, payload) => { const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } }; await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, deps); return out; };
  const ok = async (method, payload) => { const r = await call(method, payload); assert.equal(r.code, 200, `${method} ${JSON.stringify(payload).slice(0, 90)} → ${r.code} ${JSON.stringify(r.body)}`); return r.body; };
  return { get: (q) => ok('GET', q), post: (b) => ok('POST', b), raw: call, tick: (ms) => { clock += ms; }, now: () => clock };
}
const snapOf = (c, t = c.t) => MXR.snapshot({ edge: EDGE.id, market: EDGE.market, t, cand: c, series: MXAC.snapshotSeries(EDGE, SERIES), dataVersion: 'OANDA (recorded) XAU_USD' });
const decideOn = (snap, lessons = []) => MXA.decide(snap, { lessons, thesis: MXA.thesis.start(snap), history: [], risk: snap.cand ? MXK.check({ market: snap.cand.market, side: snap.cand.side, entry: snap.cand.entry, stop: snap.cand.stop, target: snap.cand.target, t: snap.t }, MXK.account(100000, { t: snap.t }), { riskPct: 0.25 }) : undefined, edgeDef: { version: EDGE.version, cost: EDGE.costPerRoundTrip } });
const attemptBody = (c, mode, d, s) => ({ action: 'attempt', attempt: { candidateId: c.id, edge: EDGE.id, mode, decision: d, sessionId: null, lessonsAvailable: [], snapshotHash: MXR.hash(s) }, features: MXA.features(s) });

test('the blind arena on real data: the engine answer is stored hidden, the mentor answers, both are shown, the outcome is read last', async () => {
  const api = mkApi(), c = TRAIN[0], s = snapOf(c), d = decideOn(s);
  const a = await api.post(attemptBody(c, 'blind', d, s)); assert.equal(a.attempt.decision, null, 'the stored answer does not come back');
  assert.equal((await api.raw('GET', { get: 'outcome', id: c.id, edge: EDGE.id })).code, 403, 'no outcome while the mentor has not answered');
  assert.deepEqual((await api.get({ get: 'blind', edge: EDGE.id })).blind, []);
  const mentor = { action: 'WAIT', entry: null, stop: null, target: null, text: 'Not here.' }; assert.deepEqual(T.answerProblems(mentor, true), []);
  const sub = await api.post({ action: 'blind.submit', blind: { edge: EDGE.id, candidateId: c.id, ...mentor } }); assert.equal(sub.engine.action, d.action); assert.equal(sub.blind.mentor.action, 'WAIT');
  const out = (await api.get({ get: 'outcome', id: c.id, edge: EDGE.id })).outcome, row = (await api.get({ get: 'blind', edge: EDGE.id })).blind[0];
  assert.equal(row.rMentor, T.gradeLite(sub.blind.mentor, c.side, out)); assert.equal(row.rEngine, T.gradeLite(sub.engine, c.side, out)); assert.equal(row.t, c.t); assert.equal(row.side, c.side);
  const tb = T.blindTable([row]); assert.equal(tb.n, 1); assert.equal(tb.graded, 1); assert.equal(tb.tooFew, true);
  // a blind-answered setup is never queued for spaced repetition, and it is train pool (an exam setup is refused as blind only when flagged; the page offers train setups only)
  const cors = (await api.get({ get: 'corrections', edge: EDGE.id })).corrections, atts = (await api.get({ get: 'attempts', edge: EDGE.id, limit: '2000' })).attempts;
  assert.deepEqual(T.reviewQueue({ corrections: cors, attempts: atts, now: api.now() }).due, []);
});
test('a mistake stored through the API comes due on the schedule, and a same-trade replay that gives the mentor\'s answer moves it on', async () => {
  const api = mkApi(); let c = null, s = null, d = null;
  for (const x of TRAIN) { const sx = snapOf(x), dx = decideOn(sx); if (dx.action !== 'WAIT') { c = x; s = sx; d = dx; break; } }
  assert.ok(c, 'the recorded window holds a setup the engine takes');
  const a1 = await api.post(attemptBody(c, 'train', d, s)), corr = MXAC.buildCorrection({ choice: 'WAIT', reasons: ['session'], text: 'Not in this session.' }, a1.attempt.id);
  await api.post({ action: 'correct', edge: EDGE.id, correction: { ...corr, errorClass: MXA.classifyError(d, corr, null) } });
  const read = async () => ({ corrections: (await api.get({ get: 'corrections', edge: EDGE.id })).corrections, attempts: (await api.get({ get: 'attempts', edge: EDGE.id, limit: '2000' })).attempts, times: { [c.id]: c.t } });
  let q = T.reviewQueue({ ...(await read()), now: api.now() }); assert.equal(q.due.length, 0); assert.equal(q.upcoming.length, 1); assert.equal(q.upcoming[0].want, 'WAIT'); assert.equal(q.upcoming[0].t, c.t); assert.equal(q.upcoming[0].passes, 0);
  q = T.reviewQueue({ ...(await read()), now: api.now() + 1.1 * DAY }); assert.equal(q.due.length, 1, 'due a day later');
  api.tick(1.1 * DAY); await api.post(attemptBody(c, 'replay-same', { ...d, action: 'WAIT' }, s));   // the review: the engine now waits
  q = T.reviewQueue({ ...(await read()), now: api.now() }); assert.equal(q.due.length, 0); assert.equal(q.upcoming[0].passes, 1); assert.ok(q.upcoming[0].dueAt - api.now() > 2.9 * DAY && q.upcoming[0].dueAt - api.now() <= 3 * DAY, 'three days after the review');
  const g = T.mistakeGroups((await read()).corrections, (await api.get({ get: 'mistakes', edge: EDGE.id })).byClass); assert.equal(g.length, 1); assert.equal(g[0].n, 1); assert.equal(g[0].examples[0].candidateId, c.id);
  const ag = T.agreementByWeek((await read()).corrections); assert.deepEqual([ag.n, ag.approve, ag.tooFew], [1, 0, true]);
  const rv = T.recallVsNew(await api.get({ get: 'progress', edge: EDGE.id })); assert.deepEqual([rv.recall.n, rv.recall.graded, rv.recall.pass], [1, 1, 1]); assert.equal(rv.fresh.n, 0);
});
test('a lesson revised and switched off through the API reads as a chain with its diff; a dismissed research draft is kept, switched off', async () => {
  const api = mkApi();
  const v1 = (await api.post({ action: 'lesson.save', lesson: { edge: EDGE.id, title: 'Wait in Asia', when: [{ f: 'session', op: 'eq', v: 'asia' }], then: { action: 'WAIT' }, source: {}, active: true } })).lesson;
  const v2 = (await api.post({ action: 'lesson.revise', id: v1.id, patch: { title: 'Wait in Asia and London', when: [{ f: 'session', op: 'in', v: ['asia', 'london'] }], then: { action: 'WAIT', note: 'two sessions' }, active: true } })).lesson;
  await api.post({ action: 'lesson.deactivate', id: v2.id, active: false, reason: 'Switched off by the mentor' });
  let all = (await api.get({ get: 'lessons', edge: EDGE.id })).lessons; const chain = T.lessonChains(all)[0];
  assert.deepEqual(chain.map((l) => [l.version, l.active]), [[2, false], [1, false]]); assert.deepEqual(T.lessonDiff(chain[1], chain[0]).map((x) => x.field), ['Title', 'When', 'Note']); assert.equal(chain[0].deactivatedWhy, 'Switched off by the mentor');
  assert.equal((await api.post({ action: 'lesson.deactivate', id: v2.id, active: true })).lesson.active, true, 'and back on');
  assert.equal((await api.raw('POST', { action: 'lesson.deactivate', id: v1.id, active: true })).code, 409, 'a replaced version stays off');
  const R = await api.get({ get: 'research', edge: 'gtl', kind: 'baseline' }), p = R.proposedLessons[0]; assert.ok(p && R.studies.length <= 2, 'the drafts come with a small read');
  const sv = (await api.post({ action: 'lesson.save', lesson: { edge: p.edge, title: p.title, text: p.text, when: p.when, then: p.then, source: { kind: 'research', studyId: p.source.studyId }, active: false } })).lesson; assert.equal(sv.active, false);
  all = (await api.get({ get: 'lessons', edge: 'gtl' })).lessons; assert.equal(T.draftStatus(p, all).state, 'saved');
  await api.post({ action: 'lesson.deactivate', id: sv.id, active: false, reason: 'Dismissed research draft' }); assert.equal(T.draftStatus(p, (await api.get({ get: 'lessons', edge: 'gtl' })).lessons).state, 'dismissed');
  assert.equal((await api.get({ get: 'lessons', edge: 'gtl', active: '1' })).lessons.length, 0, 'neither a saved nor a dismissed draft is in force');
});
test('a session note between setups: the engine\'s own read is stored beside the mentor\'s, and a draft from it is a valid, inactive lesson', async () => {
  const api = mkApi(), t = TRAIN[0].t - 3600, s = snapOf(null, t), d = decideOn(s), f = MXA.features(s), cm = MXA.classifyMiss(d, null, f);
  assert.equal(d.action, 'WAIT'); assert.ok(MXA.MISS_CLASSES.includes(cm.cls)); assert.ok(MXAC.snapshotClean(s));
  const bars = MXR.closedAt(SERIES['5m'], '5m', t), last = bars[bars.length - 1].close, a = { action: 'BUY', entry: last, stop: +(last - 5).toFixed(2), target: +(last + 10).toFixed(2), text: 'Swept the low.' }; assert.deepEqual(T.answerProblems(a, true), []);
  const se = (await api.post({ action: 'session.save', session: { edge: EDGE.id, title: 'x', kind: 'session', status: 'paused', t, summary: T.sessionSummary([]).text, state: { replay: MXR.session.save({ edge: EDGE.id, market: EDGE.market, tf: '5m', t, from: MAN.from, to: MAN.to, speed: 50, mode: 'train', savedAt: 'x' }), events: [], done: [] } } })).session;
  const m = (await api.post({ action: 'miss', miss: { edge: EDGE.id, t, kind: 'missed', ...a, sessionId: se.id, engine: { action: d.action, confidence: d.confidence }, cls: cm.cls, why: cm.why, snapshotHash: MXR.hash(s) } })).miss; assert.equal(m.kind, 'missed'); assert.equal(m.engine.action, 'WAIT');
  await api.post({ action: 'miss', miss: { edge: EDGE.id, t: t + 300, kind: 'right-wait', sessionId: se.id, engine: { action: 'WAIT', confidence: null } } });
  assert.deepEqual((await api.get({ get: 'misses', edge: EDGE.id, session: se.id })).misses.map((x) => x.kind), ['right-wait', 'missed']);
  const draft = MXA.lessons.fromCorrection(d, { verdict: 'change', ...a, reasons: [], sessionId: se.id }, f); assert.deepEqual(MXA.lessons.validate(draft), [], 'a note without a setup still drafts a valid lesson'); assert.equal(draft.then.action, 'TAKE');
  const sv = (await api.post({ action: 'lesson.save', lesson: { edge: draft.edge, title: draft.title, text: draft.text || '', when: draft.when, then: draft.then, source: { ...draft.source, sessionId: se.id }, active: false } })).lesson; assert.equal(sv.active, false); assert.equal(T.lessonOrigin(sv), 'mentor note in a session');
  const s2 = T.sessionSummary([{ kind: 'missed' }, { kind: 'right-wait' }, { kind: 'draft' }]); assert.deepEqual([s2.missed, s2.rightWait, s2.drafts], [1, 1, 1]);
  const acts = (await api.get({ get: 'audit' })).rows.map((r) => r.action); for (const x of ['session.save', 'miss', 'lesson.save']) assert.ok(acts.includes(x), x);
});

// ---- the file's static promises ----------------------------------------------------------------------------------------------------------
test('academy-tabs.js: every section is registered, talks only to the Academy API through the page\'s wrapper, and keeps the page rules', () => {
  const js = src('assets/academy-tabs.js'), css = src('assets/academy.css');
  assert.deepEqual([...js.matchAll(/MXAC\.registerTab\('([a-z]+)'/g)].map((m) => m[1]).sort(), ['audit', 'blind', 'costs', 'lessons', 'models', 'progress', 'research', 'session']);
  assert.ok(!/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/.test(js), 'no network call of its own and no browser storage');
  assert.ok(!/\b(prompt|confirm|alert)\(/.test(js), 'no native dialogs'); assert.ok(!/innerHTML|insertAdjacentHTML|document\.write/.test(js), 'stored text is never parsed as markup');
  assert.ok(!/ctrader|\/api\/bridge|council|mirror/i.test(js), 'no broker and no council code');
  assert.ok(!/probab/i.test(js.replace(/never (as|shown as) a probability|not probabilities|never as a probability/g, '')), 'nothing is called a probability');
  assert.match(js, /await api\.post\(K\.attemptBody\(c, e\.id, 'blind', d, B\.lessons, hash, f, null\)\); d = null;/, 'the engine\'s blind answer is stored and dropped');
  const sub = js.indexOf("action: 'blind.submit'"), out = js.indexOf("get: 'outcome'"); assert.ok(sub > 0 && out > sub, 'the blind outcome is asked for after the mentor\'s answer is stored');
  assert.equal((js.match(/get: 'outcome'/g) || []).length, 1, 'the only outcome read in these sections');
  assert.ok(!/pool: 'exam'|'exam'\)/.test(js), 'these sections never list or replay exam-pool setups');
  assert.ok(!/infinite|@keyframes/.test(css)); for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `font size ${m[1]}px`);
  for (const cls of ['ac-empty', 'tb-bar', 'tag', 'lsn', 'diff', 'two', 'well', 'bar', 'link', 'steps', 'ac-net']) assert.match(css, new RegExp(`\\.${cls}\\b`), cls);
  assert.match(src('academy.html'), /<p class="ac-net" id="ac-net" role="status" aria-live="polite" hidden><\/p>/);
});

test('the Desk has one way into the Academy, for the owner only', () => {
  const desk = src('market-structure.html'), links = [...desk.matchAll(/<a\b[^>]*href="\/academy"[^>]*>([^<]*)<\/a>/g)];
  assert.equal(links.length, 1, 'one link'); assert.match(links[0][0], /class="me-link adm own"/, 'in the account menu, hidden for guests (adm) and for viewers and reviewers (own)'); assert.equal(links[0][1], 'MeridianX Academy');
  assert.match(desk, /html\[data-mode="public"\] \.adm\{display:none!important\}/); assert.match(desk, /html\[data-role="reviewer"\] \.own\{display:none!important\}/); assert.match(desk, /html\[data-role="viewer"\] \.own,/);
  assert.ok(src('out/market-structure.html').includes('id="ms-me-academy"'), 'out/ carries it');
});
