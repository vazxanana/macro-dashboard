**Verdict:** INCONCLUSIVE, data not reachable: the Cboe VIX and VIX3M history files could not be fetched from the build environment, so the pre-registered rule was not run and no Sharpe, drawdown or bootstrap figure exists.

# Equity exposure timed by the VIX term structure (13 Nov 2026)

Paper research only; nothing live changed. The rule, costs, windows and pass bar are in `PREREGISTRATION.md` (committed first).

## What happened

- VIX: not fetched (Request was cancelled.), https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv
- VIX3M: not fetched (Request was cancelled.), https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv
- Attempted 2026-11-13T22:41:12.568Z through the session's proxy (`node --use-env-proxy`); the proxy refused the host (CONNECT 403). FRED (`VXVCLS`) was refused too.

No substitute was used, as pre-registered: no unofficial mirror of the series, and the macro strategist's cache (`macro/cache.json`, about 300 recent days of `VIXCLS` / `VXVCLS`) covers neither window.

## To finish it

From a machine that can reach `cdn.cboe.com`:

```sh
node --use-env-proxy research/edge/vix-term/run.mjs fetch <dir>   # outside git
node research/edge/vix-term/run.mjs full <dir>
```

The code, the tests of its signal lag (yesterday's close only), stop and costs, and the pass bar are in place; the first run with the data decides the verdict. No proposal is written.
