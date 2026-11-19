# Pre-registration: volume-conditioned reversal of big daily moves on index, metal, energy and forex CFDs (14 Nov 2026)

Written and pushed alone, before any signal, trade, return or statistic of this rule was computed. Paper research only:
nothing here changes a council rule, a trade, the mirror or any live file. It is not a gate, exit, entry or size on the gold
book (owner decision 44): it is a cross-market study of one published idea. ICT is not involved.

## Question

The idea (candidate 6 of `research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`): a big daily move
made on LOW activity tends to reverse over the next days, while the same move on HIGH activity reverses less or continues.
Priors, from memory (the papers were not opened from this sandbox, so none of their figures is relied on): Campbell,
Grossman and Wang (Quarterly Journal of Economics 1993) and Llorente, Michaely, Saar and Wang (Review of Financial Studies
2002), both on stocks and stock indices. **Said now:** the published direction is not settled. Campbell, Grossman and Wang
report, as remembered, that price changes on HIGH volume reverse MORE (the backlog's own wording of candidate 6 follows
them); Llorente et al. tie continuation to high-volume informed trading and reversal to high-volume hedging. The rule tested
here was set by the request: fade big moves on LOW activity. The secondary test (low minus high) is two-sided and is read
by its sign: a negative value would agree with Campbell, Grossman and Wang.

