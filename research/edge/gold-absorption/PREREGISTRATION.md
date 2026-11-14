# Pre-registration: gold absorption days, effort without result (14 Nov 2026)

Written and pushed alone, before any figure of this study was computed. A stand-alone rule on spot gold: not a gate, exit,
entry or size of the live gold book, and none of its positions is read (docs/owner-decisions.md item 44 untouched). Paper
research only; nothing live changes and no proposal is written whatever the result.

## Idea

An old tape-reading idea (Wyckoff's "effort versus result"): a day with unusually heavy activity but an unusually small range
means the activity was absorbed. After a fall, heavy activity that cannot push price lower reads as buyers absorbing the
selling ("stopping volume"), so price should rise more than usual afterwards; after a rise, heavy activity that cannot push
price higher reads as supply, so price should rise less (or fall). No earlier study here measured it: `gold-volume-spike`
traded H1 activity spikes by candle direction, `gold-obv-divergence` on-balance volume against price, `gold-doji-reversal` and
`gold-inside-day` small bodies or ranges without activity, `gold-amihud` |return| per unit of volume as a regime, not a day's
event after a move. Checked against `research/edge/`, every remote branch name and the shared topic list on 14 Nov.

## Data (named before any result)

- Market: spot gold only, council-data `research/daily/xau.json` (`git show origin/council-data:…`, OANDA mid, UTC days,
  column `v` = OANDA's count of price updates, a proxy for activity, not traded volume). Weekend stubs folded into Monday with
  `council/fills.mjs` `foldWeekend` (Monday keeps its own count).
- No other market, no other file. No candle cache is written.

## Rule

For each day i (all inputs closed at day i's close):
- Activity ratio `va = v_i / mean(v_{i-50} … v_{i-1})` (detrends the quote count's growth).
- Range ratio `rr = (high_i - low_i) / ATR20` with ATR20 the mean true range of days i-20 … i-1.
- Effort / result `E = va / rr`. **Absorption day** = `E` above the 90th percentile of E over days i-250 … i-1 AND `va >= 1`.
- Prior move: `close_i < close_{i-10}` = after a decline; `close_i > close_{i-10}` = after an advance.
- Trade: enter at day i's close, out at the close of day i+5 (trading days of the folded series), stop 2 x ATR(20) of days
  i-19 … i (closed at entry), filled by `fills.mjs` `stopFill` on the first day that touches it. Every trade has a stop. Each
  event is its own trade (overlap allowed); R = move / stop distance.
- Costs: $0.60 a round trip (the $0.30 gold spread plus half a spread of slippage on each market order, as the 13-14 Nov gold
  studies), plus on buys `nights(entry, exit) x FIN.xau.long x entry` (the demo broker's XAUUSD swap of 11 Nov 2026, the cost
  model's named constant); sells are credited nothing. 2x costs = $1.20 and twice the financing.

## Tests (three, Holm over the three out-of-sample p-values, one-sided)

- **T1 (primary): buy after an absorption day that follows a decline, against the same buy on every other day after a
  decline.** Baseline = the identical long trade on every eligible after-decline day that is not an absorption day. Excess of
  an event = its net R minus the mean net R of the baseline trades entered in the same calendar year. Statistic: t of the
  calendar-month sums (month of entry) of the excess.
- **T2: sell after an absorption day that follows an advance**, excess against the same sell on every other after-advance
  day, built the same way.
- **T3: the T1 buy on its own**, net R (does it make money, drift included): t of calendar-month sums of net R.

Windows by entry date: in sample 2007-01 to 2016-12, out of sample 2017-01 to the last candle with a full five-day hold
(November 2026).

## Pass bar (per test; the verdict is T1's)

1. Out of sample statistic > 0 and month t >= 2;
2. Holm-adjusted one-sided p < 0.05;
3. In sample statistic > 0 (same sign);
4. Out of sample mean at 2x costs > 0 (for T1 / T2 the excess at 2x costs, the baseline charged 2x too);
5. Placebo: 40 seeded draws (seed 20261114 + k) replace each out-of-sample event by a random eligible non-event day of the same
   prior-move side in the same calendar year; the real statistic (mean excess, or mean net for T3) beats at least 38 of 40.

Expected: about 10 % of days are absorption days, about 250 a window, about half on each side, so 100-150 events a test and
window. If a test has fewer than 60 out-of-sample events it is reported "too few", never a pass.

Reported whatever the result: n, gross and net R, excess, month t, win rate, stops, Holm p, placebo, by year. A pass would be a
lead to replicate on silver and other metals with its own pre-registration, never an edge on its own; a fail ends the idea here.
