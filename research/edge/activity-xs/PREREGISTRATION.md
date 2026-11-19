# Pre-registration: does an index's trading activity predict its relative return? A weekly cross-section of index CFDs (14 Nov 2026)

Written and pushed alone, before any ranking, trade, return or statistic of this rule was computed. Paper research only:
nothing here changes a council rule, a trade, the mirror or any live file. It is not a gate, exit, entry or size on the gold
book (owner decision 44). ICT is not involved.

## Question

Two published claims, applied ACROSS national stock-index CFDs (both papers used single stocks; neither was opened from this
sandbox, so none of their figures is relied on):
- **Gervais, Kaniel and Mingelgrin 2001** ("The high-volume return premium"): unusually high activity against a security's own
  past predicts higher returns afterwards.
- **Amihud 2002** ("Illiquidity and stock returns"): illiquid assets (a large price move per unit of volume) earn more.

At each week's end, rank the indices by an activity measure, go long the top third and short the bottom third for one week,
at equal risk. Does the long-short book earn money net of the spread and overnight financing, out of sample?

**The volume is a proxy, said now.** OANDA's daily `v` is a count of price updates (quotes), not traded volume or turnover.
It grows many-fold over the years as quoting gets faster, and its LEVEL differs between CFDs for reasons that have nothing
to do with the underlying market's liquidity (how often OANDA's feed re-quotes each CFD). Measure (b) compares each index
with its own past, so the level drops out. Measure (a) does not: across markets it largely ranks OANDA's quoting rate, which
is expected to be nearly the same ranking every week. A FAIL here says nothing about either effect on real volume.

**Why this test, and its status.** The study `volume-premium` (branch `volume-premium`, PR #993, FAIL on its own pooled
primary) found, as a reported non-primary line, that high-activity days on index CFDs were followed by higher returns
than other days of the same market (indices alone, OOS t 3.52), while a time-series long made only +0.022R a trade net.
That finding was seen after the fact. A cross-sectional long-short is a different way to collect such an effect (the long
financing is partly offset by the short); this test stands only on this pre-registration.

**Duplicate check (done before writing this).** `ls research/edge` on `origin/main` and `git branch -r` filtered on
`illiq|amihud|activity|volume|xs|premium|liquid|quote|turnover|abnormal`: `volume-premium` (time series per market, daily
signal, longs only; not a cross-section), `commodity-xs-momentum`, `crypto-xs-momentum`, `fx-xs-momentum`, `index-xs-momentum`
(all rank on past RETURN), `index-low-vol` (ranks on realised VOLATILITY). None ranks on activity or illiquidity. The
untested backlog (`research/proposals/2026-11-14-untested-backlog.md` on branch `untested-backlog`, candidate 5) proposes this
cross-section (with a 50-day window); no branch has run it. Not a repeat.

What I expect, said plainly: little. The proxy is weak, there are only 14 indices (4 a side), and they move together.

## Markets (fixed now, before any price or volume was read for this study)

Every council-data index key (`_index.json` group `index`) whose first daily candle is in 2008 or earlier, 14 markets:
`spx500 nas100 us30 us2000 de40 uk100 fr40 eu50 ch20 nl25 jp225 au200 hk33 sg30`.
Left out by that rule: `es35` (from 2016-12), `cn50` and `in50` (from 2011-08; in50 ends 2022-07).
Note, said now: the US has four indices in this set and the euro area four (de40, fr40, eu50, nl25); they are kept as the
rule names them, not thinned.

Data: council-data `research/daily/<key>.json` (complete OANDA mid UTC daily candles, columns `[t, o, h, l, c, v]`), read with
`git show origin/council-data:...` (no network; nothing cached in git). Saturday / Sunday stub candles are folded into the next
weekday: open from the stub, high / low over both, close Monday's, and **the stub's quote count added to Monday's**. A candle
with `v < 10` is a placeholder and makes any window that contains it give no measure for that week.

## The two measures (week W, the market's own folded candles up to and including its last candle of week W only)

