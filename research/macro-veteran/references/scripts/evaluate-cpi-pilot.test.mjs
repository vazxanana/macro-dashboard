import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {parseLedger} from './forecast-evaluator.mjs';
import {evaluateCpiPilot} from './evaluate-cpi-pilot.mjs';

const load = async name => JSON.parse(await readFile(new URL('../' + name, import.meta.url), 'utf8'));
// Freeze the original issuance view: later genuine resolutions must not change these regression outcomes.
const currentLedger = parseLedger(await readFile(new URL('../cpi-pilot-forecast-ledger.jsonl', import.meta.url), 'utf8'));
const originalIssuance = currentLedger.find(record => record.record_type === 'issued' && record.forecast_id === 'us-core-cpi-sa-mom-2026-10-blend-pilot-v1');
assert(originalIssuance);
const initialLedger = [structuredClone(originalIssuance)];
const plan = await load('cpi-pilot-evaluation-plan-2026-10.json');
const protocol = await load('cpi-pilot-protocol-2026-11-08.json');
const evidence = await load('cpi-pilot-evidence-2026-11-08.json');
const originalAsOf = '2026-11-08T14:12:31.252Z';
const futureAsOf = '2026-11-10T13:31:00Z';
const clone = value => structuredClone(value);
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const run = (records = clone(initialLedger), candidatePlan = clone(plan), candidateProtocol = clone(protocol), options = {}) =>
  evaluateCpiPilot(records, candidatePlan, candidateProtocol, {asOf: originalAsOf, evidence: clone(evidence), ...options});

function syntheticFuture(outcome, publication = '2026-11-10T13:30:04Z') {
  const records = clone(initialLedger), first = records[0];
  records.push({record_id: 'SYNTHETIC-REHEARSAL-fake-resolution', forecast_id: first.forecast_id, record_type: 'resolved',
    recorded_at_utc: '2026-11-10T13:30:07Z', previous_record_id: first.record_id,
    resolution: {resolved_at_utc: '2026-11-10T13:30:06Z', outcome,
      source_snapshot: {publisher: first.forecast.resolution_rule.publisher, dataset_or_instrument: first.forecast.resolution_rule.dataset_or_instrument,
        direct_url: 'urn:meridianx:synthetic-rehearsal:NOT-A-REAL-RELEASE', observed_at_utc: '2026-10-31T23:59:59Z',
        retrieved_at_utc: '2026-11-10T13:30:05Z', published_at_utc: publication, outcome_unit: first.forecast.target.unit,
        vintage_id: 'SYNTHETIC-REHEARSAL-FAKE-VINTAGE', content_hash_sha256: null}, scores: [],
      review_note: 'SYNTHETIC FUTURE TEST ONLY. Fabricated outcome, publication and vintage; not a real CPI resolution.'}});
  return records;
}

test('frozen actual initial issuance remains unresolved with six intended cases versus one in the supplied plan', () => {
  const inputs = [clone(initialLedger), clone(plan), clone(protocol), clone(evidence)];
  const before = JSON.stringify(inputs);
  const report = evaluateCpiPilot(inputs[0], inputs[1], inputs[2], {asOf: originalAsOf, evidence: inputs[3]});
  assert.equal(report.cases[0].status, 'unresolved');
  assert.equal(report.cohort_accounting.intended_protocol_cases, 6);
  assert.equal(report.cohort_accounting.registered_plan_cases, 1);
  assert.equal(report.cohort_accounting.intended_cases_not_in_this_input_plan, 5);
  assert.equal(report.cohort_accounting.unresolved, 1);
  assert.equal(report.cohort_accounting.scored, 0);
  assert.equal(report.secondary_persistence.n, 0);
  assert.deepEqual(report.secondary_persistence.mean_squared_error, {status: 'unavailable', value: null});
  near(report.pilot_checks.case_checks[0].initial_issuance_lead_hours, 47.29132555555555);
  assert.equal(JSON.stringify(inputs), before, 'Evaluation must not mutate supplied objects');
});

for (const [outcome, modelLoss, primaryLoss, persistenceLoss] of [[0.2, 0.003025, 0.0001, 0.01], [0.3, 0.002025, 0.0081, 0]]) {
  test(`synthetic future outcome ${outcome} keeps primary and secondary comparisons explicit`, () => {
    const report = run(syntheticFuture(outcome), undefined, undefined, {asOf: futureAsOf});
    assert.equal(report.cases[0].status, 'scored');
    near(report.cases[0].scores[0].loss.value, modelLoss);
    near(report.cases[0].scores[0].baseline_loss.value, primaryLoss);
    assert.equal(report.secondary_persistence.n, 1);
    near(report.secondary_persistence.mean_squared_error.value, persistenceLoss);
    near(report.secondary_persistence.paired_model_mean_squared_error.value, modelLoss);
    assert.equal(report.secondary_persistence.cases[0].evidence_record_id, 'cpi-pilot-bls-september-core-2026-11-08');
    assert.equal(report.secondary_persistence.cases[0].source_id, 'bls-september-cpi-release');
    assert.equal(report.pilot_checks.source_truth_authenticated, false);
    assert.equal(report.pilot_checks.case_checks[0].first_release_vintage_authenticated, false);
  });
}

