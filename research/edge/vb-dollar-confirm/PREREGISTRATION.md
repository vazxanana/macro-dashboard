# Pre-registration: vb-dollar-confirm (24 Nov 2026)

Written and committed alone, before any trade of this study is split by what the other breakout did. No code written, no candle
read for it. Paper research only: nothing live changes; the two forward records and the Equinox desks run on unchanged.

## Question
The two Equinox breakout desks (gold T1, USD/JPY T1) are the only two rules in the repository that passed after costs. Both trade a
move of the US dollar. Is a gold breakout better when, at the moment it fills, USD/JPY's T1 of the same UTC day has ALREADY filled
the dollar-consistent way (gold up with USD/JPY down = dollar weak; gold down with USD/JPY up = dollar strong), or when it filled
the other way (dollar-inconsistent), or when it has not filled yet? And the mirror: USD/JPY given gold.

## What was read before, said plainly
- Both base rules have been read on every year used here (gold 2007-26, USD/JPY 2005-26). Their trades are known; the split by the
  other market's fill is not. This tests the CONDITION, not the breakouts.
- `research/proposals/2026-11-20-two-breakouts.md`: the two streams' monthly correlation 0.03, daily 0.10 (2021-26); both lost on
  293 of 867 shared days against about 270 expected. That hints the two are linked on some days; it says nothing about which way a
  confirmation tilts a trade. No agree / disagree split was ever computed.
- `vb-structure-filter` (FAIL) and `holdout-vb-early` (FAIL): a direction filter on these breakouts added nothing; early fills
  looked better. Fill hour is reported here per group, so a group that is simply "earlier fills" is not mistaken for a dollar effect
  (a fill after another fill is later in the day by construction).

## Base rules (unchanged, imported, never edited)
- **Gold T1**: `gold-vol-breakout-hourcost/original.mjs` (a pinned verbatim copy of `gold-vol-breakout/run.mjs`) `buildDays`,
  `daySkip`, `vbTrade` with `gold-vol-breakout-hourcost/costs.mjs` `T1` (k 0.5, both sides): O = open of the first M5 candle
  00:00-00:55 UTC; buy stop O + 0.5 x the previous day's range, sell stop O − 0.5 x it, first fill wins, stop at O, out at the 20:55
  UTC candle close. Trades are built the way `costs.mjs` `tradesIn` builds them (same calls), keeping the fill candle's time.
- **USD/JPY T1**: `usdjpy-vol-breakout-early/run.mjs` `trades('usdjpy', days)` on `index-vol-breakout/original.mjs` `buildDays`
  (the same rule, out at 21:00 UTC, the fx-vol-breakout study's pool without its 2016 day filter).
- Data: the shared toolkit's OANDA mid M5 cache (`research/edge/_lib/edgekit.mjs` `load`), the last calendar day on file left out.

## Costs (each desk's own)
- **Gold**: `gold-vol-breakout-hourcost` route C1, frozen as the gold forward record freezes it: half the demo broker's measured
  median quoted spread of the fill hour + half of hour 20, + the measured commission (0.000024 of price), + 0.05 x the median M5
  range of the fill candle's last 12 (slippage allowance, assumed), plus financing on buys as in the rule. Measured in 2026 and
  charged on every year.
- **USD/JPY**: `fx-vol-breakout` `costPx`: measured demo commission 0.000045 x entry + 0.5 pip allowance (spread + slippage,
  assumed; the tick study `usdjpy-vol-breakout-exec` found entry slippage about 0.012R). Every figure is also reported at 2x cost.

## The condition (one, fixed)
- Both markets' trades are matched by UTC day (the day string each rule gives its trade). For a trade of market A with fill candle
  start `tA`, the other market B's trade of the same day is "known" only if B's fill candle started strictly before A's
  (`tB < tA`; candles are 5-minute and UTC-aligned, so B's fill happened before A's candle opened). Its exit, its result and anything
  after `tA` are never read.
- Groups for a trade of A:
  - **agree**: B filled before, dollar-consistent side (sideA = −sideB, since gold and USD/JPY move against each other in a dollar
    move).
  - **disagree**: B filled before, the other way (sideA = sideB).
  - **none**: B had no fill before A's fill candle (B filled later, in the same 5-minute candle, never, or had no trade that day).
- Nothing about the trade itself changes: entry, stop, exit and size are the base rule's.

## Windows
Discovery 2007-01-01..2015-12-31 (gold's 5-minute history on the cache starts in 2006; both markets need data). Confirmation
2016-01-01..the last complete day in the cache. Both windows were read for the base rules, as said above.

## Tests (four, Holm over four)
- **T1** gold: agree − disagree. **T2** gold: agree − none.
- **T3** USD/JPY: agree − disagree. **T4** USD/JPY: agree − none.
For each, the difference of net R a trade (after costs), Welch t, two-sided p from the normal approximation; Holm over T1-T4 on the
confirmation p values. Month-sum t (calendar months with a trade, the base studies' `monthT`) of the agree group's own net R.

## Pass bar (a test passes only if every line holds)
1. The difference has the same sign in discovery and confirmation; the BETTER group (agree if the difference is positive, the other
   group if negative) is called the kept group.
2. Confirmation: |Welch t| ≥ 2 and Holm-adjusted p < 0.05.
3. The kept group is positive after costs in BOTH windows, and its month-sum t ≥ 2 in confirmation.
4. The kept group has n ≥ 200 in confirmation (if it has fewer, the test is INCONCLUSIVE, not a pass).
5. The kept group is still positive at 2x cost in confirmation.
6. Control: 40 seeded random subsets of the same market's confirmation trades, each the kept group's size; the kept group's mean
   beats at least 38 of them.
7. Fill hour: the kept group's difference is also reported within fills of the same UTC hour block (00-06, 06-12, 12-21) as a check
   that it is not the hour; reported, not part of the bar.
Harness gate (no verdict without it): unconditioned trades must reproduce, within 2 % of n and 0.01R of net R, gold's hourcost C1
windows W1-W4 (2007-11, 2012-15, 2016-20, 2021-26) and USD/JPY's `usdjpy-vol-breakout-early` 2005-2015 (n 2089, +0.079R) and
`fx-vol-breakout` 2016-20 (n 955, +0.036R) / 2021 on (n 1124, +0.087R, its end date). A miss = INCONCLUSIVE.

## Verdict words
PASS (n of 4) if any test passes; FAIL otherwise; INCONCLUSIVE if the gate fails or the kept groups are all under 200.
A pass would be a hypothesis for a forward record (with the desks' own forward records still the judge), never an edge on its own,
and nothing live would change without the owner.
