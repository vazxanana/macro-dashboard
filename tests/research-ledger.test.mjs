// node --test tests/research-ledger.test.mjs — the research ledger (council/research-ledger.mjs): one row per committed study
// in research/edge, the verdict class and headline as the Edge lab reads them (research/edge/verdict.mjs), the digest lines, the ledger file the council loop
// writes, and the wiring of the week pane's Studies list and the Edge lab's #<topic> deep link. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EDGE_DIR, VERDICTS, listTopics, readStudy, studyRow, ledgerRows, studyVerdict, systemsOf, citedPRs, dateInText,
  buildLedger, landedIn, researchLines, main } from '../council/research-ledger.mjs';
import { studyVerdict as edgeVerdict } from '../research/edge/verdict.mjs';
import { buildDigest, readData } from '../council/digest.mjs';

const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const T = (s) => Date.parse(s) / 1000;

test('every committed study gets a row: a verdict from the set, a headline, its systems, the PRs it cites', () => {
  const topics = listTopics(EDGE_DIR), rows = ledgerRows(EDGE_DIR);
  const withFiles = topics.filter((t) => fs.existsSync(path.join(EDGE_DIR, t, 'result.json')) || fs.existsSync(path.join(EDGE_DIR, t, 'RESULT.md')));
  assert.ok(rows.length >= 40, `${rows.length} rows`);
  assert.deepEqual(rows.map((r) => r.topic), withFiles, 'one row per study folder with a result.json or RESULT.md, as research/edge/build.mjs publishes them');
  for (const r of rows) {
    assert.ok(VERDICTS[r.verdict], `${r.topic}: verdict ${r.verdict}`);
    assert.ok(typeof r.headline === 'string' && r.headline.length >= 8 && r.headline.length <= 221, `${r.topic}: headline "${r.headline}"`);
    assert.ok(!/\*\*|`/.test(r.headline), `${r.topic}: markdown stripped`);
    assert.ok(Array.isArray(r.systems) && r.systems.length, `${r.topic}: systems`);
    assert.ok(r.built === null || /^\d{4}-\d{2}-\d{2}$/.test(r.built), `${r.topic}: built ${r.built}`);
    assert.ok(Array.isArray(r.cites) && r.cites.every((n) => Number.isInteger(n)), `${r.topic}: cites`);
    assert.equal(r.link, `edge-lab.html#${encodeURIComponent(r.topic)}`);
    assert.equal(typeof r.name, 'string');
  }
  // the verdict class and headline are the Edge lab's own (research/edge/verdict.mjs studyVerdict), so the three places agree
  const by = Object.fromEntries(rows.map((r) => [r.topic, r]));
  for (const r of rows) {
    const e = edgeVerdict(readStudy(EDGE_DIR, r.topic).result, readStudy(EDGE_DIR, r.topic).md || '');
    if (e.verdict) assert.equal(r.verdict, e.verdict, `${r.topic}: the Edge lab's class`);
    if (e.headline) assert.equal(r.headline, e.headline.charAt(0).toUpperCase() + e.headline.slice(1), `${r.topic}: the Edge lab's headline`);
  }
  assert.equal(by['ict-sessions'].verdict, 'fail'); assert.match(by['ict-sessions'].headline, /^Nothing passes/);
  assert.equal(by['ict-oos-2008'].verdict, 'fail'); assert.equal(by['scalp-filters'].verdict, 'fail'); assert.equal(by['event-risk'].verdict, 'fail');
  assert.equal(by['ict-filters'].verdict, 'pass'); assert.match(by['ict-filters'].headline, /^PASS, but weak/);
  assert.equal(by['ict-index-longonly'].verdict, 'pass');
  assert.equal(by['nq-open-oos'].verdict, 'inc'); assert.match(by['nq-open-oos'].headline, /regime-dependent/i);
  assert.equal(by['crypto-trend-decay'].verdict, 'fail'); assert.match(by['crypto-trend-decay'].headline, /^Decayed/);
  assert.ok(by['decay-monitor'].headline.length > 10, 'a report without a Verdict line still gets its opening sentence');
  assert.deepEqual(by['ict-oos-2008'].systems, ['ICT desk']); assert.deepEqual(by['nq-open-exits'].systems, ['NQ open run']);
  assert.ok(by['decay-monitor'].cites.includes(508) && by['decay-monitor'].cites.includes(511), 'PRs cited in RESULT.md');
  assert.equal(by['ict-sessions'].built, '2026-11-07', 'built from the result (built / at / generated) or the report title date'); assert.equal(by['decay-monitor'].built, '2026-11-11');   // its baselines were rebuilt on the corrected candle clock on 10 Nov, and with overnight financing on 11 Nov
  assert.equal(by['ict-markets'].report, false); assert.ok(by['ict-markets'].headline.length > 5);
  const counts = rows.reduce((o, r) => ({ ...o, [r.verdict]: (o[r.verdict] || 0) + 1 }), {});
  assert.ok(counts.fail > counts.pass, 'the record so far: mostly null results');
});

test('studyVerdict fills in what the Edge lab leaves empty; systems, cited PRs, dates', () => {
  const v = studyVerdict({ topic: 'x', result: { verdict: 'FAIL - no filter passes', at: '2026-11-07T20:00:00Z' }, md: null });
  assert.deepEqual([v.verdict, v.headline, v.built], ['fail', 'FAIL - no filter passes', '2026-11-07']);
  assert.equal(studyVerdict({ topic: 'x', result: { verdict: { primary: 'FAIL', histdataConfirms: false } }, md: null }).verdict, 'fail');
  assert.equal(studyVerdict({ topic: 'x', result: null, md: '# T\n\n**Verdict: PASS, but weak.** More.\n' }).verdict, 'pass');
  const m = studyVerdict({ topic: 'x', result: {}, md: '# Monitor (8 Nov 2026)\n\nPaper only. It never changes a rule. The owner decides.\n' });
  assert.deepEqual([m.verdict, m.headline, m.built, m.title], ['inc', 'Paper only. It never changes a rule.', '2026-11-08', 'Monitor (8 Nov 2026)']);
  const n = studyVerdict({ topic: 'x', result: { system: 'ICT desk replay' }, md: null });
  assert.deepEqual([n.verdict, n.headline, n.built], ['inc', 'Numbers only (no RESULT.md): ICT desk replay', null]);
  assert.equal(studyVerdict({ topic: 'x', result: { paperOnly: true }, md: null }).headline, 'Numbers only, no RESULT.md yet');
  assert.equal(dateInText('Edge-decay monitor: how it does (8 Nov 2026)'), '2026-11-08'); assert.equal(dateInText('no date'), null);
  assert.deepEqual(systemsOf({ topic: 'ict-smile', result: { system: 'ICT desk A-setups vs the Dollar Smile' }, title: '' }), ['ICT desk', 'Macro desk']);
  assert.deepEqual(systemsOf({ topic: 'scalp-exits', result: { system: 'MERIDIAN Scalp on gold and forex' }, title: '' }), ['Meridian'], 'data markets are not systems');
  assert.deepEqual(citedPRs('see #512 and (#530), not #5 or https://x/pull/7, again #512'), [512, 530]);
  const r = studyRow(readStudy(EDGE_DIR, 'ict-sessions')); assert.equal(r.prereg, true); assert.equal(r.report, true); assert.equal(r.result, true);
  assert.equal(readStudy(EDGE_DIR, 'no-such-study'), null);
});

// ─── a fake ledger: three studies, one landed Friday evening, one Monday, one in October ───
const NOW = T('2026-11-06T21:20:00Z');   // Friday 21:20 UTC, the digest slot
const ROWS = [
  { topic: 'ict-sessions', name: 'ICT sessions', verdict: 'fail', headline: 'Nothing passes. All four hypotheses FAIL the pre-registered bar.', systems: ['ICT desk'], built: '2026-11-06', first: '2026-11-06T19:24:59.000Z', pr: 547 },
  { topic: 'ict-filters', name: 'ICT filters', verdict: 'pass', headline: 'PASS, but weak.', systems: ['ICT desk'], built: '2026-11-02', first: '2026-11-02T09:00:00.000Z', pr: 423 },
  { topic: 'costs', name: 'Costs', verdict: 'fail', headline: 'FAIL. No rule passes as a candidate.', systems: ['Meridian'], built: '2026-10-20', first: null, pr: null }];
const LEDGER = { at: new Date(NOW * 1000).toISOString(), count: 3, rows: ROWS };

test('landedIn and the digest lines: one line the day a study lands, a block in the Sunday preview', () => {
  assert.deepEqual(landedIn(LEDGER, NOW - 86400, NOW).map((r) => r.topic), ['ict-sessions']);
  assert.deepEqual(landedIn(LEDGER, NOW - 7 * 86400, NOW).map((r) => r.topic), ['ict-sessions', 'ict-filters']);
  assert.deepEqual(landedIn(LEDGER, T('2026-10-19T00:00:00Z'), T('2026-10-21T00:00:00Z')).map((r) => r.topic), ['costs'], 'no first-seen time: the built date counts');
  assert.deepEqual(researchLines(LEDGER, NOW, 'daily'), ['New study: ICT sessions — Nothing passes. All four hypotheses FAIL the pre-registered bar.']);
  assert.deepEqual(researchLines(LEDGER, NOW + 86400, 'daily'), [], 'the next day says nothing');
  assert.deepEqual(researchLines({ rows: ROWS.concat([{ ...ROWS[1], topic: 'x2', first: ROWS[0].first }]) }, NOW, 'daily')[0].slice(-10), ' (+1 more)');
  const p = researchLines(LEDGER, T('2026-11-08T21:20:00Z'), 'preview');
  assert.deepEqual(p, ['Research this week: 2 studies (1 pass, 1 fail):', '• ICT sessions: Nothing passes. All four hypotheses FAIL the pre-registered bar.', '• ICT filters: PASS, but weak.']);
  assert.deepEqual(researchLines(LEDGER, T('2026-12-06T21:20:00Z'), 'preview'), ['Research this week: no new study.']);
  assert.deepEqual(researchLines(null, NOW, 'preview'), [], 'no ledger file: the digest says nothing about research');
  assert.deepEqual(researchLines(null, NOW, 'daily'), []);
  // in the digest itself, before the time stamp; the preview may run to 18 lines for it
  const d = buildDigest({ ledger: LEDGER }, { now: NOW, kind: 'daily', prev: {}, sbRows: null });
  assert.equal(d.lines.at(-2), 'New study: ICT sessions — Nothing passes. All four hypotheses FAIL the pre-registered bar.');
  const w = buildDigest({ ledger: LEDGER }, { now: T('2026-11-08T21:20:00Z'), kind: 'preview', prev: {}, sbRows: null });
  assert.ok(w.msg.includes('Research this week: 2 studies (1 pass, 1 fail):\n• ICT sessions:'), w.msg); assert.ok(w.lines.length <= 18);
  const none = buildDigest({}, { now: NOW, kind: 'daily', prev: {}, sbRows: null });
  assert.ok(!/study/i.test(none.msg));
});

test('buildLedger + main: first-seen and PR kept across runs, one look-up per new study, written only on a change', async () => {
  const edge = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-')), data = fs.mkdtempSync(path.join(os.tmpdir(), 'cdata-'));
  const put = (t, files) => { fs.mkdirSync(path.join(edge, t), { recursive: true }); for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(edge, t, f), typeof c === 'string' ? c : JSON.stringify(c)); };
  try {
    put('alpha', { 'RESULT.md': '# Alpha (6 Nov 2026)\n\n**Verdict: FAIL. Nothing passes.** See #512.\n', 'result.json': { topic: 'alpha', system: 'ICT desk' }, 'preregistration.md': 'x' });
    put('beta', { 'result.json': { topic: 'beta', verdict: 'PASS - weak', at: '2026-11-05T10:00:00Z', system: 'NQ open run' } });
    put('scripts-only', { 'run.mjs': '// nothing' });
    fs.writeFileSync(path.join(edge, 'notes.txt'), 'ignored');
    const rows = ledgerRows(edge);
    assert.deepEqual(rows.map((r) => [r.topic, r.verdict, r.built, r.prereg]), [['alpha', 'fail', '2026-11-06', true], ['beta', 'pass', '2026-11-05', false]]);
    assert.equal(rows[0].name, 'Alpha');

    // first build: landed() asked for both; alpha answered, beta not (first = its built date)
    const asked = [], landed = async (t) => { asked.push(t); return t === 'alpha' ? { at: '2026-11-06T19:30:00.000Z', pr: 547 } : null; };
    const L1 = await buildLedger(rows, null, { now: NOW, landed });
    assert.deepEqual(asked, ['alpha', 'beta']);
    assert.deepEqual(L1.rows.map((r) => [r.topic, r.first, r.pr]), [['alpha', '2026-11-06T19:30:00.000Z', 547], ['beta', '2026-11-05T00:00:00.000Z', null]]);
    assert.deepEqual(L1.byVerdict, { pass: 1, inc: 0, fail: 1 }); assert.equal(L1.count, 2); assert.equal(L1.at, new Date(NOW * 1000).toISOString());
    // second build: nothing asked again (both resolved or looked up), first-seen kept even when the row changes
    asked.length = 0;
    const L2 = await buildLedger(rows.map((r) => ({ ...r, headline: r.headline + '!' })), L1, { now: NOW + 600, landed });
    assert.deepEqual(asked, []); assert.deepEqual(L2.rows.map((r) => r.first), L1.rows.map((r) => r.first));
    // a new study appears: only it is looked up; no answer anywhere → first = now
    put('gamma', { 'RESULT.md': '# Gamma\n\nPaper only.\n' });
    const L3 = await buildLedger(ledgerRows(edge), L2, { now: NOW + 1200, landed });
    assert.deepEqual(asked, ['gamma']); const g = L3.rows.find((r) => r.topic === 'gamma'); assert.equal(g.first, new Date((NOW + 1200) * 1000).toISOString()); assert.equal(g.verdict, 'inc');
    assert.equal(L3.rows[0].topic, 'gamma', 'newest first');

    // main: writes research/ledger.json, then reports unchanged; --dry writes nothing. No git answer in a temp dir, no API here.
    const env = { LEDGER_NO_API: '1' }, noFetch = async () => { throw new Error('no network in tests'); };
    let r = await main(data, { edgeDir: edge, now: NOW, env, fetchFn: noFetch });
    assert.equal(r.written, true); assert.equal(r.count, 3);
    const J = JSON.parse(fs.readFileSync(path.join(data, 'research', 'ledger.json'), 'utf8'));
    assert.equal(J.count, 3); assert.ok(J.rows.every((x) => x.first && x.topic && x.verdict && x.headline && x.link));
    r = await main(data, { edgeDir: edge, now: NOW + 300, env, fetchFn: noFetch }); assert.equal(r.unchanged, true);
    const before = fs.readFileSync(path.join(data, 'research', 'ledger.json'), 'utf8');
    r = await main(data, { edgeDir: edge, now: NOW + 600, env, fetchFn: noFetch, dry: true }); assert.equal(r.dry, true); assert.equal(fs.readFileSync(path.join(data, 'research', 'ledger.json'), 'utf8'), before);
    // the digest reads it
    const D = readData(data); assert.equal(D.ledger.count, 3);
    // the API path: one call per unresolved study, the merge subject's "(#N)" is the PR, failures are swallowed
    fs.rmSync(path.join(data, 'research'), { recursive: true });
    const calls = [], fetchFn = async (url) => { calls.push(url); return { ok: true, json: async () => [{ commit: { message: 'Study lands (#600)\n\nbody', committer: { date: '2026-11-06T18:00:00Z' } } }] }; };
    r = await main(data, { edgeDir: edge, now: NOW, env: { GH_TOKEN: 'x' }, fetchFn });
    assert.equal(calls.length, 3); assert.ok(calls.every((u) => /api\.github\.com\/repos\/vazxanana\/macro-dashboard\/commits\?path=research%2Fedge%2F/.test(u)));
    const J2 = JSON.parse(fs.readFileSync(path.join(data, 'research', 'ledger.json'), 'utf8'));
    assert.ok(J2.rows.every((x) => x.pr === 600 && x.first === '2026-11-06T18:00:00.000Z'));
    r = await main(data, { edgeDir: edge, now: NOW + 60, env: { GH_TOKEN: 'x' }, fetchFn: noFetch }); assert.equal(r.unchanged, true, 'resolved studies are not asked again');
  } finally { fs.rmSync(edge, { recursive: true, force: true }); fs.rmSync(data, { recursive: true, force: true }); }
});

