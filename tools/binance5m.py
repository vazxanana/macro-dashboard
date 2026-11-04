# RESEARCH ONLY: Binance spot 5-minute klines (public data.binance.vision monthly zips) -> one compact gz JSON per symbol:
# [[t, o, h, l, c], ...] with t in seconds (UTC open time).
import sys, io, zipfile, gzip, json, urllib.request, time
out, sym, y0 = sys.argv[1], sys.argv[2], int(sys.argv[3])
rows = []
for y in range(y0, 2027):
  for m in range(1, 13):
    if (y, m) > (2026, 10): break
    url = f"https://data.binance.vision/data/spot/monthly/klines/{sym}/5m/{sym}-5m-{y}-{m:02d}.zip"
    try:
      z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url, timeout=120).read()))
      for line in z.read(z.namelist()[0]).decode().splitlines():
        p = line.split(',')
        if not p[0].isdigit(): continue
        t = int(p[0]); t = t // 1000000 if t > 10**14 else t // 1000   # 2025+ files are in microseconds
        rows.append([t, float(p[1]), float(p[2]), float(p[3]), float(p[4])])
      print(sym, y, m, len(rows), flush=True)
    except Exception as e: print('fail', sym, y, m, e, flush=True)
    time.sleep(0.3)
rows.sort(); open(f"{out}/{sym}_5m.json.gz", 'wb').write(gzip.compress(json.dumps(rows, separators=(',', ':')).encode()))
