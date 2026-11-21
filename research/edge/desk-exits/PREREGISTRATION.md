# Desk exits: 1R, 2R, 3R targets or a trailing stop on every desk's trades (pre-registration, 21 Nov 2026)

Owner, 21 Nov 2026: "the trades u taking check how will look if u target 1/2/3 rr or tralling stop on all edges".
Written and committed before any exit below is computed on any trade.

## Question

The four desks (Mosha, Engulfing, MSNR, LIT) record paper trades with their own exits. For the SAME entries, would a fixed
1R, 2R or 3R target, or a trailing stop, have done better than the exit each desk books?

## Data

- **Trades**: council-data `mosha/desk.json`, `eg/desk.json`, `msnr/desk.json`, `lit/desk.json` as of 21 Nov 2026 19:57 UTC
  (the first light files; logs not needed). Closed records only (`R` not null), each with its booked `R`, `side`, `t` (the fill),
  `entry`, `stop` (the opening stop) and `market`. 15 groups = desk x kind: Mosha `sop`, `barrier`; Engulfing `eg-1d`, `eg-4h`,
  `eg-1h`, `eg-plan`, `eg-simple`, `eg-direct`; MSNR `msnr-main`, `msnr-other`, `msnr-sop`, `msnr-qm`; LIT `lit-rule`,
  `lit-loose`, `lit-break`.
- **Candles**: OANDA mid 5-minute candles through the site's candle service (`/md/bars`), 11 markets (xau, xag, eurusd, gbpusd,
  usdjpy, usdcad, audusd, nas100, spx500, us30, de40), from 2 days before the first trade to 21 Nov 2026; kept outside git.

## Exits (each run on each trade alone, from its own fill, its own entry and opening stop; 1R = |entry - stop|)

- **X1 / X2 / X3**: target at entry +/- 1R, 2R, 3R; stop at the opening stop.
- **XT (trailing)**: no target; once the best price since the fill is 1R or more in profit, the stop moves to 1R behind the best
  price (so the first move puts it at the entry); it never moves back.
- **Booked**: the desk's own `R`, as stored.
- Common rules: the 5-minute candle holding the fill can only stop the trade (its favourable extreme may have come before the
  fill); within a candle the stop is taken before the target; a candle that opens beyond the stop exits at its open; the trailing
  stop is moved after a candle is read, never inside it; a trade still running 5 days (120 h) after its fill exits at that
  candle's close; a trade whose candles end before an exit is left out of that exit and counted.

## Costs

Results are given before costs (as the desks show them) and after the desk-rigor cost model (`research/edge/desk-rigor`
`cost(market, price)`), charged once a round trip, in R.

## Statistics and the bar

Per group and exit: n, win %, mean R, total R, worst drawdown, t of calendar-month sums. Each exit against Booked on the same
trades: the paired difference per trade, summed by calendar month, t of the monthly means (`monthDiff`), and its sign in the two
halves of the group's own period (split at the median fill time). 60 comparisons (15 groups x 4 exits), Holm over all.

An exit is called **better than the desk's own** for a group only when: the paired difference is positive after costs, its
month t is 2 or more, its Holm p is under 0.05, and it is positive in both halves. Otherwise "no better" (or "worse" when the
same bar holds the other way).

## What this is not

- **In sample**: these entries were built on these candles, and choosing the best exit after seeing it is fitting. A group that
  passes is a hypothesis for the 2020-2025 harness of `research/edge/desk-rigor` (its own pre-registration), never a live rule
  and never "an edge".
- Each trade is run alone: a desk that takes one position at a time would have taken other later trades with other exits; that
  is not modelled.
- 2026 only (Mosha from late July: about four months, so its month t rests on few months).
- Nothing live changes: no council member, desk, rule, stop or record reads the result.