Weeks are Monday-Sunday UTC. The signal day d = the market's last candle in week W ("the Friday close"; a holiday Friday =
its last candle that week). A market with no candle in week W is not ranked that week.
- **(b) Abnormal activity (PRIMARY):** mean `v` over the 20 candles d−19 … d divided by the mean `v` over the 250 candles
  d−249 … d. Needs 250 candles. **Long the HIGHEST third** (high abnormal activity, Gervais-Kaniel-Mingelgrin).
- **(a) Amihud illiquidity (SECONDARY):** mean over the 20 candles d−19 … d of |ln(C(t) / C(t−1))| / v(t). Needs the same
  250-candle history as (b) (so both rank the same markets from the same date). **Long the HIGHEST third** (the most
  illiquid, Amihud).

## The book

- Each week W with at least `MIN_RANKED` 9 markets ranked: sort by the measure (ties by the market list order above),
  k = floor(N / 3); long the top k, short the bottom k.
- Each leg enters at the open of the market's first candle of week W+1 and exits at the close of its last candle of week W+1,
  unless stopped. A market with no candle in week W+1 has no leg that week.
- **Stop: 1R = 3 x ATR(20)** (true range, simple mean of the last 20 true ranges up to and including d) from the entry; a
  candle whose range reaches the stop exits at the stop, a candle that OPENS beyond it exits at its open (gap). Every leg has
  a stop on the losing side; the code throws otherwise.
- **Equal risk by inverse ATR:** each leg is sized so its stop costs 1R; every leg's result is counted in R of its own stop.
  The week's result = the sum of its legs (long and short), in R.

## Costs (fixed now)

- Spread and slippage: **0.04 % of the entry price a round trip** for every index CFD (the brief's index-CFD figure; the
  earlier index studies used 0.03 %, so this is the stricter one). In R: 0.0004 x entry / stop distance.
- Overnight financing per rollover (`council/fills.mjs` `nights`, imported: Monday-Friday 22:00 UTC, Wednesday three), at an
  ASSUMED rate of the index's quote-currency policy rate + 2.5 % a year for a long, max(0, 2.5 % − rate) a year paid by a
  short (no credit); the year-average policy-rate table of `index-xs-momentum` (branch `index-xs-momentum`, its
  PREREGISTRATION.md) is reused unchanged, years before 2007 take the 2007 row (stated: an approximation for 2004-06, all in
  sample). Currencies: spx500 nas100 us30 us2000 jp225 USD; de40 fr40 eu50 nl25 EUR; uk100 GBP; ch20 CHF; au200 AUD;
  hk33 HKD; sg30 SGD. Today's markup for every year.
- 2x costs = both the spread and the financing doubled.

## Windows

- Each week is booked in the calendar month of its holding week's Monday.
- **In sample:** the first week with 9 ranked markets (expected 2004) to 2016-12. **Out of sample:** 2017-01 to 2026-10.
- t = mean / (sd / sqrt n) on CALENDAR-MONTH SUMS of the weekly net R (a month with no week = 0); Newey-West (3 lags) shown
  beside it. p two-sided from the t (normal approximation).

## Tests and the pass bar

Two tests, Holm over both: T1 = measure (b), the primary; T2 = measure (a), the secondary.
**PASS (for the primary, T1) only if ALL hold:**
1. OOS net month-sum t >= 2 and its Holm-adjusted p <= 0.05;
2. the in-sample net mean has the same sign (positive);
3. the OOS net mean is still positive at 2x costs.
T2 is judged on the same three conditions and reported; it cannot rescue a failing T1, and the verdict is T1's.

**Placebo (reported, 40 seeds, mulberry32 seeds 1-40):** each week the same ranked markets in a random order, the same
thirds, stops and costs; the real OOS net mean against the 40 (how many it beats, 5th / 50th / 95th percentile).

Reported only, never deciding: gross figures, long and short sides apart, per-year sums, how often measure (a) changes its
thirds from week to week (the expected near-static ranking).

## Not done, said now

No other window, holding period, number of thirds or stop is tried. Real exchange volumes are not used (none reachable).
No rule change follows from this test on its own; a pass would go to the owner as a proposal.
