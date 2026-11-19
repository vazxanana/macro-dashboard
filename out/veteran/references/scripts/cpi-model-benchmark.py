"""Retrospective numeric benchmark; never creates historical forecast issuances.

Run inputs before evaluate. Standard-library exact rational scoring and a
protocol-specific deterministic bootstrap. Existing research remains unchanged.
"""
from pathlib import Path
from datetime import date,datetime,timezone
from decimal import Decimal,InvalidOperation
from fractions import Fraction
from collections import Counter
import argparse,hashlib,importlib.util,json,math,re,struct

ROOT=Path(__file__).resolve().parents[2]
PROTOCOL=ROOT/'outputs/cpi-model-benchmark-protocol-2022-2024.json'
INPUTS=ROOT/'outputs/cpi-model-benchmark-inputs-2022-2024.json'
RESULTS=ROOT/'outputs/cpi-model-benchmark-results-2022-2024.json'
EXPECTED='20af261af80ba9c6808248b6a1fc1b2b30592a81a2036c656a48c232a3550743'
METHODS=['C','P','R3','B50']
DOMAIN='gptmacro-cpi-model-benchmark-bootstrap-v0.1|seed=6771|series=core_mom|variant=cleveland_minus_persistence_squared_error|block={L}|counter={counter}'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def path(s):return ROOT/Path(s.replace('\\','/'))
def save(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')
def fraction(s):
    if s is None or str(s).strip().upper() in {'','N/A','NA'}:return None
    try:v=Decimal(str(s).strip())
    except InvalidOperation:return None
    return Fraction(v) if v.is_finite() else None
def encoded(x):return None if x is None else {'exact_fraction':str(x),'numeric':float(x)}
def decoded(x):return None if x is None else Fraction(x['exact_fraction'])
def lag_month(target,k):
    y,m=map(int,target.split('-'));n=y*12+(m-1)-k;return f'{n//12:04d}-{n%12+1:02d}'
def round_tenth(x):
    q=abs(x)*10;rounded=(q+Fraction(1,2)).numerator//(q+Fraction(1,2)).denominator
    return Fraction(rounded if x>=0 else -rounded,10)
def mean(xs):return sum(xs,Fraction(0))/len(xs) if xs else None
def median(xs):
    if not xs:return None
    ys=sorted(xs);n=len(ys);return ys[n//2] if n%2 else (ys[n//2-1]+ys[n//2])/2

def prepare_inputs():
    assert sha(PROTOCOL)==EXPECTED,'Adopted protocol changed'
    protocol=read(PROTOCOL);sources=protocol['sources'];bound={}
    for key in ['actual_ledger','model_cohort','model_raw','seed_manifest']:
        f=path(sources[key]);assert sha(f)==sources[key+'_sha256'];bound[sources[key]]=sha(f)
    actual=read(path(sources['actual_ledger']));model=read(path(sources['model_cohort']));seed=read(path(sources['seed_manifest']));raw=read(path(sources['model_raw']))
    assert len(actual['records'])==len(model['records'])==36 and len(seed['records'])==3
    values={};source_records={};monthly_re=re.compile(r'-?(?:\d+)?\.\d')
    def add(target,release,fields,source):
        assert target not in values,'Duplicate/conflicting target requires explicit quarantine'
        assert all(monthly_re.fullmatch(v) for v in fields.values()),'BLS printed precision changed'
        values[target]={m:fraction(v) for m,v in fields.items()};source_records[target]={'release_date':release,**source}
    for row in actual['records']:
        f=path(row['source_file']);assert sha(f)==row['source_sha256'];bound[row['source_file']]=sha(f)
        add(row['reference_month'],row['release_date'],{m:row['first_print_fields'][m+'_mom_sa']['percent'] for m in ['core','headline']},{'source_file':row['source_file'],'source_sha256':row['source_sha256']})
    for row in seed['records']:
        capture=row['raw_capture'];f=path(capture['file']);assert sha(f)==capture['sha256'];bound[capture['file'].replace('\\','/')]=sha(f)
        add(row['target_reference_month'],row['release_date'],{m:row[m+'_monthly_sa_percent'] for m in ['core','headline']},{'source_file':capture['file'].replace('\\','/'),'source_sha256':sha(f)})
    assert len(values)==39
    rows=[];bindings=0
    for target,release in [(e['reference_month'],e['release_date']) for e in sources['cohort_events']]:
        match=[r for r in model['records'] if r['target_month']==target];assert len(match)==1;r=match[0]
        assert r['release_date']==release and source_records[target]['release_date']==release
        assert r['last_pre_release_model_date']<release
        y,m=map(int,target.split('-'));charts=[c for c in raw if c['chart']['subcaption']==f'{y}-{m}'];assert len(charts)==1;c=charts[0]
        categories=[v for v in c['categories'][0]['category'] if not v.get('vline')];dates=[]
        for v in categories:
            mm,dd=map(int,v['label'].split('/'));yy=y+(1 if mm-m<-6 else -1 if mm-m>6 else 0)
            dates.append(date(yy,mm,dd).isoformat())
        assert dates==sorted(dates) and len(set(dates))==len(dates)
        observation={'event_id':'us-cpi-release-'+release,'reference_month':target,'release_date':release,'model_chart_date':r['last_pre_release_model_date'],'model_age_days':(date.fromisoformat(release)-date.fromisoformat(r['last_pre_release_model_date'])).days,'actual_first_publication_at_utc':None,'model_original_delivery_authenticated':False,'measure':{}}
        for measure,name in [('core','Core CPI Inflation'),('headline','CPI Inflation')]:
            series=[v for v in c['dataset'] if v['seriesname']==name];assert len(series)==1 and len(series[0]['data'])==len(dates)
            eligible=[(d,v['value']) for d,v in zip(dates,series[0]['data']) if d<release and fraction(v.get('value')) is not None]
            assert eligible and eligible[-1][0]==r['last_pre_release_model_date']
            C=fraction(eligible[-1][1]);assert C==fraction(r[measure+'_model_percent']);bindings+=1
            lag_targets=[lag_month(target,k) for k in [1,2,3]]
            lag_info=[{'reference_month':t,'release_date':source_records.get(t,{}).get('release_date'),'valid':t in values and values[t][measure] is not None,'known_before_model_date':t in source_records and source_records[t]['release_date']<observation['model_chart_date']} for t in lag_targets]
            reasons=[];A=values.get(target,{}).get(measure)
            if A is None:reasons.append('actual_unavailable')
            if C is None:reasons.append('model_unavailable')
            P=values[lag_targets[0]][measure] if lag_info[0]['valid'] and lag_info[0]['known_before_model_date'] else None
            if P is None:reasons.append('lag_first_print_unavailable_or_information_gate_failed')
            all_lags=all(q['valid'] and q['known_before_model_date'] for q in lag_info)
            R3=mean([values[t][measure] for t in lag_targets]) if all_lags else None
            B50=(C+P)/2 if C is not None and P is not None else None
            observation['measure'][measure]={'actual':encoded(A),'forecasts':{k:encoded(v) for k,v in zip(METHODS,[C,P,R3,B50])},'primary_pair_eligible':not reasons,'all4_common_eligible':not reasons and R3 is not None and B50 is not None,'primary_pair_reasons':reasons,'rolling3_reasons':[] if all_lags else ['rolling3_incomplete'],'lag_sources':lag_info}
        rows.append(observation)
    assert len(rows)==36 and bindings==72
    return {'protocol_sha256':EXPECTED,'bound_input_hashes':bound,'BLS_actual_months':39,'model_field_matches_against_raw':bindings,'source_records':source_records,'records':rows}

def losses(predictions,actual):return {k:{'error':f-actual,'SE':(f-actual)**2,'AE':abs(f-actual)} for k,f in predictions.items() if f is not None}
def aggregate(loss_rows,method):
    valid=[r[method] for r in loss_rows if method in r]
    return {'count':len(valid),'MSE':encoded(mean([r['SE'] for r in valid])),'MAE':encoded(mean([r['AE'] for r in valid])),'mean_signed_error':encoded(mean([r['error'] for r in valid])),'median_absolute_error':encoded(median([r['AE'] for r in valid]))}
def summarize_differences(ds):return {'count':sum(d is not None for d in ds),'mean_paired_squared_error_difference':encoded(mean([d for d in ds if d is not None]))}
def quantile(xs,p):
    h=(len(xs)-1)*p;i=math.floor(h);j=math.ceil(h);w=h-i;return (1-w)*xs[i]+w*xs[j]
def bootstrap(slots,L=3):
    assert len(slots)==36 and L in (3,6) and all(x is None or (isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)) for x in slots)
    def stream():
        counter=0
        while True:
            for u in struct.unpack('>8I',hashlib.sha256(DOMAIN.format(L=L,counter=counter).encode('ascii')).digest()):
                if u<4294967292:yield u%36
            counter+=1
    starts=stream();stats=[];hist=Counter();first=[];trace=hashlib.sha256();integer=all(x is None or float(x).is_integer() for x in slots)
    for rep in range(10000):
        indices=[];draws=[]
        for _ in range(36//L):
            s=next(starts);draws.append(s);indices.extend((s+k)%36 for k in range(L))
        vals=[slots[i] for i in indices if slots[i] is not None];total=sum(vals);n=len(vals);hist[n]+=1
        if integer:trace.update(f'{int(total)}/{n}\n'.encode('ascii'))
        if n:stats.append(total/n)
        if rep==0:first=draws
    stats.sort();count=sum(x is not None for x in slots);reasons=[]
    if count<12:reasons.append('too_few_primary_pairs_for_ci')
    if len(stats)<9900:reasons.append('too_few_valid_bootstrap_replicates')
    return {'block_length':L,'replicates':10000,'primary_pairs':count,'valid_replicates':len(stats),'invalid_all_null_replicates':10000-len(stats),'ci_reportable':not reasons,'ci':[quantile(stats,.025),quantile(stats,.975)] if not reasons else None,'ci_suppression_reasons':reasons,'non_null_count_histogram':{str(k):v for k,v in sorted(hist.items())},'first_replicate_block_starts':first,'integer_sum_count_trace_sha256':trace.hexdigest() if integer else None}

def evaluate(inputs,input_sha256=None):
    result={'status':'retrospective current-archive numeric comparison; not a prospective forecast record','protocol_sha256':EXPECTED,'input_ledger_sha256':input_sha256,'created_at_utc':datetime.now(timezone.utc).isoformat(),'measures':{}}
    exact_core=[];ids=[]
    for measure in ['core','headline']:
        scored=[];pair_rows=[];common_rows=[];rounded_pair=[];rounded_common=[]
        for row in inputs['records']:
            d=row['measure'][measure];A=decoded(d['actual']);forecast={k:decoded(v) for k,v in d['forecasts'].items()}
            ls=losses(forecast,A) if A is not None else {};D=ls['C']['SE']-ls['P']['SE'] if d['primary_pair_eligible'] else None
            scored.append({'event_id':row['event_id'],'reference_month':row['reference_month'],'release_date':row['release_date'],'forecasts':d['forecasts'],'actual':d['actual'],'losses':{k:{name:encoded(v) for name,v in one.items()} for k,one in ls.items()},'paired_difference':encoded(D),'primary_pair_eligible':d['primary_pair_eligible'],'all4_common_eligible':d['all4_common_eligible'],'reasons':d['primary_pair_reasons']})
            if d['primary_pair_eligible']:pair_rows.append(ls)
            if d['all4_common_eligible']:common_rows.append(ls)
            if measure=='core':
                exact_core.append(D);ids.append(row['event_id'])
                rounded=losses({k:round_tenth(v) if v is not None else None for k,v in forecast.items()},A) if A is not None else {}
                if d['primary_pair_eligible']:rounded_pair.append(rounded)
                if d['all4_common_eligible']:rounded_common.append(rounded)
        pair_difference=[decoded(row['paired_difference']) for row in scored]
        stats={'intended':36,'primary_pair_count':len(pair_rows),'all4_common_count':len(common_rows),'paired_event_ids':[r['event_id'] for r in scored if r['primary_pair_eligible']],'all4_common_event_ids':[r['event_id'] for r in scored if r['all4_common_eligible']],'paired_methods':{k:aggregate(pair_rows,k) for k in ['C','P']},'paired_contrast':summarize_differences(pair_difference),'common4_methods':{k:aggregate(common_rows,k) for k in METHODS},'records':scored}
        if measure=='core':
            stats['rounding_sensitivity']={'pair_count':len(rounded_pair),'paired_methods':{k:aggregate(rounded_pair,k) for k in ['C','P']},'mean_paired_SE_difference':encoded(mean([r['C']['SE']-r['P']['SE'] for r in rounded_pair])),'all4_common_count':len(rounded_common),'common4_methods':{k:aggregate(rounded_common,k) for k in METHODS},'rule':'Exact nearest0.1, ties away from zero, after predictor construction; actual unchanged.'}
        result['measures'][measure]=stats
    result['primary_uncertainty']={'L3':bootstrap([None if d is None else float(d) for d in exact_core],3),'L6_sensitivity':bootstrap([None if d is None else float(d) for d in exact_core],6)}
    dates=[r['release_date'] for r in inputs['records']]
    result['influence']={'year_specific':{str(y):summarize_differences([d for d,t in zip(exact_core,dates) if t.startswith(str(y))]) for y in (2022,2023,2024)},'leave_one_year_out':{str(y):summarize_differences([d for d,t in zip(exact_core,dates) if not t.startswith(str(y))]) for y in (2022,2023,2024)},'leave_one_event_out':{ident:summarize_differences([d for j,d in enumerate(exact_core) if i!=j]) for i,ident in enumerate(ids)}}
    result['limits']=['Current maintained model history lacks independently authenticated original per-point delivery and immutability.','Cleveland numeric point output need not be the conditional mean of rounded BLS first-print truth.','First-print persistence is explicit; it does not incorporate later revisions to the prior month.','Retrospective36-event development comparison, not an untouched holdout or prospective track record.','No survey-consensus surprise, causal market response, fitted ensemble or trading profitability established.']
    return result

def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['inputs','evaluate']);args=ap.parse_args();prepared=prepare_inputs()
    if args.mode=='inputs':
        save(INPUTS,{'created_at_utc':datetime.now(timezone.utc).isoformat(),'status':'inputs/predictors only; no forecast errors computed','analysis_code_sha256':sha(Path(__file__)),**prepared})
        INPUTS.with_suffix('.sha256').write_text(sha(INPUTS)+'  '+INPUTS.name+'\n',encoding='ascii')
        print(json.dumps({'input_ledger':str(INPUTS),'sha256':sha(INPUTS),'actual_months':39,'model_field_matches':72,'pair_counts':{m:sum(r['measure'][m]['primary_pair_eligible'] for r in prepared['records']) for m in ['core','headline']},'common4_counts':{m:sum(r['measure'][m]['all4_common_eligible'] for r in prepared['records']) for m in ['core','headline']}},indent=2));return
    saved=read(INPUTS);assert sha(INPUTS)==INPUTS.with_suffix('.sha256').read_text().split()[0]
    assert saved['analysis_code_sha256']==sha(Path(__file__)) and all(saved[k]==v for k,v in prepared.items()),'Input audit changed; verify before scoring'
    results=evaluate(saved,sha(INPUTS));save(RESULTS,results)
    print(json.dumps({'file':str(RESULTS),'core_pair':results['measures']['core']['paired_contrast'],'core_MSE':{k:v['MSE'] for k,v in results['measures']['core']['paired_methods'].items()},'core_MAE':{k:v['MAE'] for k,v in results['measures']['core']['paired_methods'].items()},'primary_uncertainty':results['primary_uncertainty'],'headline_pair':results['measures']['headline']['paired_contrast']},indent=2))
if __name__=='__main__':main()
