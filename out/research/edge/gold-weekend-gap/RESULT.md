# Gold's Sunday-open gap: does it fill? (13 Nov 2026)

**Verdict: FAIL.** Fading gold's Sunday reopen gap back to Friday's close lost money on 2020 to now (Rule G −0.109R a trade after $0.30, n 41, t −0.78; Rule H −0.110R, n 38, t −0.76).
Neither rule passes any line of the bar on the decisive window (Rule G's 2010-19 sign is the only line met): fading a
reopen gap of 0.25-1.5 x ATR back to Friday's close does not pay. Such gaps are rare (42 eligible weeks in almost seven years, so n ≥ 80
cannot be met), and the larger the gap, the less often it fills before Monday noon. Not an edge; no proposal; nothing live
changed.

Paper research only. The rules, costs, windows and the pass bar were committed before this code existed
(`PREREGISTRATION.md`, commit d1e30e49). **What this is not** (owner decision 44): it is not a test of the live gold book
(Gold trend + Gold daily engulf; none of its positions is read) and does not read the book's 2006-17 window for a decision;
it is a NEW stand-alone rule, decided on 2020 to now, 2010-19 as replication. It does not repeat `research/edge/gold-weekend`
(that study decided how the daily systems treat the Sunday stub candle; it traded no gap).

## The rule (as pre-registered)

Friday's close = the close of the last M5 candle before Friday 17:00 New York; the reopen = the first M5 candle at or after
Sunday 17:00 New York (stray weekend prints never used); gap = reopen open − Friday's close; ATR = mean true range of the 20
complete 17:00-New-York days to Friday's. Eligible: 0.25 x ATR ≤ |gap| ≤ 1.5 x ATR.

- **Rule G**: at the reopen candle's close, trade toward Friday's close; target = Friday's close, stop the same distance
  beyond the entry (1R), out at Monday 12:00 New York; stop checked first; no trade when the first candle already closed
  through Friday's close or the risk is under 0.1 x ATR.
- **Rule H**: the same, entering at the first M5 close one hour after the reopen, if Friday's close has not been touched yet.

Data: OANDA spot gold mid M5, through the council's candle proxy, October 2009 to 12 Nov 2026 (1.22 million candles in the
window; a sampled window was checked against a fresh proxy answer, identical). Costs: $0.30 a round trip (also $0.60),
financing by `council/fills.mjs` `financing()`: 0 on every trade (no hold crosses a 22:00 UTC weekday rollover).

## Results

| Rule | Window | n | win | gross R | net R ($0.30) | net R ($0.60) | t (trades) |
|---|---|---|---|---|---|---|---|
| G | 2020 to now | 41 | 46 % | −0.086 | −0.109 | −0.131 | -0.78 |
| G | 2010-19 | 23 | 48 % | +0.052 | +0.007 | −0.038 | 0.04 |
| H | 2020 to now | 38 | 50 % | −0.086 | −0.110 | −0.133 | -0.76 |
| H | 2010-19 | 20 | 55 % | +0.028 | −0.005 | −0.038 | -0.03 |

- Totals 2020 to now after $0.30: G −4.45R (worst drawdown 6.55R), H −4.16R (9.28R); t on calendar-month sums −0.69 and
  −0.69. Exits, G 2020 to now: 17 stops, 12 targets, 12 time exits. Median risk $19.9 (G), so the $0.30 cost is about
  0.02R: the loss is in the trade, not the cost.
- The bar, decisive window: net R > 0 at $0.30 (no, both), at $0.60 (no, both), Holm over the two rules at the one-sided
  t = 2 level (no: p 0.78 and 0.78), n ≥ 80 (no: 41 and 38), same sign on 2010-19 (G yes, +0.007R; H no).
- Weeks: 893 Fridays, 858 used (21 skipped with no Friday afternoon trading such as Good Friday, 10 with no Sunday reopen
  before 21:00 New York, 4 at the start without 20 days for ATR). 42 eligible weeks 2020 to now, 65 since 2010; Rule G
  skipped 1 (filled inside the first candle), Rule H 3 (filled within the hour) and 4 (risk under 0.1 x ATR).
- Rule G by year after $0.30 (n): 2020 −0.16 (5), 2021 −1.04 (1), 2022 +0.23 (7), 2023 −0.26 (4), 2024 +0.07 (5), 2025
  +0.18 (5), 2026 −0.32 (14). 2026 alone holds a third of the eligible weeks (gold's volatile year) and lost −4.42R.

## The plain fill rate (every week, not only the eligible ones)

Share of weeks in which price touched Friday's close between the reopen and Monday 12:00 New York, by |gap| / ATR.

| |gap| / ATR | 2010-19 | 2020 to now |
|---|---|---|
| under 0.25 | 437 of 484 (90 %) | 275 of 301 (91 %) |
| 0.25-0.5 | 9 of 15 (60 %) | 16 of 31 (52 %) |
| 0.5-1.0 | 1 of 7 (14 %) | 3 of 9 (33 %) |
| 1.0-1.5 | 0 of 1 | 0 of 2 |
| over 1.5 | none | none |

Up and down gaps fill alike (2020 to now, 0.25-0.5: 10 of 18 up, 6 of 13 down). Small gaps nearly always fill, but a small
gap is a few dollars and is within the cost and the first candle's noise; the gaps worth trading are the ones that fill
about half the time or less, which is what a 1R-for-1R trade loses on.

## Placebo (40 seeds, random direction on Rule G's own trades)

Mean net R 2020 to now across the 40 runs: median −0.012, 5th percentile −0.229, 95th percentile +0.200 (min −0.289,
max +0.238). Rule G's −0.109 sits inside the band, below the median (32 of 40 random runs did at least as well): the gap
direction carries no information here, and with about 40 trades the noise band (±0.2R a trade) is wider than any plausible
edge.

## What this does not say

- 41 trades cannot show a small edge either way; the claim is only that this rule, as written, did not pay on 2020-26 and
  could not meet the pre-registered sample. Larger gaps (over 1.5 x ATR) never occurred.
- OANDA's gold reopens at 18:00 New York in 750 of the 858 used weeks, so Rule H's entry was usually about 19:00 New York, not
  18:00 (the pre-registration ties it to the reopen candle, not to the clock).
- Post hoc, not tested: a lower gap threshold (more trades, but gaps under 0.25 x ATR are a few dollars), a target short of
  Friday's close, or a different exit time. None would be evidence without its own pre-registration on other data.

To repeat: `node --use-env-proxy research/edge/gold-weekend-gap/run.mjs fetch <dir>` (candles outside git), then
`CANDLES=<dir> node research/edge/gold-weekend-gap/run.mjs run`. Test: `tests/gold-weekend-gap.test.mjs`.
