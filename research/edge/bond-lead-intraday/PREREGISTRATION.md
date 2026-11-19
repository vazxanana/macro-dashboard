# Pre-registration: does a sharp intraday move in US Treasuries lead gold and USD/JPY over the next hour? (14 Nov 2026)

Written and pushed before any candle is fetched or any number is computed. Paper research only.

## Why
Real yields drive gold on a daily scale: `macro-gold` found a same-day correlation, and its daily timing rule failed. This study
asks the intraday question: when the 10-year US Treasury moves sharply inside one 15-minute candle, do gold and USD/JPY follow it
over the next hour, enough to pay their costs?

**Scope (item 44).** This is a stand-alone rule, tested on its own trades. It is NOT a gate, exit, entry or size of the live gold
book (Gold trend + Gold daily engulf) and must never be read as one; whatever the result, nothing live changes. A PASS is a
proposal to the owner, never a rule change.

## Data
OANDA mid M15 candles through the site's candle proxy (`/md/bars?sym=&tf=15m&from=&to=`), keys `usb10y` (the US 10-year Treasury
CFD: the price is the bond, so price up = yield down), `xau` (spot gold) and `usdjpy`, from the first candle the proxy serves to the
last complete candle at fetch time. Cache kept outside git. The report states how far each series reaches. Candles marked `live`
(forming) are dropped.

## Signal
- usb10y M15 return of candle i: `r = close_i / close_{i-1} - 1`, only when candle i-1 starts exactly 15 minutes before candle i
  (otherwise candle i has no return).
- Volatility: the standard deviation of every valid usb10y M15 return whose candle starts in the 28 calendar days (about 20
  trading days) before candle i's start (candle i excluded); at least 1,000 returns are required, else no signal.
- **Signal**: a closed usb10y candle with `|r| > 2.5 x sd`, whose start is between 12:00 and 19:45 UTC inclusive (it closes by
  20:00 UTC). Bond direction = sign of r (+1 = bond up = yields down).

## Trade (same scheme for every test)
- Entry: the open of the traded market's M15 candle that starts at the signal candle's close (signal start + 15 min). No such
  candle = no trade.
- Stop: 1 x the traded market's ATR(96) of M15 candles (simple mean of the true range of its 96 candles ending with the one that
  starts at the signal candle's start; that candle must exist, and 96 earlier candles), placed from the entry. Every trade has a stop.
- Exit: at the close of the last traded-market candle starting before entry + 60 minutes (four M15 candles), unless the stop is
  touched first: a candle whose low (buy) / high (sell) reaches the stop exits at the stop, or at the candle's open when it opened
  through the stop.
- One position at a time per test: a signal while that test's trade is open is skipped.
- R = side x (exit - entry) / stop distance. Net R = R - round-trip cost / stop distance.

## Tests
- **T1** gold in the bond's direction: bond up = buy gold, bond down = sell gold.
- **T2** USD/JPY against the bond: bond up = sell USD/JPY, bond down = buy USD/JPY.
- **T3** T1 without signals in the first 15 minutes after a scheduled US release at 08:30 or 10:00 New York. `council/events.mjs`
  only has history from January 2022, so the rule is the clock: a signal candle that STARTS at 08:30 or 10:00 New York time
  (daylight saving applied through the New York time zone) on any weekday is excluded, whatever the calendar said that day.

## Costs
- Gold: $0.30 a round trip.
- USD/JPY: the raw-spread model of CLAUDE.md "Forex spreads" (council/fills.mjs `costModel` / `tradeCost` with the demo broker's
  measured inputs): quoted spread 0 outside the rollover (12:00-20:00 UTC is outside it), commission 22.5 USD a million a side
  (round trip 0.0045 % of the price), and half a DEFAULT spread of slippage on each market order (entry, and the time or stop exit),
  the default spread being 1 pip (0.01 for USD/JPY). Round trip = 0.000045 x entry + 0.01, in yen.
- No financing (every trade closes within the hour). A 2x-cost check is reported for each test.

## Windows
- **Decisive**: entries from 1 January 2016 to the end of the data.
- **Replication**: every entry before 2016 that the data covers (from the later of usb10y's and the traded market's first candle,
  plus the 28-day warm-up).

## Statistics
- t on calendar-month sums of net R (months with at least one trade), mean / (sd / sqrt(months)); p one-sided from the normal
  approximation.
- Holm over the three decisive p values (T1, T2, T3).
- Placebo, 40 seeds: for each test and seed, every real signal is replaced by a random candle of the same UTC start time (hour and
  minute), drawn from the weekdays of the same calendar year on which the traded market has that candle, with the same side; the
  same trade, cost and one-at-a-time rules apply. Reported: the placebo decisive net R a trade and t per seed, and how many seeds
  reach the real test's t. Reported only, not part of the bar.
- Also reported: gross R, net R, n, win rate, worst drawdown, year by year, by bond direction.

## Pass bar (per test; all three must hold)
1. net R a trade > 0 in the decisive AND the replication window;
2. decisive Holm-adjusted p < 0.05;
3. decisive n >= 150.

Verdict: **PASS** if at least one of T1-T3 passes (the report names which), else **FAIL**. Nothing is tuned after the first run:
no other threshold, window, hour range, hold, stop or market is tried in this study; a variant needs its own pre-registration on
other data.
