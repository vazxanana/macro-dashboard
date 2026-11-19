# Pre-registration: the high-volume return premium on index, metal, energy and forex CFDs, daily (14 Nov 2026)

Written and pushed alone, before any signal, trade, return or statistic of this rule was computed. Paper research only:
nothing here changes a council rule, a trade, the mirror or any live file. It is not a gate, exit, entry or size on the gold
book (owner decision 44): it is a cross-market study of one published effect. ICT is not involved.

## Question

The published claim (Gervais, Kaniel and Mingelgrin 2001, "The high-volume return premium", stocks; not opened from this
sandbox, so none of its figures is relied on): a day of unusually high trading volume, measured against the security's own
recent history, is followed by higher returns over the next one to twenty days, whatever the direction of that day's move.

Does a LONG bought at the close of a high-activity day, held H days with a stop, do better than the same long bought on any
day, on the council's own OANDA daily candles, net of the spread and the overnight financing?

**The volume proxy is noisy, said now.** OANDA's daily `v` is a count of price updates (quotes), not traded volume or
turnover. It grows many-fold over the years as quoting gets faster (the backlog notes about sixteen-fold on DE40 from 2003
to 2026), and for spot forex and metals there is no exchange volume at all. Only a detrended measure (the day against the
market's own previous 50 days) is used. The proxy may not carry the papers' effect even if the effect is real; a FAIL here
says nothing about the effect on real volume.

**Duplicate check (done before writing this).** `ls research/edge` on `origin/main` and every remote branch's studies
(`git grep` of every `research/edge/*/RESULT.md`, `PREREGISTRATION.md` and `run.mjs` across all 638 remote refs for
"volume", "quote count", "tick count", "high volume", "volume premium", "volume spike"). The `vol-spike-*` branches
(`vol-spike-rebound` #860, `vol-spike-replicate` #920, `vol-spike-replicate2` #951, `vol-spike-crypto` #962) condition on
REALISED VOLATILITY, not on activity. Volume appears elsewhere only as a calendar or thin-day filter (`santa-rally`,
`energy-seasonal`: a candle counts as a trading day when its volume is a share of the median; `fx-tokyo-orb`: a thin-range
skip) or as a "no volume filter" exclusion. The backlog (`research/proposals/2026-11-14-untested-backlog.md`, candidate 5)
says no study has used the volume column as a signal. This study is not a repeat. It differs from the backlog's wording in
one respect, set by the request: a time-series rule per market (each day against its own past), not a weekly cross-section.

What I expect, said plainly: little. The proxy is weak, the effect was measured on single stocks, and the pooled markets
move together.

## Markets (fixed now, before any price or volume was read)

From council-data `research/daily/<key>.json` (complete OANDA mid UTC daily candles, columns `[t, o, h, l, c, v]`; all
`status: ok` in `_index.json`), read with `git show origin/council-data:research/daily/<key>.json` (no network). Four
groups, 32 markets:
- **Indices (17):** `spx500 nas100 us30 us2000 de40 uk100 fr40 eu50 ch20 nl25 es35 jp225 au200 hk33 cn50 sg30 in50`.
- **Metals (5):** `xau xag xpt xpd xcu` (the gold crosses `xaueur xaugbp xauxag` are left out: the same metal again).
- **Energies (3):** `wtico bco natgas`.
- **Forex majors (7):** `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf` (long = long the first currency).
Left out, fixed now: agriculturals, bond CFDs, forex crosses and exotics.

Data handling, fixed now:
- **Rows before 2005-01-01 are dropped for every market** (the forex rows of 2002-2004 carry a volume of 1-2, placeholder
  prices; `fx-december-usd` and `jp-fiscal-yearend` found the same). A later first candle (es35, cn50, in50, nl25, metals
  from 2005-2006) simply starts later; in50 ends 2022-07.
- Saturday / Sunday stub candles are folded into the next weekday by `council/fills.mjs` `foldWeekend` (imported): their
  open / high / low join Monday's, their quote count is dropped (Monday keeps its own `v`).
- A candle with `v < 10` is a placeholder: it cannot be a signal day, and a 50-day window containing one gives no signal.

## Signal (day t, closes and counts up to and including day t only; days = the market's own folded candles)

- **Volume rank.** V(t) = the candle's `v`. With the previous 50 candles t−50 … t−1 (all `v >= 10`):
  `above(t)` = how many of the 50 have V < V(t); `below(t)` = how many have V > V(t).
  - **High-volume day:** `above(t) >= 45` (V(t) is above at least 45 of the previous 50: the top decile).
  - **Low-volume day:** `below(t) >= 45` (the bottom decile).
- **Not a big-move day (cap).** r(t) = |ln(C(t) / C(t−1))|. With the absolute returns of the previous 50 candles:
  the day is eligible only if FEWER than 45 of those 50 are below r(t) (r(t) is not in the top decile of its own last 50
  absolute returns). **The cap applies to all three sets** (high, low and all days), so the comparison is volume and not
  move size.
- **All days:** every eligible day (cap met, 51 candles of history, ATR available, H candles after it on file).
- Needs 51 candles before t (50 for the window, one more for the first return). ATR(20) (below) needs 21.

## Trade (each signal day is its own trade; trades may overlap)

- **Long** at the close of day t, C(t). Hold H candles: **H = 5 (primary), H = 20 (secondary, reported only)**.
- **1R = 2 × ATR(20)**, ATR(20) = the simple mean of the true range (max of high − low, |high − previous close|,
  |low − previous close|) of the 20 candles ending on day t. **Every trade has a stop** at entry − 1R (absolute rule 1),
  checked on candles t+1 … t+H: a candle that OPENS at or below the stop fills at its open (gap fill, never better); a
  candle whose low touches the stop fills at the stop. Otherwise out at the close of candle t+H.
- Gross R = (exit − entry) / 1R. A signal day without H candles after it is not traded.

## Costs (each trade, in R of that trade)

- **Spread and slippage**, a round trip as a share of the entry price, the table of `research/edge/trend-breadth`'s
  pre-registration (`COST`): indices 0.03 %, forex majors 0.015 %, silver / copper / energies 0.10 %, platinum / palladium
  0.20 %; **gold 0.02 %** (written here: about $0.30 at $1,500, the flat cost the gold studies charge, and five times the
  demo broker's measured 0.0042 %). In R = cost × entry / 1R.
- **Financing** per rollover = `council/fills.mjs` `nights(entryTime, exitTime)` (Mon-Fri 22:00 UTC, Wednesday three);
  each night a share of the entry price: **gold 0.0148 %** (`council/fills.mjs` `FIN.xau.long`, the demo broker's XAUUSD
  long swap of 11 Nov 2026), **other non-forex longs 0.015 %** and **forex 0.004 %** (the `trend-breadth` pre-registration's
  assumed rates: about 5.5 % and 1.5 % a year, assumed, not measured; today's rate is charged for every year). In R =
  nights × rate × entry / 1R. Entry time = the end of day t (its start + 86,400 s, after that day's 22:00 rollover, so the
  first night counted is day t+1's); exit time = the end of the exit candle for a close exit, its start for a gap fill, its
  start + 12 h for a stop inside the candle.
- **0 / base / 2 ×** costs (2 × = spread and financing both doubled). Base decides; 2 × is part of the bar.

## The compared quantity (the primary)

For a high-volume trade i on market m with signal day in calendar month M:
`d(i) = netR(i) − bench(m, M)`, where `bench(m, M)` = the mean net R of every **all-days** trade of market m whose signal day
is in month M (the same H, the same cost multiple). The high-volume day itself is one of those all-days trades. The
benchmark is the same long on any eligible day of that market in that month, so the market's drift in that month cancels.

**Group month value** = the SUM of d(i) over the group's high-volume trades whose signal day is in that calendar month;
a calendar month of the window with none counts as 0. The same for low-volume trades (low − all, reported) and for
high − low (reported: per month, the sum of high d minus the sum of low d).

## Windows (by the signal day; fixed now)

- **In sample (IS):** 2005-01-01 to 2016-12-31 (144 calendar months).
- **Out of sample (OOS, decisive):** 2017-01-01 to 2026-10-31 (118 calendar months; the cache ends 2026-11-06, so
  November 2026 is left out as an incomplete month).

## Statistics and the judged test

- t = mean / (sd / √n) of the window's calendar-month values (a Newey-West t with 3 lags is reported beside it, not
  deciding: H = 20 trades overlap across months).
- **Five tests at H = 5, base costs, OOS:** the four groups (indices, metals, energies, forex) and the **pooled** set (all
  32 markets; the month value sums every market's d). **The pooled test is the primary.** Each test's p = two-sided, from the
  normal distribution of its t. **Holm** step-down over the five at α = 0.05.
- **Placebo:** 40 seeded runs (seeds 1-40, mulberry32). Each run draws, for every market, the same number of days as that
  market's OOS high-volume signals, at random without replacement from that market's OOS eligible days (all days), and
  computes the pooled OOS mean month value at base costs exactly as for the real set.

**PASS only when ALL hold:**
1. Pooled OOS H = 5 mean month value at base costs > 0 with **t >= 2** and a **Holm-adjusted p <= 0.05**.
2. **Same sign in IS:** pooled IS H = 5 mean month value at base costs > 0.
3. **2 × costs:** pooled OOS mean month value at 2 × costs > 0, **and** the high-volume longs themselves (their net R, not
   the difference) have a pooled OOS mean month sum > 0 at 2 × costs. The second half is added because costs nearly cancel
   in a difference of two longs: a premium that does not leave a trade positive after costs is not a trade.
4. **Placebo:** the real pooled OOS mean is above at least 38 of the 40 placebo means.

Anything else is FAIL. A group passing its own Holm test without the pooled test does not make a PASS (reported only). A
PASS leads at most to a proposal in `research/proposals/` and, because 333 decisive tests have been run with none surviving
a family correction, it would be a lead to replicate on other markets or years, not an edge. A FAIL is not evidence that the
opposite (shorting high-volume days) works.

## Reported only, never judged

- H = 20, the same five tests and the placebo-free numbers; low − all and high − low at H = 5 and 20; the cap removed
  (high − all without the absolute-return cap); per window counts of signals, mean gross / spread / financing / net R a
  trade for high, low and all trades, stops and gap fills; by group, by market, by year.

## What it cannot show

- A quote count is not volume; spot forex and metals have no central volume; index CFD quotes follow the futures only
  loosely. Price series without dividends (a CFD long is credited them; left out). Approximate, assumed costs and today's
  financing rates for every year. Overlapping trades within a market and markets that move together inflate trade counts:
  only calendar-month values are tested.

To repeat (after the code exists): `node research/edge/volume-premium/run.mjs` (reads council-data with `git show`, no
network; writes `result.json` and `RESULT.md`). Tests: `tests/volume-premium.test.mjs`.
