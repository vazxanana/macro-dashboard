# The dominant zone touched, entered at market (result)

**Verdict: FAIL. Positive before costs on unread data (Set A +0.052R a trade, n 36,490, month t 10.5), but a random band does as well as the DOM zone and all sets lose after costs.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). OANDA mid 5-minute candles,
H1 dominant (DOM) zones of combo-grid-3, first M5 touch, market entry at the next 5-minute open; combo-grid-2 costs and
exclusions. Judged before costs (the owner's basis); after costs beside. Research only: nothing live changed.

## The gate, and one deviation from the pre-registration

The pre-registration asked the code to reproduce `grid6-dom-confirm/result.json` exactly. It does for 2010-2014 in all five
cells (zone 1R, zone trail, touch-candle trail, zone 2R, touch-candle 2R). For 2015-2019 it finds 21 more zone-stop trades
(38,679 against 38,658; +0.0322R against +0.0318R, t 6.17 against 6.02). To separate code from data, grid6's own market step
was re-run unchanged on this study's cache (fetched 23 Nov 2026; `grid6-this-cache.json`): it gives exactly this study's
figures in every cell and both halves, and its visit counts per market differ from the published ones. So the code is
grid6's; the candles differ slightly from the cache grid6 read. The study was judged on that basis rather than stopped, and
the published-exact check is recorded as failed (`result.json` `gate.publishedExact`). No conclusion below depends on a
0.05 % difference in trades.

## Q2: the rule on data the grids never read (before costs; after costs in brackets)

| Set | C1 zone stop, 1R | C2 touch-candle stop, trail | Holm p (C1 / C2) |
|---|---|---|---|
| A: five markets 2005-2009 | +0.052R, n 36,490, t 10.5 [-0.020R] | +0.158R, n 25,372, t 12.14 [-0.058R] | 3.9e-15 / 2.2e-17 |
| B: nzdusd usdcad usdchf eurjpy xag 2010-2019 (costs assumed) | +0.031R, n 71,858, t 8.22 [-0.075R] | +0.089R, n 38,776, t 9.12 [-0.154R] | 1.4e-13 / 3.4e-15 |
| C: five markets 2020-Nov 2026 (reported) | +0.023R, n 55,980, t 5.34 [-0.056R] | +0.063R, n 33,068, t 6.58 [-0.181R] | not judged |

Q2 holds for both cells. The tilt shrinks with time (Set A > 2010-19 > Set C). Per market, before costs: Set B C1 is positive
in all five (silver +0.015R, t 1.26, the weakest); Set C C2 gold is +0.006R (t 0.29). After costs the only positive rows are
Set A C1 EUR/USD +0.011R and GBP/USD +0.004R and Set A C2 EUR/USD +0.010R, all inside noise and on 2005-09 only.

## Q1: is it the DOM zone? (fills 2010-2019, five markets, before costs; Welch t per trade, month t of the difference beside)

| Cell | Control | 2010-14: control R, DOM minus control | 2015-19: control R, DOM minus control | DOM wins? |
|---|---|---|---|---|
| C1 | (a) random same-colour body, 5 seeds | +0.005R; +0.032R, t 5.23 (month 4.3) | +0.007R; +0.026R, t 4.18 (month 3.17) | yes |
| C1 | (b) last opposite-colour body | +0.017R; +0.021R, t 3.22 (month 3.29) | +0.011R; +0.021R, t 3.23 (month 3.01) | yes |
| C1 | (c) random band, 5 seeds | +0.028R; +0.010R, t 1.75 (month 2.22) | +0.026R; +0.006R, t 1.06 (month 1.28) | **no** |
| C2 | (a) random same-colour body, 5 seeds | +0.041R; +0.083R, t 6.84 (month 4.91) | +0.031R; +0.040R, t 3.37 (month 3.15) | yes |
| C2 | (b) last opposite-colour body | +0.089R; +0.034R, t 2.65 (month 2.29) | +0.038R; +0.033R, t 2.62 (month 2.28) | yes |
| C2 | (c) random band, 5 seeds | +0.098R; +0.025R, t 2.19 (month 1.66) | +0.062R; +0.008R, t 0.75 (month 0.35) | **no** |

DOM in the same cells: C1 +0.037R (n 38,353) and +0.032R (n 38,679); C2 +0.123R (n 24,487) and +0.071R (n 22,998). Band seeds
one by one: C1 Welch t 0.34 to 1.96, C2 0.38 to 2.14; no seed passes both halves.

A band of the DOM's height placed where DOM zones usually sit, with no candle pattern behind it, makes about +0.027R a trade
with the 1R exit and +0.06 to +0.10R with the trail. The tilt belongs to "buy at market when price comes back down to a
level a little below where it was" (and the mirror for sells), not to the dominant pair. The candle-body controls do worse
than the DOM because older or opposite bodies tend to sit at less useful distances, which the band control matches.

## Placebo and the other exits

The side-flipped placebo (same moment, side reversed, same stop distance) is negative: 2010-19 C1 -0.042R (n 76,938, t
-10.85), C2 -0.033R (t -4.67); Set A C1 -0.058R, Set B C1 -0.041R. A flipped short-term reaction, not a separate finding. The
2R exit with the zone stop: Set A +0.059R, Set B +0.033R, Set C +0.027R before costs, all negative after. The touch-candle
stop with 1R loses even before costs on every set (-0.034R to -0.046R).

## Conclusion

Not an edge, and not a DOM effect. The market entry at the first touch keeps a small before-cost tilt on unread years and
markets (n and t above), but a random band does as well, so the zone adds nothing measurable; and the round trip in R is
larger than the tilt on every set, most of all with the tight touch-candle stop. Nothing live changes; the H1 DOM demo
record (`council/dom-demo.mjs`) stays a forward record, not evidence. Caveat: trades overlap in time, so per-trade Welch t
is generous; the month t of each difference is given beside.

To repeat: fill the cache (`_lib/fetch-cache.mjs <m> 5m`: the five markets 2004-2026, the Set B markets 2008-2019), then
`run.mjs market <m> d|a|c <dir>` for xau eurusd gbpusd usdjpy audusd, `run.mjs market <m> b <dir>` for the Set B markets
(seconds each) and `run.mjs report <dir>`.
