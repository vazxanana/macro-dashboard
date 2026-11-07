# Crypto trend v3: does the edge still hold? (7 Nov 2026)

Paper research only. Nothing live was changed: the rule, `config.json` and the Trader are as they were. Moving the rule to
shadow is the owner's decision (see "For the owner" at the end).

**Verdict: decayed.** The rule earned well from 2017 to May 2025 (+3.7R a position before 2024, +2.2R from Jan 2024 to May 2025).
From June 2025 to October 2026 it is flat to negative: 20 positions, −0.13R each (t −0.56). The Kraken cross-check is −0.25R
over 24. Fees do not explain this: they cost about 0.07R a position. The one pre-registered explanation, "only when BTC is
above its 200-day average", also fails. It explains the old bear years (2018, 2022) but not the recent fade: 16 of the
20 recent positions were in that regime and made −0.02R each. The rule's pre-registered criteria do read "regime-dependent",
but only because 2024 carries the late window (see Section 3). Read that way, the result would mislead.

## 1. The rule replayed (unchanged)

`council/trader.mjs` lines 616-676 (user rules `pairs-best` + `crypto-add`, v3 of 5 Nov). It runs on BTC, ETH, SOL and XRP.
Each coin has two independent slots, the 55-day and the 100-day breakout, and each slot holds one trade at a time.

- **Entry:** a daily close above the prior N highs. The Trader buys at market on its next run after that close, which is the next daily open.
- **Stop:** a fixed catastrophe stop at entry − 5 × ATR(20). That distance is 1R.
- **Exit:** a daily close under the N-day channel midpoint, which only ratchets up. The exit is at the next open.
- **Add:** one add when a daily close is ≥ +1R. It buys at the next open with its own stop 1R below and exits with the first unit.
- **Costs:** `council/fills.mjs` `costOf` per unit. Both legs are market orders: Kraken taker 0.40% in, 0.40% out, plus a 0.02% spread.
- **Not replayed:** the live −8R per-coin kill switch. It counts only from 5 Nov 2026.

A "position" is the first unit plus its add, in R of the first unit's risk. This is the robustness rebuild's unit. The council
replay counts the add as a separate trade, and `result.json` keeps both counts.

This replay reproduces the robustness rebuild: 124 closed positions, +2.84R each (t 3.72). The audit had 125 at +2.80R, and the
difference is one open position.

**Data:** Binance spot daily klines (public `/api/v3/klines`, UTC days) from the cache in `origin/council-data`
`research/candles/crypto1d/`. BTC and ETH start 2017-08-17, XRP 2018-05-04 and SOL 2020-08-11. All end 2026-10-31.

This is the earliest free daily history I could reach. From this sandbox, the egress proxy refuses Binance, Kraken, Bitstamp,
Yahoo, CryptoDataDownload, CoinGecko and Coin Metrics, so no longer series (for example Bitstamp BTC since 2011) could be pulled.

**Cross-check:** Kraken's own daily OHLC, the Trader's feed (`research/bars/<PAIR>-1440.json`, 720 candles, 2024-11-16 to 2026-11-06).

## 2. Year by year

Net of Kraken fees. Positions are grouped by entry year. The max DD is the drawdown of realised R within the period.

| Year | n | R/position net | t | max DD | total | cost/position |
|---|---:|---:|---:|---:|---:|---:|
| 2017 (from Aug) | 4 | +2.99 | 1.54 | −0.5R | +11.9R | 0.06R |
| 2018 | 3 | −0.67 | −3.67 | −2.0R | −2.0R | 0.03R |
| 2019 | 9 | +3.60 | 1.52 | −2.7R | +32.4R | 0.07R |
| 2020 | 19 | +6.90 | 2.02 | −7.2R | +131.2R | 0.07R |
| 2021 | 18 | +4.46 | 1.74 | −6.9R | +80.2R | 0.05R |
| 2022 | 6 | −0.84 | −7.60 | −5.0R | −5.0R | 0.05R |
| 2023 | 24 | +2.47 | 1.90 | −5.1R | +59.2R | 0.07R |
| 2024 | 16 | +3.11 | 1.71 | −2.5R | +49.7R | 0.07R |
| 2025 | 15 | −0.29 | −1.21 | −7.4R | −4.4R | 0.07R |
| 2026 (to Oct) | 10 | −0.10 | −0.30 | −3.3R | −1.0R | 0.09R |

| Window | n | R/position net | t | max DD | total |
|---|---:|---:|---:|---:|---:|
| All, 2017-26 | 124 | +2.84 | 3.72 | −10.0R | +352.1R |
| Before 2024 (early) | 83 | +3.71 | 3.47 | −10.0R | +307.8R |
| **2024-26** | **41** | **+1.08** | **1.44** | **−7.2R** | **+44.3R** |
| 2024-26 first half (2024-01 to 2025-05) | 21 | +2.24 | 1.58 | −2.5R | +47.0R |
| **2024-26 second half (2025-06 to 2026-10)** | **20** | **−0.13** | **−0.56** | **−5.0R** | **−2.7R** |
| Kraken candles, entries from 2025-03-17 | 24 | −0.25 | −1.32 | −8.3R | −5.9R |
| Binance, same window | 24 | −0.20 | −1.01 | −7.2R | −4.9R |

Counting units separately, as the council replay does, 2024-26 is +0.72R a unit (t 2.02, n 62) and the second half is −0.10R (n 28).
At twice the costs, 2024-26 is +1.01R and the second half −0.20R.

One position is open at the data's end: BTC 100-day, entered 2026-09-22. It is marked at −0.8R and left out of the stats.

