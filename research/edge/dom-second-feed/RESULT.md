# The H1 dominant-zone limit on a second candle feed (result)

**Verdict: PASS. On HistData M1 candles, 2020 on, the seven markets pooled made +0.0486R a trade before costs (n 148190, month t 11.66), and 2018-19 alone +0.0663R (n 41172, month t 8.12); after costs both lose.**

Pre-registered in `PREREGISTRATION.md` (committed alone before any run). Run 23 Nov 2026 with `run.mjs`; every figure is in
`result.json`. Judged before costs, as the owner asked; after costs beside. t = t of calendar-month sums of R.

## The question

The three combination grids found, before costs and on OANDA mid candles only, one family that holds: an H1 dominant zone
(two H1 candles of one colour, the second closing beyond the first's extreme; zone = the first candle's body), touched on M5, a
limit at the near edge, stop past the far side by half the cost + 0.25 x ATR(14) of H1, 1R trailing stop from +1R. Is that
tilt a property of OANDA's candles? The same rule, unchanged, was run on an independent feed: HistData M1 (bid prices) from the
council-data branch, labels converted to UTC only through `council/histdata.mjs` `histStampUtc`, grouped to 5 minutes. Markets:
xau, eurusd, gbpusd, usdjpy, audusd, usdcad, usdchf; 1 Feb 2018 to 30 Oct 2026 (the last HistData candle) on both feeds.

## Tests

| Test | Feed, window | n | R a trade before costs | month t | after costs (t) |
|---|---|---|---|---|---|
| T1 | HistData, 2020 on | 148190 | +0.0486 | 11.66 | −0.0508 (−10.91) |
| T3 | HistData, 2018-19 | 41172 | +0.0663 | 8.12 | −0.0596 (−6.08) |
| T2 (control) | OANDA, 2020 on | 150853 | +0.0546 | 13.99 | −0.0457 (−10.43) |
| | OANDA, 2018-19 | 41099 | +0.0652 | 7.69 | −0.0624 (−6.00) |

Holm over T1 and T3: p 4.65e-17 and 1.53e-11. Both pass, so the verdict is PASS.

**The feed difference (2020 on)**: HistData minus OANDA, paired over 82 calendar months of pooled R sums: −12.56R a month,
paired t −2.54 before costs (−1.43 after). That crosses the pre-registered flag (a paired t of −2 or less with OANDA higher),
so the result says the SIZE depends on the feed: per trade the tilt is about 0.006R smaller on HistData (+0.0486 against
+0.0546), roughly a tenth of it. The tilt itself is there on both feeds, in both windows, in every market. On 2018-19 the two
feeds agree (+0.0663 against +0.0652). Part of the gap is likely that HistData is bid and OANDA is mid (a long's limit fills
against the bid's low), not tested here.

## Per market, trailing exit, before costs (2020 on; 2018-19 in brackets)

| Market | HistData R (t) | OANDA R (t) | paired month t | HistData 2018-19 R (t) |
|---|---|---|---|---|
| xau | +0.0623 (6.58) | +0.0567 (5.85) | 0.69 | +0.0605 (3.20) |
| eurusd | +0.0337 (3.44) | +0.0436 (5.13) | −1.77 | +0.0522 (2.96) |
| gbpusd | +0.0325 (3.28) | +0.0433 (4.42) | −1.60 | +0.0673 (4.14) |
| usdjpy | +0.0860 (7.27) | +0.0866 (7.92) | −0.32 | +0.0652 (4.90) |
| audusd | +0.0451 (4.71) | +0.0591 (6.03) | −2.08 | +0.0897 (4.52) |
| usdcad | +0.0434 (3.91) | +0.0398 (3.92) | 0.40 | +0.0725 (3.95) |
| usdchf | +0.0383 (3.50) | +0.0533 (5.25) | −1.99 | +0.0565 (2.55) |

After costs every market loses on both feeds except usdjpy, about −0.008R (t −0.65 on HistData, 2020 on).

## Other exits (HistData 2020 on, before costs)

1R +0.0426 (t 12.64), 2R +0.0438 (9.18), 3R +0.0418 (6.25), 4R +0.0408 (5.39); all lose after costs (−0.057 to −0.059R).

## Same zones on both feeds?

Of the H1 dominant zones (side and the completing candle's time, 1 Feb 2018 on): 93.4 % of HistData's zones are also
OANDA's, and 92.4 % of OANDA's are HistData's (108936 in both; per market 90-96 %). The small differences in an H1 candle's
open or close flip some pairs in or out; the rest of the trades are the same setups priced on another feed.

## What it means, and what it does not

- The before-cost tilt is not an artefact of OANDA's candles: it shows on an independent feed, in 2018-19 (years no grid read)
  as well as 2020 on, in all seven markets. It is about 10 % smaller on HistData (2020 on).
- It does not pay its costs: after the demo's costs every market but usdjpy loses clearly, and usdjpy is about flat. A
  before-cost tilt of +0.05R is a property of how prices move near these zones, not a trade.
- The trades overlap heavily (about 1,800 a month across seven correlated markets); the month-sum t counts months, not trades,
  which is the honest unit, but the seven markets share the dollar, so the pooled t overstates independence somewhat.
- Nothing live changed. Not an edge: never call it one; the forward demo record and `dom-zone-holdout` judge the rule.

## To repeat

`EDGE_DATA=<dir> node --use-env-proxy research/edge/_lib/fetch-cache.mjs <market> 5m 2017 2026` for the seven markets, then
`node research/edge/dom-second-feed/run.mjs market <market> <outDir>` for each (HistData read with `git show origin/council-data`)
and `node research/edge/dom-second-feed/run.mjs report <outDir>`. Test: `tests/dom-second-feed.test.mjs`.
