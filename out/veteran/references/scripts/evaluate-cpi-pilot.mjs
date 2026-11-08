import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {evaluateLedger, instant, parseLedger} from './forecast-evaluator.mjs';

export const PILOT_METHOD = 'meridianx-cpi-pilot-evaluator-1.0.0';
const PROTOCOL_ID = 'core-cpi-six-reference-month-pilot-v1';
const MODEL_METHOD = 'core-cpi-equal-blend-1.0.0';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MONTHS = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'];
const expectedCases = MONTHS.map(month => `us-core-cpi-sa-mom-${month}-blend-pilot-v1`);
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const encoded = value => Number.isFinite(value)
  ? {status: 'finite', value: Object.is(value, -0) ? 0 : value}
  : {status: 'arithmetic_overflow', value: null};
function mean(losses) {
  if (!losses.length) return {status: 'unavailable', value: null};
  if (losses.some(loss => loss.status !== 'finite')) return {status: 'arithmetic_overflow', value: null};
  let result = 0;
  losses.forEach((loss, index) => { result += (loss.value - result) / (index + 1); });
  return encoded(result);
}

function checkProtocol(protocol, plan) {
  fail(protocol?.protocol_id === PROTOCOL_ID, 'Unsupported CPI pilot protocol ID');
  fail(protocol.method_version === MODEL_METHOD && plan?.cohort?.method_version === MODEL_METHOD,
    'CPI pilot method version changed');
  fail(protocol.evaluation_mode === 'prospective_research' && plan.evaluation_mode === 'prospective_research',
    'CPI pilot requires its prospective research mode');
  fail(protocol.model?.cleveland_weight === 0.5 && protocol.model?.latest_bls_weight === 0.5,
    'CPI pilot fixed weights changed');
  fail(protocol.issuance_window_hours_before_scheduled_release?.minimum === 24 &&
    protocol.issuance_window_hours_before_scheduled_release?.maximum === 72, 'CPI pilot issuance window changed');
  fail(protocol.selection === 'initial' && plan.selection === 'initial', 'CPI pilot requires initial selection');
  fail(protocol.primary_loss === 'squared_error' && protocol.model?.point_functional === 'mean' &&
    plan.scoring?.distribution_kind === 'point' && plan.scoring?.point_functional === 'mean' &&
    canonical(plan.scoring?.metrics) === canonical(['squared_error']), 'CPI pilot scoring specification changed');
  fail(plan.evidence_policy === 'strict_known_availability' && plan.resolution_policy === 'require_publication_and_unit',
    'CPI pilot strict evidence or resolution policy changed');
  fail(protocol.target?.resolution_contract?.revision_policy === 'first_release' &&
    protocol.target?.resolution_contract?.specified_vintage === null, 'CPI pilot first-release contract changed');
  fail(canonical(protocol.target?.resolution_contract) === canonical(plan.cohort?.resolution_contract),
    'CPI pilot plan and protocol resolution contracts differ');
  fail(protocol.target?.variable === plan.cohort.variable && protocol.target?.population === plan.cohort.instrument_or_population &&
    protocol.target?.unit === plan.cohort.unit, 'CPI pilot target and plan cohort differ');
  fail(instant(protocol.created_at_utc, 'protocol creation') <= instant(plan.created_at_utc, 'plan creation'),
    'CPI pilot protocol postdates the case plan');
  fail(Array.isArray(protocol.case_set) && protocol.case_set.length === MONTHS.length &&
    protocol.case_set.every((item, index) => item.reference_month === MONTHS[index] && item.forecast_id === expectedCases[index]),
    'CPI pilot intended six-case set changed');
  fail(Array.isArray(plan.cases) && plan.cases.length > 0 && plan.cases.every(item => expectedCases.includes(item.forecast_id)),
    'Case plan contains a case outside the frozen CPI pilot');
}

