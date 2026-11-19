# Pre-registration: fading the break of gold's tight five-day box (14 Nov 2026)

Written and pushed alone, before any trade of this rule was computed. A new stand-alone rule on spot gold: it is not a gate,
exit, entry or size change of the live gold book (Gold trend / Gold daily engulf), and none of that book's positions (2006-17 or
later) is read (docs/owner-decisions.md item 44). Paper research only: nothing live changes and no proposal is written whatever
the result.

## Where the idea comes from, and why it is chosen after a result

`gold-box-breakout` (branch `gold-box-breakout`, PR #1097) traded the break of a tight five-day gold box with the stop at the
box's other side. Its primary test lost: out of sample (2017 to Oct 2026) −0.299R a trade net, n 80, month t −2.03, 58 of 80
trades stopped back through the box; in sample (2007-16) −0.096R net, −0.022R gross, n 83. **The idea of fading the break was
chosen after seeing that result**, so the window that produced it cannot confirm it.

## Hypothesis

When gold breaks out of an unusually tight five-day box, the break tends to fail: selling the upper break (buying the lower
break) at the next hour's open, with a stop beyond the box edge, earns more than costs as price returns to the box's other side.

## Why not a duplicate

Read before choosing: `gold-box-breakout` (follows the break; this fades it), `gold-squeeze` (Bollinger inside Keltner, follows
the release), `gold-h1-bb-fade` (fades an H1 Bollinger band touch, no multi-day box), `nr7-breakout`, `gold-inside-week`,
`gold-inside-day`, `gold-daily-turtle-soup` (a fade of a prior-day high / low, not a five-day box chosen by its height),
`gold-range-expansion`. No study on any branch or in `research/proposals/2026-11-14-untested-backlog.md` fades the break of a
height-selected multi-day box.

## Data and windows (named before any result): option (b), a forward-only split of OANDA data

- One market: spot gold, OANDA mid XAU/USD H1 candles through the council's candle proxy (cache kept outside git, March 2006 to
  13 Nov 2026). Days are UTC days built from the H1 candles; Saturday / Sunday hours belong to the next Monday (as
  `council/fills.mjs` `foldWeekend` does on daily candles). Same candles and day construction as `gold-box-breakout`.
- **Confirmation (decisive): entries 2007-01-01 to 2016-12-31.** **Descriptive: entries 2017-01-01 to 2026-10-31**, the window
  in which #1097 saw the breaks fail; it is reported but cannot pass the rule (only its sign is used, below).
- Said plainly: 2007-16 was #1097's in-sample window, so its breakout figures there were seen too (−0.022R gross, a weak and
  insignificant loss, t −0.14); the fade was not suggested by that window, but the window is not unseen data. An independent
  HistData feed (option a) would cover the same market and the same years, so it would add no independence; option (b) is
  chosen. A pass here would still be a lead to replicate, never an edge.

## Rule

At the close of each completed day d (no candle of day d+1 or later is read for the signal):

- Box: Hb = the highest high and Lb = the lowest low of days d-4 .. d (five days); h = Hb - Lb.
- Usual five-day range: U = the mean five-day range (high - low over five days) of the 60 windows ending on days d-60 .. d-1.
- Signal when h < 0.6 x U and the test has no position open and no box being watched.
- The break: the first H1 candle of days d+1 .. d+5 with high >= Hb (upper break) or low <= Lb (lower break). An hour that
  touches both is no trade. No break within 5 days: no trade.
- Entry: the OPPOSITE side, at the open of the next H1 candle after the break hour: a sell after an upper break, a buy after a
  lower break.
- Stop (fixed in advance): 0.5 x h beyond the broken box edge: a sell's stop is Hb + 0.5h, a buy's stop Lb - 0.5h. Every trade
  has it. If the entry open is already at or beyond that stop, no trade. 1R = |entry - stop|. A stop gapped through fills at the
  hour's open.
- Target, by test (if the entry open is already at or beyond the target, no trade):
  - **T1 (primary)**: the box's other side (a sell targets Lb, a buy Hb); time exit at the last H1 close of the 20th day after
    the fill day.
  - **T2**: the box midpoint (Hb + Lb) / 2; time exit as T1.
  - **T3**: T1's target with a time exit at the last H1 close of the 5th day after the fill day.
- The entry hour counts from its open: its high / low can hit the stop or target. When an hour holds both, the stop is taken
  first. A target fills at the target price (a gap beyond it fills at the open).
- Each test is its own one-position stream; after a no-trade the stream is free again the day after the break (or after d+5).

## Tests (three, Holm over the three)

T1, T2, T3 above. Buys and sells are always both traded; they are reported apart, not tested apart.

## Costs

- $0.30 spread + $0.15 slippage on the entry + $0.15 on the exit = **$0.60 a round trip** (as `gold-box-breakout`), taken off
  each trade in R of its own risk: 0.60 / r0.
- Financing on buys only: `nights(fill, exit)` x `FIN.xau.long` (0.000148 a rollover, the demo broker's XAUUSD swap.long of 11
  Nov 2026, `council/fills.mjs`; today's rate charged for every year) x fill / r0. Sells are charged and credited nothing.
- 2x costs doubles the $0.60 and the financing.
- Cost share reported up front: the median stop distance in dollars and the median cost in R of each test and window.

## Statistics and the pass bar

- Per test and window: n, gross and net R a trade, net at 2x, win rate, total, worst drawdown, exits; t on calendar-month sums
  of net R (exit month; months with no trade count as 0 between the window's first and last month), gross t the same way.
- p two-sided from the normal approximation of the month t; Holm over T1-T3 on the confirmation-window p.
- Placebo, 40 seeded draws (seeds 1..40), confirmation window: entry days drawn at random from all eligible days of the window
  (the same count as T1's confirmation signals; one position at a time), entry at the first H1 open of the next day, the side
  drawn with the same share of sells as T1's confirmation trades, and the stop and target distances in dollars copied from a
  T1 confirmation trade drawn at random; T1's time exit, costs and financing. Placebo statistic: confirmation net R a trade.
- **Pass** (T1 decides; T2 / T3 are only reported as passing or not): confirmation (2007-16) net month t >= 2 with Holm p <=
  0.05, confirmation net R a trade > 0 at 2x costs, descriptive (2017-26) net R a trade > 0 (the same sign), and T1 above at
  least 38 of the 40 placebos. Anything less is FAIL. Even a pass is a lead, not an edge, until replicated on data it did not use.

## Deliverables

`run.mjs` (pure functions exported for the test; `node --use-env-proxy run.mjs fetch <dir>` / `node run.mjs full <dir>`),
RESULT.md and result.json written from the run, `tests/gold-box-fade.test.mjs` (hand-made candles, no look-ahead, the report
against result.json), `out/` rebuilt. Nothing outside `research/edge/gold-box-fade/`, its test and `out/` is touched.
