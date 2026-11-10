# Scalp filters on 8 years of M1 (edge research: `scalp-filters`)

> **Clock correction, 10 Nov 2026.** NOT RE-RUN: the published numbers were computed on the old candle clock. Details: the last section of this page.

**Verdict: FAIL. The Scalp has no robust edge on any of the 10 markets tested, under any single or pairwise filter.**
That includes the owner's live rule (against D1, not Asia/overlap, no AUD/USD). The live rule loses **−0.20R a trade
in-sample and −0.20R out-of-sample after spread**, and it lost money in **every one of the 9 years**. Even with no costs
at all it is negative (−0.07R / −0.06R gross).

## What was run

- **Engine:** the live code, imported unchanged. That is `council/engine.mjs` (`msAnalyze`, `buildSetup` for `scalp`, M15 → M1),
  `council/choch.mjs` (`m15cFeat`) and `council/clean.mjs` (`cleanBars`, with the forex wick rule on the lower timeframes).
  The live Coach settings are used: buf 0.15, minRisk 1.1, minimum reward:risk 1.2.
- **Driver:** `scalp-long.mjs`, a long-history copy of the `council/backtest.mjs` replay loop:
  - a 5-minute step with 720-candle views (closed candles plus the forming one);
  - a READY signal, an unseen signature, a fresh M1 confirming break (≤ 12 candles), and no copy of an idea that is still open;
  - a limit order at the engine entry, or a fill at market when price is already through it;
  - an expiry after 3 h, or "missed" when the target trades first;
  - management on M1 to the stop or T1 (no break-even, which is the live config).
- **Data:** HistData M1 from 2018 to Oct 2026 (`research/candles/`, EST+5 → UTC). M5, M15, H1 and H4 are resampled from it, and D1
  uses New York close days. Every timeframe is cleaned like the backtest does.
- **Markets:** EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF, USD/JPY, gold, silver, NAS100 and SPX500.
  - Trading starts 2018-06-15, once D1 has more than 100 candles.
  - The replay produced 105,037 closed signals.
  - Applying the live minimum reward:risk of 1.2 and the live re-entry block (no Scalp the same way within 3 h of a Scalp loss)
    leaves 61,229.
- **Costs:** one round-trip spread per trade, as in `backtest.mjs`:
  - forex 1 pip (JPY 0.01);
  - gold $0.30;
  - silver $0.025;
  - NAS100 1.5 points;
  - SPX500 0.5 points.
  "Stress" charges two spreads, and the baseline is also reported at half a spread (a raw-spread account).
- **Walk-forward:** in-sample (IS) runs from 2018-06 to 2023 and out-of-sample (OOS) from 2024 to 2026-10. Rules were picked on IS only
  (IS n ≥ 300 and clustered t ≥ 2.5). Nothing qualified, so the 15 best IS expectancies were also carried to OOS.
  The t-statistics are clustered by market-day.
- **Differences from live:**
  - D1 comes from the M1 data, not OANDA's daily candles.
  - There is no news guard, because there is no news history.
  - There are no portfolio limits (exposure, USD cap).
  - HistData quotes are bid-side.
  - H4, H1 and M5 are analysed only when a Scalp is READY. That changes no signal.

## Baseline: the owner's live rule

These are the live markets minus AUD/USD (gold, EUR/USD, GBP/USD, USD/CAD, USD/CHF).

| | n | win% | R/trade | total R | max DD | worst streak | t |
|---|---|---|---|---|---|---|---|
| IS 2018–23 (net) | 5,252 | 28% | **−0.201** | −1,054 | −1,054 | 28 | −7.8 |
| OOS 2024–26 (net) | 2,602 | 28% | **−0.195** | −509 | −547 | 22 | −5.2 |
| OOS gross (no cost) | 2,602 | | −0.062 | | | | |
| OOS at half spread | 2,602 | | −0.128 | | | | |
| OOS stress (2 spreads) | 2,602 | | −0.329 | | | | |

By year (net R a trade): 2018 −0.14, 2019 −0.29, 2020 −0.22, 2021 −0.15, 2022 −0.17, 2023 −0.22, **2024 −0.20, 2025 −0.24,
2026 −0.14**. The baseline was negative in every year.

The rule went live on the strength of one 30-day replay that showed +0.33R a trade. Across 101 calendar months, "against D1, outside
Asia, live markets" had **no** month at +0.30R or better, and only 14 months were positive at all.

## Q1: is "against D1" robust out-of-sample? No.

| slice (net R/t) | against D1, IS | against D1, OOS | with D1, IS | with D1, OOS |
|---|---|---|---|---|
| all 10 markets, no other filter | −0.214 (19,388) | −0.181 (10,220) | −0.218 (20,469) | **−0.145** (11,152) |
| live markets | −0.185 | −0.173 | −0.208 | −0.150 |
| baseline's other rules (session, markets) | −0.201 | −0.195 | −0.210 | **−0.139** |

- In-sample, "against" and "with" are the same, within 0.03R.
- Out-of-sample, "against" is slightly **worse** than "with".
- Market by market, the sign of the against-minus-with gap flips between IS and OOS. The one market where it holds is gold
  (against −0.14/−0.05 vs with −0.24/+0.07), and both sides of it are flat or negative IS.
- D1 direction is not an edge for this setup. The 30-day window that suggested it was noise.

## Q2: which markets should Scalp trade? None, and that includes EUR/USD and GBP/USD.

This table uses the baseline rules (against D1, not Asia/overlap). Figures are net R a trade.

