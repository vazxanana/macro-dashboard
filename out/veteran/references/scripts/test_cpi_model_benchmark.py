from pathlib import Path
from fractions import Fraction as F
import hashlib,importlib.util,json,unittest
spec=importlib.util.spec_from_file_location('b',Path(__file__).with_name('cpi-model-benchmark.py'))
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class BenchmarkTests(unittest.TestCase):
    def test_reference_month_lags(self):
        self.assertEqual(b.lag_month('2021-12',3),'2021-09');self.assertEqual(b.lag_month('2022-01',1),'2021-12')
    def test_missing_is_not_zero(self):
        for x in [None,'','N/A','NaN','Infinity','bad']:self.assertIsNone(b.fraction(x))
        self.assertEqual(b.fraction('0.0'),0);self.assertEqual(b.fraction('-0.0'),0)
    def test_full_decimal_precision(self):
        self.assertEqual(b.fraction('0.12345678901234567890'),F(1234567890123456789,10**19))
    def test_exact_thirds(self):
        self.assertEqual(b.mean([F('0.1'),F('0.2'),F('0.2')]),F(1,6))
    def test_mse_mae_median_distinct(self):
        rows=[b.losses({'C':F(x),'P':F(2)},F(0)) for x in [1,3]]
        self.assertEqual(b.decoded(b.aggregate(rows,'C')['MSE']),5)
        self.assertEqual(b.decoded(b.aggregate(rows,'P')['MSE']),4)
        self.assertEqual(b.decoded(b.aggregate(rows,'C')['MAE']),2)
        self.assertEqual(b.mean([r['C']['SE']-r['P']['SE'] for r in rows]),1)
        self.assertEqual(b.median([F(0),F(0),F(9)]),0);self.assertEqual(b.mean([F(0),F(0),F(9)]),3)
    def test_signed_error_direction(self):
        row=b.losses({'C':F('0.4')},F('0.3'))['C'];self.assertEqual(row,{'error':F('0.1'),'SE':F('0.01'),'AE':F('0.1')})
    def test_rounding_ties_both_signs(self):
        self.assertEqual(b.round_tenth(F('0.25')),F('0.3'));self.assertEqual(b.round_tenth(F('-0.25')),F('-0.3'))
    def test_construct_before_rounding(self):
        a,c=F('0.14'),F('0.15')
        self.assertEqual(b.round_tenth((a+c)/2),F('0.1'))
        self.assertEqual(b.round_tenth((b.round_tenth(a)+b.round_tenth(c))/2),F('0.2'))
    def test_no_pairs_not_zero_loss(self):
        self.assertEqual(b.aggregate([],'C')['count'],0);self.assertIsNone(b.aggregate([],'C')['MSE'])
    def test_fixed36_slots(self):
        with self.assertRaises(AssertionError):b.bootstrap([None]*35)
    def test_rolling_missing_does_not_remove_primary(self):
        records=[]
        for i in range(36):
            d={'actual':b.encoded(F(1)),'forecasts':{k:b.encoded(v) for k,v in {'C':F(1),'P':F(1),'R3':None,'B50':F(1)}.items()},'primary_pair_eligible':True,'all4_common_eligible':False,'primary_pair_reasons':[]}
            records.append({'event_id':str(i),'reference_month':f'{2022+i//12}-{i%12+1:02d}','release_date':f'{2022+i//12}-{i%12+1:02d}-15','measure':{'core':d,'headline':d}})
        result=b.evaluate({'records':records})
        self.assertEqual(result['measures']['core']['primary_pair_count'],36)
        self.assertEqual(result['measures']['core']['all4_common_count'],0)
        self.assertEqual(result['primary_uncertainty']['L3']['ci'],[0,0])
        self.assertIsNone(result['input_ledger_sha256'])
    def test_independent_bootstrap_fixtures(self):
        path=b.ROOT/'work/cpi-model-benchmark/bootstrap-synthetic-reference.json';ref=json.loads(path.read_text(encoding='utf-8'));checks=[]
        for f in ref['fixtures']:
            ex=f['result'];got=b.bootstrap(f['input'],ex['block_length'])
            for key in ['valid_replicates','invalid_all_null_replicates','ci_reportable','non_null_count_histogram','first_replicate_block_starts','integer_sum_count_trace_sha256']:self.assertEqual(got[key],ex[key],(f['id'],key))
            self.assertEqual(got['primary_pairs'],ex['scored_events'])
            names=[x.replace('primary_pairs','scored_events') for x in got['ci_suppression_reasons']]
            self.assertEqual(names,ex['ci_suppression_reasons'])
            if got['ci'] is not None:
                for x,y in zip(got['ci'],ex['ci']):self.assertLessEqual(abs(x-y),1e-12+1e-12*max(abs(x),abs(y)))
            checks.append({'fixture':f['id'],'passed':True,'trace':got['integer_sum_count_trace_sha256']})
        b.save(b.ROOT/'work/cpi-model-benchmark/python-bootstrap-synthetic-crosscheck.json',{'reference_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'fixtures':checks,'scope':'synthetic only'})
if __name__=='__main__':unittest.main(verbosity=2)
