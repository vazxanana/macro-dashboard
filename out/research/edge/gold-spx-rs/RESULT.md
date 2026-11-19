# Gold against the S&P 500: 3-month relative strength as a gold timing rule (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests: the both-sided switch lost 0.06R a trade net out of sample (n 118, t -0.68) and broke even in sample; RS sign does not separate gold's next month.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any return was computed). A stand-alone rule: not a gate, exit,
entry or size of the gold book, and nothing of the book's 2006-17 positions is read (owner item 44). Research only: no
proposal, nothing live changed.

## The rule
At gold's last weekday close of each month: RS = gold's 3-month log return minus the S&P 500's (SPX500). Buy gold for the
next month when RS > 0, sell when RS < 0; entry at the next open, exit at the open after the next month end; stop 3 x ATR(20)
(median $55 in sample, $74 out of sample), never moved. $0.60 a round trip (about 0.01R a trade) and overnight financing on
buys at `FIN.xau.long` (about 0.08R a buy month; 0.036-0.041R averaged over all trades). OANDA mid daily candles,
council-data `research/daily/xau.json` and `spx500.json`, weekends folded. t on calendar-month sums (one trade a month).

## Tests (net of costs unless marked)

| Test | Window | n | Gross R a trade (t) | Net R a trade | Net t | Net at 2x costs | Holm p (OOS) |
|---|---|---|---|---|---|---|---|
| T1 switch, both sides (primary) | 2007-16 | 120 | +0.039 (0.39) | -0.009 | -0.09 | -0.057 | |
| T1 switch, both sides (primary) | 2017-26 | 118 | -0.009 (-0.10) | -0.060 | -0.68 | -0.110 | 0.992 |
| T2 buy when RS > 0 minus buy when RS < 0 | 2007-16 | 59 / 61 | -0.047 (-0.24) | -0.034 | -0.17 | | |
| T2 buy when RS > 0 minus buy when RS < 0 | 2017-26 | 54 / 64 | -0.085 (-0.40) | -0.063 | -0.31 | | 0.992 |
| T3 switch where RS and gold's own 3-month return disagree | 2007-16 | 26 | +0.140 (0.69) | +0.107 | 0.53 | +0.073 | |
| T3 switch where RS and gold's own 3-month return disagree | 2017-26 | 33 | -0.137 (-0.84) | -0.166 | -1.04 | -0.195 | 0.914 |

- **Pass checks on T1** (all required): OOS net t >= 2: no (-0.68); Holm p < 0.05: no (0.992); in-sample net positive: no
  (-0.009R); positive at 2x costs: no (-0.110R); above the placebo: no.
- **Placebo** (40 seeds, out of sample): T1 random sides, 95th percentile t 0.87, 26 of 40 seeds at or above the rule's
  -0.68; T2 shuffled RS signs, 95th percentile 0.84, 22 of 40 at or above -0.31; T3 random sides, 95th percentile 1.56, 36 of
  40 at or above -1.04. The rule sits inside (or below) its noise everywhere.
- **The two sides of T1 out of sample**: buys +0.097R (n 54, t 0.70); sells -0.192R (n 64, t -1.76). The sells lose because
  gold rose: the unconditional buy every month made +0.132R net (t 1.28; gross +0.242R, t 2.30) out of sample and +0.053R net
  in sample. The months after gold LAGGED stocks were, if anything, better for a buy (+0.161R against +0.097R): the opposite of
  the idea, and within noise.
- **Stops**: 43 of 120 months in sample, 39 of 118 out of sample.
- **Year by year** (T1, net R): 2007 +1.65, 2008 -1.87, 2009 -2.57, 2010 -2.40, 2011 +4.47, 2012 -1.72, 2013 +5.03,
  2014 -1.98, 2015 -2.95, 2016 +1.28, 2017 -5.67, 2018 +2.64, 2019 +1.43, 2020 -4.96, 2021 +0.28, 2022 -0.18, 2023 +1.03,
  2024 -2.74, 2025 -1.47, 2026 (to Oct) +2.58.

## Reading
Gold's three-month strength against US stocks says nothing usable about gold's next month on 2007-26: the switch is flat before
costs in both windows, and the part relative strength adds beyond gold's own momentum (T3) flips sign between the windows.
Not an edge; never use it as a gold filter or bias. Nothing live changed.

## To repeat
`git show origin/council-data:research/daily/xau.json > <dir>/xau.json`, the same for `spx500.json` (kept out of git), then
`node research/edge/gold-spx-rs/run.mjs <dir>`. Tests: `tests/gold-spx-rs.test.mjs`.
