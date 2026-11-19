**Verdict:** FAIL: 0 of 2. A big WTI day did not lead USD/CAD the next day (2016 to 13 Nov 2026: 366 trades, −0.009R a trade after costs, month-sum t −0.29; 2006-15: −0.074R, t −2.47), and a big copper day did not lead AUD/USD by enough to clear the bar (+0.033R a trade, t 0.89, Holm p 0.38; 2006-15: −0.002R). Pooled: +0.012R, t 0.46, negative at twice the cost and in 2006-15. The two pairs move WITH their commodity on the same day (correlation −0.33 for oil / USD/CAD, +0.49 for copper / AUD/USD since 2016) and almost not at all the day after (−0.01 and +0.02).

# Does a big commodity day lead its commodity currency the next day? (14 Nov 2026)

Pre-registered in `PREREGISTRATION.md` (committed alone before any return of this study was computed). Paper research only:
no live rule, size, filter, stop, config, cost constant or mirror setting changed, and no proposal is written (both tests
failed). Not related to the gold book or the ICT edge.

**The rule** (fixed): on each 17:00 New York day d, when the commodity's close-to-close log return is above 1.5 x the standard
deviation of its 60 previous daily returns (day d excluded), trade the pair at day d + 1's open and close it at day d + 1's
close. T1: WTI (`wtico`) up = sell USD/CAD, down = buy. T2: copper (`xcu`) up = buy AUD/USD, down = sell. Stop 1 x ATR(20) of
the pair (days up to d), checked on every H1 candle (an open past the stop fills at that open). Costs: 0.3 pip spread, half a
spread of slippage on each market order, 22.5 USD per million a side, and one rollover (Wednesday three) at the policy-rate
difference less a 1 % a year markup for a trade held to the close. Data: OANDA mid H1 through the candle proxy, 3 Jan 2005 to
13 Nov 2026 (wtico 131,161 candles, xcu 121,083, usdcad 138,448, audusd 138,566), days built at 17:00 New York.

## The tests

| test | window | n | won | gross R a trade | net R a trade | net total R | month-sum t | Holm p | net at 2x cost | worst drawdown R | stopped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2016 to 13 Nov 2026 (decisive) | 366 | 49.5 % | +0.011 | −0.009 | −3.3 | −0.29 | 0.62 | −0.030 | −10.9 | 49 |
| T1 | 2006-15 (replication) | 357 | 42.9 % | −0.058 | −0.074 | −26.5 | −2.47 |  | −0.090 | −30.0 | 50 |
| T2 | 2016 to 13 Nov 2026 (decisive) | 375 | 49.6 % | +0.051 | +0.033 | +12.2 | 0.89 | 0.38 | +0.014 | −11.3 | 42 |
| T2 | 2006-15 (replication) | 345 | 48.1 % | +0.012 | −0.002 | −0.7 | −0.06 |  | −0.015 | −10.5 | 33 |
| Pooled | 2016 to 13 Nov 2026 | 741 | 49.5 % | +0.031 | +0.012 | +8.8 | 0.46 | — | −0.007 | −14.6 | 91 |
| Pooled | 2006-15 | 702 | 45.4 % | −0.024 | −0.039 | −27.2 | −1.57 | — | −0.053 | −32.3 | 83 |

Month sums over 131 months (2016 to November 2026) and 120 months (2006-15), months without a trade counted as 0. No stop was
filled at a gapped open (H1 forex candles inside one New York day open where the last closed). Costs took about 0.015R a trade
(T1 5.6R, T2 5.4R since 2016); the rollover about 0.004-0.005R (437 and 467 nights charged since 2016, carry −1.9R and −1.4R:
the markup outweighs the rate difference on most nights).

Checks of the bar (decisive n ≥ 30, net > 0, month-sum t ≥ 2 with Holm p < 0.05, net > 0 at 2x cost, replication net > 0):
T1 fails all but n; T2 passes n, net and 2x cost, and fails the t (0.89) and the replication (−0.002R); the pooled stream
fails the t, the 2x cost and the replication.

## Placebo (40 seeds: the same number of trades on random days of 2016-26, random sides, same stop, exit and costs)

| stream | placebo net R a trade, 5th / 50th / 95th | placebo month-sum t, 5th / 50th / 95th | placebos at or above the real net R |
|---|---|---|---|
| T1 | −0.066 / −0.021 / +0.035 | −2.00 / −0.62 / 1.19 | 15 of 40 |
| T2 | −0.069 / −0.029 / +0.019 | −2.23 / −0.87 / 0.55 | 0 of 40 |
| Pooled | −0.057 / −0.024 / +0.017 | −2.55 / −1.01 / 0.81 | 5 of 40 |

The placebo is not part of the bar. T1 sits inside the coin-flip range. T2 since 2016 did better than every one of its 40
placebos (post hoc reading, not a pass: a random day pays the same costs, so the placebo's middle is below zero, and the real
stream's lead over it is about 0.06R a trade); the same rule made nothing in 2006-15 (+0.012R gross, −0.002R net), so it is not
taken as a finding. Any further look at copper → AUD/USD needs its own pre-registration and data it was not chosen on.

## Descriptive context (not part of the pass)

Pearson correlation of the commodity's day-d log return with the pair's log return of the same New York day and of the next
day, over every day both have:

| pair | window | same day | next day | days |
|---|---|---|---|---|
| WTI → USD/CAD | 2016-26 | −0.33 | −0.01 | 2,805 |
| WTI → USD/CAD | 2006-15 | −0.49 | +0.02 | 2,577 |
| copper → AUD/USD | 2016-26 | 0.49 | +0.02 | 2,805 |
| copper → AUD/USD | 2006-15 | 0.53 | +0.01 | 2,526 |

The link is real and same-day: CAD strengthens with oil and AUD with copper within the same session. By the next session it is
gone (|r| ≤ 0.025 in both windows), which is what the trades show. Nothing here contradicts Chen, Rogoff & Rossi (2010): their
lead runs from the currency to the commodity at quarterly horizons, and no daily lead the other way is visible here.

## Decisions not in the brief, stated

- The council-data daily files (`research/daily/`) are UTC days; the brief's day is 17:00 New York, so every day was built
  from H1 candles (stated in the pre-registration before any result). The daily files were used only to see where the data
  starts.
- A day counts with at least 6 H1 candles, Monday to Friday (drops holiday stubs); the trade day is the pair's first counted
  day after d, at most 4 calendar days later.
- The rollover is counted for the 17:00 New York close of the trade day only (a trade open at its day's close is held over that
  rollover), with `council/fills.mjs` `nights` over that date's 22:00 UTC; a stopped trade pays none.
- Policy rates: the `usd`, `cad`, `aud` lines copied from `research/edge/fx-carry/rates.json` (branch `fx-carry`), which are
  written from memory and say so; rates held at their last listed value through 2026. They move the result by under 0.005R a
  trade.
- The decisive window runs to the last day on file (13 Nov 2026), the replication from 2006 (H1 reaches January 2005; 2005 is
  warm-up).

To repeat: `node --use-env-proxy research/edge/commodity-fx-lead/run.mjs fetch <dir>` (about 2 MB a market, kept out of
git), then `CANDLES=<dir> node research/edge/commodity-fx-lead/run.mjs run`. Tests: `tests/commodity-fx-lead.test.mjs`.
