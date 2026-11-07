# Meridian exits: does any exit beat the live one? (8 Nov 2026)

**Short answer: no exit gives Meridian an edge.** Every exit loses after costs on every setup group. One exit, **half off at +1R with the rest trailing**, loses less than the live exit on the live-rule book. It passes the owner's overfitting guard: better in both halves and on 4 of 6 markets. It is recorded as a paper comparison column in the nightly replay (`R_pt1`). Live exits are unchanged; changing them is the owner's call.

Entries were out of scope (another branch tests entry filters). This study changes only how a filled trade is managed.

## What was tested

- **Replay.** `council/backtest.mjs`, unchanged except for a `BT_DUMP` hook. The hook writes each filled trade and the 1m candles it was managed on. Settings are the live `config.json` of 7 Nov: buffer 0.15, minimum stop 1.1 ATR, minimum reward:risk 1.2.
- **Window.** 365 days, 7 Nov 2025 to 7 Nov 2026, split at 9 May 2026. The 1m data starts 16 Oct 2025, to give the indicators time to warm up.
- **Candles.** OANDA spot through `meridianx.dev/md/bars` for gold, EUR/USD, GBP/USD, AUD/USD, USD/CAD and USD/CHF: about 390k 1m candles per market, with OANDA's own 1h, 4h and 1d candles.
- **Fills.** 18,686 fills (the backtest's live entry style: a limit order, or market when price is already through). Of these, 14,236 are engine Meridian trades (scalp, intraday, swing, rscalp, rintra, rswing). 2,965 of them pass today's live rules: the config filters plus reward:risk ≥ 1.2.
- **Paired test.** Every exit is replayed on the same fills and the same candles (`research/edge/meridian-exits/exits.mjs`). The simulator reproduces the replay's own live result (`R_none`) on **14,387 of 14,387** closed trades.
- **Costs and conventions.** Costs come from `costOf`: one spread per trade, in R. On a candle that touches both stop and target, the stop counts. Stop moves take effect from the next candle, as in `trader.mjs`. A trade still open at the end is marked to market in every variant.
- **Crypto is not in the 365-day test.** `api.kraken.com` and Binance are blocked from this session's network. The nightly 30-day replay (`backtest.json`, Kraken and Binance) already says enough: engine trades on BTC, ETH, SOL and XRP lose about −2.4R a trade net, because Kraken's fees are 0.65% a round trip against tight stops. The four exits in that file (none, break-even at +1R, break-even at +1.5R, second target) are all within 0.1R of each other. No exit can rescue that.

## The live exit

The live exit is the engine's stop, then the engine's target (t1), with no break-even, no trail and no time limit. This is `trader.mjs` for every engine setup, since `config.be` is null and `config.target` is empty. `config.focusSetups` is empty since `scalp-shadow-research`, so today the live-rule book is a paper book.

## Variants (trail timeframe: M5 for scalp/rscalp, M15 for intraday/rintra, H1 for swing/rswing)

| name | rule |
|---|---|
| `live` | Engine target, no break-even. |
| `be1` | Break-even at +1R, engine target. |
| `partial` | 50% off at +1R. The rest: stop to entry, then trails 1R behind the best price. No target (cap 10R). |
| `r2` / `r3` | Fixed 2R or 3R target instead of the engine's. |
| `struct` | From +1R the stop trails the last confirmed swing (2 candles each side, 0.1 ATR beyond it) of the trail timeframe. Engine target kept. |
| `time` | Out at market after 4 candles of the setup's trigger timeframe (scalp 1 h, intraday 4 h, swing 16 h) unless the trade has reached +0.5R. Otherwise the engine target. |
| `atr` | From +1R the stop trails 2× ATR(14) of the trail timeframe behind the best price. No target (cap 10R). |

## Results: Meridian live-rule book (config filters + minRR, all setups pooled, 2,965 trades)

| exit | n | win% | net R/trade | total R | max DD | t | 1st half | 2nd half | paired vs live (t) | markets beating live | guard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **live** | 2965 | 24.7 | −0.239 | −708.4 | −712.6 | −7.5 | −0.202 | −0.279 | | | |
| be1 | 2965 | 17.4 | −0.237 | −702.9 | −703.6 | −9.4 | −0.212 | −0.264 | +0.002 (0.1) | 4/6 | fails (1st half) |
| **partial** | 2965 | 47.3 | **−0.195** | −578.4 | −578.4 | −10.2 | −0.171 | −0.221 | **+0.044 (1.7)** | 4/6 | **passes** |
| r2 | 2965 | 29.9 | −0.226 | −669.9 | −670.6 | −8.9 | −0.192 | −0.263 | +0.013 (0.6) | 3/6 | fails (markets) |
| r3 | 2965 | 22.3 | −0.229 | −679.0 | −683.7 | −7.5 | −0.208 | −0.252 | +0.010 (0.5) | 4/6 | fails (1st half) |
| struct | 2965 | 35.0 | −0.219 | −648.8 | −650.7 | −9.3 | −0.188 | −0.252 | +0.020 (0.9) | 3/6 | fails (markets) |
| time | 2965 | 24.2 | −0.226 | −670.1 | −675.8 | −7.6 | −0.205 | −0.249 | +0.013 (1.0) | 4/6 | fails (1st half) |
| atr | 2965 | 40.7 | −0.212 | −629.6 | −630.1 | −9.2 | −0.196 | −0.230 | +0.027 (1.1) | 4/6 | passes |

Net R a trade by market:

| exit | XAU | EUR/USD | GBP/USD | AUD/USD | USD/CAD | USD/CHF |
|---|---|---|---|---|---|---|
| live | −0.107 (454) | −0.446 (510) | −0.213 (610) | −0.214 (223) | −0.144 (681) | −0.322 (487) |
| partial | −0.109 | −0.300 | −0.199 | −0.113 | −0.205 | −0.184 |
| atr | −0.143 | −0.291 | −0.213 | −0.158 | −0.220 | −0.207 |
| time | −0.085 | −0.409 | −0.181 | −0.217 | −0.190 | −0.278 |

## Results by setup (net R a trade, live → best alternative)

`research/edge/meridian-exits/tables.md` has every setup, both universes (all signals and rule-passing), every exit and every market.

| setup | universe | n | live | partial | be1 | r2 | r3 | struct | time | atr | passes the guard |
|---|---|---|---|---|---|---|---|---|---|---|---|
| scalp | rule-passing | 1547 | −0.280 | −0.208 | −0.266 | −0.264 | −0.266 | −0.241 | −0.246 | −0.229 | partial, time |
| scalp | all | 7719 | −0.167 | −0.157 | −0.165 | −0.171 | −0.171 | −0.163 | −0.157 | −0.157 | time |
| intraday | rule-passing | 626 | −0.110 | −0.111 | −0.132 | −0.108 | −0.100 | −0.110 | −0.126 | −0.108 | r3 (+0.009) |
| intraday | all | 1791 | −0.095 | −0.118 | −0.112 | −0.134 | −0.151 | −0.111 | −0.083 | −0.121 | none |
| swing | rule-passing | 87 | −0.043 | −0.195 | −0.011 | −0.110 | −0.041 | −0.174 | −0.081 | −0.177 | none |
| swing | all | 212 | −0.109 | −0.144 | −0.091 | −0.085 | +0.000 | −0.144 | −0.046 | −0.180 | r3 |
| rscalp | rule-passing | 398 | −0.445 | −0.309 | −0.396 | −0.343 | −0.338 | −0.375 | −0.454 | −0.350 | partial, r2, r3 |
| rintra | rule-passing | 276 | −0.056 | −0.135 | −0.134 | −0.118 | −0.194 | −0.110 | −0.028 | −0.140 | none |
| rswing | all | 111 | −0.123 | −0.051 | −0.154 | −0.121 | +0.126 | −0.146 | −0.164 | −0.082 | none |
| all engine | all | 14236 | −0.148 | −0.149 | −0.153 | −0.160 | −0.163 | −0.147 | −0.143 | −0.155 | time (+0.005) |

## Reading it honestly

1. **No exit makes Meridian positive.** The best number in the whole study is swing with a 3R target over all signals, at +0.000R over 212 trades with t 0.0. Losses are the entry's, and the cost against small stops (scalp ≈ 0.13R a trade). `research/edge/scalp-exits` found the same for Scalp on 8 years of M1.
2. **The guard alone lets chance through.** 8 exits × 15 slices gives 105 comparisons. "Better in both halves and on 4 of 6 markets" would pass roughly 1 in 10 coin-flip exits (rough estimate), and 12 passed here. Most of those passes are tiny (+0.005 to +0.01R) or rest on under 400 trades.
3. **Why partial is the one recorded.** It is the strongest pass on the book that would trade live: +0.044R a trade, t 1.7, −130R less loss, and −134R less drawdown over the year. The gain comes from the M1-triggered setups: scalp +0.072R (t 2.2, 4/5 markets) and rscalp +0.137R (5/6 markets). It is the same idea that held on 8 years of HistData in `research/edge/scalp-exits`: half at 1R, +0.023R a trade in-sample and out-of-sample, t 2.1–3.1.
4. **Where partial fails.** It does not help on intraday, swing or rintra. On swing it is clearly worse (−0.15R): those trades need the full engine target. On the whole shadow book it is flat (−0.001R).
5. **Any adoption would be per setup.** If the owner ever adopts it, it should apply only to scalp and rscalp. The forward column below is what should decide that, not this replay.

## What was recorded (paper only)

- **The column.** `council/backtest.mjs` has a fifth management variant, `pt1`: half off at +1R, the rest's stop to the entry, then trailing 1R behind the best price, no target (cap 10R).
  - The nightly 30-day replay writes it as **`R_pt1`**, the last column of `backtest.json` `tradeCols`, so older column indexes hold.
  - It also appears as `pt1` in `overall`, `bySetup`, `byMarket`, `byRR` and `bySetupCond`.
- **No effect on existing output.** A trade's status, MFE and the signal de-duplication still follow the four existing variants. The other columns are unchanged: pinned-clock reruns (gold + EUR/USD over 25 days, gold + USD/CAD over 15 days) give identical rows and stats, with only the order of rows and setup keys different. `R_pt1` is null while that exit is still running at the end of the window.
- **The column matches the study.** It equals the research simulator's `partial` on all 227 closed gold trades checked.
- **Nothing trades on it.** The Coach, `trader.mjs`, the live trades and the config are unchanged. The Coach's break-even and target learners read only `R_none`, `R_be1`, `R_be15` and `R_tp2`.
- **How to judge it forward.** In the nightly `backtest.json`, take scalp and rscalp trades that pass the live filters, and compare `R_pt1 − cost` with `R_none − cost` signal by signal. The bar is set beforehand: 300+ trades opened after 8 Nov, better in both halves and on most markets. Even then it is still a losing setup unless the entry improves.

## Reproduce

```
for m in xau eurusd gbpusd audusd usdcad usdchf; do
  mkdir -p R/$m && cp <council-data>/config.json R/$m/
  BT_DUMP=R/$m BT_MARKETS=$m node council/backtest.mjs R/$m 365
done
node research/edge/meridian-exits/exits.mjs R R/result.json
node research/edge/meridian-exits/analyze.mjs R/result.json <council-data>/config.json R/tables.md
```

A 365-day market takes about 6 minutes: about 117 OANDA calls, then 105k replay steps.
