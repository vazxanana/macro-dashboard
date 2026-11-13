# The FX carry trade on the G10 majors, out of sample: result

**Verdict: inconclusive: not run, data not reachable.** The pre-registered short-rate series (FRED `fredgraph.csv`, OECD 3-month interbank
rates and their overnight fallbacks for USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD) could not be read from the build
environment on 13 Nov 2026: every request to `fred.stlouisfed.org` was refused by the network (the proxy answered 403 to the
tunnel). ALFRED, the FRED API, the ECB, OECD and DBnomics data hosts were refused the same way, and the council-data branch
holds US rates only (`macro/cache.json`). Following the pre-registration (gate 3), no rate was typed in, guessed or taken from
memory, and **no return, Sharpe, t or drawdown was computed**. There is no finding: not an edge, not a failure.

Pre-registration: [`PREREGISTRATION.md`](PREREGISTRATION.md) (committed alone, before any code ran on data).

## What is ready

- `run.mjs` implements the pre-registered rule in full: the rate ranking with the two-month publication lag (an observation
  dated month m is used only from month m+2), long the top 2 / short the bottom 2 through the seven USD pairs (a USD leg is
  0 R), 1R = 3 x ATR(20) with a catastrophe stop on every leg (gapped stops fill at the open), carry accrued as a swap (the
  differential of the month held, less 1 % a year per leg), 1 pip + the measured 0.0045 % commission per round trip every
  month, the 2 x cost run, the volatility-skip variant, the two windows (2008-15, 2016 to the last complete month), Holm
  over the two decisive tests and the pass bar.
- The daily candles are present: council-data `research/daily/` holds all seven pairs from 2002 (NZD/USD from 24 Sep 2002)
  to 6 Nov 2026, so NZD's history is not missing.
- The pipeline was exercised on the real candles with made-up flat rates only to check that it runs (no figure of that run
  is reported or kept); `tests/fx-carry.test.mjs` checks the ranking, the lag, the accrual, the stop and the costs offline.

## To run it

```sh
node --use-env-proxy research/edge/fx-carry/run.mjs fetch <dir>      # FRED series into <dir> (outside git)
# daily candles: git show origin/council-data:research/daily/<key>.json > <dir>/daily/<key>.json for the seven keys
node research/edge/fx-carry/run.mjs full <dir>                       # writes result.json; then rewrite this file from it
```

The environment needs `fred.stlouisfed.org` allowed (keyless public data, no cost). Nothing live changed.

Wording note (post hoc, 13 Nov 2026): the pre-registration names this outcome "not run: data not reachable"; the stored
verdict reads "inconclusive: not run, data not reachable" so the Edge lab and the research ledger file it as inconclusive,
not as a FAIL (their reader counts any verdict that starts with "not" as a fail).
