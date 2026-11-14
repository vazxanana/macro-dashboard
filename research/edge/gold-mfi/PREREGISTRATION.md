# Pre-registration: does gold's volume say more than its price? The money-flow gap, judged against gold's own drift (14 Nov 2026)

Committed and pushed ALONE, before any return, trade or statistic of these rules was computed.

**Question.** Gene Quong and Avrum Soudack's Money Flow Index (1989) is an RSI-like oscillator in which each day's typical
price change is weighted by that day's volume. Take the same oscillator with every day's volume set to one (its price-only
twin). The difference between the two, the **money-flow gap**, is what volume adds beyond price: it is high when the up days
of the last two weeks carried more activity than the down days, more than the price path alone shows ("accumulation"), and
low in the opposite case ("distribution"). When the gap is unusually high for gold, does a buy at the next open do better
than the same buy taken on every day? And the mirror for sells?

**Why this topic.** A stand-alone gold rule of my own choosing, said as such; chosen from its published origin and the
volume-confirmation idea, not from any gold table. Dedupe (checked 14 Nov): no folder under `research/edge/`, no remote
branch and no line of the 14 Nov untested-backlog list names the Money Flow Index, money flow or a volume-weighted
oscillator. Closest done studies: `gold-obv-divergence` (on-balance volume against price), `gold-volume-spike` (one
abnormal-activity H1 candle), `gold-volume-profile`, `gold-amihud`, `volume-reversal` (backlog item 6, high / low activity
days), `metals-rsi2` and `gold-rsi-divergence` (price-only oscillators). This study isolates the volume part of an
oscillator by subtracting its price-only twin, and its primary test is an EXCESS over the same-side trade entered on EVERY
eligible day, so gold's rise from 2007 to 2026 cannot pass as an edge.

**Event count (checked before writing this, counts only, no return seen).** Plain MFI(14) crosses of 20 / 80 give 19 / 27
events in 2007-16 and 15 / 32 in 2017-26, too few for power; that design was dropped for this reason only. The gap's
trailing-decile rule below fires on about 10 % of days by construction (about 250 a window a side).

**Data caveat.** OANDA's daily `v` is a count of price updates (ticks), not traded ounces. The gap only compares the ticks
of up days with those of down days inside the same 14 days, so the long-run growth of the tick count cancels; it is still
a proxy for activity, said as such.

**What this is not.** Not a gate, exit, entry, filter or size of the live gold book (Gold trend + Gold daily engulf); it
reads nothing of it; owner decision 44 is untouched. Paper research only: nothing live changes.

## Data (fixed before any result)

- Market: **spot gold only (XAU/USD)**, OANDA mid daily candles with volume, council-data `research/daily/xau.json`
  (`git show origin/council-data:research/daily/xau.json`, no network; kept outside git). Rows start March 2006.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (prices); their volume is ADDED to
  that weekday's volume. Complete days only.

## The indicator (N = 14, look-back L = 252)

- Typical price TP = (high + low + close) / 3. On the close of day i, over days k = i-13 .. i: a day is UP when
  TP[k] > TP[k-1], DOWN when TP[k] < TP[k-1] (equal: neither).
- MFI[i] = 100 x P / (P + D), P = sum of TP[k] x v[k] over UP days, D = the same over DOWN days (P + D = 0: 50).
- PFI[i] = the same with v[k] = 1 for every day (the price-only twin).
- **Gap G[i] = MFI[i] - PFI[i].**
- Thresholds from the L = 252 previous gaps G[i-252] .. G[i-1] only: hi = their 90th percentile, lo = their 10th
  (sorted values, linear interpolation). **Buy signal** on day i: G[i] > hi. **Sell signal**: G[i] < lo.
- ATR(14) = simple mean of the last 14 true ranges up to and including day i.
- Everything is read on the close of day i; the order fills at the OPEN of day i+1. Nothing of day i+1 or later is read.
  Signals start on the first day with 252 earlier gaps (about April 2007).

## The trade (signal and baseline alike)

- Enter at the open of day i+1 on the given side. **Every trade has a stop**: 2 x ATR(14) of day i from the entry, never
  moved, checked from the entry day on (a day opening beyond it fills at the open). Otherwise out at the open of day
  i+1+H. 1R = the stop distance; R = (exit - entry) x side / stop distance.
- Every signal day is its own trade (trades may overlap). The same trade is the **baseline**, entered after EVERY eligible
  day of the window (same side, same H): the baseline mean is gold's drift for that trade shape.

## Costs

- **$0.60 an ounce a round trip**, as 0.60 / stop distance in R.
- **Financing on buys**: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, demo broker XAUUSD swap of
  11 Nov 2026, `council/fills.mjs`) x entry / stop distance; sells charged and credited nothing. Today's rate every year.
- **2x costs**: $1.20 and twice the financing (signal and baseline both).

## The three tests

- **T1 (primary): high gap (accumulation), buy, H = 10.** Excess = mean net R of the signal trades minus the mean net R of
  the every-day buy (H = 10) in the same window.
- **T2: low gap (distribution), sell, H = 10.** Excess against the every-day sell (H = 10).
- **T3: high gap, buy, H = 20.** Excess against the every-day buy (H = 20).

## Windows

- **In sample**: entry day 2007-01-01 .. 2016-12-31. **Out of sample**: 2017-01-01 .. the last complete candle
  (November 2026). OOS halves (2017-21, 2022 on) reported only.

## Statistics

- Per test and window: n, R a trade gross and net (signal and baseline), excess net, excess at 2x costs.
- **Month t of the excess**: for each signal trade, x = net R - baseline mean net R (same window); x summed by the calendar
  month of the ENTRY, over every calendar month of the window (no entry = 0); t = mean / (sd / sqrt(months)), two-sided p
  from Student's t. Also reported: the plain month t of the signal's net R.
- **Holm** over the three OOS excess p-values.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1..40); each draws as many OOS entry days as the test has OOS signals,
  uniformly from the OOS baseline days, same side and H; its excess is recorded.

## Pass bar (per test; the study passes when T1 passes; T2 / T3 passing alone is reported, not a pass)

1. OOS excess t >= 2 with Holm p < 0.05;
2. IS excess > 0 (same sign);
3. OOS excess at 2x costs > 0;
4. OOS excess above at least 38 of the 40 placebos;
5. n >= 100 signals in each window (fewer: descriptive only).

Anything else is FAIL. No parameter (N, L, the deciles, H, stop multiple) will be changed after a result is seen; any
variant would be a new pre-registration on other data.
