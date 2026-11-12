# Five filters on the shadow scalp / intraday setups: result

Pre-registration: `PREREGISTRATION.md` (committed alone first, 12 Nov 2026). Paper research only: nothing live changed, no
proposal written. ICT is not part of it; the gold book (Gold trend, Gold daily engulf) is not touched (owner item 44).

**Verdict: INCONCLUSIVE: the pre-registered bar passes 4 of 5, but a random filter of the same size passes it too (4 of 5 placebos)**

Plainly: the pre-registered statistic (the R a month a filter saves) cannot tell a good filter from a coin flip, because
the whole family loses about 0.22R on every trade: removing ANY share of its trades "saves" R. So the four passes say
nothing. What can be read (post hoc, labelled so below): the family loses in every setup, every market and both windows
with or without each filter; only the minimum stop of 8 spreads picks clearly worse trades, and almost all of that is
cost; the 07:00-13:00 UTC window picks slightly worse trades out, before costs too (t −1.8 out of sample); H4 and
retiring the retraces pick nothing. **No filter turns any part of this family into something worth trading**: no proposal.

## What was run

- `run.mjs market <key>`: the `council/backtest.mjs` loop restricted to `scalp`, `intraday`, `rscalp`, `rintra`, with
  the engine, cleaner, `replayBar`, `tradeCost` and the HistData clock imported unchanged; live exit (engine target, no
  break-even); `buf` 0.15, `minRisk` 1.1. Every READY signal, no minimum reward:risk or other filter.
- Gold and the five forex markets: HistData M1, trades 1 Jan 2020 to 31 Oct 2026 (warm-up from Jul 2019), all four setups.
- BTC, ETH, SOL, XRP: Binance 5-minute candles, trades 1 Mar 2022 to 31 Oct 2026, `intraday` and `rintra` only (no coin M1
  history in the repository), managed on 5-minute candles.
- 107,735 closed trades (IS 61,469; OOS 46,266). Per market: gold 14,082, EUR/USD 16,169, GBP/USD 16,905, AUD/USD 18,260,
  USD/CAD 17,839, USD/CHF 16,995, BTC 1,942, ETH 1,809, SOL 2,156, XRP 1,578. Costs: `tradeCost` (spread, CFD crypto
  fee, half a spread of slippage on market entries and non-target exits, gold-long financing).

## The baseline (the unfiltered family, net R a trade)

| | IS 2020-23 | OOS 2024-26 |
|---|---|---|
| All, net | −0.227 (n 61,469) | −0.223 (n 46,266) |
| All, before costs | −0.043 | −0.037 |
| scalp | −0.265 (31,495) | −0.266 (22,223) |
| intraday | −0.132 (8,786) | −0.112 (8,049) |
| rscalp | −0.232 (16,386) | −0.257 (11,458) |
| rintra | −0.129 (4,802) | −0.130 (4,536) |

Every market is negative out of sample (gold −0.129, forex −0.22 to −0.27, coins −0.06 to −0.16). Before costs the
family is near zero and slightly negative: the loss is the cost of many small trades.

## The five filters against the pre-registered bar

D = R a month the filter saves (minus the net R of the trades it removes); t on calendar-month sums; Holm over five.

| Filter | removed OOS | removed R a trade | kept R a trade | D IS | D OOS | t OOS | Holm p | D at 0.5x / 2x | bar |
|---|---|---|---|---|---|---|---|---|---|
| F1 no retrace | 15,994 | −0.221 | −0.225 | +4,414 | +3,528 | 14.544 | <0.001 | +1,957 / +6,670 | pass |
| F2 with H4 | 22,484 | −0.234 | −0.214 | +6,825 | +5,257 | 13.437 | <0.001 | +3,141 / +9,489 | pass |
| F3 stop ≥ 8 spreads | 19,396 | −0.373 | −0.116 | +8,897 | +7,233 | 19.77 | <0.001 | +4,179 / +13,340 | pass |
| F4 SOL/ETH cost cap | 3 | −1.008 | −0.223 | +8 | +3 | 1.083 | 0.143 | +2 / +6 | fail |
| F5 07-13 UTC | 32,912 | −0.236 | −0.193 | +10,100 | +7,759 | 17.462 | <0.001 | +4,710 / +13,856 | pass |

