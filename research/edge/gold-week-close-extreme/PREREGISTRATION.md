# Pre-registration: gold after a week that closed at its high or its low (14 Nov 2026)

Written and pushed alone, before any trade of this study is simulated and before any return after a signal week is computed.
The only numbers read before writing this were the counts of signal weeks (below), which use the signal weeks' own candles and
nothing after them.

## Question
When gold's Monday-to-Friday week closes in the top tenth of its own range (it "closed at its high"), does gold keep going up the
next week; and the mirror for a week that closed in the bottom tenth? A week closing at its extreme is a common chart reading of
strong demand (or supply) into the weekend. This asks whether following it is a trade after costs and financing, and whether it
beats the same-side trade taken on any day of the same year.

## Dedupe (each RESULT.md read)
- `gold-weekly-wick` (FAIL): trades in the direction a LONG weekly wick points (lower wick > 60 % of the range = buy). A week
  that closes at its high has almost no upper wick and needs no lower wick at all: a different condition, and the opposite
  reading (follow the close, not the rejection).
- `gold-weekly-momentum` (FAIL): the SIGN of last week's open-to-close return, every week. Here only the weeks whose close sits at
  the edge of the range (about one week in five) trade.
- `gold-week-exhaustion` (FAIL): fades a week already stretched by mid-week, held to that week's close. Not the close location,
  not the next week.
- `gold-weekly-stoch` (FAIL): the 14-week stochastic (close against the 14-week range), an oscillator over many weeks, held
  three weeks. Here only the one week's own range is read, no oscillator.
- `gold-streak` (FAIL): runs of daily closes. `gold-outside-week`, `gold-inside-week`, `gold-week-raid`, `gold-weekly-open`,
  `gold-weekly-vol-breakout`, `gold-first-week`: ranges, levels, breakouts, the month's first week. None conditions on where the
  week CLOSED inside its range.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) lists no such study, and
  no remote branch name matches. Not a duplicate.

## Relation to the gold book (owner decision 44)
A stand-alone weekly rule. It is not a gate, exit, entry or size of the live gold book (Gold trend + Gold daily engulf), reads
nothing of that book's records, positions or `legs.json`, and does not use its 2006-17 positions. A PASS would only be a lead for
a paper shadow the owner may approve. The 2007-16 daily gold path has been read by many earlier studies: the in-sample half is a
check of sign; the decision rests on 2017-26.

## Data and market set
Market set fixed here: **spot gold only** (OANDA mid XAU_USD daily candles, UTC days), council-data `research/daily/xau.json` at
commit `d8d68407b` (20 Mar 2006 to 13 Nov 2026), read with `git show` (no network; the copy is kept out of git and deleted at the
end). Weekend stubs folded into the next weekday with `council/fills.mjs` `foldWeekend`.

## Weeks and the signal
- A week = the folded daily candles whose UTC date falls in the same Monday-Sunday calendar week. Weekly open = first candle's
  open, close = last candle's close, high / low = the highest high / lowest low of its candles, range = high - low. A week with
  fewer than 4 candles, or a range of 0, gives no signal. The last week of the file counts only if it ends on a Friday.
- **Closed at its high**: close >= high - F x range. **Closed at its low**: close <= low + F x range. F = 0.10 (T1, T3), 0.20 (T2).
- Side: +1 (buy) after a week closed at its high, -1 (sell) after a week closed at its low (follow the close).
- Counts of signal weeks already read (by the year of the trade week; highs / lows): F 0.10: 2007-16 87 / 28 (115), 2017-26
  85 / 37 (122). F 0.20: 2007-16 151 / 91 (242), 2017-26 142 / 75 (217). Each test has at least 100 events in each window; the
  two sides alone do not, so no side is a test of its own (both are reported).

## The three tests (Holm over these three)
- **T1 (primary)**: F 0.10, hold one week (entry at the first open of the next week, out at that week's last close).
- **T2**: F 0.20, hold one week.
- **T3**: F 0.10, hold two weeks (out at the last close of the week after next). A new signal inside a held position is skipped
  (one position at a time).

## Trades
- Entry: market order at the OPEN of the first daily candle of the week after the signal week.
- **Stop** (every trade has one): 2 x ATR(20) from the entry; ATR = mean of the 20 daily true ranges up to and including the
  signal week's last candle. Checked on every held candle: a candle after the entry candle that OPENS through the stop exits at
  that open; else a low (buy) / high (sell) reaching the stop exits at the stop. Otherwise out at the time exit's close.
- 1R = the stop distance; results in R a trade.
- **Costs**: $0.60 an ounce a round trip (spread $0.30 + $0.15 of slippage on each market order), divided by the stop distance.
- **Financing on buys**: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026) x entry price / stop distance. Sells pay and receive nothing. Today's rate for every year.
- 2x costs = both the $0.60 and the financing doubled.

## Baseline (same side, every day of the same year)
For each test and side, the same trade (same stop rule, entry at the day's open, ATR to the day before) entered at the open of
EVERY trading day of the calendar year, held 5 trading days (T1, T2) or 10 (T3), net of the same costs. The excess of a signal
trade = its net R minus the mean net R of the baseline trades of the same side and the same entry year. Reported: mean excess,
Welch t of signal trades against the baseline trades of the window (same side, matched year by year through the excess).

## Windows and statistics
- In sample: trades exiting 2007-01 to 2016-12. Out of sample: 2017-01 to 2026-10. A window holds a trade by its exit month.
- t = mean / standard error of the CALENDAR-MONTH SUMS of net R over every month of the window (months with no trade count as 0).
  One-sided p from the normal distribution, Holm over the three tests (OOS).
- **Placebo**, 40 seeded draws (seed 1..40, mulberry32): every real OOS trade keeps its side, its entry week is replaced by a
  week drawn at random from the eligible weeks of the same calendar year; the OOS month t of each draw is computed.
- **Pass (each test)**: OOS month t >= 2 and Holm-adjusted p < 0.05; in-sample net mean > 0; OOS net still > 0 at 2x costs;
  OOS mean excess over the same-side baseline > 0; OOS t above at least 38 of the 40 placebo t.
- Verdict: PASS if T1 passes; the others are reported on the same bar. Nothing is re-run with another F, hold or stop.

## Deliverables
`run.mjs`, `RESULT.md` (verdict in the bold line), `result.json`, `tests/gold-week-close-extreme.test.mjs`, `out/` rebuilt.
Paper research only; nothing live changes.
