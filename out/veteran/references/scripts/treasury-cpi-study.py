"""Frozen retrospective Treasury CPI calendar study. Python standard library only.

Run coverage before evaluate. Coverage never calculates or displays differences.
Preserves missing weekdays, source hashes, fixed controls and all36 month slots.
"""
from pathlib import Path
from datetime import date,datetime,timedelta,timezone
from zoneinfo import ZoneInfo
from decimal import Decimal,InvalidOperation
from fractions import Fraction
from collections import Counter
import argparse,calendar,csv,hashlib,html,json,math,re,struct,sys
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[2]
RAW=ROOT/'work/raw/treasury-cpi-study-2022-2024'
PROTOCOL=ROOT/'outputs/treasury-cpi-study-protocol-2022-2024.json'
AMENDMENT=ROOT/'outputs/treasury-cpi-study-amendment-01-2026-11-09.json'
COVERAGE=ROOT/'outputs/treasury-cpi-coverage-2022-2024.json'
RESULTS=ROOT/'outputs/treasury-cpi-results-2022-2024.json'
NY=ZoneInfo('America/New_York')
EXPECTED_PROTOCOL='4bbed411c83a65253d5172badfced14a9c1a6c1e83f939ddaed0ee2f64644835'
EXPECTED_AMENDMENT='e327e9474a789760b3d728dc29a43c2380796b70d1ea250d42a8628dc7756ab2'
SERIES={'real10y':('real','TC_10YEAR','10 yr'),'nominal2y':('nominal','BC_2YEAR','2 yr')}

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,d):p.write_text(json.dumps(d,indent=2,ensure_ascii=False,allow_nan=False)+'\n',encoding='utf-8')
def plain(s):return ' '.join(html.unescape(re.sub(r'<[^>]+>',' ',s)).split())
def attrs(s):return dict(re.findall(r'([\w-]+)="([^"]*)"',s))
def value(s):
    if s is None or s.strip().upper() in {'','NA','N/A'}:return None
    try:v=Decimal(s.strip())
    except InvalidOperation:return None
    return v if v.is_finite() else None
def previous(d):
    p=d-timedelta(days=1)
    while p.weekday()>4:p-=timedelta(days=1)
    return p
def proxy(d):return datetime(d.year,d.month,d.day,15,30,tzinfo=NY)
def signature(d):
    p=previous(d);a=proxy(p);b=proxy(d)
    return [(d-p).days,int(a.utcoffset().total_seconds()/60),int(b.utcoffset().total_seconds()/60),int((b.astimezone(timezone.utc)-a.astimezone(timezone.utc)).total_seconds())]
def unique(rows,label):
    out={};identical=0;conflicts=set()
    for d,v in rows:
        if d in out:
            if out[d]==v:identical+=1
            else:conflicts.add(d);out[d]=None
        else:out[d]=v
    for d in conflicts:out[d]=None
    return out,{'identical_duplicates':identical,'conflicting_dates':sorted(str(d) for d in conflicts),'source':label}

def parse_xml(path,field,year):
    feed=ET.parse(path).getroot()
    assert feed.tag=='{http://www.w3.org/2005/Atom}feed','Expected official Atom XML feed'
    assert not any(el.tag.endswith('link') and el.attrib.get('rel')=='next' for el in feed.iter()),'Unfollowed pagination'
    rows=[]
    for entry in feed.findall('{http://www.w3.org/2005/Atom}entry'):
        props=[el for el in entry.iter() if el.tag.endswith('}properties')]
        assert len(props)==1
        fields={el.tag.rsplit('}',1)[-1]:el for el in props[0]}
        assert field in fields and 'NEW_DATE' in fields
        d=date.fromisoformat(fields['NEW_DATE'].text[:10]);assert d.year==year
        el=fields[field];null=any(k.endswith('}null') and v=='true' for k,v in el.attrib.items())
        rows.append((d,None if null else value(el.text)))
    assert rows,'Empty feed'
    return unique(rows,path.name)

def parse_html(path,header_label):
    s=path.read_text(encoding='utf-8');tables=re.findall(r'<table\b[^>]*>(.*?)</table>',s,re.S|re.I)
    candidates=[]
    for table in tables:
        headings=[(attrs(tag),plain(body)) for tag,body in re.findall(r'<th\b([^>]*)>(.*?)</th>',table,re.S|re.I)]
        selected=[a['id'] for a,text in headings if text.lower()==header_label and 'id' in a]
        dates=[a['id'] for a,text in headings if text.lower()=='date' and 'id' in a]
        if len(selected)==1 and len(dates)==1:candidates.append((table,selected[0],dates[0]))
    assert len(candidates)==1,('Missing/ambiguous semantic HTML table',path.name)
    table,target_id,date_id=candidates[0];rows=[]
    for row in re.findall(r'<tr\b[^>]*>(.*?)</tr>',table,re.I|re.S):
        cells=[(attrs(tag),plain(body)) for tag,body in re.findall(r'<td\b([^>]*)>(.*?)</td>',row,re.I|re.S)]
        dc=[text for a,text in cells if date_id in a.get('headers','').split()]
        vc=[text for a,text in cells if target_id in a.get('headers','').split()]
        if not cells:continue
        assert len(dc)==len(vc)==1,('Ambiguous semantic cells',path.name)
        d=datetime.strptime(dc[0],'%m/%d/%Y').date();rows.append((d,value(vc[0])))
    assert rows
    return unique(rows,path.name)

