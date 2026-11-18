# Replica: do its sells really beat its buys?

Paper research only. No live rule, config, Trader or mirror setting was changed. Pre-registration: `PREREGISTRATION.md`
(committed alone, before any trade of this study was simulated).

**Question.** The replica's forward research stream (every signal of the replica rule on ten markets, 3-17 Nov 2026) showed
buys −0.41R a trade (n 522, t −7.83) and sells +0.26R (n 478, t 3.58) before costs. Is that split a property of the rule,
or of those two weeks?

**Verdict: FAIL, 0 of 3. The side split is a regime artefact of two weeks; the raw replica signal has no edge on either side
before costs, on any of the ten markets.**

- **T1, sells only** (pool of ten markets, net of the council's 17 Nov cost model): in sample −0.148R a trade (n 44,409,
  month t −8.19), out of sample **−0.196R a trade (n 44,458, month t −12.63)**. Before costs −0.004R and −0.001R: zero.
- **T2, sells minus buys** (per month, mean net R of the sells minus that of the buys): in sample +0.030R (48 months,
  t 1.77), out of sample **+0.007R (34 months, t 0.38)**, Holm p 1.00. The two-week gap was 0.67R a trade; on 2020-26 it is
  under 0.01R.
- **T3, with the market's 20-day move**: in sample −0.147R (n 43,226, t −8.29), out of sample **−0.194R (n 43,140,
  t −12.72)**; against the move −0.177R and −0.206R. Following the recent direction does not rescue it either.
- **Why it looked like a side effect.** In every market the side that won a month was the side of that month's own move in
  61 to 84 % of the months (gold 57 of 82, EUR/USD 56 of 82, USD/CAD 64 of 82, SOL 47 of 56). In 3-17 Nov the dollar rose
  and the coins fell: on forex the winning side was the rising-dollar side in all five pairs (EUR / GBP / AUD sells and
  CAD / CHF buys: +50.2R on 181 trades; the other side −123.6R on 208). That is a month's direction, not a rule property, and
  it cannot be known in advance (T3).
- **Every market loses after costs in both windows** (out of sample from −0.04R on gold to −0.48R on SOL a trade), and
  **before costs every market is within 0.05R of zero**. No market and no side has a gross edge to protect.
- **What costs do**: gold 0.034R a trade, forex 0.08-0.11R, BTC and XRP 0.10-0.12R, ETH 0.49R and SOL 0.45R. On ETH and SOL
  66 % and 72 % of the stops are under five broker spreads (the CFD spread is 0.17 % and 0.27 % of price, the M5 stops are
  a few tenths of a percent). The same mechanism shows in the demo fills (below).

So: no side rule is proposed. The replica's raw signal is a zero-gross, cost-negative stream everywhere it was measured.

## The three tests

| Test | IS (2020-23) | OOS (2024 - Oct 2026) | OOS one-sided p | Holm p | Pass |
|---|---|---|---|---|---|
| T1 sells, net R a trade | −0.148 (n 44,409, t −8.19) | −0.196 (n 44,458, t −12.63) | 1.00 | 1.00 | no |
| T2 sells − buys, mean a month | +0.030 (48 months, t 1.77) | +0.007 (34 months, t 0.38) | 0.353 | 1.00 | no |
| T3 with the 20-day move, net R a trade | −0.147 (n 43,226, t −8.29) | −0.194 (n 43,140, t −12.72) | 1.00 | 1.00 | no |

t = mean / (sd / √k) over the calendar months of the window (T1, T3: net R summed by month, a month with no trade is 0;
T2: months with at least five sells and five buys). The pass bar (pre-registered): OOS t ≥ 2, Holm one-sided p ≤ 0.05 over
the three tests, and the statistic positive in both windows. T2 is positive in both windows, but nowhere near the t.

Pool, every signal: in sample −0.162R a trade net (n 87,377), out of sample −0.200R (n 86,939); before costs −0.019R and
−0.010R. Buys alone −0.177R / −0.203R. At twice the costs the pool loses −0.31R / −0.39R a trade.

## By market (reported, not tested)

Net R a trade unless marked; "follow" = months in which the side that did better was the side of the month's own move.

| Market | Trades | Cost a trade (R) | Stops < 5 spreads | All IS, gross / net | All OOS, gross / net (t) | Buys OOS | Sells OOS | Sells − buys IS (t) / OOS (t) | Follow |
|---|---|---|---|---|---|---|---|---|---|
| xau | 16,606 | 0.034 | 0 % | −0.013 / −0.051 | −0.014 / −0.042 (−2.83) | −0.001 | −0.079 | −0.043 (−0.87) / −0.083 (−1.38) | 57 / 82 |
| eurusd | 17,546 | 0.107 | 0 % | −0.013 / −0.112 | −0.048 / −0.166 (−8.85) | −0.195 | −0.136 | +0.050 (1.15) / +0.059 (1.15) | 56 / 82 |
| gbpusd | 17,506 | 0.085 | 0 % | −0.015 / −0.090 | −0.023 / −0.121 (−8.74) | −0.123 | −0.120 | +0.010 (0.23) / 0.000 (0.01) | 57 / 82 |
| audusd | 17,673 | 0.082 | 0 % | −0.031 / −0.104 | −0.017 / −0.111 (−6.70) | −0.168 | −0.057 | +0.040 (0.71) / +0.117 (1.95) | 61 / 82 |
| usdcad | 17,903 | 0.105 | 0 % | −0.030 / −0.118 | −0.010 / −0.138 (−8.07) | −0.109 | −0.167 | +0.025 (0.57) / −0.058 (−0.84) | 64 / 82 |
| usdchf | 17,584 | 0.103 | 0 % | −0.031 / −0.131 | −0.030 / −0.135 (−8.72) | −0.126 | −0.144 | +0.065 (1.37) / −0.015 (−0.30) | 56 / 82 |
| btc | 17,748 | 0.124 | 5 % | −0.035 / −0.162 | −0.007 / −0.130 (−7.53) | −0.129 | −0.131 | +0.003 (0.05) / −0.004 (−0.11) | 40 / 56 |
| eth | 17,066 | 0.492 | 66 % | −0.008 / −0.575 | +0.017 / −0.428 (−19.82) | −0.404 | −0.450 | +0.010 (0.27) / −0.049 (−1.27) | 34 / 56 |
| sol | 17,241 | 0.446 | 72 % | +0.001 / −0.379 | +0.009 / −0.477 (−17.13) | −0.466 | −0.487 | +0.050 (0.89) / −0.019 (−0.44) | 47 / 56 |
| xrp | 17,443 | 0.096 | 0 % | −0.001 / −0.095 | −0.003 / −0.100 (−9.86) | −0.156 | −0.046 | +0.081 (2.08) / +0.107 (2.07) | 38 / 56 |

