from pathlib import Path
from datetime import date
from decimal import Decimal
import hashlib,importlib.util,io,json,unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('study',HERE/'treasury-cpi-study.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

class TreasuryStudyTests(unittest.TestCase):
    def test_missing_zero_negative(self):
        self.assertEqual(s.value('0.00'),Decimal(0));self.assertEqual(s.value('-1.23'),Decimal('-1.23'))
        for token in [None,'','N/A','NaN','Infinity','bad']:self.assertIsNone(s.value(token))

    def test_no_missing_weekday_bridge(self):
        vals={date(2024,1,12):Decimal('1.0'),date(2024,1,16):Decimal('1.1')}
        r=s.memberships(vals,[date(2024,1,16)])[0]
        self.assertIn('missing_expected_weekday_endpoint',r['reasons'])
        self.assertEqual(r['prior_date'],'2024-01-15')

    def test_neighbor_band_uses_valid_observations(self):
        ds=[date(2024,2,9),date(2024,2,13),date(2024,2,15)]
        band,bad=s.neighbors(ds,[date(2024,2,13)])
        self.assertEqual(band,set(ds));self.assertFalse(bad)

    def test_missing_neighbor_quarantines_month(self):
        _,bad=s.neighbors([date(2024,2,13),date(2024,2,14)],[date(2024,2,13)])
        self.assertEqual(bad,{'2024-02'})

    def test_dst_spanning_placebo_not_relaxed(self):
        vals={date(2024,3,k):Decimal(1) for k in range(1,32) if date(2024,3,k).weekday()<5}
        r=s.memberships(vals,[date(2024,3,12)],True)[0]
        self.assertEqual(r['ending_date'],'2024-03-11');self.assertEqual(r['clock_signature'],[3,-300,-240,71*3600])
        self.assertEqual(r['control_dates'],[]);self.assertIn('no_matched_control',r['reasons'])

    def test_basis_points_and_signed_negative_real_levels(self):
        vals={date(2024,2,5):Decimal('-1.00'),date(2024,2,6):Decimal('0.00'),date(2024,2,12):Decimal('1.00'),date(2024,2,13):Decimal('1.01')}
        rows=[{'eligible':True,'ending_date':'2024-02-06','control_dates':['2024-02-13']}]
        r=s.scores(vals,rows)[0]
        self.assertEqual(r['signed_event_bp'],100);self.assertEqual(r['mean_absolute_control_bp'],1);self.assertEqual(r['contrast_bp'],99)

    def test_equal_event_not_pooled_control_weight(self):
        rows=[{'contrast_bp':7,'absolute_event_bp':10,'mean_absolute_control_bp':3,'control_dates':['a','b']},{'contrast_bp':1,'absolute_event_bp':10,'mean_absolute_control_bp':9,'control_dates':['c']}]
        out=s.summary(rows)
        self.assertEqual(out['mean_contrast_bp'],4);self.assertEqual(out['mean_of_event_control_means_bp'],6)

    def test_duplicate_quarantine(self):
        d=date(2024,1,2)
        out,a=s.unique([(d,Decimal('1.00')),(d,Decimal('1.0'))],'synthetic');self.assertEqual(a['identical_duplicates'],1);self.assertEqual(out[d],1)
        out,a=s.unique([(d,Decimal('1.0')),(d,Decimal('2.0')),(d,Decimal('1.0'))],'synthetic');self.assertIsNone(out[d]);self.assertEqual(a['conflicting_dates'],['2024-01-02'])

    def test_semantic_header_wins_over_reused_css_class(self):
        markup='<table><tr><th id="date">Date</th><th id="ten">10 YR</th><th id="twenty">20 YR</th></tr><tr><td headers="date">01/02/2024</td><td class="tc-10year" headers="ten">1.00</td><td class="tc-10year" headers="twenty">9.00</td></tr></table>'
        class MemoryHtml:
            name='synthetic.html'
            def read_text(self,**kwargs):return markup
        out,_=s.parse_html(MemoryHtml(),'10 yr')
        self.assertEqual(out[date(2024,1,2)],1)

    def test_wrong_xml_field_fails(self):
        p=io.StringIO('<feed xmlns="http://www.w3.org/2005/Atom"><entry><properties xmlns="x"><NEW_DATE>2024-01-02T00:00:00</NEW_DATE><TC_20YEAR>1.0</TC_20YEAR></properties></entry></feed>')
        with self.assertRaises(AssertionError):s.parse_xml(p,'TC_10YEAR',2024)

    def test_type7_quantile(self):
        self.assertEqual(s.quantile([0,10],.25),2.5)

    def test_independent_bootstrap_fixtures(self):
        reference=s.ROOT/'work/treasury-cpi-design/bootstrap-synthetic-reference.json'
        ref=json.loads(reference.read_text(encoding='utf-8'));checks=[]
        for fixture in ref['fixtures']:
            expected=fixture['result'];got=s.bootstrap(fixture['input'],expected['block_length'])
            for key in ['valid_replicates','invalid_all_null_replicates','ci_reportable','ci_suppression_reasons','non_null_count_histogram','first_replicate_block_starts','integer_sum_count_trace_sha256']:
                self.assertEqual(got[key],expected[key],(fixture['id'],key))
            if got['ci'] is not None:
                for a,b in zip(got['ci'],expected['ci']):self.assertLessEqual(abs(a-b),1e-12+1e-12*max(abs(a),abs(b)))
            checks.append({'fixture':fixture['id'],'result':'passed','valid_replicates':got['valid_replicates'],'trace_sha256':got['integer_sum_count_trace_sha256']})
        result={'independent_reference_sha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'fixtures':checks,'scope':'Synthetic cross-language reproducibility, not real-data performance'}
        (s.ROOT/'work/treasury-cpi-bootstrap-python-crosscheck.json').write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__':unittest.main(verbosity=2)