def parse_csv(path,column):
    rows=[]
    with path.open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);assert 'date' in reader.fieldnames and column in reader.fieldnames
        for row in reader:
            d=datetime.strptime(row['date'],'%m/%d/%Y').date()
            if d.year in (2022,2023):rows.append((d,value(row[column])))
    return unique(rows,path.name)

def ingest():
    assert sha(PROTOCOL)==EXPECTED_PROTOCOL and sha(AMENDMENT)==EXPECTED_AMENDMENT,'Frozen specification changed'
    p=json.loads(PROTOCOL.read_text(encoding='utf-8'));a=json.loads(AMENDMENT.read_text(encoding='utf-8'))
    assert p['status']=='frozen_before_outcome_computation' and a['status']=='adopted_before_outcome_computation'
    ledger=ROOT/p['cohort']['source_ledger'];assert sha(ledger)==p['cohort']['source_ledger_sha256']
    manifests=[RAW/'capture-1794183470759.json',RAW/'binding-capture-1794183633116.json']
    source_hashes={}
    for m in manifests:
        md=json.loads(m.read_text(encoding='utf-8'))
        for r in md['records']:
            path=ROOT/r['file'];assert r['http_status']==200 and sha(path)==r['sha256']
            source_hashes[r['file']]=r['sha256']
    all_values={};bindings=[]
    for sid,(label,field,column) in SERIES.items():
        values={};csv_values,csv_dups=parse_csv(RAW/f'{label}-2020-2023.csv',column)
        assert not csv_dups['conflicting_dates']
        for year in [2022,2023,2024]:
            xm,xd=parse_xml(RAW/f'{label}-{year}.xml',field,year)
            if year==2024:other,od=parse_html(RAW/f'{label}-2024.html',column)
            else:other={d:v for d,v in csv_values.items() if d.year==year};od=csv_dups
            assert not xd['conflicting_dates'] and not od['conflicting_dates'],'Unresolved conflicting source values'
            assert xm.keys()==other.keys(),(sid,year,'Date mask mismatch')
            assert all(xm[d]==other[d] for d in xm),(sid,year,'Official format disagreement')
            assert not (values.keys()&xm.keys());values.update(xm)
            bindings.append({'series':sid,'year':year,'xml_field':field,'crosscheck':'official2024HTML' if year==2024 else 'official2020-2023CSV','crosscheck_column':column,'entries':len(xm),'finite_values':sum(v is not None for v in xm.values()),'date_masks_match':True,'exact_Decimal_agreements':len(xm),'xml_duplicate_audit':xd,'format_duplicate_audit':od})
        all_values[sid]=values
    return p,all_values,bindings,source_hashes

def neighbors(valid,events):
    banned=set();unresolved=[]
    for d in events:
        before=[q for q in valid if q<d];after=[q for q in valid if q>d]
        banned.add(d)
        if not before or not after:unresolved.append(d.strftime('%Y-%m'))
        else:banned.update([max(before),min(after)])
    return banned,set(unresolved)

def memberships(values,event_dates,pseudo=False):
    valid=sorted(d for d,v in values.items() if v is not None);vset=set(valid)
    banned,bad_months=neighbors(valid,event_dates);rows=[]
    for actual in event_dates:
        d=previous(actual) if pseudo else actual;p=previous(d);sig=signature(d)
        controls=[];rejected=[]
        for day in range(1,calendar.monthrange(d.year,d.month)[1]+1):
            c=date(d.year,d.month,day)
            if c.weekday()!=d.weekday() or c==d:continue
            reasons=[]
            if c in banned:reasons.append('CPI_neighbor_band')
            if c.strftime('%Y-%m') in bad_months:reasons.append('neighbor_band_unresolved')
            if signature(c)!=sig:reasons.append('clock_or_gap_mismatch')
            if c not in vset or previous(c) not in vset:reasons.append('missing_expected_weekday_endpoint')
            if reasons:rejected.append({'date':str(c),'reasons':reasons})
            else:controls.append(str(c))
        reasons=[]
        if d not in vset or p not in vset:reasons.append('missing_expected_weekday_endpoint')
        if not controls:reasons.append('no_matched_control')
        if d.strftime('%Y-%m') in bad_months:reasons.append('neighbor_band_unresolved')
        rows.append({'actual_release_date':str(actual),'ending_date':str(d),'prior_date':str(p),'start_proxy_utc':proxy(p).astimezone(timezone.utc).isoformat(),'end_proxy_utc':proxy(d).astimezone(timezone.utc).isoformat(),'clock_signature':sig,'control_dates':controls,'rejected_candidates':rejected,'eligible':not reasons,'reasons':reasons,'early_posting_flag':str(actual)=='2024-05-15'})
    return rows

