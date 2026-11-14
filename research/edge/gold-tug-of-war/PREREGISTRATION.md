# Gold tug of war: Asia's 20-day session drift against London and New York's (pre-registration, 14 Nov 2026)

Pushed alone, before any trade or return of this rule was computed. Paper research only. **A new stand-alone daily rule on
XAU/USD, not a gate, exit, entry or size of the live gold book** (owner item 44 respected: it reads none of the book's
positions, its 2006-17 trades or its rules). Nothing live changes whatever the result.

## Idea

Each gold day is split in two by the clock: the Asian part (the 17:00 New York reopen to 03:00 New York, where physical and
Asian buyers trade) and the Western part (03:00 to 17:00 New York, London and New York). Over twenty days the two parts can
pull gold in opposite directions: Asia buying while the West sells, or the other way round. The hypothesis (a "tug of war",
after the overnight / intraday split studied for equities) is that when the two disagree over a month, the side Asia has been
pushing is the one gold follows over the next week. Earlier studies here tested one session into the next
(`us-asia-lead`, `gold-us-asia`, `gold-late-ny`), single-day agreement of the sessions (`gold-session-agreement`) and the
average drift of each session (`gold-session-drift`); none tested a month of accumulated disagreement as a signal for the
following days. No oscillator is used.

## Data (named before any result)

OANDA mid XAU/USD H1 candles through the site's keyless candle proxy (`/md/bars`), 125,474 candles 19 Mar 2006 to
30 Oct 2026 (cache outside git, deleted after the run). Days are New York sessions (17:00 to 17:00 New York, `council/histdata.mjs`
`nyOffsetH`); a session with fewer than 20 H1 candles is dropped (5,272 usable days). Gold only; no other market.

Counted before this file was written (signal days and trades only, no return looked at): signal days 1,449 in sample and
1,201 out of sample; trades one at a time T1 360 / 319, T2 202 / 171, T3 199 / 178 (in sample / out of sample).

## Rule

- Per day i: `A_i` = ln(close of the last H1 candle starting before 03:00 New York / previous usable day's close); `W_i` =
  ln(day's close / that candle's close). A day with no Asian candle, or whose last candle is Asian, has no split (1 day).
- `A20`, `W20` = sums over days i-19 .. i (all 20 must have a split). Known at day i's 17:00 New York close.
- Signal when `A20` and `W20` have opposite signs: side = sign of `A20` (buy when Asia pushed up and the West down).
- Entry at the open of day i+1's first H1 candle; stop 2.0 x ATR(14) of the New York days ending at day i (gaps through the
  stop fill at the open, a candle reaching it takes it); out at the close of the hold's last day or at the stop. One position
  at a time (a signal is skipped while a trade is open). R in units of the stop distance.
- Costs: $0.60 a round trip plus `nights(entry, exit) x FIN.xau.long x entry` on buys (`council/fills.mjs`, the demo
  broker's XAUUSD swap of 11 Nov 2026); sells pay and earn nothing. Also reported at 2x costs.

## Tests (three, Holm over the three)

- **T1 (primary)**: the signal, 5-day hold.
- T2: only when `|A20|` is at or above the median `|A20|` of the 250 previous days (past only), 5-day hold.
- T3: the signal, 10-day hold.

Each trade is measured as an **excess**: its net R minus the mean net R of the same-side trade (same stop, same hold) entered
on every usable day of the same window. t on calendar-month sums of the excess (every month of the window counted, zero
months included). Holm on the two-sided p of the three out-of-sample t.

Windows: in sample (IS) entries 2007-01-01 to 2016-12-31; out of sample (OOS, decisive) 2017-01-01 to 2026-10-31.

## Placebo and control (T1, out of sample)

- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40); each shuffles the day-by-day signal series within its calendar year
  (same count and buy / sell mix per year, random days), then runs the same one-at-a-time rule.
- **Control** (keeps each day's return, drift and volatility, removes the session information): 40 seeded draws; each day's
  Asian and Western parts are swapped with probability one half before `A20` / `W20` are summed, then the same rule.

## Pass bar (all must hold)

1. T1 OOS excess month t >= 2 and its Holm-adjusted p < 0.05;
2. T1 IS excess > 0 (same sign in sample);
3. T1 OOS net R a trade > 0 at 1x and at 2x costs;
4. T1 OOS excess t above the 95th percentile of both the placebo and the control draws.

Otherwise FAIL. A pass would be a hypothesis for the owner, not a rule change; T2 and T3 are reported but cannot pass alone.
