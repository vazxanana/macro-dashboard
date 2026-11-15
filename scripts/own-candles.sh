#!/bin/sh
# A workflow's own OANDA candles (15 Nov 2026; council/md-proxy.mjs): with OANDA_TOKEN set, start the localhost /md/bars service
# for the rest of the job and point MD_BASE (and ICT_MD_BARS) at it through $GITHUB_ENV, once it answers. Without the token, or
# if it does not answer, nothing is set and the scripts keep the website's proxy. Never fails the job.
#   sh scripts/own-candles.sh [bars]     "bars": MD_BASE is the full .../md/bars URL (scripts/daily-cache.mjs's form)
[ -n "$OANDA_TOKEN" ] || { echo "own candles: OANDA_TOKEN not set, using the website's proxy"; exit 0; }
nohup node council/md-proxy.mjs 8790 > "${RUNNER_TEMP:-/tmp}/md-proxy.log" 2>&1 &
ok=""
for t in $(seq 1 20); do
  if curl -fs -o /dev/null "http://127.0.0.1:8790/md/bars?sym=xau&tf=1h&n=2"; then ok=1; break; fi
  sleep 0.5
done
[ -n "$ok" ] || { echo "own candles: the service did not answer, using the website's proxy"; exit 0; }
if [ "$1" = "bars" ]; then echo "MD_BASE=http://127.0.0.1:8790/md/bars" >> "$GITHUB_ENV"; else echo "MD_BASE=http://127.0.0.1:8790/md/" >> "$GITHUB_ENV"; fi
echo "ICT_MD_BARS=http://127.0.0.1:8790/md/bars" >> "$GITHUB_ENV"
echo "own candles: on"
