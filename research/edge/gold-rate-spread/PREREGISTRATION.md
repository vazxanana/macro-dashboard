# Does the US-German 10-year rate gap lead spot gold? Pre-registration

Written and committed **alone, before any return, signal or trade of this study was computed** (14 Nov 2026). Rules, data,
costs, windows, tests and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only, a **stand-alone cross-asset rule** on spot gold: never a gate, entry, exit or size of the live gold book,
never compared with it, and the book's 2006-17 window and positions are not used (owner decision 44). No live rule, size,
filter, stop, config, cost constant or council member changes, whatever the outcome.

## Why (the economic reason)

Gold is priced in dollars. A large part of the dollar's medium-term moves against the euro follows the gap between US and
German rates: when US yields fall relative to German yields, holding dollars pays less against the other big reserve
currency, the dollar tends to weaken, and dollar-priced gold tends to rise (and the reverse). The question is whether a
large 4-week move in that gap, measured from bond prices, leads gold over the next two weeks, both ways.

## What is already known (seen before this was written), and why this is not a duplicate

- `gold-bond-lead` (14 Nov 2026, FAIL 0 of 3): the US 10-year bond's own weekly move (with gold lagging) as a one-week lead.
  It used the US bond ALONE; this study uses the US bond RELATIVE to the German Bund (the transatlantic rate gap), over 4
  weeks, held 2 weeks, both ways in one test.
- `yield-fx-weekly` (FAIL): the US 2-year alone leading the dollar. `macro-gold` (FAIL): US real yields and gold.
  `gold-dollar-lead`, `gold-dollar-divergence`, `gold-currency-breadth`: the dollar / currencies themselves, not rates.
- `gold-curve-slope` was taken by another study the same day (the US 2s10s slope); not this one.
- No study in `research/edge/`, on a remote branch or in the untested-backlog proposal uses `de10yb`.

## Data (named before any result)

- council-data `research/daily/xau.json`, `usb10y.json`, `de10yb.json` (OANDA mid daily candles, UTC days) at commit
  `60e9d956cd79c2d9e64ebb8363f608abdd0f6733`, copied with `git show` (no network, kept out of git). Gold from March 2006,
  the two bond CFDs from 2003. Weekend candles folded into Monday with `council/fills.mjs` `foldWeekend` (all three).
- `usb10y` and `de10yb` are the bond CFDs' PRICES (in their own currency): a price up = that yield down.
- Market traded: **XAU/USD only.** Signal markets: `usb10y`, `de10yb` only.

## The rule

1. Common days: UTC days on which both bond keys have a candle. On each common day t, the gap move
   `S_t = ln(U_t / U_{t-20}) - ln(D_t / D_{t-20})` (U = usb10y close, D = de10yb close, 20 common days back).
   `S > 0` = the US bond outperformed the Bund = US yields fell relative to German yields.
2. `z_t = (S_t - mean) / sd`, mean and sd of `S` over the 250 common days BEFORE t (t excluded). A common-day gap of more
   than 7 calendar days restarts the history.
3. Signal day: gold's last candle of each Monday-based week (normally Friday), only when that same UTC day is a common
   day with a z. `z > +1` = long gold; `z < -1` = short gold; otherwise nothing.
4. Entry at the open of the next gold candle (the folded Monday = the Sunday reopen). Stop = 2 x ATR(20) of the 20 gold
   candles before the entry (1R); a candle opening through the stop fills at its open, else a touch fills at the stop.
   No target. Exit at the close of the 10th gold candle (about two weeks) if not stopped. **Every trade has a stop.**
5. One position at a time: a signal whose entry candle is not after the last trade's exit candle is skipped.

## Costs

$0.30 spread + $0.15 slippage on each of the two market orders = **$0.60 a round trip**, plus on buys
`nights(entry, exit) x FIN.xau.long x entry price` (`council/fills.mjs`; 0.000148 of price a rollover, the demo broker's
XAUUSD long swap of 11 Nov 2026, today's rate charged for every year). Shorts are charged and credited nothing. All in R of
the trade's own stop distance. 2x costs = both doubled. The report states the median stop in dollars (expected well over
$10) and the cost share (mean cost in R, and as a share of the mean absolute gross R).

## Windows

In sample: signal days 2007-01-01 to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31 (entries; a trade that closes
after 31 Oct is kept). The first 250 common days of history are warm-up only.

## Tests (three, Holm over all three)

- **T1 (primary): the both-sided rule above.** Statistic: net R, t on calendar-month sums (every month of the window, empty
  months 0), booked by exit month.
- **T2: long leg against the unconditional long baseline.** Baseline = long gold at every eligible signal day (any z), same
  entry, stop, hold, costs, one at a time. Per long trade of T1, excess = net R - baseline mean net R a trade in the same
  window; t on month sums of the excess.
- **T3: short leg against the unconditional short baseline**, the same with shorts.

p = one-sided normal p of the OOS month t; Holm over T1-T3.

## Placebo

40 seeded draws (seeds 1-40, a fixed mulberry32 generator): the same number of longs and of shorts as T1's OOS signals,
placed on randomly chosen eligible signal days of the OOS window (sides shuffled), simulated with the same rules. Reported:
how many draws reach the real OOS month t, the placebo median and 95th percentile.

## Pass bar (T1 decides the verdict)

T1 passes only if all hold: OOS net month t >= 2 and Holm p < 0.05; in-sample net R a trade > 0 (same sign); OOS net R a
trade > 0 at 2x costs; OOS n >= 30; the real OOS month t is beaten or equalled by at most 2 of the 40 placebo draws.
Verdict PASS if T1 passes, PARTIAL if only T2 or T3 passes its own first four conditions, FAIL otherwise.

## Informational only (no verdict, not in Holm)

- I1: T1 with a 5-day gap move (`S` over 5 common days), held 5 candles.
- I2: T1 with the US bond alone (`S = ln(U_t/U_{t-20})`), to show what the Bund adds.
- I3: T1 with the Bund alone, sign as the gap (Bund up = German yields down = short gold).
- Per-year net R of T1, gross figures, stop counts.

Nothing here becomes a rule. A PASS would only be reported to the owner as research; any use needs his decision.
