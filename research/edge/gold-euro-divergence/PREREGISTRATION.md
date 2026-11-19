# Gold at a 20-day high in euros but not in dollars: pre-registration

Written and committed **before** any trade result below was computed (14 Nov 2026). Only the number of signal days per
window was counted first (to check the 100-event floor; numbers below). The data, the market set, the signal, the trade, the
costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: never a gate, filter, size step, entry or exit of the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and the book's 2006-17 positions are
not read (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member changes, whatever the
outcome.

## Question and economic reason

Gold is priced in dollars, but a large part of the private demand sits in Europe. When gold priced in euros (XAU/EUR) closes
at a new 20-day high while gold in dollars does not, gold's own strength is being hidden by a strong dollar (a weak euro): the
buyers holding euros are paying up, the dollar chart does not show it yet. The idea is that gold in dollars then catches up
(and the mirror: a 20-day low in euros, not in dollars, means weakness hidden by a weak dollar, and gold in dollars falls
later). The question: does that divergence of the two gold prices lead XAU/USD, by enough to trade after costs and better
than the same-side trade taken on any day of the same year?

## Dedupe (read before writing this)

- `gold-eur-vol-breakout` (branch): gold-vol-breakout's rule traded ON XAU/EUR. Here XAU/EUR is only the signal and the trade
  is XAU/USD; no volatility breakout.
- `gold-dollar-lead` (branch): a strong dollar WEEK (z of the DXY's weekly return) with gold lagging its fitted co-move, held
  a week. FAIL. `gold-dollar-divergence` (branch): gold and the DXY moving the same way on one day. FAIL. `gold-factor-residual`,
  `gold-haven-catchup` (branches): regression residuals against a basket. FAIL. None of them reads a price LEVEL (a 20-day
  closing extreme) of gold in another currency; no regression, no dollar-week condition here.
- `gold-eurchf-stress` (branch): EUR/CHF as European stress, four-week hold. FAIL. Not gold in euros.
- `research/edge/` on main, every remote branch name (`git branch -r`), the shared topics list and
  `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`) were read: no XAU/EUR vs XAU/USD extreme
  divergence. New.

## Data (no network)

- OANDA mid daily candles, UTC days, from council-data `research/daily/xau.json` (XAU/USD, from 2006-03-20) and
  `research/daily/xaueur.json` (XAU/EUR, from 2006-03-19), read with `git show origin/council-data:<path>` (commit recorded in
  `result.json`). `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full <dir>`
  runs the study. The cache directory is deleted after the run.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported); the two series are matched
  by UTC day, a day counts only when both have a folded candle.
- **Market set, fixed now:** signal XAU/EUR against XAU/USD; traded market XAU/USD only.

## Signal (daily, only closes at or before the signal day)

- `eHigh` = XAU/EUR closes above the highest XAU/EUR close of the 20 matched days before it; `gHigh` the same for XAU/USD;
  `eLow` / `gLow` = below the lowest close of the 20 days before. A gap of more than 5 calendar days between matched days
  restarts the 20-day history.
- **Long signal:** `eHigh` and not `gHigh`. **Short signal:** `eLow` and not `gLow`.
- Events counted before writing this (signal days, not trades): in sample 2007-16 134 long + 98 short = 232; out of sample
  2017-01 to 2026-10 128 long + 83 short = 211. The both-sided tests and the long-only test have at least 100 events in each
  window; the short side alone does not, so it is never tested alone.

## Tests (at most three, Holm over all three)

- **T1 (primary):** both sides (long and short signals), entry at XAU/USD's next daily open, out at the close of the 5th
  candle, stop 2 x ATR(20).
- T2: long signals only, otherwise as T1.
- T3: both sides, out at the close of the 10th candle, stop 3 x ATR(20).

## The trade (every trade has a stop)

- 1R = the stop distance from the ATR(20) (true range) of the 20 gold candles before the entry candle. Checked on each daily
  candle: an open beyond the stop (after the entry candle) fills at that open; a candle that touches the stop fills at the
  stop; otherwise out at the close of the last held candle. One position at a time per test (a signal while a trade is open is
  skipped).
- Costs: $0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus overnight financing on
  buys = `nights(entry, exit)` x `FIN.xau.long` x entry price (both imported from `council/fills.mjs`; 0.000148 of price a
  rollover, the demo broker's XAUUSD `swap.long` of 11 Nov 2026, used for every year). Sells are charged and credited nothing.
  Net R = gross R - cost / risk.

## Baseline (the same-side trade on every day of the same year)

For each calendar year and side, the same trade (same hold, stop, costs) entered after EVERY eligible day of that year
(overlapping, not one at a time). A signal trade's **excess** = its net R minus the mean net R of its own side's baseline in
its signal year. Mean excess and its month-sum t are reported per window.

## Windows, statistics, bar

- In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t = mean / standard error of **calendar-month sums** of net R by exit month (months with no trade count as 0), per window.
  One-sided p from the normal; **Holm over T1-T3** on the out-of-sample p.
- Placebo, per test, 40 seeds (1..40): the test's out-of-sample signal sides kept in order, put on the same number of eligible
  out-of-sample days drawn at random (seeded), same trade, costs and one-at-a-time; the real month-sum t is compared with the 40.
- **A test passes** when all hold: OOS net month-sum t >= 2 and Holm p < 0.05; in-sample net mean R a trade > 0; OOS net mean
  > 0 at 2 x costs; OOS mean excess over the same-side same-year baseline > 0; real OOS t above at least 38 of the 40 placebo t;
  OOS trades >= 30.
- **Verdict:** PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. No re-run with other look-backs, holds,
  stops or markets; any such look is labelled post hoc and cannot change the verdict.

## Reported, not judged

Long and short sides apart for T1 and T3, gross R and gross month t, stops hit, mean cost, median risk in dollars.
