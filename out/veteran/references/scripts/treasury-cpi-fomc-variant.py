"""Apply only the predeclared formal-FOMC overlap exclusion. No rematching."""
from pathlib import Path
from datetime import datetime,date,timezone
import hashlib,importlib.util,json
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('treasury-cpi-study.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
ROOT=base.ROOT
CALENDAR=ROOT/'work/fomc-overlap-calendar-2022-2024.json'
OUT=ROOT/'outputs/treasury-cpi-fomc-variant-2022-2024.json'
def instant(s):return datetime.fromisoformat(s.replace('Z','+00:00'))
def overlap(a,b,t):
    if t==a or t==b:return 'boundary_ambiguous'
    return 'present' if a<t<b else 'outside'
def screen(ending,events):
    d=date.fromisoformat(ending);p=base.previous(d)
    a=base.proxy(p).astimezone(timezone.utc);b=base.proxy(d).astimezone(timezone.utc)
    assert date(2022,1,1)<=p<=d<=date(2024,12,31),'Interval outside audited calendar'
    hits=[{'event_id':e['event_id'],'url':e['url'],'release_at_utc':e['release_at_utc'],'status':overlap(a,b,instant(e['release_at_utc']))} for e in events if overlap(a,b,instant(e['release_at_utc']))!='outside']
    return {'ending_date':ending,'start_proxy_utc':a.isoformat(),'end_proxy_utc':b.isoformat(),'status':'present_or_boundary' if hits else 'none_after_complete_formal_statement_review','formal_statement_hits':hits,'broader_news_status':'not_completely_audited'}
def main():
    cal=json.loads(CALENDAR.read_text(encoding='utf-8'));gate=cal['gate']
    assert gate['status']=='complete_for_currently_published_formal_statement_scope'
    assert gate['formal_statement_count']==len(cal['events'])==24
    assert not gate['calendar_urls_missing_from_archive'] and not gate['archive_urls_missing_from_calendar'] and not gate['unclassified_screen_entries']
    events=cal['events'];assert all(e['iana_timezone_check'] and e['event_class']=='formal_fomc_policy_statement' for e in events)
    for e in events:
        name=e['raw_file'].replace('\\','/').rsplit('/',1)[-1]
        assert base.sha(ROOT/'work/raw/fomc-overlap-calendar-2022-2024'/name)==e['raw_sha256']
        t=instant(e['release_at_utc']);assert t==instant(e['release_at_new_york'])
        assert t.astimezone(base.NY).hour==14
    _,values,_,_=base.ingest()
    primary_path=ROOT/'outputs/treasury-cpi-results-2022-2024.json'
    original=json.loads(primary_path.read_text(encoding='utf-8'))
    assert base.sha(primary_path)=='1ecf48b3ff355dcaf9452bc74d8d39fc50a9a5fac9e9c9a4f936cea8270e4d33'
    baseline=original['series']['real10y']['records']
    dates=sorted({r['ending_date'] for r in baseline}|{c for r in baseline for c in r['control_dates']})
    audit={d:screen(d,events) for d in dates};members=[]
    for row in baseline:
        reasons=list(row['reasons']);event_hits=audit[row['ending_date']]['formal_statement_hits']
        removed=[c for c in row['control_dates'] if audit[c]['formal_statement_hits']]
        keep=[c for c in row['control_dates'] if c not in removed]
        if event_hits:reasons.append('formal_FOMC_statement_in_event_interval')
        if not keep:reasons.append('no_surviving_original_control')
        members.append({**row,'eligible':not reasons,'reasons':reasons,'control_dates':keep,'original_control_dates':row['control_dates'],'removed_original_control_dates':removed,'event_formal_statement_hits':event_hits})
    scored=base.scores(values['real10y'],members)
    result={'calculated_at_utc':datetime.now(timezone.utc).isoformat(),'variant_id':'omit_FOMC_statements','role':'predeclared_primary-series_descriptive_point_only','scope':'Currently published formal FOMC policy-decision statements; not all Fed policy/news.',
     'protocol_sha256':base.EXPECTED_PROTOCOL,'amendment_sha256':base.EXPECTED_AMENDMENT,'unchanged_primary_result_sha256':base.sha(primary_path),'calendar_file':CALENDAR.relative_to(ROOT).as_posix(),'calendar_sha256':base.sha(CALENDAR),
     'calendar_gate':gate,'baseline_primary_summary':original['series']['real10y']['summary'],'variant_summary':base.summary(scored),'records':scored,'audited_intervals':list(audit.values()),
     'exclusions':{'event_dates':[r['ending_date'] for r in scored if r['event_formal_statement_hits']],'removed_control_dates':sorted({c for r in scored for c in r['removed_original_control_dates']}),'unique_baseline_intervals_audited':len(audit),'retained_original_month_slots':len(scored)},
     'confidence_interval':None,'limitations':['A selected narrower daily comparison, not causal CPI isolation.','No replacement controls or changed windows; remaining controls are a subset of frozen sets.','Formal statements are only one news class; broader macro/Fed/speech/geopolitical coverage remains incomplete.','Official release-header clocks and approximate Treasury quote proxies are not exact network/trading timestamps.']}
    assert len(scored)==36
    for r in scored:assert set(r['control_dates'])<=set(r['original_control_dates'])
    base.dump(OUT,result)
    print(json.dumps({'file':str(OUT),'summary':result['variant_summary'],'exclusions':result['exclusions']},indent=2))
if __name__=='__main__':main()
