# Result: gold back at its rising 50-day average after a run away from it, on H4 (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold's return to its rising average lost −0.228R a trade against the every-candle buy in 2017-26 (n 106, month t −1.66), after +0.150R in sample.**

Pre-registered in [PREREGISTRATION.md](PREREGISTRATION.md) (pushed alone before any outcome was computed; only signal counts
were taken first). Paper research only, a **stand-alone rule**: not a gate, entry, exit or size of the live gold book, and it
reads none of that book's positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council
member changed. No proposal is written.

## What was tested

- Data: OANDA mid H4 XAU_USD, UTC-aligned, through the site's candle proxy: 33,581 candles, 2006-03-19 to 2026-10-30 (kept
  out of git, deleted after the run).
- d = (close − SMA of 300 H4 closes) / ATR of 42 H4 candles. Buy: the average rising over 30 candles, the previous close more
  than 1 ATR above it, this close back within ±1 ATR, and price at least 3 ATR above it in the last 120 candles. Sell: the mirror.
- Entry at the next H4 open, stop 3 x ATR (1R), out at the close of the 30th candle (about 5 trading days). Each signal its own
  trade. Costs $0.60 a round trip plus financing on buys, `nights()` x `FIN.xau.long` (0.000148 of price a rollover).
- Tested statistic: excess = net R − the mean net R of the same side entered at EVERY H4 candle of the window (same stop, hold,
  costs). t on calendar-month sums, Holm over T1-T3. IS 2007-16, OOS 2017 to Oct 2026.
- Signals: IS 143 buys / 120 sells, OOS 106 buys / 104 sells.

## The three tests

| Test | Window | n | Baseline net R | Excess R a trade | Month t excess | Net R a trade | Month t net | Gross R a trade | Net at 2x costs |
|---|---|---|---|---|---|---|---|---|---|
| **T1 buy, rising average (primary)** | IS 2007-16 | 143 | −0.007 | +0.150 | 0.94 | +0.142 | 0.90 | +0.221 | |
| **T1 buy, rising average (primary)** | OOS 2017-26 | 106 | +0.100 | −0.228 | −1.66 | −0.129 | −0.95 | −0.054 | −0.203 |
| T2 sell, falling average | IS 2007-16 | 120 | −0.072 | −0.112 | −0.97 | −0.184 | −1.55 | −0.152 | |
| T2 sell, falling average | OOS 2017-26 | 104 | −0.148 | +0.330 | 1.82 | +0.182 | 1.05 | +0.213 | +0.151 |
| T3 both | IS 2007-16 | 263 | by side | +0.030 | 0.31 | −0.006 | −0.07 | +0.051 | |
| T3 both | OOS 2017-26 | 210 | by side | +0.048 | 0.43 | +0.025 | 0.23 | +0.078 | −0.028 |

Holm-adjusted one-sided p (OOS excess): T1 0.952, T2 0.105, T3 0.670. OOS halves, net R a trade: T1 2017-21 −0.361 (n 53),
2022-26 +0.104 (n 53); T2 +0.205 (n 65) and +0.143 (n 39). One position at a time (reported only), OOS net: T1 −0.212 (n 57),
T2 +0.072 (n 61), T3 −0.068 (n 118).

## Placebo and control

| Test | Placebo (40 random OOS candles, same side): rule beats | Placebo median excess | Control (candles shuffled within each year, rule re-run): rule beats | Control median excess |
|---|---|---|---|---|
| T1 | 2 of 40 | −0.004 | 4 of 40 | −0.001 |
| T2 | 40 of 40 | −0.001 | 39 of 40 | −0.069 |
| T3 | 30 of 40 | +0.007 | 31 of 40 | −0.010 |

## Reading

- **T1, the primary, fails every OOS check**: the return to a rising average was a WORSE buy than buying any H4 candle of
  2017-26 (−0.228R, t −1.66), below 38 of 40 placebos and 36 of 40 shuffled paths. Its in-sample excess (+0.150R, t 0.94) did
  not repeat; the 2017-21 half lost −0.361R a trade net. In a market that rose most of the decade, "support at the average"
  bought the dips that kept going.
- **T2 is the one lead, and it does not pass**: selling the return to a falling average beat the every-candle sell by +0.330R
  out of sample (t 1.82, Holm p 0.105, beats 40 of 40 placebos and 39 of 40 controls) but lost in sample (−0.112R excess,
  −0.184R net). Opposite signs in the two windows: noise or a regime effect, not a rule. Not to be traded; a replication would
  need its own pre-registration on other data (silver, or gold before 2007 is too short).
- No parameter, window or market was changed after the counts. Nothing live changes.

## Files

`PREREGISTRATION.md`, `run.mjs` (`fetch` / `full`), `result.json` (every test, baselines, placebo and control summaries, the OOS
trades), `tests/gold-h4-average-retest.test.mjs`. To repeat: `node --use-env-proxy research/edge/gold-h4-average-retest/run.mjs
fetch <file.json.gz>`, then `node research/edge/gold-h4-average-retest/run.mjs full <file.json.gz>`.
