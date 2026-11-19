# Pre-registration: gold after a large Asian-session dollar move against the yen or the Australian dollar (14 Nov 2026)

Written and pushed alone before any gold outcome was computed. Paper research only. A **new stand-alone intraday rule on gold**:
not a gate, entry, exit or size of the live gold book, and nothing here reads or is compared with that book or its 2006-17
positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changes.

## Idea

The dollar's moves against the yen and the Australian dollar during the Asian session (00:00-07:00 UTC) carry Tokyo and Sydney
news, risk appetite and dollar flow before London opens. If gold's London and New York trading takes time to absorb a large
Asian dollar move, gold should drift in the dollar-weak direction over the rest of the UTC day after a large Asian fall of the
dollar, and the other way after a large rise.

Why it is not a duplicate: `gold-yen-surge` used USD/JPY's whole daily close-to-close move and held gold 1-3 days from the next
open; `gold-dollar-lead`, `gold-commodity-fx-lead`, `gold-currency-breadth` are weekly or daily; `gold-us-asia` and
`gold-asia-break` read gold's own Asian session; `risk-spill-jpy` traded the yen after the S&P session. No study here reads a
currency's Asian-session move and trades gold the same UTC day. The near misses named in the brief (Nikkei drop, carry crash,
euro divergence, low-vol hold, AUD haven day) are not re-tested.

## Data (named before any result)

- OANDA mid H1 candles via the site's proxy (`/md/bars`): `xau` (XAU/USD), `usdjpy`, `audusd`, June 2006 to 31 Oct 2026.
  Cache kept out of git (scratchpad) and deleted at the end.
- Market set: gold only is traded; USD/JPY and AUD/USD only give the signal. Nothing else is tested.

## Rule

- Asian move of a currency on UTC weekday d = ln(close of the 06:00 UTC H1 candle / open of the 00:00 UTC H1 candle); no value
  when either candle is missing.
- z = that move / the sample sd of the 60 previous valid Asian moves of the same currency (day d excluded; no z before 60).
- Gold trade on day d (a UTC weekday, not 25 Dec or 1 Jan, with gold's 07:00 and 19:00 UTC H1 candles present): entry at the
  open of the 07:00 UTC candle, out at the close of the 19:00 UTC candle (20:00 UTC), stop 1 x ATR(20) of gold's UTC daily
  candles (built from H1, weekdays) that ended before d (1R); stop checked first on each H1 candle, a gap through it fills at the
  candle's open. One trade a day; no overlap is possible.
- T1 (primary): USD/JPY z <= -1.5 (dollar falls against the yen in Asia): buy gold.
- T2: USD/JPY z >= +1.5: sell gold.
- T3: AUD/USD |z| >= 1.5: gold the same way as AUD/USD (AUD/USD up = dollar down: buy gold; down: sell gold).

Signal days, counted from the currency candles before this was written (no gold price outcome read): T1 184 in sample, 166 out of
sample; T2 131 / 156; T3 329 / 302 (eligible gold days 2,538 / 2,474). Every test has at least 100 events in each window.

## Costs

$0.60 a round trip (spread $0.30 + $0.15 slippage on each market order, as `gold-dollar-lead`) plus, on buys, `nights(entry, exit)`
x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD `swap.long` of 11 Nov 2026, `council/fills.mjs`) x entry,
divided by the stop distance. A 07:00-20:00 UTC hold crosses no 22:00 UTC rollover, so financing is 0 by construction; it is
computed anyway. Sells pay and receive nothing. Also reported at 2x costs.

## Windows and statistics

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- Baseline: the same trade, same side, on EVERY eligible gold day of the window (the every-day buy for buys, the every-day sell
  for sells). Excess = the test's mean net R a trade minus the mean of its trades' same-side baseline.
- t on calendar-month sums (every month of the window counted, an empty month 0): `t` of net R, `tExcess` of (net R - the
  same-side baseline mean). One-sided p of the out-of-sample tExcess (normal approximation); Holm over T1-T3.
- Placebo: 40 seeded draws of the same number of buys and sells on random eligible days of the window.
- Control (keeps drift and volatility, removes the signal's information): 40 seeded draws keeping each signal's calendar year and
  side: the same count of buys and sells per year on random eligible days of that same year.

## Pass bar (per test; the verdict is T1's)

All of, out of sample: Holm p of the excess <= 0.05; net t >= 2; net R > 0; net R at 2x costs > 0; net R above the placebo's
95th percentile and above the control's 95th percentile; and in sample excess > 0 (same sign); n >= 100 in both windows.
T2 and T3 can be reported as passing but do not change the verdict on their own. Any pass is a paper finding for the owner, not a
rule change.
