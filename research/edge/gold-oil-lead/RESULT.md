# Result: do big crude-oil days (and big copper days) lead spot gold? (14 Nov 2026)

**Verdict: FAIL, 0 of 3: a big WTI day does not lead gold over the next 3 days (follow, out of sample 2017-26: −0.028R a trade net, n 126, month t −0.47); the fade and copper fail too.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (committed and pushed alone before any number). Paper research
only, a **standalone cross-asset signal**: not a gate, entry, exit or size of the live gold book, and nothing here was
compared with or applied to that book (owner decision 44). No live rule, size, filter, stop, config, cost constant or
council member changed. No proposal is written.

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `wtico.json`, `bco.json`, `xcu.json` at commit
  `732f00c3` (gold 2006-03-20 to 2026-11-06), weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Oil,
  copper and gold days matched by their UTC day stamp.
- Signal: a day whose close-to-close return is beyond ±2 sd of the 60 returns before it (its own return not in the sd);
  known at 00:00 UTC the next day. Entry at the open of gold's first daily candle after the signal day, stop 2 x ATR(20)
  of gold (candles before the entry only), out at the close of the 3rd gold candle; one position at a time.
- T1 (primary) gold the same way as WTI; T2 gold the other way (fade); T3 gold the same way as copper. Brent with the T1
  rule is informational (B1, no test).
- Costs: $0.30 spread + $0.15 slippage on each of the two market orders = $0.60 a trade, plus financing on longs by
  `nights()` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap); shorts pay and earn nothing. The
  stop is wide (2 ATR, about $41 a trade in sample and $68-82 out of sample), so costs are small: 0.022-0.028R a trade.
- t on calendar-month sums of net R (every month counts, empty ones as 0), Holm over T1-T3 on the one-sided OOS p.

## The three tests

| Test | Window | Big days | n (long / short) | Win % | Stops | Gross R | Net R | Net 2x costs | Total net R | Month t gross | Month t net | Trade t |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 WTI, follow | IS 2006-04 to 2016 | 152 | 126 (56 / 70) | 41.3 | 16 | −0.069 | −0.094 | −0.118 | −11.80 | −1.31 | −1.77 | −1.63 |
| T1 WTI, follow | OOS 2017 to 2026-10 | 151 | 126 (52 / 74) | 46.8 | 16 | −0.006 | −0.028 | −0.050 | −3.49 | −0.10 | −0.47 | −0.49 |
| T2 WTI, fade | IS | 152 | 125 (68 / 57) | 54.4 | 8 | +0.075 | +0.049 | +0.023 | +6.12 | 1.48 | 0.97 | 0.86 |
| T2 WTI, fade | OOS | 151 | 125 (72 / 53) | 48.8 | 13 | +0.050 | +0.022 | −0.005 | +2.79 | 0.81 | 0.37 | 0.37 |
| T3 copper, follow | IS | 164 | 136 (69 / 67) | 47.8 | 18 | −0.018 | −0.043 | −0.069 | −5.90 | −0.40 | −0.99 | −0.80 |
| T3 copper, follow | OOS | 141 | 121 (60 / 61) | 53.7 | 12 | +0.092 | +0.067 | +0.041 | +8.07 | 1.46 | 1.07 | 1.08 |
| B1 Brent, follow (info) | IS | 175 | 147 (64 / 83) | 43.5 | 17 | −0.021 | −0.045 | −0.068 | −6.55 | −0.41 | −0.88 | −0.87 |
| B1 Brent, follow (info) | OOS | 163 | 135 (59 / 76) | 48.1 | 15 | −0.012 | −0.036 | −0.060 | −4.86 | −0.27 | −0.78 | −0.74 |

| Test | OOS p (one-sided) | Holm p | OOS t ≥ 2 and Holm < 0.05 | IS net > 0 | OOS net at 2x > 0 | OOS n ≥ 30 | Pass |
|---|---|---|---|---|---|---|---|
| T1 (primary) | 0.681 | 0.711 | no | no | no | yes | no |
| T2 | 0.356 | 0.711 | no | yes | no | yes | no |
| T3 | 0.142 | 0.427 | no | no | yes | yes | no |

## Placebo (40 seeds, OOS)

The same number of random eligible days of the test's signal market, given the real days' sides in a random order, the
identical trade and costs.

| Test | Real month t | Seeds with t ≥ 2 | Seeds at or above the real t | Median | 2nd lowest / 2nd highest of 40 |
|---|---|---|---|---|---|
| T1 | −0.47 | 0 | 15 | −0.56 | −2.72 / 1.17 |
| T2 | 0.37 | 0 | 10 | −0.16 | −2.00 / 1.69 |
| T3 | 1.07 | 0 | 4 | −0.10 | −2.88 / 1.57 |

Every real result sits inside its placebo spread.

## Reading

- Following oil loses a little in both windows (IS −0.094R, OOS −0.028R net) and Brent agrees; the inflation channel does
  not show up in gold's next three days. Fading oil is the mirror image, small and positive (IS t 0.97, OOS t 0.37) and
  under zero at 2x costs out of sample: not a lead either.
- Copper flips sign between the windows (IS −0.043R, OOS +0.067R, OOS t 1.07, 4 of 40 placebos at or above it): noise
  until shown otherwise on other data.
- "Gold leads oil" is not tradeable on gold and was not tested; gold's own extreme day into the next day failed in
  `gold-shock-revert`.

## What is not tested

Other thresholds, look-backs or holds, intraday entries at the oil settlement, silver or other metals as signal markets,
natural gas, any use inside the gold book. Nothing here should be re-cut on these windows; a further idea needs its own
pre-registration on other data.

## To repeat

`node research/edge/gold-oil-lead/run.mjs fetch <dir>` (git show from `origin/council-data`, no network; keep the copy out
of git), then `node research/edge/gold-oil-lead/run.mjs full <dir>`. Tests: `tests/gold-oil-lead.test.mjs`.
