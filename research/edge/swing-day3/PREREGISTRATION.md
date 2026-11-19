# Pre-registration: a daily three-candle swing failure on gold (13 Nov 2026)

Written and committed alone, before any candle of this study is read or any number computed.

## Why
The owner asked for a daily "swing failure" model taken from course material (kept private; the rule below is described in this
study's own words). Nothing like it has been tested here. Prior evidence from the owner's own tests, stated before the run: an
Asia-range sweep model lost on H1 (profit factor 0.64 / 0.71) and a London-range sweep was thin (PF 1.20 / 1.09). A sweep of
the previous day's range is the same family one timeframe up; the expectation is not favourable.

## Days
17:00 New York trading days (Sunday evening belongs to Monday; weekend hours dropped), built from OANDA mid M15 candles. New
York time from the IANA zone (daylight saving included). Not `foldWeekend` (that folds UTC days).

## The rule (mechanical, closed candles only)
- **Day 1, Day 2, Day 3** are three consecutive trading days.
- **Buy setup**: Day 2's low is below Day 1's low AND Day 2 closes back inside Day 1's range (close >= Day 1 low and <= Day 1
  high). **Sell setup**: the mirror (Day 2's high above Day 1's high, close back inside). A Day 2 that took BOTH of Day 1's
  extremes is skipped (no side).
- **Stop** = Day 2's extreme beyond Day 1 plus $0.30 (buy: Day 2 low - 0.30; sell: Day 2 high + 0.30). **Target** = Day 1's
  opposite extreme (buy: Day 1 high; sell: Day 1 low).
- **Entry on Day 3**: M15 swings are 3-a-side pivots (a high strictly above the 3 candles before and after it), confirmed only
  once the third candle after has closed. The most recent confirmed swing high is "active" until a candle closes above it (it is
  then used up). A buy is entered at market, at the CLOSE of the first Day 3 candle that closes above the active swing high
  (break of structure); sells mirror with swing lows. A swing confirmed before Day 3 opened counts.
- No trade that day if, before that break, a Day 3 candle reaches the stop level or the target; if the break is on the day's
  last M15 candle; or if the target is under 1R from the entry (reward / risk < 1).
- **Exit**: stop (a candle that opens through it fills at its open), target, or **the close of Day 3's last M15 candle** (fixed
  here: out at Day 3's close, no Day 4). A candle holding both stop and target counts as the stop. One trade at a time (each
  trade lives inside its Day 3, so at most one a day).
- **Costs**: $0.30 a round trip on gold; buys pay overnight financing by `council/fills.mjs` `financing` (rollovers between fill
  and close; almost always none inside one trading day). R = (exit - entry) / (entry - stop) per unit, net = R - 0.30 / risk -
  financing R.

## Tests (three, Holm over the three; p one-sided for T1, two-sided for T2 and T3, normal approximation)
Windows by Day 3's date: first half 2020-01-01 to 2023-12-31, second half 2024-01-01 to now.
- **T1, the model**: PASS only if net R a trade > 0 in BOTH halves, the t of calendar-month sums of net R over the whole window
  (every calendar month counted, 0 for a month with no trade) is >= 2, the Holm-adjusted p < 0.05, AND the real mean beats at
  least 38 of the 40 placebo means (below).
- **T2, silver agreement (SMT)**: the model's trades split into "SMT" (on Day 2 gold took Day 1's extreme on the setup side
  while silver did NOT take its own Day 1 extreme on the same side, same 17:00 New York days) and the rest. PASS only if the
  Welch t of the difference of mean net R (SMT minus rest) over the whole window has |t| >= 2, the Holm-adjusted p < 0.05, and
  the difference has the same sign in both halves.
- **T3, the New York midnight open**: "below midnight" = a buy entered at or after 00:00 New York on Day 3 at a price below the
  open of the M15 candle that starts at 00:00 New York (sells: above it); "the rest" = all other trades (those entered before
  midnight, when the open is not known yet, included). Same bar as T2.
- Verdict PASS only if T1 passes (T2 and T3 are read only as splits of the model).

## Placebo (for T1)
40 seeds (seeded generator). For each real trade: a random trading day from the same half that has a full set of M15 candles,
the same side, the same stop distance in dollars, the same target distance in dollars, entry at the close of the candle at the
same minute of the day as the real entry, exit by the same rules (stop, target, the day's close), same costs. Each seed gives
one mean net R; the real mean is compared with the 40.

## Reported, not tested
Splits by side, year, exit type; how many setups reach an entry; win rate, PF, worst drawdown; **how often the previous day's
high or low is taken the next day** (descriptive: share of days whose high exceeds the previous day's high, whose low undercuts
its low, and either; the course states about 90 % for "either").

## Data
OANDA mid M15 XAU_USD and XAG_USD from 2020-01-01 to the latest closed candle, through the site's keyless candle proxy
(`node --use-env-proxy run.mjs fetch <dir>`), cached outside git. Nothing live changes whatever the result; a T1 PASS would be a
proposal to the owner (`research/proposals/`), never a rule change. ICT is not touched.