Does a FADE (the side opposite to the day's move) taken at the close of a big-move, low-activity day, held 3 days with a
stop, make money on the council's own OANDA daily candles, net of the spread and the overnight financing?

**The volume proxy is noisy, said now.** OANDA's daily `v` is a count of price updates (quotes), not traded volume or
turnover. It grows many-fold over the years as quoting gets faster, and spot forex and metals have no exchange volume at
all. Only a detrended measure (the day against the market's own previous 50 days) is used. The proxy may not carry the
effect even if the effect is real; a FAIL here says nothing about the effect on real traded volume.

**Duplicate check (done before writing this).** `ls research/edge` on `origin/main`; remote branches matching
`reversal|volume|vol-spike`: `crypto-reversal`, `crypto-weekend-reversal`, `fx-asia-london-reversal`, `fx-reversal`,
`fx-weekly-reversal`, `index-long-reversal`, `wmr-fix-reversal`, `vol-spike-rebound`, `vol-spike-replicate`,
`vol-spike-replicate2`, `vol-spike-crypto`, `volume-premium`. A `git grep` of those branches' reversal and vol-spike study
files for "volume" or "quote count" finds nothing: none splits by activity (the `vol-spike-*` studies condition on realised
volatility). `volume-premium` (PR #993, FAIL: pooled OOS high-minus-all +2.69R a month net, t 1.99, Holm p 0.186; indices
alone t 3.52, reported) used the volume column, but for LONGS on high-activity days and with big-move days CAPPED OUT: this
study takes exactly the days that one removed, and fades them. The backlog's other daily-reversal families on indices
(`index-ibs`, `rsi2-*`, `turnaround-*`) are not conditioned on activity. Not a repeat.

What I expect, said plainly: little. Every daily reversal family on indices failed its replications, the proxy is weak,
and the pooled markets move together.

## Markets (fixed now, before any price or volume was read for this study)

The same 32 markets and data handling as `volume-premium`, from council-data `research/daily/<key>.json` (complete OANDA mid
UTC daily candles, columns `[t, o, h, l, c, v]`), read with `git show origin/council-data:research/daily/<key>.json` (no
network). Four groups:
- **Indices (17):** `spx500 nas100 us30 us2000 de40 uk100 fr40 eu50 ch20 nl25 es35 jp225 au200 hk33 cn50 sg30 in50`.
- **Metals (5):** `xau xag xpt xpd xcu`.
- **Energies (3):** `wtico bco natgas`.
- **Forex majors (7):** `eurusd gbpusd audusd nzdusd usdjpy usdcad usdchf`.
Left out, fixed now: agriculturals, bond CFDs, gold crosses, forex crosses and exotics.

Data handling, fixed now:
- **Rows before 2005-01-01 are dropped for every market** (the forex rows of 2002-2004 carry placeholder volumes of 1-2).
- Saturday / Sunday stub candles are folded into the next weekday by `council/fills.mjs` `foldWeekend` (imported).
- A candle with `v < 10` is a placeholder: it cannot be a signal day, and a 50-day volume window holding one gives no signal.

## Signal (day t; closes and counts up to and including day t only; days = the market's own folded candles)

- r(t) = ln(C(t) / C(t−1)).
- **Big move:** |r(t)| is in the top decile of its own last 100 days: at least 90 of the absolute returns of candles
  t−100 … t−1 are below |r(t)|. Needs 101 candles before t.
- **Volume class:** with the quote counts of candles t−50 … t−1 (all `v >= 10`), M = their median (the mean of the 25th and
  26th sorted values). **Low-volume** if V(t) < M; **high-volume** if V(t) > M; V(t) = M is neither (counted, not traded).
- Side: the fade is a SHORT after an up day (r > 0) and a LONG after a down day (r < 0).

## Trade (each signal day is its own trade; trades of one market may overlap)

- Entry at the close of day t, C(t). **Hold 3 candles**: out at the close of candle t+3.
- **1R = 1.5 × ATR(20)**, ATR(20) = the simple mean of the true range of the 20 candles ending on day t. **Every trade has a
  stop** 1R against the trade (absolute rule 1), checked on candles t+1 … t+3: a candle that OPENS at or beyond the stop
  fills at its open (gap fill, never better); a candle that touches it fills at the stop.
- Gross R = side × (exit − entry) / 1R. A signal day without 3 candles after it is not traded.

## Costs (each trade, in R of that trade)

- **Spread and slippage**, a round trip as a share of the entry price, as `volume-premium` (the `trend-breadth` table):
  indices 0.03 %, forex majors 0.015 %, gold 0.02 %, silver / copper / energies 0.10 %, platinum / palladium 0.20 %.
- **Financing** per rollover = `council/fills.mjs` `nights(entryEnd, exitTime)` (Mon-Fri 22:00 UTC, Wednesday three), a
  share of the entry price each night, charged on BOTH sides (assumed, conservative: a short is never credited): gold long
  0.0148 % (`FIN.xau.long`, the demo broker's long swap of 11 Nov 2026), gold short 0 (`FIN.xau.short`, same source), other
  non-forex 0.015 %, forex 0.004 % (the `trend-breadth` pre-registration's assumed rates; today's rate for every year).
  Entry time = the end of day t; exit time = the end of the exit candle for a close exit, its start for a gap fill, its
  start + 12 h for a stop inside the candle.
- **0 / base / 2 ×** costs (2 × = spread and financing doubled). Base decides; 2 × is part of the bar.

## Windows (by the signal day; fixed now)

- **In sample (IS):** 2005-01-01 to 2016-12-31 (144 calendar months).
- **Out of sample (OOS, decisive):** 2017-01-01 to 2026-10-31 (118 calendar months; November 2026 is incomplete, left out).

## Tests (calendar-month sums: a month's value = the SUM of the net R of the set's trades with a signal day in it; 0 if none)

- **Primary (T1):** low-volume fades, pooled over the 32 markets, net at base costs, OOS.
- **Secondary (T2):** low-volume fades minus high-volume fades, pooled: per month, the low sum minus the high sum.
- **Groups (T3-T6):** low-volume fades of each group (indices, metals, energies, forex), net, OOS.
- t = mean / (sd / √n) of the window's month values (Newey-West t with 3 lags reported beside, not deciding). p two-sided
  from the normal distribution of t. **Holm** step-down over the six tests T1-T6 at α = 0.05.
- **Placebo (deciding):** 40 seeded runs (seeds 1-40, mulberry32). Each run draws, for every market, as many days as that
  market's OOS low-volume signals, at random without replacement from that market's OOS big-move days of EITHER volume
  class (low, high or neither), each faded, and computes the pooled OOS mean month value at base costs. It asks whether the
  volume class adds anything to fading a big move.
- Reported only: a second placebo of random eligible days (any move size) with a random side.

**PASS only when ALL hold:**
1. T1 OOS mean month value at base costs > 0 with **t >= 2** and a **Holm-adjusted p <= 0.05**.
2. **Same sign in IS:** T1 IS mean month value at base costs > 0.
3. **2 × costs:** T1 OOS mean month value at 2 × costs > 0.
4. **Placebo:** the real T1 OOS mean is above at least 38 of the 40 placebo means.

Anything else is FAIL. A group or T2 passing its Holm test without T1 does not make a PASS (reported). A PASS leads at
most to a proposal in `research/proposals/`; with hundreds of decisive tests run before this one, it would be a lead to
replicate on other markets or years, not an edge. A FAIL is not evidence that the opposite works.

## Reported, never judged

The four groups (low and high fades, each group, IS and OOS, gross and net); high-volume fades on their own; per trade
gross / spread / financing / net, stops and gap fills; by market; by year.

## What it cannot show

- A quote count is not volume; spot forex and metals have no central volume. Price series without dividends. Assumed
  spreads and financing, today's rates for every year. Overlapping trades and co-moving markets: only calendar-month sums
  are tested.

To repeat (after the code exists): `node research/edge/volume-reversal/run.mjs` (reads council-data with `git show`, no
network; writes `result.json` and `RESULT.md`). Tests: `tests/volume-reversal.test.mjs`.