**The defect** (found on reading the first report, not foreseen in the pre-registration): a placebo that removes the
same share of trades by a fixed hash of the trade (no market fact) gets OOS t 13.17 (F1's share), 17.08 (F2), 16.56 (F3)
and 20.37 (F5). The bar is met by doing nothing smart. The pre-registered result is kept in `result.json`
(`barVerdict`: "PASS for F1, F2, F3, F5 (4 of 5)", `pass` per filter), but it is not read as evidence. The statistic the
caller's brief named first ("per-trade net R difference filtered vs unfiltered") is the one that answers the question;
it is reported below, post hoc.

## Post hoc: does the filter remove the WORSE trades? (not pre-registered)

Month by month, removed R a trade minus kept R a trade; t on those monthly differences (negative = removes worse trades).

| Filter | IS diff (t) | OOS diff (t) | OOS before costs (t) | kept book OOS, R a trade (monthly t) |
|---|---|---|---|---|
| F1 no retrace | +0.038 (1.55) | +0.008 (0.38) | +0.024 (1.07) | −0.225 (−14.5) |
| F2 with H4 | −0.001 (−0.05) | −0.023 (−0.85) | −0.019 (−0.71) | −0.214 (−12.6) |
| F3 stop ≥ 8 spreads | −0.239 (−16.08) | −0.257 (−13.28) | −0.035 (−1.80) | −0.116 (−9.6) |
| F4 SOL/ETH cost cap | n 5 / 3 trades | | | −0.223 |
| F5 07-13 UTC | −0.043 (−2.48) | −0.046 (−1.80) | −0.049 (−1.93) | −0.193 (−10.5) |

- **F1** points the wrong way: the retrace setups lose a little less per trade than the scalp and intraday setups they
  sit beside (rintra −0.13R; rscalp about as bad as scalp). Retiring them alone changes the family's R a trade by −0.002.
- **F2** selects nothing: with and against H4 lose the same (as `research/edge/scalp-filters` found for the Scalp).
- **F3** selects strongly after costs, weakly before (−0.035, t −1.8): a stop under 8 spreads pays its cost on a small
  risk. The kept book still loses −0.116R a trade (n 26,870, t −9.6).
- **F4** is untestable here: on the M5 setups the coins' cost is far under 0.5R (5 trades in IS, 3 in OOS). The week's
  SOL / ETH losses came from M1 scalps, for which the repository has no coin history.
- **F5** removes slightly worse trades, before and after costs, in both windows (IS t −2.5, OOS t −1.8); it is not
  significant out of sample and the kept book loses −0.193R a trade (n 13,354).

## What this means

- No filter, and no filter's kept book, is an edge (absolute rule 4: n and t above). No proposal is written to
  `research/proposals/` (the pre-registered pass is void for the reason shown).
- The one consistent fact is the cost: the family is about −0.04R before costs and −0.22R after. The week's shadow-book
  picture (−86.6R on retraces, −70.9R against H4, …) is what a book that loses on every slice looks like when it is cut
  after the fact.
- A new pre-registration, if the owner wants one, should judge a filter by the per-trade difference of removed vs kept
  (and against a placebo of the same size), not by R saved.

## Not done, said plainly

- No M1 history of the coins: the M1 setups (scalp, rscalp) and filter 4 on them are untested.
- The Trader's own setups (sweep, M15 CHoCH, m30m1) are not in the replay; nor the news guard, portfolio caps, the live
  minimum reward:risk or market / session rules. The replay is every engine signal, as the pre-registration fixed.
- HistData quotes are bid-side; spreads are the fixed `spreadOf` values, not the broker's of each hour.

## To repeat

```sh
node research/edge/shadow-scalp-filters/run.mjs fetch <candleDir>          # git show from origin/council-data, no network
node --max-old-space-size=3500 research/edge/shadow-scalp-filters/run.mjs market xau <candleDir> <outDir>   # each market; ~20-25 min for an M1 market, mostly loading
node research/edge/shadow-scalp-filters/run.mjs report <outDir>            # result.json
```

Tests: `tests/shadow-scalp-filters.test.mjs`.
