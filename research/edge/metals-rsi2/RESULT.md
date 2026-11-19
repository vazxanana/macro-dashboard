# Result: the frozen 2-day RSI pullback on gold and silver (13 Nov 2026)

**Verdict: FAIL** — gold and silver together lose −0.077R a trade after costs in 2016-26 (n 137, month t −1.79), 4 of the 5 pre-registered checks fail.

Silver loses on its own (−0.155R, n 59, month t −2.85), gold is flat (−0.017R, n 78), and the pool sits below even the
placebo's mean. Only the replication check holds, barely (2008-15 pooled +0.014R, t 0.29). The bar was fixed in
PREREGISTRATION.md, committed and pushed before any number was computed. Not an edge on metals; nothing live changed and no
proposal is written.

**Item 44**: this is a NEW stand-alone rule, not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf),
and it was decided on 2016 to now. It changes nothing about that book and says nothing about it.

| Window B, 2016 - 6 Nov 2026, net | n | R a trade | R a trade before costs | won | t trades | t months | worst drawdown |
|---|---|---|---|---|---|---|---|
| Pooled | 137 | −0.077 | −0.050 | 52.55 % | −1.97 | −1.79 | −11.11R |
| Gold (XAU/USD) | 78 | −0.017 | +0.008 | 60.26 % | −0.33 | −0.35 | −4.00R |
| Silver (XAG/USD) | 59 | −0.155 | −0.126 | 42.37 % | −2.72 | −2.85 | −9.66R |

| Window A, 2008 - 2015, net (replication) | n | R a trade | R a trade before costs | won | t trades | t months |
|---|---|---|---|---|---|---|
| Pooled | 96 | +0.014 | +0.037 | 68.75 % | 0.33 | 0.29 |
| Gold (XAU/USD) | 53 | +0.041 | +0.062 | 75.47 % | 0.74 | 0.71 |
| Silver (XAG/USD) | 43 | −0.019 | +0.007 | 60.47 % | −0.28 | −0.29 |

- **Checks** (all five needed): pooled net R a trade > 0 **no** (−0.077R); t on month sums ≥ 2 **no** (−1.79); same sign
  2008-15 yes (+0.014R); both markets positive **no** (gold −0.017R, silver −0.155R); beats the placebo **no** (placebo p95
  +0.087R).
- **The placebo** (40 seeds; each real window-B trade replaced by an entry the next open after a random day above the 200-day
  average, same hold, stop and costs) averaged **+0.026R** a trade, 95th percentile +0.087R, best seed +0.101R. Buying an
  oversold day did worse on metals than buying a random day in an uptrend.
- **Costs are not the reason**: before any cost the window-B pool is already −0.050R a trade; the round trip and financing take
  about 0.027R a trade (financing about 0.017R; a trade holds about 4 trading days, 5.9 rollovers).
- Silver lost in every year of window B that it traded (2016-17, 2019-26; no trade in 2018). Gold was positive in 2018, 2019,
  2022, 2024 and 2025 and negative in the other six years.
- The two metals move together: 20 of gold's 78 window-B entries fell on a day silver also entered.
- Against the indices: the same file made +0.06R to +0.11R a trade on US index CFDs (`rsi2-pullback`, PR #838) and failed on six
  non-US indices (`rsi2-replicate`, PR #844); on metals it loses. The oversold bounce of stock indices is not a property of
  gold or silver.

## How it was run
- The rule is `rsi2-pullback.mjs`, the `rsi2-pullback` branch's `run.mjs` copied unchanged (sha256 pinned in the test): close
  above SMA200 and Wilder RSI(2) under 10 → buy at the NEXT day's open; exit at the open after the first close above SMA5; stop
  3 x ATR(20) from the fill, a gap below it fills at the open; one position per market. The brief that asked for this study listed
  "buy at the close", "exit after 10 days" and "stop 2.5 x ATR"; it also said to copy the frozen rule when the branch can be
  fetched, which it could, so the frozen rule was used (said in PREREGISTRATION.md before any result).
- Data: OANDA mid daily candles from council-data `research/daily/xau.json` and `xag.json` (20 Mar 2006 to 6 Nov 2026), weekend
  stubs folded into Monday with `council/fills.mjs` `foldWeekend` (5,365 weekday candles each, no gap over four days).
- Costs: a round trip of $0.30 (gold) and $0.03 (silver); financing = `council/fills.mjs` `nights` x `FIN.xau.long` (0.000148 of
  price a rollover, today's demo rate, used for every year) x entry; silver at the same fraction of its price (no silver swap is
  measured in the repository).
- Caveats: OANDA's daily close is 00:00 UTC, not a New York or London fix; spreads are stated, not measured on the broker; the
  financing rate is today's for every year; the placebo trades may overlap each other.
- Not tested, and not to be tuned on these windows: other RSI thresholds, a short side, other exits or stops on metals. Any of
  them needs its own pre-registration on data this study did not read.

To repeat: `node research/edge/metals-rsi2/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then
`node research/edge/metals-rsi2/run.mjs full <dir>`. Tests: `tests/metals-rsi2.test.mjs`.
