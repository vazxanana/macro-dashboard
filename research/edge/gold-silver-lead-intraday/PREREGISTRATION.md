# Pre-registration: does silver lead gold (or gold lead silver) by a few minutes inside the day? (14 Nov 2026)

Written and pushed before any return, signal count or trade is computed. Only `fetch.mjs` (the candle download) exists beside this
file; the silver download was started while this was written and nothing has been read from it. Paper research only.

## Why
Gold and silver move together, and silver is the thinner, more speculative market. If one of them reacts to news a few minutes
before the other, a large M5 move in the leader that the follower has not yet matched should be followed by the follower catching
up. This study asks whether that catch-up exists on gold, the owner's priority, and whether it is worth trading after costs.

## What has already been tested (dedupe)
- `gold-silver-divergence` (branch): H1, a gold 24-hour extreme silver does not confirm, fade and follow over 12 hours. FAIL
  (2020-now fade −0.084R, follow −0.075R a trade net; the silver condition adds nothing over a placebo). That is the session /
  extreme SMT idea on gold and silver, so the session-high SMT version is NOT repeated here.
- `mmxm-pdhl-raid-gold` (branch): silver SMT as a condition on a Day-3 gold raid, 2 trades in sample. `ict-smt`, `ict-smt-2008`:
  SMT between index futures, not metals.
- `gold-silver-ratio`, `gold-drd-silver`, `drd-metals-book`, `metals-intraday-momentum`, `metals-rsi2`, `post-holiday-metals`:
  daily ratio reversion, daily patterns on silver, the US-session intraday momentum of each metal on its own. None measures a
  minutes-scale lead between the two metals.
- `gold-oil-lead`: silver as a daily leader is an information row only. `bond-lead-intraday`: the intraday lead design mirrored
  here (shock in one market, trade the other at the next open, fixed hold, one position at a time, placebo by random candles).

So the M5 cross-lead between gold and silver, with gold's usual co-move estimated from the data before each signal, is new.

**Scope (item 44).** A new stand-alone intraday rule, tested on its own trades. It is NOT a gate, exit, entry or size of the live
gold book (Gold trend + Gold daily engulf), reads none of its positions and uses no candle before 2016. Whatever the result,
nothing live changes; a PASS is a proposal to the owner, never a rule change.

## Data
- OANDA mid M5 candles through the site's candle proxy (`/md/bars?sym=&tf=5m&from=&to=`): `xau` (spot gold) and `xag` (spot silver),
  from 1 January 2016 00:00 UTC to the last complete candle at fetch time (`fetch.mjs`; the gold file may be the same proxy's
  download made for an earlier study, cut at 2016-01-01). Cache kept outside git. The report states how far each series reaches.
- The two series are **aligned by exact candle start time** (inner join): a time present in only one series does not exist for this
  study.
- Calendar: `ict/calendar.mjs` (read only). A New York date that `dayInfo` calls a full holiday or an early close is skipped whole
  (no signal on it); no candle used by a trade may be one `cmeShut` calls shut.

## Returns and the prior 20-day window
- For joined candle i: `g_i = ln(goldClose_i / goldClose_{i-1})`, `s_i = ln(silverClose_i / silverClose_{i-1})`, defined only when
  joined candle i-1 starts exactly 5 minutes before candle i.
- Window of candle i: every defined pair (g, s) whose candle starts in the **28 calendar days (about 20 trading days) before candle
  i's start**, candle i excluded. At least **3,000** pairs are required, else candle i gives no signal.
- From the window: `sd_s`, `sd_g` (sample standard deviations), `beta = cov(g, s) / var(s)` (gold's usual co-move per unit of
  silver) and `betaR = cov(g, s) / var(g)` (silver's per unit of gold). A window with `beta <= 0` (or `betaR <= 0`) gives no signal of
  that kind.

## Signals
- **Silver shock with gold lagging** (T1, T2): `|s_i| > 2 x sd_s` AND gold moved less than half its usual co-move in silver's
  direction: `sign(s_i) x g_i < 0.5 x beta x |s_i|`. Side = sign(s_i) (silver up = buy gold).
- **Gold shock with silver lagging** (T3): `|g_i| > 2 x sd_g` AND `sign(g_i) x s_i < 0.5 x betaR x |g_i|`. Side = **−sign(g_i)**: the
  gold move that silver did not confirm is faded (sell gold after an unconfirmed gold rise).
- Excluded signal candles: any whose New York date is a CME holiday or early close (above); any whose trade window (the signal
  candle's start to the planned exit) overlaps **16:30-18:30 New York** (the daily halt and the rollover, when spreads widen); no
  trade therefore holds through a rollover.

## Trade (same scheme for every test; traded market = gold)
- Entry: the open of the gold M5 candle that starts at the signal candle's close (signal start + 5 minutes); that candle must be a
  joined candle. Market order.
- Stop (every trade has one): 1 x the **20-day mean 30-minute gold range** = the mean of `max(high) − min(low)` of every complete
  30-minute block of gold M5 candles (six candles, blocks starting on :00 and :30 UTC, all six present) whose block starts in the 28
  calendar days before the signal candle's start; at least 200 blocks required, else no trade. Placed from the entry.
- Exit: at the close of the last gold candle starting before entry + hold (T1, T3: **30 minutes**, six candles; T2: **60 minutes**,
  twelve candles), unless the stop is touched first: a candle whose low (buy) / high (sell) reaches the stop exits at the stop, or at
  that candle's open when it opened through it.
- One position at a time per test: a signal whose entry falls inside that test's open trade is skipped.
- R = side x (exit − entry) / stop distance; net R = R − round-trip cost / stop distance.

## Costs
- $0.30 spread + half a spread ($0.15) of slippage on each market order (the entry, and the stop or time exit) = **$0.60 a round
  trip** in gold price. No financing: no trade spans the rollover. A **2x-cost** run ($1.20) is reported for each test.

## Windows
- **In sample**: entries 2016-01-01 to 2020-12-31 (the first 28 days of 2016 are warm-up).
- **Out of sample (decisive)**: entries 2021-01-01 to the end of the data.

## Statistics
- t on calendar-month sums of net R (months with at least one trade), mean / (sd / sqrt(months)); one-sided p from the normal
  approximation; **Holm** over the three out-of-sample p values (T1, T2, T3).
- **Placebo, 40 seeds** per test: each real signal is replaced by a random joined candle of the same calendar year that passes the same
  exclusions (holiday / early close, the 16:30-18:30 New York window, a defined return), with the same side; the same trade, stop,
  cost and one-at-a-time rules apply. Reported per seed: out-of-sample n, net R a trade, t.
- Also reported: gross and net R, n, win rate, stopped share, worst drawdown, by year, by side, the median stop in dollars and the
  median cost in R, and the signal counts.

## Pass bar (per test; all must hold)
1. out-of-sample net R a trade > 0 and Holm-adjusted p < 0.05 (month-sum t);
2. in-sample net R a trade > 0 (same sign);
3. out-of-sample net R a trade still > 0 at 2x costs;
4. out-of-sample n >= 150;
5. out-of-sample net t above the 95th percentile of the 40 placebo seeds (above the 38th of 40 sorted values).

Verdict: **PASS** if at least one of T1-T3 passes (the report names which; T1 is the primary test), else **FAIL**. Nothing is tuned
after the first run: no other threshold, co-move fraction, window, hold, stop, hour filter or market is tried in this study; a
variant needs its own pre-registration on other data.
