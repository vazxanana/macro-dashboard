# Pre-registration: the Daily-regime filter on the weekly-bull daily rejection long (12 Nov 2026)

Written and pushed before any number of this study is computed.

## Why
`research/edge/gold-drd-long` (11 Nov 2026, FAIL) found that the playbook's weekly-bull daily rejection long makes money out of
its own sample, but not measurably more than the same trade on every day of a bullish week (lift +0.10R, t 1.58), and that its
losses sit in gold's sideways years (2012-15, 2017-19, 2021). The playbook names one regime filter for this: skip the trade when
the Daily market is choppy, read as a 20-day efficiency ratio under 0.2. This is the one follow-up that study named.

## Rule (unchanged from gold-drd-long; its `run.mjs` is imported, never edited)
Last completed week's structure bullish (2-bar fractal swings, a weekly close above the last swing high); the signal day (17:00
New York) closes above the previous day's low and in the top 30% of its range; buy the next day's first H1 open; stop $0.30 under
the signal day's low; target 3R; out at the close of the 10th day; stop first when one candle holds both; $0.35 a round trip.
Each signal is its own trade, as before.

## The filter
ER20 on the signal day = |C(t) - C(t-20)| / sum of |C(i) - C(i-1)| for the 20 daily closes up to and including the signal day's
close (17:00 New York days, the same days as the rule). Known when the order is placed (the next day's open). Undefined (fewer than
21 days) = no trade.

## Primary test (one)
On March 2006 to October 2022 (the rule's own out-of-sample window; the skill's window Nov 2022-now is shown, never judged):
the signals with ER20 >= 0.2 against the signals with ER20 < 0.2, net R a trade, Welch t.
**PASS** only if all hold: (1) difference > 0 with t >= 2; (2) the filtered rule's PF > 1 in 2006-2019 AND in 2020-Oct 2022;
(3) the filtered rule's worst drawdown (summed R in entry order) is smaller than the unfiltered rule's on 2006-Oct 2022.
Otherwise FAIL. A PASS is a proposal to the owner, never a live change.

## Reported, not tested
ER20 >= 0.3; a signed version (ER20 >= 0.2 AND C(t) > C(t-20)); the filter on the baseline (every bullish-week day) to see
whether ER helps the rule's selection or just the trend; year by year; the skill's window.

## Data
OANDA mid H1 XAU_USD through the site's candle proxy, the same cache as gold-drd-long (kept out of git). No other data.
