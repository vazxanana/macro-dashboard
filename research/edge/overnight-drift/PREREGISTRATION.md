# Overnight drift on US index CFDs: hold the night, not the day (pre-registration, 13 Nov 2026)

Written and committed before any result was computed. Research only: nothing live reads it, no rule, size, filter, stop or
council member changes. Not an ICT study (ICT stays a separate edge) and not an opening-range or intraday-momentum study
(other studies of the day cover those).

## The question

Cliff, Cooper and Gulen (2008, "Return differences between trading and non-trading hours: like night and day") and Lou,
Polk and Skouras (2019, Journal of Financial Economics, "A tug of war: overnight versus intraday expected returns") report
that US equity index returns accrue from the close to the next open, while the trading day earns about nothing. A CFD can
hold only the night, but it pays a financing charge for every rollover it holds and a spread on every round trip. Does the
night still pay after those costs, out of sample, on the CFDs this desk can trade?

## Data

OANDA mid candles through the site's keyless candle proxy (`/md/bars`; `fetch.mjs`, the loop of
`research/edge/trend-breadth-h1/fetch.mjs`): SPX500, NAS100, US30 on **M30** (the 09:30 boundary is a half hour; H1 cannot
place it), gold (XAU) on H1. Complete candles only, 2007-10-01 to 2026-10-31. Cache kept out of git.
The 2Y rate: FRED DGS2 weekly, the copy already committed in `research/edge/gold-carry/rates.json` (2006 on), read as of the
last value dated on or before the entry day (no look-ahead).

## Clock and calendar

- New York time from UTC with the US daylight-saving rule in force since 2007 (`council/histdata.mjs` `nyOffsetH`).
- A trading day is a weekday that is not an NYSE full holiday. Calendar (written in `run.mjs`, tested): New Year (Saturday:
  no holiday; Sunday: the Monday), Martin Luther King Day, Presidents' Day, Good Friday, Memorial Day, Juneteenth (2022 on),
  Independence Day, Labor Day, Thanksgiving, Christmas (Saturday holidays observed the Friday before, Sunday ones the Monday
  after); special closures 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025.
- Session: open 09:30, close 16:00 New York; early close 13:00 on 3 July (a weekday that is not itself the observed
  holiday), the day after Thanksgiving and 24 December (a weekday that is not the observed holiday).
- The price at a time X is the OPEN of the candle that starts at X. A missing candle there means no trade that day (counted).

## The rule (one position at a time, long only)

- **Overnight leg (the trade)**: on each trading day D, buy at the session close of D; sell at the session open of the next
  trading day. Friday → Monday and a holiday are held through (one position).
- **Stop (absolute rule 1, every position has one)**: entry − 2 × ATR20, ATR20 = the mean of the high − low range of the
  last 20 COMPLETED overnight windows (close → next open, all candles in between), so it uses only candles that ended before
  the entry. No trade until 20 nights exist. If a candle of the night trades at or below the stop, the position is out at the
  stop, or at that candle's open if it opened below the stop (gap). The stop never moves.
- **Intraday leg (described, not a position)**: the session open of D to the session close of D, the same prices.

## Costs

- Spread, one per round trip, charged on mid prices: SPX500 0.5, NAS100 1.5, US30 2.5 index points (typical retail CFD
  spreads, assumed: the demo account's index spreads are not on file). The intraday leg pays the same spread.
- Financing (overnight leg only): annual rate = DGS2 + 2.5 %, charged per rollover (17:00 New York) the position is held
  through, rate / 365 × entry price per calendar day until the next trading day (so a Friday rollover counts 3, a
  rollover before a holiday counts the extra days). A position stopped out before 17:00 pays none.
- Gold (described): $0.30 spread, financing `council/fills.mjs` `FIN.xau.long` per calendar day of each rollover.
- A row at twice the spread is shown; it does not decide anything.

## Units and windows

- R = the trade's net result divided by its initial risk (2 × ATR20). Returns are also shown as % of the entry price.
- Windows: **2008-01-01 to 2015-12-31** (replication, reported) and **2016-01-01 to 2026-10-31 (decisive)**. A trade
  belongs to the window of its entry day.

## Pass rule (fixed now)

Per index, in the decisive window, all of:
1. Net R a trade > 0 and t ≥ 2 on calendar-month sums of net R (months with a trade; t = mean / (sd / √n)).
2. Holm over the three indices at 5 % (one-sided p from the month t, normal approximation; about 130 months).
3. The overnight leg beats the intraday leg per hour held: mean net % per trade divided by mean calendar hours held, net of
   the costs above (financing on the night only).

**PASS if at least one index passes all three**; it is named. A passing index whose 2008-15 net R is negative is reported
as "not robust". Gold is descriptive (no verdict). If the study passes, a proposal for a PAPER SHADOW only is written in
`research/proposals/2026-11-13-overnight.md`; no live change either way.

## Gold (descriptive)

Its own sessions: a "day" leg 08:00 → 16:00 New York and a night leg 16:00 → 08:00 the next weekday (Friday → Monday), on
H1 candles; a weekday without a candle at 08:00 or 16:00 is skipped. Same stop rule (ATR20 of its night ranges), $0.30
spread, financing as above. Reported by window, gross and net.

## Reported besides the verdict

Gross R and %, the share of the gross the spread and the financing take, trades stopped, win rate, worst drawdown in R,
per-year net R, nights skipped for missing candles.