- Gold's sells did WORSE than its buys (gold rose through most of 2020-26), the opposite of the two forward weeks.
- XRP's sells beat its buys in both windows (t 2.08 and 2.07), one market of ten, untested, and both its sides lose after
  costs (sells −0.046R a trade out of sample). Not a finding; at most something to watch.
- Coins: IS is March 2022 to December 2023 (22 months); their files start in January 2022.

By year, net R a trade, buys / sells: 2020 −0.094 / −0.109, 2021 −0.163 / −0.067, 2022 −0.169 / −0.128, 2023 −0.238 /
−0.234, 2024 −0.173 / −0.207, 2025 −0.186 / −0.182, 2026 (to October) −0.258 / −0.200. No year has a positive side.

Forex by the dollar's side (EUR / GBP / AUD sells and CAD / CHF buys = dollar up): in sample −0.109 against −0.113R a trade,
out of sample −0.109 against −0.159R. The two forward weeks' +50R against −124R is that month's dollar, not a lasting lean.

## The forward stream beside it (descriptive)

council-data `research.json` of 17 Nov 2026, `k: 'replica'`, 3-17 Nov, closed and not void, net by `tradeCost` with the
same model: 1,000 trades, −0.094R a trade before costs (t −2.08), −0.30R after; buys −0.414R / −0.62R (n 522), sells
+0.256R / +0.051R (n 478). After costs even the sells are flat (t 0.69). Two weeks are about one sample month of the 82 above;
months with a spread that large exist in both directions.

The Replica demo account's copies (council-data `ctrader/mirror-10152148.json`, 157 copies 10-17 Nov): fills 0.062R a trade
worse than the council's entry (t 3.06). By market ETH +0.189R (t 3.26), SOL +0.143R (t 2.29), GBP/USD +0.071R, gold +0.027R,
EUR/USD +0.001R. Buys −0.003R, sells +0.127R: the side gap is a price basis between the council's feed and the broker
(gold: the broker fills buys $1.33 under and sells $0.84 under the council's mid at the median), so the cost is the average
of the two sides. Copies placed 5 minutes or more after the signal: +0.159R (n 23).

## Method

- **Signal**: `replicaSignals` copied verbatim from `council/trader.mjs` at run time (`research/edge/gold-systems/live.mjs`),
  evaluated at every M5 close with the closed M5 / M15 / H1 candles of that moment, keyed once by side and CHoCH candle
  time. Every signal; no `pass`, `v5`, H4, D1, volatility gate, risk rule or size.
- **Trade**: as the research rows: entry at the open of the next M5 candle (dropped if that comes over 15 minutes later);
  stop past the extreme by `max(0.1 × M15 ATR, 0.30)` on gold and `0.1 × M15 ATR` elsewhere, gold's round-number stop;
  2R target; out at the close of the first M5 candle 48 h after the fill; stop first in a candle, gapped stops at the open
  (`stopFill`); gold and forex candles while spot is shut skipped (`spotSkip`). 174,316 closed trades counted (2020 to
  Oct 2026); a trade still open when the files end is not counted.
- **Costs**: `council/fills.mjs` `tradeCost`, unchanged, with the 17 Nov 2026 cost model pinned in `run.mjs` `MODEL`
  (coins: their spread and demo entry fill as a share of the 17 Nov price). Gold buys pay overnight financing.
- **Candles**: council-data `research/candles/` (HistData M1 through `council/histdata.mjs`; Binance 5-minute for the coins),
  read with `git show`, no network. Live reads OANDA and Kraken: a different feed, which is why the per-market signal count
  (about 9-10 a trading day) runs a little above the forward stream's.
- **Departures from live**: entry at the next M5 open (live: the price of the run that sees the signal, a median 52 s after
  the CHoCH candle closes); exits managed on M5 candles instead of M1.

## Files

- `run.mjs` (`fetch <dir>`, `market <key> <dir> <out>`, `report <out>`), `months.json` (net R by market, month, side and
  20-day-move agreement: everything the tests and tables are computed from), `result.json`.
- Reproduce: `node research/edge/replica-sides/run.mjs fetch <candles>`, then `market <key> <candles> <out>` for the ten
  keys, then `report <out>` (about a minute in all). Test: `tests/replica-sides.test.mjs`.