test('wiring: the council loop and the push workflow write the ledger; the week pane lists the week\'s studies; the Edge lab opens #<topic>', () => {
  const yml = src('.github/workflows/council.yml');
  assert.match(yml, /node council\/research-ledger\.mjs data/); assert.match(yml, /sparse-checkout: \|\n(\s+\S+\n)*\s+research\/edge\n/);
  const rl = src('.github/workflows/research-ledger.yml');
  assert.match(rl, /- 'research\/edge\/\*\*'/); assert.match(rl, /node council\/research-ledger\.mjs data/); assert.match(rl, /git -C data add research\/ledger\.json/);

  const html = src('market-structure.html'), js = html.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/)[1];
  assert.ok(js.includes("get('research/ledger.json')"), 'the week pane fetches the ledger'); assert.ok(js.includes('ledger: X.ledger'));
  assert.ok(html.includes('id="ms-wk-studies"') && html.includes('class="card wk-studies"'));
  assert.ok(js.includes("href=\"edge-lab.html#' + encodeURIComponent(r.topic)"), 'each study links to its Edge lab row');
  assert.match(html, /#ms-cp-week \.wk-studies \{ order: 8; \}/, 'phone order');
  const W = {}; vm.runInNewContext(js, { window: W }); const MW = W.MS_WEEK;
  const wk = MW.weekOf(T('2026-11-06T12:00:00Z'));
  assert.deepEqual([...MW.studies(LEDGER, wk, wk + MW.WEEK)].map((r) => r.topic), ['ict-sessions', 'ict-filters'], 'this week\'s studies, newest first');
  assert.deepEqual([...MW.studies(LEDGER, wk - MW.WEEK, wk)].map((r) => r.topic), []);
  assert.deepEqual([...MW.studies({ rows: [{ topic: 'c', built: '2026-10-20' }] }, T('2026-10-19T00:00:00Z'), T('2026-10-26T00:00:00Z'))].map((r) => r.topic), ['c']);
  assert.deepEqual([...MW.studies(null, 0, 1e12)], []);

  const lab = src('edge-lab.html');
  assert.match(lab, /window\.addEventListener\('hashchange'/); assert.match(lab, /\.row\[data-topic="' \+ t \+ '"\]/); assert.match(lab, /scrollIntoView\(/);
  assert.match(lab, /\.row \{ scroll-margin-top: 72px; \}/); assert.match(lab, /\.row\.hit/); assert.match(lab, /deepLink\(\);\n\s*\}/, 'render ends with the deep link');
  assert.match(lab, /d\.open = true/, 'the candidate list opens');
});
