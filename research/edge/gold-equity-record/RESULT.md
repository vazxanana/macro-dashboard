# Result: spot gold sold for five days after a US equity index closes at a 52-week high (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a 5-day gold sell after an S&P 500 52-week closing high beat gold's every-day sell by -0.065R net out of sample 2017-26 (n 145, month t -1.08); +0.135R in 2007-16.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any gold return after an event was
computed; only event dates were counted). The test ran once; nothing was changed after the first run. Paper research only:
a stand-alone gold rule, never a gate, entry, exit or size of the live gold book, and none of the book's 2006-17 positions
was read (owner decision 44). Nothing live changed and no proposal is written. Nothing here is an edge.

## The rule and the data

OANDA mid daily candles from council-data (`research/daily/xau.json` 2006-03-20 to 2026-11-13, `spx500.json`, `nas100.json`,
`us30.json` from 2003), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. A record day: the index closes at
or above every close of its 251 candles before. Gold is sold at the next gold open, held 5 gold candles, stop 2 x ATR(20)
above the entry (1R), one trade at a time. Costs $0.60 a round trip; a sell pays no financing (`council/fills.mjs`: only
gold buys are charged `FIN.xau.long`). Excess = net R minus the mean net R of the same sell entered on every gold candle of
the window. t on calendar-month sums of the excess.

## Results

| test | window | n | months | gross R | net R | excess R | month t (excess) | month t (net) | net at 2x costs | excess at 2x | stops |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 S&P 500 (primary) | 2007-16 | 111 | 52 | +0.089 | +0.071 | +0.135 | 1.39 | 0.73 | +0.053 | +0.134 | 16 |
| T1 S&P 500 (primary) | 2017-26 | 145 | 65 | −0.159 | −0.173 | −0.065 | −1.08 | −2.71 | −0.187 | −0.065 | 31 |
| T2 Nasdaq 100 | 2007-16 | 122 | 57 | −0.055 | −0.074 | −0.010 | −0.15 | −1.09 | −0.092 | −0.012 | 20 |
| T2 Nasdaq 100 | 2017-26 | 143 | 62 | −0.073 | −0.088 | +0.020 | 0.36 | −1.49 | −0.103 | +0.019 | 27 |
| T3 Dow Jones 30 | 2007-16 | 106 | 49 | +0.136 | +0.117 | +0.181 | 1.77 | 1.16 | +0.099 | +0.179 | 13 |
| T3 Dow Jones 30 | 2017-26 | 114 | 52 | −0.124 | −0.139 | −0.030 | −0.47 | −2.04 | −0.153 | −0.030 | 20 |

The every-day 5-day gold sell (the baseline) made −0.064R a trade net in 2007-16 (n 2,602) and −0.109R in 2017-26 (n 2,552):
gold rose in both windows, so every sell lost; the question was only whether record days lose less.

| test | placebo beaten (of 40) | control beaten (of 40) | control mean excess | one-sided p | Holm p |
|---|---|---|---|---|---|
| T1 | 1 | 1 | −0.007 | 0.86 | 1.00 |
| T2 | 25 | 22 | +0.020 | 0.36 | 1.00 |
| T3 | 6 | 29 | −0.071 | 0.68 | 1.00 |

Placebo: the same number of random index days of 2017-26; control: each event day replaced by a random non-event day of the
same calendar month (same drift and volatility, the record information removed).

## Reading

- In 2007-16 a sell after an S&P 500 or Dow record did lose less than an ordinary sell (+0.135R and +0.181R a trade, month t
  1.39 and 1.77), the story's direction. Out of sample it reversed: after an S&P 500 record the sell did 0.065R WORSE than an
  ordinary sell, worse than 39 of 40 random-day placebos and 39 of 40 same-month controls. The Nasdaq 100 shows nothing in
  either window. One window's sign does not survive the next.
- No test reaches the bar on any line: T1's out-of-sample t is negative, its net is negative at 1x and 2x costs, Holm p 1.00.
- Costs are small here (0.014-0.019R a trade: a 2 x ATR stop and no financing on a sell); the result is not a cost story.

Not an edge, not a filter, not a proposal; equity record days carry no measured information about gold's next five days.

## To repeat

`node research/edge/gold-equity-record/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), `… count <dir>`
(event dates only), `… full <dir>` (writes `result.json`). Test: `tests/gold-equity-record.test.mjs`.
