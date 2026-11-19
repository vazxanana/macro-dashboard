# Follow or fade the first 30 minutes after the FOMC statement: pre-registration

Written and committed **before** any trade of this rule was computed (13 Nov 2026). The event list, the two rules, the skip
filter, the costs, the windows, the placebo and the pass bar are fixed here; nothing in them changes after the results are
seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. **This is a
NEW stand-alone event rule decided on 2020 → now. It is not a test of the gold book** (Gold trend + Gold daily engulf):
owner decision item 44 (no further gate, exit, entry or size tested on the book's 2006-17 window) is untouched, because no
book trade, gate or exit is read here. A pass is a hypothesis for a forward paper shadow that the owner decides on, never a
live rule.

## The question

The statement is released at a fixed minute and the Chair's press conference starts 30 minutes later. Does the direction
of the first 30 minutes after the statement carry on into the rest of the New York afternoon (follow), or reverse once the
press conference starts (fade)? On the council's own feeds, net of a CFD trader's costs.

## What is already known (seen before this was written)

- `research/edge/pre-fomc-drift` (13 Nov 2026): the 24 hours BEFORE the statement, long only; FAIL. It says nothing about
  the minutes after the statement. Its event list and its M5 candle files are reused here (the list is copied into
  `events.mjs` of this study, not imported; the candles are the same files, kept outside git).
- `research/edge/event-reaction`: gold and the dollar index in the first hour after CPI / NFP / FOMC, 2022-26, descriptive;
  its one pre-registered test (CPI, T+5 → T+60 follows the dollar's first read) FAILED. It shows the gold move after FOMC is
  large; it does not test following or fading the first 30 minutes into the afternoon, and no index was studied.
- No figure of this rule on any market has been computed or looked at.

## Events

Scheduled FOMC statements only (`events.mjs`: the Federal Reserve's meeting calendars 2008-2021, `council/events.mjs`
from 2022). Unscheduled announcements (2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15) are excluded. Statement
time S in New York: 14:00 from January 2013; 14:15 in 2010-2012, 12:30 on the 2011-2012 press-conference meetings (the
times the event list carries). All clock times are New York local time converted to UTC per date (daylight time included,
`council/events.mjs` `zonedToUtc`).

## Data and markets

OANDA mid M5 candles through the site's candle proxy: NAS100, SPX500, XAU/USD. A candle is used only once it has closed.

## The rules (identical for every market)

Opening window = the M5 candles from S to S + 30 min (six candles). `ref` = the close of the candle ending at S (the price
the statement hit); `c30` = the close of the candle ending at S + 30 min; `hi` / `lo` = the highest high / lowest low of the
six candles. Direction d = sign(c30 − ref); d = 0 → no trade.

- **Skip filter**: range = hi − lo. Baseline = the mean of the same clock window (S to S + 30 min) on the 20 previous
  weekdays that have all six candles, leaving out any announcement day (scheduled or not). No trade if range < 0.5 x
  baseline, or if fewer than 20 such days exist in the 45 calendar days before.
- **Rule F (follow)**: enter at c30 in direction d. Stop beyond the window's opposite extreme: d up → stop at lo; d down →
  stop at hi.
- **Rule R (fade)**: enter at c30 against d. Stop beyond the window's extreme on the other side: d up → short, stop at hi;
  d down → long, stop at lo.
- Risk = |entry − stop|, floored at 0.25 x range (a stop closer than that is moved out to 0.25 x range, so a close right
  at the extreme cannot give a near-zero risk). Target = entry ± 1.5 x risk.
- **Management** on the M5 candles after the entry: a candle that opens beyond the stop exits at its open; then the stop
  when the candle's range reaches it; then the target; **stop first** when one candle reaches both. Otherwise out at the
  close of the candle ending at 15:55 New York (time exit). No break-even, no trail.
- Costs, round trip, in points: SPX500 1.0, NAS100 2.0, gold $0.30; net R = gross R − cost / risk. No financing (the trade
  never holds over 17:00 New York).

## Windows

- **Decisive**: 2020-01-01 → now (the last candle on file). This is where the rule is judged.
- **Replication**: 2010-01-01 → 2019-12-31 (sign check only).

## Statistics and the pass bar

Six tests: {F, R} x {NAS100, SPX500, XAU}. Per test, in the decisive window: n, mean net R a trade, t = mean / (sd / √n).
One-sided p from the normal approximation; Holm over the six tests at 0.05. A test **passes** only if all of these hold:

1. n ≥ 40 trades in 2020 → now;
2. mean net R a trade > 0 and t ≥ 2;
3. Holm-adjusted p < 0.05;
4. the same rule on the same market has a positive mean net R a trade in 2010-19;
5. placebo: the same rule (skip filter included) on non-FOMC Wednesdays at the same clock time, 40 seeds: for each event one
   Wednesday drawn at random within ±182 days of it, inside the decisive window, not within 3 days of any announcement
   (scheduled or not); if the drawn day gives no trade, another draw, up to 50 tries. The event mean must be above the
   95th percentile of the 40 seed means.

**Verdict: PASS** if at least one of the six tests passes, else **FAIL**. Gold has no extra role: it is one of the six.
The study reports both rules on every market whatever the verdict.

## What follows

- PASS: a proposal in `research/proposals/` for a forward paper shadow of the passing rule(s) only; nothing live changes.
- FAIL: no proposal, nothing live changes; the figures are the record. Any other version (another window length, target,
  exit time, market, filter) would need its own pre-registration on other data.