test('synthetic future unknown actual publication remains unverified without a score', () => {
  const report = run(syntheticFuture(0.2, null), undefined, undefined, {asOf: futureAsOf});
  assert.equal(report.cases[0].status, 'resolution_unverified');
  assert.equal(report.cohort_accounting.resolution_unverified, 1);
  assert.equal(report.aggregate_scores.length, 0);
  assert.equal(report.secondary_persistence.n, 0);
});

test('synthetic non-one-decimal and nonnumeric outcomes are rejected before scoring', () => {
  for (const outcome of [0.255, 0.30000000000000004, Infinity, '0.2', true]) {
    assert.throws(() => run(syntheticFuture(outcome), undefined, undefined, {asOf: futureAsOf}), /one-decimal published grid/);
  }
});

test('synthetic publication after frozen deadline is rejected even with valid reference-period endpoint', () => {
  const records = syntheticFuture(0.2, '2026-11-18T13:30:04Z'), last = records.at(-1);
  last.recorded_at_utc = '2026-11-18T13:30:07Z';
  last.resolution.resolved_at_utc = '2026-11-18T13:30:06Z';
  last.resolution.source_snapshot.retrieved_at_utc = '2026-11-18T13:30:05Z';
  assert.throws(() => run(records, undefined, undefined, {asOf: '2026-11-18T13:31:00Z'}), /publication after frozen pilot deadline/);
});

test('synthetic schedule exposing an initial issuance earlier than 72 hours is rejected', () => {
  const records = clone(initialLedger), candidate = clone(plan);
  candidate.cases[0].eligibility_cutoff_utc = '2026-11-10T15:00:00Z'; // Synthetic schedule is November11,15:00Z.
  records[0].forecast.target.deadline_utc = '2026-11-18T15:00:00Z';
  assert.throws(() => run(records, candidate), /initial issuance outside frozen 24–72 hour window/);
});

test('synthetic initial issuance closer than 24 hours is rejected', () => {
  const records = clone(initialLedger);
  records[0].forecast.issued_at_utc = records[0].recorded_at_utc = '2026-11-09T14:00:00Z';
  assert.throws(() => run(records), /initial issuance outside frozen 24–72 hour window/);
});

test('synthetic cutoff boundaries preserve strict T−24h exclusion and allow eligible 24h plus 1ms and 72h leads', () => {
  const atCutoff = clone(initialLedger);
  atCutoff[0].forecast.issued_at_utc = atCutoff[0].recorded_at_utc = '2026-11-09T13:30:00Z';
  const exact24 = run(atCutoff, undefined, undefined, {asOf: '2026-11-09T14:00:00Z'});
  assert.equal(exact24.pilot_checks.case_checks[0].initial_issuance_lead_hours, 24);
  assert.equal(exact24.cases[0].visible_versions, 1);
  assert.equal(exact24.cases[0].status, 'no_eligible_snapshot');
  assert.equal(exact24.cases[0].selected_forecast_record_id, null);
  assert.equal(exact24.cohort_accounting.status_counts.no_eligible_snapshot, 1);

  const beforeCutoff = clone(initialLedger);
  beforeCutoff[0].forecast.issued_at_utc = beforeCutoff[0].recorded_at_utc = '2026-11-09T13:29:59.999Z';
  const plusOneMillisecond = run(beforeCutoff, undefined, undefined, {asOf: '2026-11-09T14:00:00Z'});
  assert.equal(plusOneMillisecond.cases[0].status, 'unresolved');
  assert.equal(plusOneMillisecond.cases[0].selected_forecast_record_id, beforeCutoff[0].record_id);
  near(plusOneMillisecond.pilot_checks.case_checks[0].initial_issuance_lead_hours, 24 + 1 / 3_600_000);

  const exactly72Ledger = clone(initialLedger), exactly72Plan = clone(plan);
  const initialInstant = Date.parse(exactly72Ledger[0].forecast.issued_at_utc);
  // This synthetic schedule preserves the actual issuance's input chronology while placing it exactly at T−72h.
  exactly72Plan.cases[0].eligibility_cutoff_utc = new Date(initialInstant + 48 * 3_600_000).toISOString();
  exactly72Ledger[0].forecast.target.deadline_utc = new Date(initialInstant + (72 + 7 * 24) * 3_600_000).toISOString();
  const exact72 = run(exactly72Ledger, exactly72Plan);
  assert.equal(exact72.pilot_checks.case_checks[0].initial_issuance_lead_hours, 72);
  assert.equal(exact72.cases[0].status, 'unresolved');
  assert.equal(exact72.cases[0].selected_forecast_record_id, exactly72Ledger[0].record_id);
});