def coverage_payload(p,values,bindings,hashes):
    event_dates=[date.fromisoformat(r['release_date']) for r in p['cohort']['events']]
    assert len(event_dates)==36 and event_dates==sorted(event_dates)
    series={}
    for sid,vals in values.items():
        missing=[];day=date(2022,1,1)
        while day<=date(2024,12,31):
            if day.weekday()<5 and (day not in vals or vals[day] is None):missing.append(str(day))
            day+=timedelta(days=1)
        series[sid]={'source_dates':len(vals),'valid_dates':sum(v is not None for v in vals.values()),'missing_required_weekdays':missing,'availability_mask':[{'date':str(d),'valid':v is not None} for d,v in sorted(vals.items())],'event_membership':memberships(vals,event_dates),'placebo_membership':memberships(vals,event_dates,True)}
    return {'protocol_sha256':EXPECTED_PROTOCOL,'amendment_sha256':EXPECTED_AMENDMENT,'source_hashes':hashes,'field_bindings':bindings,'series':series}

def scores(values,rows):
    out=[]
    def change(s):
        d=date.fromisoformat(s);return Fraction((values[d]-values[previous(d)])*100)
    for row in rows:
        r={**row,'signed_event_bp':None,'absolute_event_bp':None,'mean_absolute_control_bp':None,'contrast_bp':None,'control_changes':[]}
        if row['eligible']:
            b=change(row['ending_date']);control=[(c,change(c)) for c in row['control_dates']]
            cm=sum(abs(v) for _,v in control)/len(control);contrast=abs(b)-cm
            r.update(signed_event_bp=float(b),absolute_event_bp=float(abs(b)),mean_absolute_control_bp=float(cm),contrast_bp=float(contrast),control_changes=[{'date':c,'signed_bp':float(v),'absolute_bp':float(abs(v))} for c,v in control])
        out.append(r)
    return out

def summary(rows):
    valid=[r for r in rows if r['contrast_bp'] is not None]
    if not valid:return {'intended_events':len(rows),'scored_events':0,'mean_contrast_bp':None}
    d=[r['contrast_bp'] for r in valid]
    return {'intended_events':len(rows),'scored_events':len(valid),'mean_contrast_bp':math.fsum(d)/len(d),'mean_event_absolute_bp':math.fsum(r['absolute_event_bp'] for r in valid)/len(valid),'mean_of_event_control_means_bp':math.fsum(r['mean_absolute_control_bp'] for r in valid)/len(valid),'median_contrast_bp':quantile(sorted(d),.5),'fraction_positive_contrasts':sum(v>0 for v in d)/len(d),'control_count_distribution':dict(sorted(Counter(len(r['control_dates']) for r in valid).items()))}

def quantile(x,p):
    h=(len(x)-1)*p;i=math.floor(h);j=math.ceil(h);a=h-i
    return (1-a)*x[i]+a*x[j]