| market | IS | OOS | OOS stress | years positive (of 9) |
|---|---|---|---|---|
| **EUR/USD** | −0.235 (1,064) | **−0.259** (472, t −3.3) | −0.41 | **0** |
| **GBP/USD** | −0.151 (972) | **−0.142** (535, t −1.5) | −0.27 | 1 (2026 +0.13) |
| USD/CAD | −0.241 | −0.275 | −0.42 | 0 |
| USD/CHF | −0.177 | −0.201 | −0.35 | 2 |
| AUD/USD | −0.296 | −0.081 | −0.24 | 1 |
| USD/JPY | −0.318 | −0.046 | −0.18 | 2 |
| Gold | −0.192 (889) | −0.048 (372) | −0.12 | 1 |
| Silver | −0.660 | −0.483 | −0.75 | 0 |
| NAS100 | −0.175 | −0.203 | −0.25 | 0 |
| SPX500 | +0.002 | −0.168 | −0.23 | 5 (none of them in 2024–25) |

- EUR/USD has been negative every year since 2018, and GBP/USD every year except 2026 to date.
- Skipping them is right, but skipping them does not make the remaining markets profitable. Gold, the best live market, is still
  −0.05R a trade OOS after spread and only just positive gross.
- Before costs (OOS gross), every live market is between −0.13R (USD/CAD) and +0.03R (gold).
- With an average stop of a few pips, the spread costs 0.10–0.15R a trade, which turns flat into a clear loss.

## Q3: filters and stability

Every single condition was tested on the baseline. Each result below is negative IS and OOS (net R a trade, IS → OOS):

| condition | IS → OOS |
|---|---|
| H4 with | −0.20 → −0.22 |
| H4 against | −0.20 → −0.17 |
| H1 with | −0.19 → −0.19 |
| H1 against | −0.23 → −0.20 |
| main structure | −0.17 → −0.19 |
| internal structure | −0.28 → −0.20 |
| CF CHoCH | −0.15 → −0.14 |
| CF BO | −0.25 → −0.27 |
| fresh M15/M5 CHoCH yes | −0.22 → −0.27 |
| fresh M15/M5 CHoCH no | −0.20 → −0.17 |
| trader's M15 CHoCH yes | −0.32 → −0.40 |
| London | −0.18 → −0.10 |
| New York | −0.19 → −0.30 |
| late | −0.31 → −0.21 |
| Asia | −0.17 → −0.20 |
| overlap | −0.10 → −0.14 |
| reward:risk 1.5–2.5 | −0.18 → −0.20 |
| reward:risk 2.5–4 | −0.26 → −0.35 |
| reward:risk 4+ | −0.27 → +0.04 |
| ATR regime low | −0.36 → −0.30 |
| ATR regime mid | −0.18 → −0.12 |
| ATR regime high | −0.14 → −0.21 |
| buys | −0.22 → −0.22 |
| sells | −0.18 → −0.16 |
| limit entry | −0.20 → −0.23 |
| market entry | −0.20 → −0.13 |

**Pairwise** (784 pairs):

- No pair reached IS n ≥ 300 with a positive t ≥ 2.5.
- The 10 best pairs by IS expectancy are almost all SPX500 slices at +0.03 to +0.13R IS. **All ten are negative OOS**
  (−0.07 to −0.39R).
- The handful of pairs that look positive OOS were all negative IS, and their t is under 1. Examples:
  - gold + D1 with: −0.28 → +0.14;
  - gold + London: −0.25 → +0.15;
  - GBP/USD + market entry: +0.01 → +0.17.

  They are hindsight and should not be traded.
- The live re-entry block is the one thing that holds. Scalps taken within 3 h of a same-side loss lose −0.18 (IS) and −0.27 (OOS),
  against −0.20 / −0.20 without it. Keep the block if Scalp stays on at all.

**Stability:** the live rule was negative in all 9 years, and so was the unfiltered Scalp on the live markets (−0.15 to −0.27).
The result is a stable loss, not an edge that drifts in and out.

**Multiple testing:** 826 variants were tried (42 single conditions and 784 pairs). That is on top of the market, D1 and session
cross-tabs in `analysis-output.txt`. With this many tries a few OOS-positive slices at t < 1 are expected by chance.

## Recommendation (paper only; nothing was changed live)

- **Take the Scalp out of the live sleeve.** Keep it as a shadow, or switch it off. The rule it rests on ("against D1") is not supported
  by 8 years of data on any market.
- Skipping EUR/USD and GBP/USD is consistent with the data, but it is not enough. No market–filter combination for this setup passes
  the walk-forward.
- This matches earlier research. In `research/log.md`:
  - on 6 Nov, gold Scalp against D1 2023–26 lost −0.09 to −0.23 a year;
  - on 5 Nov, "desk Scalp (M15→M1 CF) found empty on long history".

  This run extends that finding to every FX pair, silver and the indices, across 2018–2026.

## Files

- `scalp-long.mjs`: the long-history Scalp replay, which uses the live engine.
  Run it as `node scalp-long.mjs <SYM> <candleDir> <outDir> [from] [to]`.
- `run-all.sh`: runs every market, 4 at a time.
- `analyze.mjs`: the filters, walk-forward, per-year stats and result.json.
- `analysis-output.txt`: the full printout, including every single condition and the per-year rows.
- `result.json`: the structured results.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. This study used the documented "EST, no daylight saving" reading (label + 5 hours all year), which is one hour late for the whole of Europe's summer, about seven months a year.

**Not re-run: computed on the old clock.** Reason: this is a long engine replay over 8 years of M1 candles for several markets, and the machine time was spent on the studies that feed a live system or the Academy. The loader is fixed, so the next run is on the corrected clock; the commands are on this page. Until then every number here is an old-clock number. What the old clock touched here: the session and overlap filters and the day rollover were an hour late in Europe's summer. The verdict (FAIL: the Scalp loses after spread in every one of 9 years) is about a setup that is not live.