test('synthetic unknown evidence availability reconciles in companion status counts without scores', () => {
  const candidateEvidence = clone(evidence);
  candidateEvidence.find(record => record.record_id === 'cpi-pilot-bls-september-core-2026-11-08').time.available_at_utc = null;
  const report = run(undefined, undefined, undefined, {evidence: candidateEvidence});
  assert.equal(report.counts.registered, 1);
  assert.equal(report.cohort_accounting.registered_plan_cases, 1);
  assert.equal(report.cohort_accounting.status_counts.evidence_ineligible, 1);
  assert.equal(report.cases[0].status, 'evidence_ineligible');
  assert.equal(report.cohort_accounting.scored, 0);
  assert.equal(report.aggregate_scores.length, 0);
  assert.equal(report.secondary_persistence.n, 0);
});

test('synthetic deadline drift is rejected instead of altering the frozen resolution limit', () => {
  const records = clone(initialLedger);
  records[0].forecast.target.deadline_utc = '2026-11-17T13:30:01Z';
  assert.throws(() => run(records), /deadline differs from frozen schedule plus seven days/);
});

test('changed protocol ID, method, weights, window, selection or intended case set is rejected', () => {
  for (const change of [p => {p.protocol_id = 'different';}, p => {p.method_version = 'v2';},
    p => {p.model.cleveland_weight = 0.6;}, p => {p.issuance_window_hours_before_scheduled_release.maximum = 96;},
    p => {p.selection = 'latest_before_cutoff';}, p => {p.case_set.pop();}]) {
    const candidate = clone(protocol); change(candidate);
    assert.throws(() => run(undefined, undefined, candidate), /CPI pilot/);
  }
});

test('synthetic ambiguous secondary evidence remains unavailable without dropping a primary score', () => {
  const records = syntheticFuture(0.2), candidateEvidence = clone(evidence);
  const extra = clone(candidateEvidence.find(record => record.record_id === 'cpi-pilot-bls-september-core-2026-11-08'));
  extra.record_id = 'SYNTHETIC-REHEARSAL-second-bsl-matching-record';
  candidateEvidence.push(extra);
  records[0].forecast.evidence.supporting_record_ids.push(extra.record_id);
  const report = run(records, undefined, undefined, {asOf: futureAsOf, evidence: candidateEvidence});
  assert.equal(report.counts.scored, 1);
  assert.equal(report.secondary_persistence.n, 0);
  assert.equal(report.secondary_persistence.cases[0].unavailable_reason, 'ambiguous_matching_reported_bls_evidence');
});

test('synthetic missing secondary supporting reference cannot be replaced by an unreferenced record', () => {
  const records = syntheticFuture(0.3);
  records[0].forecast.evidence.supporting_record_ids = records[0].forecast.evidence.supporting_record_ids
    .filter(id => id !== 'cpi-pilot-bls-september-core-2026-11-08');
  const report = run(records, undefined, undefined, {asOf: futureAsOf});
  assert.equal(report.counts.scored, 1);
  assert.equal(report.secondary_persistence.n, 0);
  assert.equal(report.secondary_persistence.cases[0].unavailable_reason, 'matching_reported_bls_evidence_missing');
});

test('CLI writes a new report with hashes and refuses existing report or input paths', async () => {
  const workRoot = tmpdir();
  const directory = await mkdtemp(join(workRoot, 'cpi-pilot-wrapper-test-'));
  assert(resolve(directory).startsWith(resolve(workRoot) + sep), 'Scratch cleanup target must stay inside work');
  try {
    const files = {ledger: join(directory, 'initial-only-ledger.jsonl'), plan: join(directory, 'plan.json'),
      protocol: join(directory, 'protocol.json'), evidence: join(directory, 'evidence.json')};
    const ledgerRaw = JSON.stringify(initialLedger[0]) + '\n';
    await writeFile(files.ledger, ledgerRaw);
    await writeFile(files.plan, JSON.stringify(plan));
    await writeFile(files.protocol, JSON.stringify(protocol));
    await writeFile(files.evidence, JSON.stringify(evidence));
    const args = [fileURLToPath(new URL('./evaluate-cpi-pilot.mjs', import.meta.url)),
      ...Object.entries(files).flatMap(([key, value]) => [`--${key}`, value]), '--as-of', originalAsOf];
    const output = join(directory, 'new-report.json');
    let command = spawnSync(process.execPath, [...args, '--out', output], {encoding: 'utf8'});
    assert.equal(command.status, 0, command.stderr);
    const reportRaw = await readFile(output, 'utf8'), report = JSON.parse(reportRaw);
    assert.equal(report.cohort_accounting.unresolved, 1);
    assert.equal(report.input_sha256.ledger, createHash('sha256').update(ledgerRaw).digest('hex'));
    for (const target of [output, files.ledger]) {
      command = spawnSync(process.execPath, [...args, '--out', target], {encoding: 'utf8'});
      assert.notEqual(command.status, 0);
      assert.match(command.stderr, /Existing files are never overwritten/);
    }
    assert.equal(await readFile(output, 'utf8'), reportRaw);
    assert.equal(await readFile(files.ledger, 'utf8'), ledgerRaw);
  } finally { await rm(directory, {recursive: true, force: true}); }
});
