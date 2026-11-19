# Do Treasury bond prices lead spot gold when gold lags them? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **This is a standalone cross-asset signal study.** It is not a gate, filter, size step, entry or exit
for the live gold book (Gold trend, Gold daily engulf, Mosha cycle) and must never be read as one. Owner decision 44
(docs/owner-decisions.md) stopped further tests of gates, exits, entries or sizes on that book's 2006-17 window; this study
tests no lever of that book, takes none of its trades, and is judged on its own out-of-sample window (2017 on). The years
before 2017 are used only as the in-sample half of this signal. No live rule, size, filter, stop, config, cost constant or
council member changes, whatever the outcome.

## Question

Gold moves with real yields on the same day (`macro-gold`: correlation −0.20 to −0.31 with the same day's 10-year real-yield
change). When US Treasury bond PRICES rise strongly in a week (yields fall) but gold rises less than its usual co-move with
bonds (gold "lags" the yield drop), does gold catch up over the following week, by enough to trade after costs? The mirror:
bonds fall strongly while gold falls less than its co-move. And the daily form of the same catch-up with the 2-year note.

## Dedupe (read before writing this)

- `macro-gold` (main, #539): long / flat gold on the 20-observation change of the FRED 10-year real yield (DFII10) as known
  after its publication lag, and the same as a gate on Gold trend. FAIL. Diagnostic there: the change known at the prior
  close correlates −0.015 / +0.019 with gold's next day. It tests real-yield MOMENTUM with a 1-2 day publication lag, never
  a gold-vs-bonds DIVERGENCE (gold lagging its own co-move), never the bond CFD price (known at the same UTC close as gold),
  never a weekly catch-up. The daily diagnostic is the closest thing to T3 here; T3 differs by using the market price with
  no lag and by the lag condition on gold.
- `macroscore-overlay` (main): the Gold Macro Score (4-week real-yield fall, 4-week dollar fall, 13-week 2Y fall, curve) as a
  size step on the gold systems. FAIL on the sizing rule; its calibration H0 (weekly score vs gold's next 4 weeks, IC +0.149,
  t 3.24, 2006-17) is a slow multi-input score over 4 weeks, not a one-week bond shock with gold lagging, and not a trade.
- `bond-lead-intraday` (branch, #926): a sharp 15-minute 10-year move into gold / USD/JPY over the next HOUR. Gross lead real
  (gross t 2.0-2.9 since 2016), smaller than the round-trip cost. FAIL. Here the horizon is a week / a day, where the cost is
  about 0.01R of a 2 x ATR(20) daily stop, and the signal is conditioned on gold having lagged.
- `yield-fx-weekly` (branch, #942): weekly 2-year moves into the dollar against JPY / CHF / EUR. FAIL. Not gold.
- `gold-oil-lead` (branch): big oil / copper days into gold. FAIL. `copper-gold` (#854): copper / gold ratio into US indices.
  `intermarket-lead` (branch): monthly leaders (US500, copper, dollar into metals). `stock-bond-corr`, `bond-fomc-drift`,
  `bond-month-end*`, `bond-intraday-momentum`, `treasury-auction-cycle`: bonds traded, not gold. None tests a bond-price
  move with gold lagging it as a lead for gold.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists no such study.
  This is new.

## Data (no network)

- OANDA mid daily candles, UTC alignment, from the council's research cache on the `council-data` branch
  (`research/daily/xau.json`, `usb10y.json`, `usb02y.json`, `usb30y.json`; read with `git show origin/council-data:<path>`;
  the commit is recorded in `result.json`). At the time of writing (from `_index.json`, no prices read): xau 2006-03-20,
  usb10y 2003-03-21, usb02y 2003-04-01, usb30y 2003-03-21, all to 2026-11-06. Gold limits the study to 2006 on.
  `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full <dir>` runs it.
- These bond keys are the CFD's PRICE: a rising price is a falling yield.
- Weekend candles are folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported), the same way for every
  market. Bond and gold days are matched by their UTC day stamp, never by row number.
- **Market set, fixed now**: signal markets `usb10y` (T1, T2) and `usb02y` (T3); `usb30y` is run with the T1 rule as an
  informational replication only (no test, not in Holm, not in the verdict). Traded market: `xau` only.

## Signal, weekly (T1, T2)

- A week = Monday-Sunday UTC. Its **week-end day** = gold's last folded candle of the week (normally Friday). A week counts
  only when the bond has a candle on that SAME day stamp (else the week is skipped as unaligned).
- Weekly returns over consecutive counted weeks (a gap of more than 14 days between week-end days breaks the chain and the
  history restarts): `b_w = bondClose_w / bondClose_{w-1} − 1`, `g_w = goldClose_w / goldClose_{w-1} − 1`, both at the same
  week-end day stamps.
- Using only the **52 weekly pairs before week w** (w itself not in them; a week needs 52 earlier pairs):
  - `sd_w` = sample standard deviation of the 52 bond returns; `z_w = b_w / sd_w`;
  - `beta_w` = least-squares slope of gold's on the bond's weekly returns (with intercept); the co-move gold "should" have made
    is `beta_w × b_w`; **lag** `e_w = g_w − beta_w × b_w`.
- **T1 (primary), buy the lag**: `z_w > +1` (bonds up more than 1 sd, yields down) **and** `e_w < 0` (gold rose less than its
  co-move, or fell) → **long gold**.
- **T2, the mirror short**: `z_w < −1` **and** `e_w > 0` → **short gold**.
- Known at 00:00 UTC after the week-end day. **Entry = the open of gold's first folded candle whose day is later than the
  week-end day** (the Monday candle, i.e. the Sunday reopen). Nothing of that candle or later is used by the signal, the ATR
  or the stop. **Exit at the close of the 5th gold candle** (the entry candle is the 1st).

## Signal, daily (T3)

- Common days = days on which both gold and `usb02y` have a folded candle. Daily returns between consecutive common days
  (`b_d`, `g_d`; a gap over 5 calendar days breaks the chain).
- Using only the **250 daily pairs before day d**: `sd_d` of the bond returns, `z_d = b_d / sd_d`, `beta_d` the slope of
  gold's on the bond's daily returns, `e_d = g_d − beta_d × b_d`.
- **T3**: `z_d > +1` and `e_d < 0` → long gold; `z_d < −1` and `e_d > 0` → short gold (both sides in one test).
- Entry at the open of gold's first folded candle whose day is later than d; **exit at the close of that same candle**
  (held one candle).

## Trade (every trade has a stop)

- **Stop** = 2 × gold's ATR(20) from the entry (below a long, above a short). ATR(20) = simple mean of the 20 true ranges of
  the folded gold candles before the entry candle. 1R = the stop distance.
- Before the time exit: on the entry candle a low (long) / high (short) through the stop exits at the stop; on a later
  candle an open through the stop exits at that open (gap), else a low / high through it exits at the stop. A trade whose
  gold candles end before its exit is left out (open).
- **One position at a time** per test: a signal whose entry candle is not after the open trade's exit candle is skipped.
- **Costs** (net R):
  - $0.30 spread a round trip plus half a spread ($0.15) of slippage per market order (entry, time exit and stop are market
    orders): **$0.60 a trade**, ÷ risk.
  - Financing on **longs only** by `council/fills.mjs` `nights` and `FIN.xau.long` (imported; the demo broker's XAUUSD long
    swap, 0.000148 of price a rollover, Wednesday three, source in fills.mjs): `nights(entryT, exitT) × FIN.xau.long × entry ÷
    risk`. Shorts are charged and credited nothing (`FIN.xau.short` 0). Entry stamp = the entry candle's day 00:00 UTC; exit
    stamp = the exit candle's day end (23:59:59 UTC) Monday-Thursday, 21:59:59 UTC Friday. Today's rate for every year.
  - **2x costs**: the $0.60 and the financing both doubled.
- Gross R = side × (exit − entry) ÷ risk.

## Windows

- **In sample (IS)**: signal (week-end / signal) days from the first eligible one (gold from 2006-03-20 plus the 52-week or
  250-day history and the ATR) to 2016-12-31.
- **Out of sample (OOS)**: signal days from 2017-01-01 to 2026-10-31.

## Statistics

- Per test and window: n (long / short), win rate, mean gross R, mean net R, total net R, stops, mean net R at 2x costs,
  **t on calendar-month sums of net R** (months by exit stamp; every calendar month of the window counts, empty ones as 0),
  gross month t, and the per-trade t.
- **p** = one-sided normal upper tail of the OOS month-sum t of net R. **Holm** over T1, T2, T3.
- **Placebo**: 40 seeds (1-40, mulberry32). Each draws, from the OOS window's eligible signal days of that test (weeks for T1
  / T2, days for T3: those with the full history), as many days as the test has real signal days, at random, and gives them
  the real sides in a random order (same long / short mix); then the identical trade and statistics. Reported: each seed's
  OOS month-sum t, how many reach t ≥ 2, how many reach the real t, the median. Informational, not part of the bar.
- Informational, no test: the T1 rule on `usb30y`; and T1 / T2 **without** the lag condition (every week with `z > +1` long,
  `z < −1` short), to show whether gold's lag adds anything over the bond move itself.

## Pass bar (per test)

1. OOS month-sum t of net R ≥ 2 **and** Holm-adjusted p < 0.05;
2. IS mean net R a trade > 0 (the same sign);
3. OOS mean net R at 2x costs > 0;
4. OOS n ≥ 30.

Verdict: **PASS** if T1 (the primary) passes; **PARTIAL** if T2 or T3 passes but T1 does not; **FAIL** if none passes. A
pass makes this a paper lead worth a forward record with its own proposal, nothing more: no live change follows from it.

## What is not tested

Other thresholds, look-backs, betas or holds; the 5-year note; real yields from FRED or TIPS; intraday timing around the
US cash close; gold leading bonds; any use inside the gold book. A changed rule after seeing results is post hoc and must
say so.
