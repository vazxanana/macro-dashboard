"""Conditional clock compatibility only; no NBU prices, CPI scores or returns."""
from pathlib import Path
from datetime import datetime,date,time,timezone
from collections import Counter
from io import BytesIO
from zoneinfo import ZoneInfo
import hashlib,importlib.metadata,importlib.resources,json,sys

ROOT=Path(__file__).resolve().parents[2]
LEDGER='outputs/cpi-first-print-release-ledger-2022-2024.json'
DATES='work/nbu-date-label-profile-2022-2024.json'
METHOD='work/nbu-gold-method-version-audit.json'

def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def iso(d):return d.astimezone(timezone.utc).isoformat().replace('+00:00','Z')
def load(p):return json.loads((ROOT/p).read_text(encoding='utf-8'))

def main():
    assert sha(LEDGER)=='0004d715f03c8e6f557721cf527dee4fad4a98dcea1679d9212efa58c9012052'
    assert sha(DATES)=='e0dc4dd1ddf57c489689368e3528e524efb0ff4da44cc0276ec64ab8a37f1906'
    assert sha(METHOD)=='58b03a7015ce9f6e17ad466447602f5a50d7b26a50c0fcc9d838fafc565cd69a'
    zonebytes={z:importlib.resources.files('tzdata.zoneinfo').joinpath(z).read_bytes()
               for z in ['Europe/Kyiv','America/New_York']}
    zones={z:ZoneInfo.from_file(BytesIO(b),key=z) for z,b in zonebytes.items()}
    kyiv=zones['Europe/Kyiv'];newyork=zones['America/New_York']
    ledger=load(LEDGER)['records'];dates=load(DATES)
    by_effective={r['exchangedate_label_iso']:r for r in dates['date_pairs']}
    assert len(ledger)==36 and len(by_effective)==1096
    def reference(label,scheduled):
        day=date.fromisoformat(label)
        assert day>=date(2022,1,4)
        if date(2022,2,24)<day<date(2022,3,21):state='FROZEN_RULE_PERIOD_NO_FRESH_QUOTE_ASSUMED'
        elif day in (date(2022,2,24),date(2022,3,21)):state='COMMENCEMENT_DAY_INTRADAY_UNAUTHENTICATED'
        else:state='CONDITIONAL_POST127_DEFAULT_CLOCK'
        quote=datetime.combine(day,time(15,0),tzinfo=kyiv)
        deadline=datetime.combine(day,time(15,30),tzinfo=kyiv)
        return {'date_label':label,'legal_clock_state':state,
          'included_in_default_clock_summary':state=='CONDITIONAL_POST127_DEFAULT_CLOCK',
          'hypothetical_reference_bfix_local':quote.isoformat(),
          'hypothetical_reference_bfix_utc':iso(quote),
          'hypothetical_reference_deadline_utc':iso(deadline),
          'quote_reference_minus_scheduled_cpi_minutes':int((quote.astimezone(timezone.utc)-scheduled).total_seconds()/60),
          'deadline_reference_minus_scheduled_cpi_minutes':int((deadline.astimezone(timezone.utc)-scheduled).total_seconds()/60),
          'kyiv_utc_offset_minutes':int(quote.utcoffset().total_seconds()/60),
          'actual_quote_or_publication_authenticated':False,
          'interpretation':'Reference-clock arithmetic, not an observed quote/publication or proof that the API field means this timestamp.'}
    records=[]
    for e in ledger:
        scheduled=datetime.fromisoformat(e['scheduled_at_utc'].replace('Z','+00:00'))
        local=scheduled.astimezone(newyork)
        assert local.isoformat()==e['scheduled_local'] and local.strftime('%H:%M')=='08:30'
        assert local.date().isoformat()==e['release_date']
        pair=by_effective[e['release_date']]
        same=reference(e['release_date'],scheduled)
        paired=reference(pair['calcdate_label_iso'],scheduled)
        records.append({'event_id':e['event_id'],'release_date':e['release_date'],
          'scheduled_cpi_utc':e['scheduled_at_utc'],'scheduled_cpi_new_york':local.isoformat(),
          'actual_cpi_first_available_utc':None,
          'new_york_utc_offset_minutes':int(local.utcoffset().total_seconds()/60),
          'source':{'url':e['source_url'],'file':e['source_file'],'sha256':e['source_sha256']},
          'nbu_date_projection_source_array_index':pair['source_array_index'],
          'paired_calcdate_label':pair['calcdate_label_iso'],
          'same_calendar_date_reference':same,'effective_label_join_reference':paired,
          'special_timing_caveat':'Official early-publication case; no exact field-specific actual UTC imposed.' if e['release_date']=='2024-05-15' else None})
    def summarize(key):
        valid=[r[key] for r in records if r[key]['included_in_default_clock_summary']]
        return {'conditional_default_cases':len(valid),'excluded_rule_cases':len(records)-len(valid),
          'reference_bfix_gap_minutes':dict(sorted(Counter(r['quote_reference_minus_scheduled_cpi_minutes'] for r in valid).items())),
          'reference_deadline_gap_minutes':dict(sorted(Counter(r['deadline_reference_minus_scheduled_cpi_minutes'] for r in valid).items())),
          'warning':'Negative means before scheduled CPI, positive after; no actual-availability/price claim.'}
    result={'status':'CONDITIONAL_CLOCK_ARITHMETIC_NOT_PRICE_OR_PUBLICATION_AUTHENTICATION',
      'created_at_utc':datetime.now(timezone.utc).isoformat(),
      'cohort':'The existing36 calendar-year2022–2024 CPI releases; dates/times only.',
      'method':'15:00/15:30 Europe/Kyiv reference clocks from post127 rule; separate same-calendar-date arithmetic and conditional use of paired calcdate labels. Freeze days excluded from default-clock summaries.',
      'input_bindings':[{'file':p,'sha256':sha(p)} for p in [LEDGER,DATES,METHOD]],
      'runtime':{'python':sys.version,'tzdata_version':importlib.metadata.version('tzdata'),
                 'zone_loading':'ZoneInfo.from_file over explicitly hashed tzdata package bytes; no system-path/cache dependency.',
                 'zone_file_sha256':{z:hashlib.sha256(b).hexdigest() for z,b in zonebytes.items()}},
      'summary':{'cases':len(records),'same_calendar_date':summarize('same_calendar_date_reference'),
                 'effective_label_join':summarize('effective_label_join_reference')},
      'records':records,
      'limits':[
        'Range calcdate/exchangedate semantics and original source/publication availability remain incomplete; paired-label clock assignment is explicitly conditional.',
        'Legal reference/default times are not observed source quotes or actual publication. Fallback quotation ages and operational exceptions remain unknown.',
        'CPI times are scheduled, not authenticated actual first-publication timestamps; May2024 early posting is separately flagged.',
        'No NBU price response, numeric gold values, CPI outcomes, forecast errors, returns or back-conversion used.'
      ],
      'attribution':'National Bank of Ukraine, https://bank.gov.ua/en/open-data; U.S. Bureau of Labor Statistics; independent clock arithmetic by MeridianX research.',
      'code':{'file':'outputs/scripts/nbu-cpi-clock-audit.py','sha256':sha('outputs/scripts/nbu-cpi-clock-audit.py')}}
    path=ROOT/'outputs/nbu-cpi-clock-compatibility-2022-2024.json'
    path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'file':str(path),'sha256':sha(str(path.relative_to(ROOT))),'summary':result['summary']},indent=2))

if __name__=='__main__':main()
