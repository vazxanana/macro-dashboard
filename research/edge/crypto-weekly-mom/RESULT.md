# Result: weekly time-series momentum in crypto, out of sample (13 Nov 2026)

**Verdict: FAIL, 0 of 2.** On 2022-26 (the decisive window, fully after the paper's sample) the one-week momentum book did
worse than holding the coins: long / flat Sharpe 0.367 against buy and hold's 0.442 (month-sum t 0.77), long / short Sharpe
0.199 (t 0.51). Neither passes a single one of the four pre-registered checks. Not an edge; no proposal; nothing live changed.

Rule, sizing, stop, costs and bar as in `PREREGISTRATION.md` (committed first): every Monday 00:00 UTC, per coin, long when the
past week's close-to-close return is above zero (V1 long / flat; V2 short when below), 40 % annual volatility target (30-day
EWMA, cap 2x), equal weight across the coins available, a 3 x ATR(14) daily stop on every position, the council's CFD crypto
round trip (`CFD_CRYPTO`, 0.04 %) every week a coin is held, and the demo broker's crypto CFD financing (15 % a year on longs;
shorts 7.5 % BTC, 10 % ETH, 15 % SOL and XRP; `ctrader/symbols.json` of 13 Nov 2026, cTrader swap type 1 = percent a year).

Data: Binance spot daily (council-data `research/candles/crypto1d/`): BTC and ETH from 2017-08-17, XRP from 2018-05-04, SOL from
2020-08-11, all to 2026-10-31. Decisive window: 251 full weeks, 2022-01-03 to 2026-10-19, 58 months.

## Decisive window, 2022-01-03 to 2026-10-19

| Book | Return a year | Volatility | Sharpe | Month-sum t | Worst drawdown | Holm p | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|
| V1 long / flat | +9.6 % | 26.0 % | 0.367 | 0.77 | -36.0 % | 0.441 | 35 of 40 | no |
| V2 long / short | +6.4 % | 32.4 % | 0.199 | 0.51 | -44.3 % | 0.441 | 33 of 40 | no |
| Buy and hold (equal weight, no costs) | +28.1 % | 63.6 % | 0.442 | 0.84 | -74.9 % | | | |

- **Before costs** V1 had Sharpe 0.568 (+14.8 % a year), V2 0.507 (+16.4 %). Financing is the larger cost: 4.6 % a year on V1,
  8.5 % on V2 (shorts pay too); the CFD round trip 0.7 % and 1.5 %. Charging the round trip only on the change of position
  (reported, not tested) barely moves it: V1 Sharpe 0.378, V2 0.219.
- **The placebo** (random weekly signs per coin, same sizing, stops and costs, seeds 1-40) has a 95th percentile of 0.522 (V1)
  and 0.635 (V2): the real books sit inside the random ones. Long / flat placebos earn part of the market's drift too.
- **By coin** (each coin's contribution to the book, decisive window): V1 BTC Sharpe 0.30, ETH 0.43, SOL -0.01, XRP 0.35;
  V2 BTC -0.01, ETH 0.49, SOL -0.15, XRP 0.23. No coin carries it.
- **Year by year (V1 Sharpe):** 2022 -0.26, 2023 1.61, 2024 1.23, 2025 -0.49, 2026 (to October) -2.07. V2: 2022 1.21,
  2023 0.64, 2024 0.50, 2025 -0.92, 2026 -0.49. The two recent years lose in both.
- Positions in the decisive window: V1 470 (52 stopped, a coin held 47 % of the weeks), V2 1,004 (94 stopped).

## 2018-21 (reported, not part of the pass; 2018 overlaps the paper's sample)

V1 Sharpe 1.097 (+34.9 % a year, t 2.01, worst drawdown -32.5 %) against buy and hold's 1.087 (+98.5 %, -82.7 %); V2 0.885
(t 1.79). The effect the paper describes is visible in the bull years up to 2021, as large as holding on a risk-adjusted basis,
and it is gone after: from 2022 the rule earns less than holding and is indistinguishable from random weekly signs.

## What it means

One-week momentum in these four coins is not a tradable rule for the council on today's costs: out of sample it did not beat
holding, the month-sum t is under 1, and random signs do as well. The paper's sample end (2018) was recalled from its working
paper and not re-checked against the published text. Today's financing rate is charged for every year (past rates unknown);
before any cost the decisive Sharpe is still near holding's and the t near 1, so the cost assumption does not decide the
verdict. Do not re-test longer look-backs (2-4 weeks) on the same window without their own pre-registration.

To repeat: `git fetch origin council-data && node research/edge/crypto-weekly-mom/run.mjs` (no network; about a second).
Tests: `tests/crypto-weekly-mom.test.mjs`.
