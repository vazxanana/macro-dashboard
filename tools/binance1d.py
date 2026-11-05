# RESEARCH ONLY: Binance spot daily klines from the public data.binance.vision monthly zips -> one gz JSON per symbol.
import sys, io, zipfile, gzip, json, urllib.request, time
out = sys.argv[1]
for sym in sys.argv[2:]:
  rows = []
  for y in range(2017, 2027):
    for m in range(1, 13):
      if (y, m) > (2026, 10): break
      url = f"https://data.binance.vision/data/spot/monthly/klines/{sym}/1d/{sym}-1d-{y}-{m:02d}.zip"
      try:
        z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(url, timeout=60).read()))
        for line in z.read(z.namelist()[0]).decode().splitlines():
          p = line.split(',')
          if not p[0].isdigit(): continue
          t = int(p[0]); t = t // 1000000 if t > 10**14 else t // 1000
          rows.append([t, float(p[1]), float(p[2]), float(p[3]), float(p[4])])
      except Exception as e: pass
      time.sleep(0.1)
  rows.sort(); print(sym, len(rows), rows[0][0] if rows else None, flush=True)
  open(f"{out}/{sym}_1d.json.gz", 'wb').write(gzip.compress(json.dumps(rows).encode()))
