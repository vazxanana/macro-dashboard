# Pre-registration: the first H4 candle of the New York day as gold's direction for the day (14 Nov 2026)

Written and pushed alone, before `run.mjs` exists and before any trade result was computed. Paper research only.

## Question

On spot gold, does the direction of the first H4 candle after the 17:00 New York daily open (New York 17:00-20:59) tell
the direction of the rest of that New York day (21:00 to 17:00), net of costs, out of sample, and better than taking the
same side on every day of the same year?

## Status of this rule

A **stand-alone intraday rule**, tested on its own. It is never a gate, exit, entry or size of the live gold book (Gold
trend + Gold daily engulf) and it does not read the book's positions (CLAUDE.md "Path to live", item 44). Whatever the
verdict, nothing live changes; a pass would only be a candidate for the owner, with a forward paper record first.

## Dedupe

- `gold-us-asia` (branch): the Asian session 00:00-07:00 UTC after the NEW YORK CASH session's move (follow / fade). A
  different signal (the 13:30-20:00 UTC cash move) and a different hold.
- `gold-asia-break` (branch): a breakout of the 00:00-07:00 London range into London, out by noon New York.
- `gold-session-drift` (branch): fixed session holds with no signal.
- `gold-pdhl-break`, `gold-comex-orb`, `gold-london-orb`: range breakouts, not the sign of the first H4 of the day.
- `gold-h4-*` (pin bar, inside bar, supertrend, trendline, pullback resume, vol breakout side): none reads the first H4 of the
  New York day. Not in `research/edge/`, not on a remote branch, not in the shared topics list.

## Data

- OANDA mid H1 XAU/USD from March 2006 (the site's candle proxy; cache kept out of git; `run.mjs fetch <dir>`).
- New York time from `council/histdata.mjs` `nyOffsetH` (US daylight time). New York day = 17:00 to 17:00 New York; an H1
  candle belongs to the day its New York start time falls in (17:00 or later = the next day). Sunday's reopen goes with Monday.
- **First H4** = the H1 candles of the day starting 17:00, 18:00, 19:00, 20:00 New York (the 17:00 hour is the daily halt and
  is usually absent). Open = the first of them's open, close = the last of them's close. A day is used only when it has at
  least 2 first-H4 candles, at least 8 H1 candles from 21:00 on, and at least 15 H1 candles in all.
- ATR = the mean true range of the 20 New York days before the signal day (completed days only).
- Windows by the New York day: warm-up 2006; **in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31**.
- Event counts made before this file (signal conditions only, no outcome read): usable days 2,584 IS / 2,546 OOS; T1 1,324 /
  1,124; T2 (|body| >= 0.3 ATR) about 250 / 200 (0.25 ATR: 370 / 295, 0.35 ATR: 179 / 147); T3 574 / 526. Every window >= 100.

## The trade (all on the CLOSED first H4; nothing later is read)

- body = close − open of the first H4. side: T1 follow sign(body) when |body| >= 0.1 × ATR; T2 FADE (−sign) when
  |body| >= 0.3 × ATR; T3 follow sign(body) when |body| >= 0.1 × ATR AND sign(body) = sign(previous day's close − mean of
  the 20 previous days' closes).
- Entry at the open of the day's first H1 candle starting at or after 21:00 New York.
- Stop 1 × ATR from the entry (every trade has a stop). No target.
- Exit at the close of the day's last H1 candle (the one ending at 17:00 New York).
- Managed on H1 candles: a stop gapped through fills at the candle's open; otherwise at the stop.
- One trade per day at most (the trades cannot overlap).
- R = side × (exit − entry) / risk.

## Costs

- $0.60 a round trip (spread $0.30 + half a spread of slippage on each order, the convention of the gold H4 studies), in R
  = 0.60 / risk.
- Financing on buys: `council/fills.mjs` `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's swap of 11 Nov 2026) × entry / risk. The hold ends at 17:00 New York, so it is almost always 0 nights; charged by
  the same function anyway. Shorts pay and earn nothing.
- Net x2: gross − 2 × (cost + financing).

## Baseline (same side, every comparable day of the same year)

For every calendar year and side, the baseline is the mean net R of the same trade (same entry, stop and exit) taken on
EVERY usable day of that year, whatever the first H4 did. lift(trade) = net R − the baseline of its year and side. Reported
per window: mean lift and its month-sum t.

## Tests and statistics

- **T1 (primary):** follow the first H4, |body| >= 0.1 ATR.
- T2: fade a large first H4, |body| >= 0.3 ATR.
- T3: follow the first H4 when it agrees with the 20-day trend.
- t on calendar-month sums of net R (months with no trade count as 0), by exit month. One-sided p from the OOS t (normal),
  **Holm over the three tests**.
- **Placebo**: 40 seeds (seed 20261114 + s). Each real OOS trade is replaced by a random usable day of the same calendar year
  traded on the same side with the same entry, stop and exit; the placebo mean net R per seed. Reported: how many of the 40
  seeds the real OOS mean beats.

## Pass bar (a test passes only on all of these)

1. OOS net R a trade > 0 and OOS month-sum t >= 2 with Holm p < 0.05;
2. in-sample net R a trade > 0 (the same sign);
3. OOS net R a trade > 0 at 2x costs;
4. OOS mean lift over the baseline > 0;
5. the real OOS mean beats at least 38 of the 40 placebo seeds;
6. OOS n >= 100.

**Verdict = T1.** T2 and T3 are reported; one passing alone is named as such, not as the verdict. Nothing is tuned after the
result (thresholds, hours, stop and hold are fixed here). A FAIL ends the idea on these years.
