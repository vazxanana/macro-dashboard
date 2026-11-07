#!/bin/bash
# Replays the Scalp on every market, at most $J at a time (small heaps: the M1 history sits in typed arrays).
# Usage: run-all.sh <candleDir> <outDir> [jobs=4] [symbols...]
C="$1"; O="$2"; J="${3:-4}"; shift 3 2>/dev/null; H="$(dirname "$0")"
SYMS="${*:-EURUSD GBPUSD XAUUSD USDCAD USDCHF AUDUSD USDJPY XAGUSD NSXUSD SPXUSD}"
mkdir -p "$O"
for s in $SYMS; do
  [ -f "$O/$s.json" ] && continue
  while [ "$(jobs -rp | wc -l)" -ge "$J" ]; do sleep 5; done
  ( node --max-old-space-size=400 "$H/scalp-long.mjs" "$s" "$C" "$O" > "$O/$s.log" 2>&1; echo "done $s: $(tail -1 "$O/$s.log")" ) &
done
wait
echo ALL DONE
