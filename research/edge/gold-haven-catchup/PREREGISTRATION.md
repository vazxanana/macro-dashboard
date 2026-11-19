# Does gold catch up with the other havens? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and the book's 2006-17 positions are
not read (owner decision 44). It is judged on its own out-of-sample window (2017 on). No live rule, size, filter, stop,
config, cost constant or council member changes, whatever the outcome.

## Question and economic reason

Gold trades as one of a family of "havens" with the yen, the Swiss franc and US Treasuries (Baur and Lucey, Financial Review
2010; Ranaldo and Soderlind, Review of Finance 2010, on the yen and the franc; neither opened here). In a week when that family
moves together but gold does not follow (or runs ahead of it), the gap may be a slow reaction of the gold market to the same
news, closed in the following week(s). The question: is gold's weekly move **net of what the haven complex explains** followed
by a move in the direction that closes the gap, by enough to trade after costs?

The test is **both-sided** and reads gold's idiosyncratic part (the residual after the haven complex), so gold's own upward
drift cannot make it pass: a week where gold lagged the havens is a buy, a week where it ran ahead is a sell, and the result
is also measured against buying (selling) gold every week with the same trade (the same-side baseline) and against a seeded
placebo with the same sides on random weeks.

## Dedupe (read before writing this)

- `gold-haven-shock` (branch): an S&P 500 / Nasdaq shock day, then a gold buy. FAIL. Equities as the trigger, no haven
  complex, no residual.
- `chf-haven`, `risk-spill-jpy`, `risk-cross` (branches): the franc / yen as the traded market, or AUD/JPY as a risk filter.
  None trades gold against the haven family.
- `gold-dollar-lead`, `gold-dollar-divergence` (branches): the dollar index (gold lagging its co-move; gold and the dollar
  moving the same way on one day). The dollar, not the havens; the yen and franc enter that index only with small weights,
  and Treasuries not at all.
- `gold-bond-lead`, `gold-rate-spread`, `gold-curve-slope`, `macro-gold` (branches / main): rates or bonds alone as a lead
  for gold, not a residual against a haven basket.
- `gold-commodity-fx-lead` (branch): the commodity currencies' dollar-neutral week as a lead (same residual mechanics, other
  basket, gold the SAME way as the basket). FAIL. Here the basket is the havens and the trade closes gold's gap to it.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists no haven-gap
  rule; `ls research/edge`, every remote branch name and the shared topics list were read. New.

## Data (no network)

- OANDA mid daily candles, UTC alignment, from council-data `research/daily/<key>.json` (`git show origin/council-data:<path>`;
  the commit is recorded in `result.json`). Keys: `xau` (from 2006-03-20), `usdjpy`, `usdchf` (2002), `usb10y` (US 10-year
  Treasury note CFD, 2003). `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full
  <dir>` runs the study.
- Weekend candles folded into the next weekday with `council/fills.mjs` `foldWeekend` (imported); days matched by UTC stamp.
- **Market set, fixed now.** Haven index H = the equal-weight mean of the weekly log returns of the yen (1 / USD/JPY), the
  franc (1 / USD/CHF) and the 10-year Treasury CFD (USB10Y). A week counts only when gold and all three have a folded candle on
  gold's last day of that Monday-based week. Traded market: `xau` only.

## Signal (weekly; only data at or before gold's last close of the week)

- Weekly log returns of gold (`g`) and of H (`h`) between consecutive qualifying week ends (a gap of over 14 days restarts the
  history).
- **Residual** `e = g - alpha - beta x h`, `alpha`, `beta` = OLS of `g` on `h` over the 52 weeks BEFORE this week;
  `z_e = e / sd` with `sd` = standard deviation of those 52 weeks' residuals under the same fit. **Raw haven week**
  `z_h = h / sd(h over the 52 earlier weeks)`.
- T1 (primary): `z_e < -1` (gold lagged the havens) long gold, `z_e > +1` (gold ran ahead) short gold; entry at gold's next
  daily open (the Sunday reopen folded into Monday), out at the close of the 5th gold candle; stop 2 x ATR(20).
- T2: the same signal held 10 gold candles, stop 3 x ATR(20).
- T3: `z_h > +1` long gold, `z_h < -1` short gold (gold follows a strong haven week), 5 candles, stop 2 x ATR(20).

## The trade (every trade has a stop)

- Stop distance (1R) from the ATR(20) of the 20 gold candles before the entry candle. Checked on each daily candle; an open
  beyond the stop fills at that open; a candle that touches the stop fills at the stop. Otherwise out at the close of the last
  held candle. One position at a time per test (a signal while a trade is open is skipped).
- Costs: $0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus overnight financing on
  longs = `nights(entry, exit)` x `FIN.xau.long` x entry price (both imported from `council/fills.mjs`; today's demo rate for
  every year). Shorts are charged and credited nothing. Net R = gross R - cost / risk. The cost share (cost / gross) is
  reported.
- Expected median stop: well over $10 (2 x ATR(20) of gold was about $20 even in 2007).

## Windows, statistics, bar

- In sample: signal weeks from the first with 52 earlier weeks (2007) to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31.
- t = mean / standard error of **calendar-month sums** of net R by exit month (months with no trade count as 0), per window.
  One-sided p from the normal; **Holm over T1-T3** on the OOS p.
- **Same-side baseline**, per test and window: a trade of the same rule entered on every eligible week (one at a time), long
  for the long baseline and short for the short baseline. Excess = the test's mean net R minus the side-weighted baseline mean
  (each signal trade compared with its own side's baseline mean).
- Placebo, per test, 40 seeds (1..40): the test's OOS sides shuffled onto the same number of eligible OOS weeks drawn at
  random, same trade rule, costs and one-at-a-time; the real OOS month-sum t is compared with the 40.
- **A test passes** when all hold: OOS net month-sum t >= 2 with Holm p < 0.05; in-sample net mean R a trade > 0; OOS net
  mean > 0 at 2 x costs; OOS excess over the same-side baseline > 0; real OOS t above at least 38 of the 40 placebo t;
  OOS n >= 30.
- **Verdict**: PASS if T1 passes; PARTIAL if only T2 or T3 passes; FAIL otherwise. No re-run with other thresholds, horizons,
  baskets or stops; any such look is labelled post hoc and cannot change the verdict.

## Reported, not judged

Long and short sides apart, gross R, stops hit, mean cost and cost share, median stop in dollars, and the in-sample /
out-of-sample median beta of gold on H.
