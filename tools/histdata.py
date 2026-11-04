# RESEARCH ONLY: XAUUSD 1-minute bars from HistData.com (free; ASCII M1, times in EST without DST = UTC-5).
# Each download is a form POST that needs the page's hidden "tk" token.
import re, sys, io, zipfile, gzip, time, urllib.request, urllib.parse, http.cookiejar
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
cj = http.cookiejar.CookieJar(); op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def fetch(year, month=None):
  page = f"https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/xauusd/{year}" + (f"/{month}" if month else "")
  html = op.open(urllib.request.Request(page, headers={'User-Agent': UA}), timeout=60).read().decode('utf8', 'ignore')
  tk = re.search(r'id="tk"\s+value="([^"]+)"', html) or re.search(r'name="tk"[^>]*value="([^"]+)"', html)
  if not tk: raise RuntimeError('no tk token on ' + page)
  data = urllib.parse.urlencode({'tk': tk.group(1), 'date': str(year), 'datemonth': f"{year}{month:02d}" if month else str(year), 'platform': 'ASCII', 'timeframe': 'M1', 'fxpair': 'XAUUSD'}).encode()
  z = op.open(urllib.request.Request('https://www.histdata.com/get.php', data=data, headers={'User-Agent': UA, 'Referer': page, 'Content-Type': 'application/x-www-form-urlencoded'}), timeout=120).read()
  zf = zipfile.ZipFile(io.BytesIO(z)); name = [n for n in zf.namelist() if n.endswith('.csv')][0]
  return zf.read(name)
out = sys.argv[1]
for y in range(2018, 2025):
  try:
    b = fetch(y); open(f"{out}/XAUUSD_M1_{y}.csv.gz", 'wb').write(gzip.compress(b)); print(y, len(b))
  except Exception as e: print('fail', y, e)
  time.sleep(3)
for m in range(1, 13):
  try:
    b = fetch(2025, m); open(f"{out}/XAUUSD_M1_2025{m:02d}.csv.gz", 'wb').write(gzip.compress(b)); print(2025, m, len(b))
  except Exception as e: print('fail 2025', m, e)
  time.sleep(3)
