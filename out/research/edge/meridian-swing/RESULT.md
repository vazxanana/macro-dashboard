# MERIDIAN Swing: do filters or exits give it an edge?

Paper research only. No live rule, config or trader code was changed.

## Short answer

**No. None of the 10 variants passes the bar, so no shadow stream was added.** The bar is n ≥ 30, |t| ≥ 2 and positive in both halves.

- **Swing (H4→H1) loses after costs.** All signals: −0.095R a trade, t −3.0, n 2,076, from 2017 to 2026. It is negative in both halves and in every year.
- **The owner rule (against D1) does not help.** −0.111R, t −2.2, n 807.
- **No filter makes it positive.** That includes ADX band, session, D1 + H4 alignment and W1 alignment.
- **The D1 ADX band does not replicate on OANDA.** Under the owner rule it is −0.003R, n 338. The swing-adx paper sleeve should stay a tag. For 2024–26 alone it is +0.207, n 80, t 1.2, which agrees with the regime study's OOS. 2018–23 is −0.069, n 226.
- **Exits: break-even, partial and trailing each cut losses but stay negative.** Each is t ≤ −2.3 on all signals.
- **Holding to target 2 is the only exit near zero.** On all signals it is +0.018R, t 0.35.
- **One near-miss: owner rule + hold to target 2.** +0.174R, t 1.97, n 807, with halves +0.166 / +0.181. It does **not** pass, and it is not robust:
  - It is one cell of a 48-cell grid.
  - Without USD/CHF it is +0.085 (t 0.9).
  - Sells are +0.025 and buys +0.337.
  - 2026 is −0.10.
  - Day-clustered t is lower.

## Data and method

- **Candles.** OANDA mid candles, the live Trader's gold and forex feed, read through the site's `/md/bars` proxy (`fetch.mjs`).
  - M5 from 2017-06-01 to 2026-11-06.
  - OANDA's own H1, H4 and D1, with warm-up.
  - Markets: XAU/USD, EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF.
  - Crypto is left out. Kraken's OHLC has only 720 candles, too short for a multi-year Swing sample.
- **Engine.** The live `council/engine.mjs` `buildSetup` (swing) and `buildRetrace` (rswing), with `msAnalyze` through the identical speed copy (`setups-promote/fastms.mjs`).
- **Loop.** The replay loop follows `council/backtest.mjs`:
  - a 5-minute step;
  - the last 720 closed candles of each timeframe plus the forming one;
  - READY with a CF ≤ 12 H1 candles old;
  - a resting order, or a market fill when price is already through the entry;
  - the 2-day expiry;
  - missed if target 1 trades first.
  - Settings: buf 0.15, minRisk 1.1.
- **Costs.** One spread per round trip, as `spreadOf`: 1 pip on forex, 0.30 on gold. Results are net.
- **Differences from `backtest.mjs`.**
  - Trades are managed on M5, not M1. The stop is checked before the target inside a candle.
  - Signal-level only: no exposure, USD or duplicate caps.
  - D1 label: the engine trend on the OANDA D1 candles closed before the UTC day, as `odTrend`.
- **Halves.** Split chronologically at 2022-02-21. Both t-stats are shown: the trade-level t, and t on daily sums across markets (`t (day)`).

## Results: Swing, net R a trade

| variant | n | win | avg R net | t | t (day) | 1st half | 2nd half | yrs + | pass |
|---|---|---|---|---|---|---|---|---|---|
| Swing, all signals (baseline) | 2076 | 30.3% | −0.095 | −2.99 | −2.54 | −0.128 | −0.062 | 0/10 | no |
| Swing, owner rule (against D1) | 807 | 29.9% | −0.111 | −2.17 | −1.89 | −0.133 | −0.093 | 1/10 | no |
| Retrace swing (rswing), all | 1106 | 55.9% | −0.074 | −2.48 | −2.37 | −0.047 | −0.102 | 2/10 | no |
| F1 D1 ADX 19.4–29.2 (the paper tag) | 784 | 32.0% | −0.067 | −1.34 | −1.13 | −0.143 | +0.010 | 4/10 | no |
| F1b ADX band, owner rule | 338 | 34.0% | −0.003 | −0.04 | −0.03 | −0.023 | +0.017 | 4/10 | no |
| F2 London + overlap only (07–16 UTC) | 1281 | 29.5% | −0.128 | −3.20 | −2.86 | −0.145 | −0.109 | 1/10 | no |
| F3 D1 and H4 trend with the trade | 1269 | 30.7% | −0.085 | −2.08 | −1.77 | −0.125 | −0.040 | 2/10 | no |
| F3b W1 trend with the trade | 1046 | 32.4% | −0.031 | −0.69 | −0.60 | −0.124 | +0.062 | 4/10 | no |
| E1 break-even at +1R | 2076 | 23.2% | −0.071 | −2.59 | −2.17 | −0.073 | −0.068 | 1/10 | no |
| E2 half off at +1R, rest to BE | 2076 | 48.6% | −0.061 | −2.61 | −2.18 | −0.057 | −0.065 | 1/10 | no |
| E3 hold to target 2 | 2076 | 19.1% | +0.018 | 0.35 | 0.30 | −0.030 | +0.066 | 6/10 | no |
| E4 trail H1 structure from +1R, no target | 2076 | 43.9% | −0.058 | −2.29 | −1.91 | −0.029 | −0.088 | 2/10 | no |
| E5 trail H1 structure from +1R, target 1 kept | 2076 | 44.7% | −0.058 | −2.37 | −1.99 | −0.058 | −0.059 | 2/10 | no |

The variants were fixed before the full sample was run. The exit × filter grid and the per-market tables are in `analysis.txt`. The probe of the near-miss is in `probe.txt`.

## Verdict

- **FAIL.** Nothing is added as a shadow stream, and no live rule changes.
- **Swing stays shadow.** On the live feed it is a −0.1R a trade setup.
- **Owner rule + target 2 (+0.17R, t 1.97).** Watch the swing shadows' `R_tp2` column in the 30-day replay for it. Promote it only on forward evidence that clears the bar.

## Reproduce

```
node fetch.mjs <candleDir>                                   # ~13 min, ~880 proxy calls
for k in xau eurusd gbpusd audusd usdcad usdchf; do node replay.mjs $k <candleDir> <outDir>/$k.json; done   # ~3 min each
node analyze.mjs <outDir> result.json && node probe.mjs <outDir>
node --test research/edge/meridian-swing/exits-test.mjs
```