function checkCaseRules(records, plan) {
  fail(Array.isArray(records), 'CPI pilot ledger must be a record array');
  return plan.cases.map(specification => {
    const schedule = instant(specification.eligibility_cutoff_utc, 'case cutoff') + DAY;
    const deadline = schedule + 7 * DAY;
    const history = records.filter(record => record.forecast_id === specification.forecast_id);
    const initial = history.find(record => record.record_type === 'issued');
    const check = {
      forecast_id: specification.forecast_id,
      schedule_derived_from_v1_cutoff_policy_utc: new Date(schedule).toISOString(),
      required_resolution_deadline_utc: new Date(deadline).toISOString(),
      initial_issuance_present: Boolean(initial),
      initial_issuance_lead_hours: null,
      resolution_records_checked: 0,
      publication_times_authenticated: false,
      first_release_vintage_authenticated: false
    };
    if (initial) {
      const lead = (schedule - instant(initial.forecast?.issued_at_utc, 'initial issuance')) / HOUR;
      fail(lead >= 24 && lead <= 72, `${specification.forecast_id}: initial issuance outside frozen 24–72 hour window`);
      fail(instant(initial.forecast?.target?.deadline_utc, 'target deadline') === deadline,
        `${specification.forecast_id}: target deadline differs from frozen schedule plus seven days`);
      check.initial_issuance_lead_hours = lead;
    }
    for (const record of history.filter(item => item.record_type === 'resolved')) {
      const resolution = record.resolution;
      const publication = resolution?.source_snapshot?.published_at_utc;
      if (publication != null) fail(instant(publication, 'actual publication') <= deadline,
        `${specification.forecast_id}: actual publication after frozen pilot deadline`);
      const outcome = resolution?.outcome;
      if (outcome !== null) fail(typeof outcome === 'number' && Number.isFinite(outcome) && Number(outcome.toFixed(1)) === outcome,
        `${specification.forecast_id}: outcome must be a finite number on the one-decimal published grid`);
      check.resolution_records_checked++;
    }
    return check;
  });
}

function secondaryComparison(report, records, evidence, plan) {
  const recordsById = new Map(records.map(record => [record.record_id, record]));
  const evidenceById = new Map(evidence.map(record => [record.record_id, record]));
  const cases = report.cases.map(result => {
    const item = {forecast_id: result.forecast_id, status: 'not_scored', unavailable_reason: `primary_case_${result.status}`,
      evidence_record_id: null, source_id: null, value: null, loss: null, paired_model_loss: null};
    if (result.status !== 'scored') return item;
    const forecast = recordsById.get(result.selected_forecast_record_id).forecast;
    const candidates = forecast.evidence.supporting_record_ids.map(id => evidenceById.get(id)).filter(record =>
      record?.record_type === 'reported_observation' && record.source?.publisher === plan.cohort.resolution_contract.publisher &&
      record.measurement?.unit === forecast.target.unit);
    item.status = 'unavailable';
    if (candidates.length !== 1) {
      item.unavailable_reason = candidates.length ? 'ambiguous_matching_reported_bls_evidence' : 'matching_reported_bls_evidence_missing';
      return item;
    }
    const candidate = candidates[0];
    item.evidence_record_id = candidate.record_id;
    item.source_id = candidate.source.source_id;
    item.value = candidate.measurement.value;
    if (typeof item.value !== 'number' || !Number.isFinite(item.value)) {
      item.unavailable_reason = 'secondary_value_not_finite_number';
      return item;
    }
    if (!candidate.time?.available_at_utc) {
      item.unavailable_reason = 'secondary_availability_unknown';
      return item;
    }
    if (instant(candidate.time.available_at_utc, 'secondary evidence availability') > instant(forecast.information_cutoff_utc)) {
      item.unavailable_reason = 'secondary_available_after_forecast_cutoff';
      return item;
    }
    item.status = 'scored';
    item.unavailable_reason = null;
    item.available_at_utc = candidate.time.available_at_utc;
    item.loss = encoded((item.value - result.outcome) ** 2);
    item.paired_model_loss = result.scores.find(score => score.metric === 'squared_error').loss;
    return item;
  });
  const paired = cases.filter(item => item.status === 'scored');
  return {
    comparator: 'Predeclared latest-archived-BLS-print persistence check; separate from primary Cleveland comparator',
    metric: 'squared_error', optimization_direction: 'lower_is_better', unit: `${plan.cohort.unit} squared`,
    n: paired.length, mean_squared_error: mean(paired.map(item => item.loss)),
    paired_model_mean_squared_error: mean(paired.map(item => item.paired_model_loss)),
    cases,
    limits: 'Candidate selection checks one supporting reported BLS record, its matching units and known availability. Correct source row, latest-archive status and reference month still need source review. Ambiguity or absence does not remove a primary score.'
  };
}