By coin, 2024-26: BTC +0.98R (n 9), ETH +0.07R (11), SOL −0.25R (13), XRP +4.75R (8). In the second half every coin is
between −0.83R and +0.22R a position.

The positive 2024-26 average rests on one run. XRP's November 2024 breakout made +23.7R and +18.6R, one position in each slot.
To check how much each window depends on its biggest runs, I removed the best 5% of positions in every window with the same cut:

| Window | n | R/position |
|---|---:|---:|
| Before 2024 | 79 | +1.97 (t 3.01) |
| 2022-23 | 28 | +0.47 |
| **2024-26** | **39** | **+0.05 (t 0.25)** |
| 2024-26 second half | 19 | −0.26 |

The early edge survives losing its best runs. The recent one does not.

**Fees are not the cause.** With a 5 ATR stop, 1R is about 23% of price (median), so the 0.82% round trip costs about 0.07R.
The 1-2R a trade in #484 is the cost on tight-stop scalps, not on this rule. The fade is gross: −0.06R a position before costs
in the second half.

**Is the flat half just bad luck?** I ran a block bootstrap: draw 7 signal months from the 41 earlier months that had trades,
20,000 times. A result as bad as −0.13R a position comes up about 10% of the time. A best position no bigger than the recent
2.3R comes up about 9% of the time. Before June 2025, 26% of positions made ≥ 2R; since then, 1 of 20 has.

So the decay is likely, not proven. The rule earns from rare large runs, and none has come in 17 months.

## 3. The pre-registered decay explanation

I fixed this before computing the split (`PREREG` in `run.mjs`). Nothing was tuned afterwards.

- **Hypothesis:** the edge exists only when the BTC/USDT daily close is above its 200-day simple average on the signal day.
  The same rule applies to all four coins, with no other length or threshold tried. The 2024-26 fade would then be breakouts
  taken in a BTC downtrend.
- **Fit** on signals before 2024: in-regime > 0 and at least +0.5R better than out-of-regime.
- **Validate** on signals from 2024 on: in-regime > 0 with t ≥ 1.5 and at least +0.5R better than out-of-regime.

| | in regime (BTC > 200-day) | out of regime | difference | test |
|---|---|---|---:|---|
| Early (before 2024) | n 63, +4.83R (t 3.52) | n 16, −0.54R | +5.37R | fit: pass |
| Late (2024-26) | n 37, +1.26R (t 1.53) | n 4, −0.59R | +1.85R | validation: pass (letter) |
| Late, first half | n 21, +2.24R | n 0 | – | – |
| **Late, second half** | **n 16, −0.02R (t −0.07)** | n 4, −0.59R | – | **the fade is in regime** |

By the letter, the pre-registered criteria pass and the pre-registered verdict rule reads "regime-dependent".

The pass is hollow, though:

- The late in-regime result clears t ≥ 1.5 only through the first half, where no position was out of regime at all. That
  half also includes the XRP run.
- The hypothesis's own prediction is that in-regime breakouts keep the edge. In the second half, where the decay is, they
  made −0.02R over 16 positions.
- All 15 positions of 2025 were taken with BTC above its 200-day and lost −0.29R each.

The 200-day filter does avoid bear-market breakouts: 2018, 2022 and early 2026 all lost out of regime. It does not explain
why bull-regime breakouts stopped running.

`result.json` records both readings: `verdictPrereg: "regime-dependent"` and `explains.holds: false`, giving the final
`verdict: "decayed"`. The criteria I wrote checked the whole late window, not the half where the fade is. That was a flaw in
the pre-registration, and it is stated here rather than adopted.

Context only, not proposals: without the add, 2024-26 is +0.70R and the second half −0.01R. The 55-day slot alone has a second
half of +0.04R (n 13); the 100-day slot alone has −0.46R (n 7). No variant brings back an edge in the second half.

## 4. Verdict

**Decayed.** The rule had a large, broad edge in 2017-21 and a smaller one in 2023 to May 2025. That later edge is +0.05R a
position once the single XRP run of November 2024 is removed. Since June 2025 there is no edge, on Binance or on the Trader's
Kraken candles. The BTC-trend explanation does not account for it.

The evidence is moderate, not conclusive: about a 10% chance of a half this bad under the old behaviour. A fat-tailed trend
rule can go 17 months without a big run, and that is what this looks like.

## For the owner (decision, not done)

The rule is still live on paper (`config.cryptoTrend` = BTC, ETH, SOL, XRP; adopted 5 Nov 2026) with a −8R per-coin kill
switch counted from adoption. Options:

1. **Move it to shadow.** Remove the coins from `config.cryptoTrend` (user rule `pairs-best`) and let it keep recording as a
   shadow book. This is the conservative reading of "no edge for 17 months; the audit's 'robust' rested on 2017-21".
2. **Keep it on paper with the kill switch.** The switch already stops a coin at −8R forward. At the recent −0.13R a position
   and about one position a coin every 3-4 months, that would take many years to trigger. A tighter, portfolio-level stop (for example −6R
   across the four coins) would end the test sooner.
3. **Whichever you choose,** the robustness audit's "robust" label for the 2018-26 rebuild should carry this caveat: robust on
   2017-24, decayed since mid-2025.

Re-run this study after the next large crypto trend, or in 6 months:
`git fetch origin council-data && node research/edge/crypto-trend-decay/run.mjs`.
A new run of ≥ 2R positions in bull regimes would argue for revival; another flat half would confirm the decay.

Files: `lib.mjs` (data, the rule, statistics), `run.mjs` (the study, the pre-registration, the verdict) and `result.json` (every
table plus every position).
