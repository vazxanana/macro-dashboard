# Edge research · turnaround-unused-markets: the local exchange calendars, written once to holidays.json (committed) so the
# study and its test run offline. Source: the PyPI package `holidays`, version 0.108 (pinned below), its financial
# calendars: TAR (Euronext Paris / Amsterdam close on the TARGET days), XMAD (BME), XSWX (SIX), XASX (ASX), XHKG (HKEX,
# defined from 2014 only), XSHG (Shanghai), XSES (SGX), XNSE (NSE India). Closed days ('public') and half days ('half_day',
# where the package has them). Calendar dates only: no price is read.
#   python3 -m venv /tmp/v && /tmp/v/bin/pip install holidays==0.108
#   /tmp/v/bin/python -I research/edge/turnaround-unused-markets/holidays.py research/edge/turnaround-unused-markets/holidays.json
import json
import sys

import holidays

VERSION = '0.108'
CODES = ['TAR', 'XMAD', 'XSWX', 'XASX', 'XHKG', 'XSHG', 'XSES', 'XNSE']
YEARS = list(range(2007, 2027))

if holidays.__version__ != VERSION:
    raise SystemExit(f'holidays {holidays.__version__}, pinned {VERSION}')
out = {'src': f'PyPI holidays {VERSION}, financial calendars', 'years': [YEARS[0], YEARS[-1]], 'closed': {}, 'half': {}, 'from': {}}
for c in CODES:
    cls = holidays.financial_holidays(c, years=YEARS)
    out['closed'][c] = sorted(str(d) for d in cls)
    out['from'][c] = max(YEARS[0], getattr(cls, 'start_year', YEARS[0]))
    cats = getattr(cls, 'supported_categories', ())
    out['half'][c] = sorted(str(d) for d in holidays.financial_holidays(c, years=YEARS, categories=('half_day',))) if 'half_day' in cats else []
with open(sys.argv[1], 'w') as f:
    json.dump(out, f, indent=0)
    f.write('\n')
print({c: (len(out['closed'][c]), len(out['half'][c]), out['from'][c]) for c in CODES})