export function evaluateCpiPilot(records, plan, protocol, {asOf, evidence = []} = {}) {
  checkProtocol(protocol, plan);
  const checks = checkCaseRules(records, plan);
  const report = evaluateLedger(records, plan, {asOf, evidence});
  return {
    ...report,
    pilot_wrapper_method: PILOT_METHOD,
    pilot_checks: {
      protocol_id: PROTOCOL_ID,
      scope: 'Frozen v1 structured policy checks on all supplied registered-case records, including records after the evaluation as-of; the generic result retains its as-of view.',
      schedule_policy: 'Captured scheduled release is derived as case eligibility cutoff plus 24 hours; required deadline is that schedule plus seven days. This is the frozen v1 convention, not a live calendar lookup.',
      issuance_window_and_cutoff_policy: 'The arithmetic lead window includes 24 and 72 hours. The frozen generic selection additionally requires BOTH issuance and recording strictly before the eligibility cutoff (T−24h). An issuance exactly at T−24h remains visible but is not eligible; this wrapper does not make that cutoff inclusive.',
      case_checks: checks,
      source_truth_authenticated: false,
      limits: 'Full JSON Schema validation is separate. Supplied publication times, source rows, original first-release vintage and historical precommitment require independent evidence. No prose contract is parsed or authenticated.'
    },
    cohort_accounting: {
      intended_protocol_cases: protocol.case_set.length,
      registered_plan_cases: plan.cases.length,
      intended_cases_not_in_this_input_plan: protocol.case_set.length - plan.cases.length,
      status_counts: Object.fromEntries(Object.entries(report.counts).filter(([status]) => status !== 'registered')),
      visible_issued_cases: report.cases.filter(item => item.visible_versions > 0).length,
      scored: report.counts.scored || 0,
      unresolved: report.counts.unresolved || 0,
      resolution_unverified: report.counts.resolution_unverified || 0,
      not_issued_as_of: report.counts.not_issued_as_of || 0,
      note: 'Counts are local to the supplied plan. Other intended cases may have separate plans; absence here does not prove global absence. Keep the intended six-case denominator distinct from this plan and its issuance statuses.'
    },
    secondary_persistence: secondaryComparison(report, records, evidence, plan)
  };
}

const sha256 = raw => createHash('sha256').update(raw).digest('hex');
async function main() {
  const args = process.argv.slice(2), options = {};
  const usage = 'node evaluate-cpi-pilot.mjs --ledger FILE --plan FILE --protocol FILE [--evidence FILE] [--as-of ISO] [--out NEW_FILE]';
  for (let index = 0; index < args.length; index += 2) {
    fail(/^--(ledger|plan|protocol|evidence|as-of|out)$/.test(args[index]) && args[index + 1] && !options[args[index]], usage);
    options[args[index]] = args[index + 1];
  }
  fail(options['--ledger'] && options['--plan'] && options['--protocol'], usage);
  const [ledgerRaw, planRaw, protocolRaw, evidenceRaw] = await Promise.all([
    readFile(options['--ledger'], 'utf8'), readFile(options['--plan'], 'utf8'), readFile(options['--protocol'], 'utf8'),
    options['--evidence'] ? readFile(options['--evidence'], 'utf8') : Promise.resolve(null)
  ]);
  const report = evaluateCpiPilot(parseLedger(ledgerRaw), JSON.parse(planRaw), JSON.parse(protocolRaw), {
    asOf: options['--as-of'], evidence: evidenceRaw ? JSON.parse(evidenceRaw) : []
  });
  report.input_sha256 = {ledger: sha256(ledgerRaw), evaluation_plan: sha256(planRaw), protocol: sha256(protocolRaw), evidence: evidenceRaw ? sha256(evidenceRaw) : null};
  const output = JSON.stringify(report, null, 2) + '\n';
  if (options['--out']) {
    try { await writeFile(options['--out'], output, {encoding: 'utf8', flag: 'wx'}); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('CPI pilot output already exists; choose a new report path. Existing files are never overwritten.');
      throw error;
    }
  } else process.stdout.write(output);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  process.stderr.write(`CPI pilot evaluation failed: ${error.message}\n`);
  process.exitCode = 1;
});
