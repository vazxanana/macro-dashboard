# Pre-registration: the playbook's weekly-bull daily rejection long and its two Daily-regime cuts, on platinum and palladium (15 Nov 2026)

Written and pushed before any platinum or palladium number of this rule is computed.

## Why
`gold-drd-long` (FAIL) found the gold playbook's weekly-bull daily rejection long profitable out of its own sample but not
measurably better than buying every bullish-week day. `gold-drd-er` (FAIL) named two cuts after the fact on gold: ER20 >= 0.3
(T2), and ER20 >= 0.2 with the close above its value 20 days earlier (T3). `gold-drd-silver` passed its pre-registered bar on
silver but was not robust: counted once a month its t fell to 1.15-1.43, and 2025 alone carried most of the profit. Silver has
now been read, so the cuts need markets they were never looked at on. Platinum and palladium are the remaining OANDA metals with
history back to 2006; this rule was never run on either (the two `*-ny-range-share` studies of 14 Nov tested another rule).
Silver's lesson is built in: **the bar is on calendar-month sums**, not on overlapping trades counted as independent.

## Rule (gold-drd-silver's code, unchanged except for the two price-scaled numbers)
17:00 New York days; weekly structure from 2-bar fractal weekly swings, bullish after a weekly close above the last swing high
(the last COMPLETED week). Signal day: closes above the previous day's low and in the top 30 % of its range. Buy the next day's
first H1 open; stop under the signal day's low by a buffer; target 3R; out at the close of the 10th day; stop first when one
candle holds both. Each signal is its own trade. ER20 as in gold-drd-er (17:00 New York daily closes up to and including the
signal day). The days, weeks, weekly state, ER and statistics are imported from gold-drd-long / gold-drd-er, not copied.
- **Buffer**: 0.01 % of the signal day's low (gold's $0.30 and silver's $0.004 are both about that share of price).
- **Cost**: the repository's own figures for these markets, a round trip on every trade, charged as cost x entry / risk in R:
  **platinum 0.30 % of the entry price** (`platinum-ny-range-share`), **palladium 0.20 %** (`palladium-ny-range-share`,
  from the `trend-breadth` cost table). A 2x cost run doubles both.

## Tests (four, Holm over the four)
OANDA mid H1 XPT_USD and XPD_USD, from each feed's first candle (2006 or later) to now, net of costs.
- **T2-xpt, T3-xpt, T2-xpd, T3-xpd**: the rule with the T2 / T3 cut on that market.
- Statistic: the one-sided t of the **calendar-month sums** of net R (months with no trade left out), p from the normal
  approximation, Holm over the four.
- A test PASSES only if ALL of: mean net R a trade > 0; Holm-adjusted p < 0.05; PF > 1 in 2006-2019 AND in 2020-now; mean net
  R a trade still > 0 at 2x costs; and still > 0 with the stream's single best calendar year removed.
- **Verdict: PASS if at least one test passes.** A pass is a proposal to the owner, nothing more.

## Reported, not tested
T1 (every signal) on each market with the same columns; the trade-count t; worst drawdown; year by year; the baseline (every
bullish-week day) and lift t as in gold-drd-long; the pooled four-metal picture (gold, silver from the earlier studies, these two)
in words only.

## Data
OANDA mid H1 through the site's candle proxy (`/md/bars?sym=xpt|xpd&tf=1h`), cached outside git. Nothing live changes whatever
the result; this is a stand-alone rule on two markets the council does not trade, not a gate, exit, entry or size of the live
gold book, and it reads none of the book's positions (docs/owner-decisions.md item 44).
