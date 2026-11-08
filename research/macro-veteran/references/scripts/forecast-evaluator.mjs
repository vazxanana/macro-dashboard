import { readFile, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const METHOD = 'meridianx-forecast-evaluator-1.0.0';
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const finite = (x, label) => { fail(typeof x === 'number' && Number.isFinite(x), `${label}: finite number required`); return x; };
const canonical = x => JSON.stringify(x, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
export function instant(x, label = 'timestamp') {
  fail(typeof x === 'string', `${label}: RFC3339 timestamp required`);
  const m = x.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
  fail(m, `${label}: RFC3339 timestamp required`);
  const [,y,mo,d,h,mi,s] = m;
  fail(+mo>=1 && +mo<=12 && +d>=1 && +d<=new Date(Date.UTC(+y,+mo,0)).getUTCDate() && +h<24 && +mi<60 && +s<60, `${label}: invalid calendar value`);
  const n = Date.parse(x); fail(Number.isFinite(n), `${label}: invalid instant`); return n;
}
export function brier(p,y) { probability(p); binary(y); return (p-Number(y))**2; }
export function logLoss(p,y) { probability(p); binary(y); return y ? -Math.log(p) : -Math.log1p(-p); }
export function pinball(p,q,y) { probability(p,true); finite(q,'quantile'); finite(y,'outcome'); return y>=q ? p*(y-q) : (1-p)*(q-y); }
export function intervalScore(alpha,l,u,y) { probability(alpha,true); finite(l,'lower');finite(u,'upper');finite(y,'outcome');fail(l<=u,'crossed interval');return u-l+(y<l?2*(l-y)/alpha:0)+(y>u?2*(y-u)/alpha:0); }
function probability(p,open=false) {finite(p,'probability');fail(open?p>0&&p<1:p>=0&&p<=1,'probability outside permitted range');}
function binary(y){fail(typeof y==='boolean','binary outcome must be a boolean; no coercion');}
function checkedStrings(a,label){fail(Array.isArray(a)&&a.every(x=>typeof x==='string'&&x.length>0)&&new Set(a).size===a.length,`${label}: unique nonempty strings required`);}
function quantiles(q){fail(Array.isArray(q)&&q.length>=2,'at least two quantiles required');q.forEach((x,i)=>{probability(x.probability,true);finite(x.value,'quantile value');if(i)fail(q[i-1].probability<x.probability&&q[i-1].value<=x.value,'quantiles must have increasing unique probabilities and nondecreasing values');});}
function centralIndices(grid,alpha){const indices=[alpha/2,1-alpha/2].map(t=>{const hits=grid.map((q,i)=>Math.abs(q-t)<1e-12?i:-1).filter(i=>i>=0);fail(hits.length===1,'central interval endpoint missing or ambiguous');return hits[0];});fail(indices[0]<indices[1],'central interval endpoints must be distinct and ordered');return indices;}
const contractKeys=['publisher','dataset_or_instrument','field_or_price_convention','rule','revision_policy','specified_vintage','missing_or_holiday_policy'];
const contract = r => Object.fromEntries(contractKeys.map(k=>[k,r[k]??null]));
const encoded = (value, exactInfinity=false) => Number.isFinite(value) ? {status:'finite',value:Object.is(value,-0)?0:value} : {status:exactInfinity?'infinite_loss':'arithmetic_overflow',value:null};
function mean(losses){if(!losses.length)return {status:'unavailable',value:null};if(losses.some(s=>s.status==='arithmetic_overflow'))return {status:'arithmetic_overflow',value:null};if(losses.some(s=>s.status==='infinite_loss'))return {status:'infinite_loss',value:null};let m=0;losses.forEach((s,i)=>{m+=(s.value-m)/(i+1);});return encoded(m);}

function validatePlan(p){
  fail(p.schema_version==='1.0.0','unsupported evaluation plan version');
  fail(typeof p.plan_id==='string'&&p.plan_id.length,'plan ID required');instant(p.created_at_utc,'plan creation');
  fail(['synthetic_demonstration','retrospective_research','prospective_research'].includes(p.evaluation_mode),'invalid evaluation mode');
  fail(['initial','latest_before_cutoff'].includes(p.selection),'invalid snapshot selection');
  fail(['strict_known_availability','report_unknown'].includes(p.evidence_policy),'invalid evidence policy');
  fail(['require_publication_and_unit','report_unverified'].includes(p.resolution_policy),'invalid resolution policy');
  fail(p.baseline_policy==='selected_snapshot_numeric','unsupported baseline policy');
  fail(p.missing_outcome_policy==='remain_unresolved','missing outcomes must remain unresolved');
  const c=p.cohort;fail(c&&['variable','instrument_or_population','unit','horizon','method_version'].every(k=>typeof c[k]==='string'&&c[k].length),'complete cohort definition required');checkedStrings(c.required_tags,'cohort tags');
  fail(c.resolution_contract&&contractKeys.every(k=>Object.hasOwn(c.resolution_contract,k)),'cohort resolution contract required');
  fail(Array.isArray(p.cases)&&p.cases.length>0,'registered cases required');checkedStrings(p.cases.map(x=>x.forecast_id),'case IDs');p.cases.forEach(x=>{const cutoff=instant(x.eligibility_cutoff_utc);if(p.evaluation_mode!=='retrospective_research')fail(cutoff>instant(p.created_at_utc),'plan must precede each case cutoff');});
  const s=p.scoring;fail(s&&['binary_event','point','quantiles'].includes(s.distribution_kind),'unsupported forecast distribution');checkedStrings(s.metrics,'metrics');fail(s.metrics.length>0,'metrics required');
  const allowed={binary_event:['brier','log_score'],point:['absolute_error','squared_error'],quantiles:['pinball','interval_score']}[s.distribution_kind];fail(s.metrics.every(x=>allowed.includes(x)),'metric/distribution mismatch');
  fail(s.log_loss_policy==='exact','only exact, unclipped log loss supported');
  if(s.distribution_kind==='point'){fail(['mean','median'].includes(s.point_functional),'point functional must be mean or median');fail(s.metrics.every(x=>x===(s.point_functional==='mean'?'squared_error':'absolute_error')),'point functional and scoring loss must match');}
  if(s.distribution_kind==='quantiles'){
    fail(Array.isArray(s.quantile_probabilities)&&s.quantile_probabilities.length>=2,'fixed quantile grid required');s.quantile_probabilities.forEach((x,i)=>{probability(x,true);if(i)fail(x>s.quantile_probabilities[i-1],'quantile probabilities must increase');});
    fail(Array.isArray(s.interval_alphas)&&new Set(s.interval_alphas).size===s.interval_alphas.length,'unique interval alphas required');s.interval_alphas.forEach(a=>{probability(a,true);centralIndices(s.quantile_probabilities,a);});
    if(s.metrics.includes('interval_score'))fail(s.interval_alphas.length>0,'interval score needs declared intervals');
  }
  fail(Array.isArray(p.probability_bin_edges)&&p.probability_bin_edges[0]===0&&p.probability_bin_edges.at(-1)===1,'probability bins must span 0 to 1');p.probability_bin_edges.forEach((x,i)=>{probability(x);if(i)fail(x>p.probability_bin_edges[i-1],'probability bin edges must increase');});
  if(p.evaluation_mode==='prospective_research')fail(p.evidence_policy==='strict_known_availability'&&p.resolution_policy==='require_publication_and_unit','prospective mode needs strict evidence and resolution policies');
}
function forecastShape(f){
  fail(f&&typeof f==='object','forecast snapshot required');const issued=instant(f.issued_at_utc,'forecast issuance');fail(instant(f.information_cutoff_utc,'information cutoff')<=issued,'information cutoff after issuance');
  const t=f.target;fail(t&&['variable','instrument_or_population','unit','outcome_description'].every(k=>typeof t[k]==='string'&&t[k].length),'target definition incomplete');fail(instant(t.observation_start_utc)<=instant(t.deadline_utc),'target start after deadline');
  const rule=f.resolution_rule;fail(rule&&typeof rule.rule==='string'&&rule.rule.length,'resolution rule required');fail(['first_release','latest_as_of_deadline','final','specified_vintage','not_applicable'].includes(rule.revision_policy),'invalid vintage policy');if(rule.revision_policy==='specified_vintage')fail(typeof rule.specified_vintage==='string'&&rule.specified_vintage.trim().length,'specified vintage is missing');
  const d=f.distribution;fail(d&&['binary_event','point','quantiles'].includes(d.kind),'distribution missing');if(d.kind==='binary_event')probability(d.event_probability);else if(d.kind==='point')finite(d.point_estimate,'point estimate');else quantiles(d.quantiles);if(d.unit!==undefined)fail(d.unit===t.unit,'distribution/target unit mismatch');
  fail(f.evidence&&f.comparator,'evidence and comparator objects required');checkedStrings(f.evidence.supporting_record_ids,'supporting evidence');checkedStrings(f.evidence.counterevidence_record_ids,'counterevidence');
  return issued;
}
function validateChains(records){
  fail(Array.isArray(records),'ledger collection required');const ids=new Set(),heads=new Map(),groups=new Map();
  for(const r of records){
    fail(typeof r.record_id==='string'&&r.record_id.length&&!ids.has(r.record_id),'missing or duplicate record ID');ids.add(r.record_id);fail(typeof r.forecast_id==='string'&&r.forecast_id.length,'forecast ID required');
    const recorded=instant(r.recorded_at_utc,'recording time'),head=heads.get(r.forecast_id);fail(['issued','updated','resolved'].includes(r.record_type),'invalid ledger event type');
    if(!head)fail(r.record_type==='issued'&&r.previous_record_id===null,'chain must start with one issuance');else{fail(r.record_type!=='issued'&&r.previous_record_id===head.record_id,'orphan, fork or out-of-order predecessor');if(head.record_type==='resolved')fail(head.resolution.outcome===null&&r.record_type==='resolved','event follows terminal resolution');fail(recorded>=instant(head.recorded_at_utc),'recording times move backwards');}
    if(r.record_type!=='resolved'){
      const issued=forecastShape(r.forecast);fail(issued<=recorded,'forecast recorded before issuance');fail(!r.resolution,'forecast event cannot contain resolution');
      if(head){const first=groups.get(r.forecast_id)[0].forecast;for(const k of ['target','horizon','resolution_rule','method_version'])fail(canonical(r.forecast[k])===canonical(first[k]),`update changed immutable ${k}`);fail(r.forecast.distribution.kind===first.distribution.kind,'update changed forecast family');if(first.distribution.kind==='quantiles')fail(canonical(r.forecast.distribution.quantiles.map(q=>q.probability))===canonical(first.distribution.quantiles.map(q=>q.probability)),'update changed quantile grid');fail(issued>=instant(head.forecast.issued_at_utc),'update issuance moves backwards');fail(r.forecast.comparator.type===first.comparator.type&&r.forecast.comparator.description===first.comparator.description,'update changed comparator definition');}
    }else{
      fail(r.resolution&&!r.forecast,'resolution event must contain only resolution');const z=r.resolution,s=z.source_snapshot;fail(s,'resolution source snapshot required');const resolved=instant(z.resolved_at_utc),retrieved=instant(s.retrieved_at_utc),observed=instant(s.observed_at_utc);fail(observed<=retrieved&&retrieved<=resolved&&resolved<=recorded,'resolution/source chronology inconsistent');
      const original=groups.get(r.forecast_id)[0].forecast;fail(observed>=instant(original.target.observation_start_utc)&&observed<=instant(original.target.deadline_utc),'resolution observation outside target window');
      if(s.published_at_utc!=null){const published=instant(s.published_at_utc);fail(published>=observed&&published<=retrieved,'source publication outside observation/retrieval window');}fail(Array.isArray(z.scores),'stored scores array required');if(z.outcome===null)fail(z.scores.length===0,'missing outcome cannot have stored scores');
      fail(s.publisher===original.resolution_rule.publisher&&s.dataset_or_instrument===original.resolution_rule.dataset_or_instrument,'resolution source does not match frozen rule');
      if(original.resolution_rule.revision_policy!=='not_applicable')fail(typeof s.vintage_id==='string'&&s.vintage_id.trim().length,'resolution vintage identifier required');
      if(z.outcome!==null){const kind=groups.get(r.forecast_id)[0].forecast.distribution.kind;if(kind==='binary_event')binary(z.outcome);else finite(z.outcome,'resolved outcome');}
    }
    heads.set(r.forecast_id,r);if(!groups.has(r.forecast_id))groups.set(r.forecast_id,[]);groups.get(r.forecast_id).push(r);
  }
  return groups;
}
function baseline(f){const c=f.comparator;if(c.type==='none')return {value:null,reason:'no_comparator'};if(typeof c.probability_or_value!=='number'||!Number.isFinite(c.probability_or_value))return {value:null,reason:'missing_numeric_comparator'};if(!c.captured_at_utc)return {value:null,reason:'comparator_capture_unknown'};if(instant(c.captured_at_utc)>instant(f.information_cutoff_utc))return {value:null,reason:'comparator_after_information_cutoff'};if(f.distribution.kind==='quantiles')return {value:null,reason:'numeric_point_is_not_quantile_distribution'};if(f.distribution.kind==='binary_event'&&(c.probability_or_value<0||c.probability_or_value>1))return {value:null,reason:'comparator_not_probability'};return {value:c.probability_or_value,reason:null};}
function scores(f,y,s,b){
  const rows=[],d=f.distribution;const add=(metric,value,base,exact=false,extra={})=>rows.push({metric,loss:encoded(value,exact),baseline_loss:base===null?null:encoded(base,metric==='log_score'&&base===Infinity),optimization_direction:'lower_is_better',...extra});
  if(d.kind==='binary_event')for(const m of s.metrics){const fn=m==='brier'?brier:logLoss;const value=fn(d.event_probability,y);add(m,value,b.value===null?null:fn(b.value,y),m==='log_score'&&value===Infinity,{unit:m==='brier'?'squared probability error':'natural-log loss'});}
  if(d.kind==='point')for(const m of s.metrics){const fn=x=>m==='squared_error'?(x-y)**2:Math.abs(x-y);add(m,fn(d.point_estimate),b.value===null?null:fn(b.value),false,{unit:m==='squared_error'?`${f.target.unit} squared`:f.target.unit});}
  if(d.kind==='quantiles'){
    if(s.metrics.includes('pinball'))for(const q of d.quantiles)add(`pinball@${q.probability}`,pinball(q.probability,q.value,y),null,false,{unit:f.target.unit});
    if(s.metrics.includes('interval_score'))for(const alpha of s.interval_alphas){const [li,ui]=centralIndices(s.quantile_probabilities,alpha),lower=d.quantiles[li].value,upper=d.quantiles[ui].value;add(`interval_score@${alpha}`,intervalScore(alpha,lower,upper,y),null,false,{unit:f.target.unit,nominal_coverage:1-alpha,covered:lower<=y&&y<=upper});}
  }
  return rows;
}
export function evaluateLedger(records,plan,{asOf=new Date().toISOString(),evidence=[]}={}){
  validatePlan(plan);const asof=instant(asOf,'evaluation as-of');fail(instant(plan.created_at_utc)<=asof,'plan created after evaluation as-of');const groups=validateChains(records);fail(Array.isArray(evidence),'evidence collection must be an array');const ev=new Map(evidence.map(x=>[x.record_id,x]));fail(ev.size===evidence.length,'duplicate evidence IDs');const cases=[];
  for(const spec of plan.cases){
    const all=groups.get(spec.forecast_id)||[],visible=all.filter(r=>instant(r.recorded_at_utc)<=asof),versions=visible.filter(r=>r.record_type!=='resolved'),resolution=visible.filter(r=>r.record_type==='resolved').at(-1);const item={forecast_id:spec.forecast_id,status:'not_issued_as_of',selected_forecast_record_id:null,registered_cutoff_utc:spec.eligibility_cutoff_utc,visible_versions:versions.length,pending_resolution_attempts:visible.filter(r=>r.record_type==='resolved'&&r.resolution.outcome===null).length,stored_scores_used:false};cases.push(item);if(!versions.length)continue;
    const original=versions[0].forecast;fail(instant(spec.eligibility_cutoff_utc)<=instant(original.target.deadline_utc),'eligibility cutoff after target deadline');
    if(plan.evaluation_mode==='prospective_research')fail(instant(plan.created_at_utc)<=instant(original.issued_at_utc),'prospective plan postdates initial issuance');
    let cutoff=instant(spec.eligibility_cutoff_utc);const source=resolution?.resolution.source_snapshot;
    const publicationRecords=visible.filter(r=>r.record_type==='resolved'&&r.resolution.source_snapshot.published_at_utc!=null);
    for(const r of publicationRecords)cutoff=Math.min(cutoff,instant(r.resolution.source_snapshot.published_at_utc));
    item.cutoff_publication_record_ids=publicationRecords.filter(r=>instant(r.resolution.source_snapshot.published_at_utc)===cutoff).map(r=>r.record_id);
    item.effective_cutoff_utc=new Date(cutoff).toISOString();const eligible=versions.filter(r=>instant(r.forecast.issued_at_utc)<cutoff&&instant(r.recorded_at_utc)<cutoff);item.versions_excluded_by_cutoff=versions.length-eligible.length;
    const selected=plan.selection==='initial'?(eligible.includes(versions[0])?versions[0]:null):eligible.at(-1);if(!selected){item.status='no_eligible_snapshot';continue;}
    const f=selected.forecast;item.selected_forecast_record_id=selected.record_id;
    for(const k of ['variable','instrument_or_population','unit'])fail(f.target[k]===plan.cohort[k],`mixed cohort ${k}`);for(const k of ['horizon','method_version'])fail(f[k]===plan.cohort[k],`mixed cohort ${k}`);fail(plan.cohort.required_tags.every(x=>f.tags?.includes(x)),'required cohort tags missing');fail(f.distribution.kind===plan.scoring.distribution_kind,'mixed forecast distributions');if(f.distribution.kind==='quantiles')fail(canonical(f.distribution.quantiles.map(q=>q.probability))===canonical(plan.scoring.quantile_probabilities),'forecast does not match planned quantile grid');
    fail(canonical(contract(f.resolution_rule))===canonical(plan.cohort.resolution_contract),'mixed cohort resolution contract');
    if(plan.evaluation_mode==='synthetic_demonstration')fail(f.tags?.includes('synthetic'),'synthetic demonstration must use tagged synthetic forecasts');
    const refs=[...new Set([...f.evidence.supporting_record_ids,...f.evidence.counterevidence_record_ids])],problems=[];
    for(const id of refs){const e=ev.get(id);if(!e){problems.push({record_id:id,reason:'evidence_missing'});continue;}if(!e.time?.available_at_utc){problems.push({record_id:id,reason:'availability_unknown'});continue;}if(instant(e.time.available_at_utc)>instant(f.information_cutoff_utc))problems.push({record_id:id,reason:'evidence_available_after_cutoff'});}
    if(plan.evaluation_mode==='prospective_research'&&!refs.length)problems.push({record_id:null,reason:'no_evidence_records'});
    item.evidence_issues=problems;item.point_in_time_availability_supplied=problems.length===0&&refs.length>0;
    if(problems.some(x=>x.reason==='evidence_available_after_cutoff')||(plan.evidence_policy==='strict_known_availability'&&problems.length)){item.status='evidence_ineligible';continue;}
    if(!resolution||resolution.resolution.outcome===null){item.status='unresolved';continue;}
    const z=resolution.resolution;item.resolution_record_id=resolution.record_id;item.outcome=z.outcome;item.source_publication_supplied=source.published_at_utc!=null;item.outcome_unit_supplied=source.outcome_unit===f.target.unit;
    if(source.outcome_unit!=null)fail(source.outcome_unit===f.target.unit,'resolution unit mismatch');
    if(plan.resolution_policy==='require_publication_and_unit'&&(!item.source_publication_supplied||!item.outcome_unit_supplied)){item.status='resolution_unverified';continue;}
    if(f.resolution_rule.revision_policy==='specified_vintage')fail(source.vintage_id===f.resolution_rule.specified_vintage,'resolution does not match specified vintage');
    item.status='scored';item.selected_distribution=f.distribution;item.comparator=f.comparator;const b=baseline(f);item.baseline_unavailable_reason=b.reason;item.scores=scores(f,z.outcome,plan.scoring,b);item.stored_score_count_ignored=z.scores.length;
  }
  const scored=cases.filter(x=>x.status==='scored'),metrics=[...new Set(scored.flatMap(x=>x.scores.map(s=>s.metric)))];
  const aggregates=metrics.map(metric=>{const entries=scored.flatMap(x=>x.scores.filter(s=>s.metric===metric)),pairs=entries.filter(s=>s.baseline_loss!==null),model=mean(entries.map(s=>s.loss)),pairedModel=mean(pairs.map(s=>s.loss)),base=mean(pairs.map(s=>s.baseline_loss));const result={metric,unit:entries[0].unit,n:entries.length,model_mean:model,paired_n:pairs.length,paired_model_mean:pairedModel,paired_baseline_mean:base};if(metric==='brier')result.brier_skill=base.status==='finite'&&base.value>0&&pairedModel.status==='finite'?encoded(1-pairedModel.value/base.value):{status:base.value===0?'undefined_zero_baseline':'unavailable',value:null};if(metric.startsWith('interval_score@'))result.coverage={nominal:entries[0].nominal_coverage,observed:entries.filter(s=>s.covered).length/entries.length,n:entries.length};return result;});
  const reliability=[];if(plan.scoring.distribution_kind==='binary_event')for(let i=0;i<plan.probability_bin_edges.length-1;i++){const lo=plan.probability_bin_edges[i],hi=plan.probability_bin_edges[i+1],rows=scored.filter(x=>x.selected_distribution.event_probability>=lo&&(x.selected_distribution.event_probability<hi||(i===plan.probability_bin_edges.length-2&&x.selected_distribution.event_probability===hi)));reliability.push({lower_inclusive:lo,upper:hi,upper_inclusive:i===plan.probability_bin_edges.length-2,n:rows.length,mean_probability:rows.length?rows.reduce((s,x)=>s+x.selected_distribution.event_probability,0)/rows.length:null,event_rate:rows.length?rows.filter(x=>x.outcome).length/rows.length:null});}
  return {method_version:METHOD,plan_id:plan.plan_id,evaluation_mode:plan.evaluation_mode,as_of_utc:new Date(asof).toISOString(),selection:plan.selection,cohort:plan.cohort,validation_scope:'Standalone runtime checks; full JSON Schema validation must also be performed separately.',counts:{registered:cases.length,...Object.fromEntries([...new Set(cases.map(x=>x.status))].map(s=>[s,cases.filter(x=>x.status===s).length]))},cases,aggregate_scores:aggregates,reliability,limits:['Input timestamps, units, source truth, prose event resolution and plan precommitment require external review; current files/hashes do not prove historical append-only storage.','Resolution publication times are supplied assertions, not independently authenticated receipt logs.','Only the declared cohort and paired baseline cases are aggregated. Sparse quantiles are not converted into CRPS.','Synthetic or retrospective scores do not establish a prospective forecasting or trading track record.']};
}
export function parseLedger(raw){try{const x=JSON.parse(raw);return Array.isArray(x)?x:[x];}catch{const lines=raw.split(/\r?\n/).filter(x=>x.trim());return lines.map((s,i)=>{try{return JSON.parse(s);}catch{throw new Error(`Invalid JSONL record ${i+1}`);}});}}
const sha256 = raw => createHash('sha256').update(raw).digest('hex');
async function main(){
  const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i+=2){fail(/^--(ledger|plan|as-of|evidence|out)$/.test(args[i])&&args[i+1], 'Usage: node forecast-evaluator.mjs --ledger FILE --plan FILE [--as-of ISO] [--evidence FILE] [--out FILE]');fail(!opts[args[i]],'duplicate CLI option');opts[args[i]]=args[i+1];}
  fail(opts['--ledger']&&opts['--plan'],'ledger and evaluation plan are required');
  if(opts['--out']){const actual=async p=>realpath(p).catch(()=>resolve(p));const output=await actual(opts['--out']);for(const input of [opts['--ledger'],opts['--plan'],opts['--evidence']].filter(Boolean))fail(output!==await actual(input),'report output must not overwrite ledger, plan or evidence input');}
  const [ledgerRaw,planRaw,evidenceRaw]=await Promise.all([readFile(opts['--ledger'],'utf8'),readFile(opts['--plan'],'utf8'),opts['--evidence']?readFile(opts['--evidence'],'utf8'):Promise.resolve(null)]);
  const report=evaluateLedger(parseLedger(ledgerRaw),JSON.parse(planRaw),{asOf:opts['--as-of'],evidence:evidenceRaw?JSON.parse(evidenceRaw):[]});report.input_sha256={ledger:sha256(ledgerRaw),evaluation_plan:sha256(planRaw),evidence:evidenceRaw?sha256(evidenceRaw):null};const output=JSON.stringify(report,null,2)+'\n';if(opts['--out'])await writeFile(opts['--out'],output,'utf8');else process.stdout.write(output);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{process.stderr.write(`Forecast evaluation failed: ${e.message}\n`);process.exitCode=1;});