def bootstrap(slots,L=3):
    assert len(slots)==36 and L in (3,6) and all(x is None or (isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)) for x in slots)
    def starts():
        counter=0
        while True:
            message=f'gptmacro-treasury-cpi-bootstrap-v0.1|seed=6771|series=real10y|variant=primary|block={L}|counter={counter}'
            for word in struct.unpack('>8I',hashlib.sha256(message.encode('ascii')).digest()):
                if word<4294967292:yield word%36
            counter+=1
    stream=starts();stats=[];hist=Counter();first=[];trace=hashlib.sha256();integer=all(x is None or float(x).is_integer() for x in slots)
    for rep in range(10000):
        indices=[];draws=[]
        for _ in range(36//L):
            start=next(stream);draws.append(start);indices.extend((start+k)%36 for k in range(L))
        vals=[slots[i] for i in indices if slots[i] is not None];total=sum(vals);count=len(vals);hist[count]+=1
        if integer:trace.update(f'{int(total)}/{count}\n'.encode('ascii'))
        if vals:stats.append(total/count)
        if rep==0:first=draws
    stats.sort();scored=sum(x is not None for x in slots);reasons=[]
    if scored<12:reasons.append('too_few_scored_events_for_ci')
    if len(stats)<9900:reasons.append('too_few_valid_bootstrap_replicates')
    return {'block_length':L,'replicates':10000,'scored_events':scored,'valid_replicates':len(stats),'invalid_all_null_replicates':10000-len(stats),'ci_reportable':not reasons,'ci':[quantile(stats,.025),quantile(stats,.975)] if not reasons else None,'ci_suppression_reasons':reasons,'non_null_count_histogram':{str(k):v for k,v in sorted(hist.items())},'first_replicate_block_starts':first,'integer_sum_count_trace_sha256':trace.hexdigest() if integer else None}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('mode',choices=['coverage','evaluate']);args=ap.parse_args()
    p,values,bindings,hashes=ingest();cov=coverage_payload(p,values,bindings,hashes)
    if args.mode=='coverage':
        doc={'created_at_utc':datetime.now(timezone.utc).isoformat(),'status':'date/validity/binding audit only; no yield differences or event contrasts calculated','analysis_code_sha256':sha(Path(__file__)),**cov}
        dump(COVERAGE,doc);COVERAGE.with_suffix('.sha256').write_text(sha(COVERAGE)+'  '+COVERAGE.name+'\n',encoding='ascii')
        print(json.dumps({'coverage':str(COVERAGE),'sha256':sha(COVERAGE),'format_agreements':sum(b['exact_Decimal_agreements'] for b in bindings),'series':{s:{'valid_dates':v['valid_dates'],'eligible_events':sum(r['eligible'] for r in v['event_membership']),'eligible_placebos':sum(r['eligible'] for r in v['placebo_membership'])} for s,v in cov['series'].items()}},indent=2));return
    old=json.loads(COVERAGE.read_text(encoding='utf-8'))
    assert sha(COVERAGE)==COVERAGE.with_suffix('.sha256').read_text().split()[0]
    assert old['analysis_code_sha256']==sha(Path(__file__)) and all(old[k]==v for k,v in cov.items()),'Coverage changed; audit before outcome computation'
    result={'calculated_at_utc':datetime.now(timezone.utc).isoformat(),'status':'retrospective daily release-calendar association; not a causal or trading result','protocol_sha256':EXPECTED_PROTOCOL,'amendment_sha256':EXPECTED_AMENDMENT,'coverage_sha256':sha(COVERAGE),'analysis_code_sha256':sha(Path(__file__)),'series':{}}
    for sid,vals in values.items():
        records=scores(vals,cov['series'][sid]['event_membership']);placebo=scores(vals,cov['series'][sid]['placebo_membership'])
        result['series'][sid]={'role':'single primary' if sid=='real10y' else 'descriptive secondary','summary':summary(records),'records':records,'pre_event_placebo':{'summary':summary(placebo),'records':placebo}}
    records=result['series']['real10y']['records'];slots=[r['contrast_bp'] for r in records]
    result['primary_uncertainty']={'L3':bootstrap(slots,3),'L6_sensitivity':bootstrap(slots,6)}
    omitted=[{**r,'contrast_bp':None} if r['actual_release_date']=='2024-05-15' else r for r in records]
    result['planned_variants']={'omit_2024_05_15':{**summary(omitted),'excluded_date':'2024-05-15','original_month_slots_retained':True},'omit_FOMC_statements':{'status':'not_evaluated_FOMC_coverage_incomplete'},'omit_broader_core_overlap':{'status':'not_evaluated_broader_overlap_coverage_incomplete'},'year_specific':{str(y):summary([r for r in records if r['actual_release_date'].startswith(str(y))]) for y in (2022,2023,2024)},'leave_one_year_out':{str(y):summary([r for r in records if not r['actual_release_date'].startswith(str(y))]) for y in (2022,2023,2024)},'leave_one_event_out':{r['actual_release_date']:summary([x for x in records if x is not r]) for r in records}}
    result['overlap_coverage']={'status':'incomplete; unknown is not clean','primary_retains_all_windows':True,'FOMC_and_broader_exclusion_variants':'unavailable until their frozen completeness gates pass','exceptional_quote_clock_audit':'No complete date-specific early-close audit;15:30 is an approximate source-method proxy, not exact ticks.'}
    result['limits']=['Current historical Treasury source vintage, not authenticated original-day bytes.','Conservative weekday predecessor, not verified holiday calendar; no bridging or filling.','Daily windows bundle CPI/Real Earnings, other releases and news; no causal isolation.','No survey-consensus regression, gold result, five-minute response or execution return.','CIs rely on limited36-month weak-dependence/stability assumptions; not a randomization test.']
    dump(RESULTS,result)
    print(json.dumps({'file':str(RESULTS),'primary':result['series']['real10y']['summary'],'primary_uncertainty':result['primary_uncertainty'],'secondary':result['series']['nominal2y']['summary'],'pre_event_placebo':result['series']['real10y']['pre_event_placebo']['summary']},indent=2))

if __name__=='__main__':main()
