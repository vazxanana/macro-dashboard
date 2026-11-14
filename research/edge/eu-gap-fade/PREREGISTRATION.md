# Does a European index session partly reverse a US-led overnight gap? (DE40, UK100, EU50): pre-registration

Written and committed on 14 Nov 2026, alone, before any candle of DE40, UK100 or EU50 was fetched for this study and
before any gap, session return or trade of these markets was computed. The rule, calendar, costs, windows, statistics,
placebo and pass bar are fixed here and do not change after the results are seen. Anything added later is labelled post
hoc in `RESULT.md`.

Paper research only: no live rule, size, filter, stop, config, council member, page or mirror setting is changed by this
study, whatever it finds. ICT is not involved; nothing under `ict/` is read or changed. A pass leads at most to a proposal
for a forward paper shadow that the owner decides on; it is never a live rule.

## Source of the idea, and why JP225 / HK33 are excluded

The idea comes from the `us-asia-lead` study (#913, FAIL; branch `us-asia-lead`, not on main). Its pre-registered trade
(follow the US cash session's direction in the Asian session) lost. Its RESULT.md then noted, **after the run and not
pre-registered**, that the US cash session's return is correlated +0.45 to +0.70 with the next Tokyo / Hong Kong
cash-to-cash gap, while the Asian session that follows slightly REVERSES it (correlation −0.04 to −0.12; the US-direction
trade's gross R negative in all six cells). That reversal is a post-hoc observation on **JP225 and HK33**: those two markets
have already been looked at, so they cannot be the decisive test of it and are **excluded** from this study. The test is
on three markets the observation was not seen on: the European cash indices DE40, UK100 and EU50, whose overnight gap
spans the whole US afternoon session.

What is already known, said plainly:
- `gap-fill` (FAIL; branch `gap-fill`) faded the 09:30 New York opening gap on NAS100 / SPX500 with a 1R stop at the
  previous close and lost after costs in both windows. That is a different market and a different exit (target = the
  previous close); it is a reason to expect little here.
- `us-asia-lead`'s reversal was small: its gross figure in the reverse direction was +0.005 to +0.029R a trade at a one-ATR
  stop, about the size of a 0.04 % round trip. The same arithmetic may bite here.
- No European index gap or session return has been computed by me before this file.

## Data

- OANDA mid **M15** candles through the site's keyless candle proxy (`/md/bars?sym=…&tf=15m`): `de40` (DE30_EUR),
  `uk100` (UK100_GBP), `eu50` (EU50_EUR) and `spx500` (US500, for T3 only), 1 January 2005 to 14 November 2026 00:00 UTC,
  in windows of at most 4,999 candles, complete candles only, rows `[t, o, h, l, c]`, UTC. Fetched with
  `node --use-env-proxy research/edge/eu-gap-fade/run.mjs fetch <dir>`; kept out of git. Where each file starts is
  whatever OANDA serves; it is reported, not chosen.
- **Daily candles for the ATR** are built from the same M15 file of each instrument: the CFD's day, 17:00 New York to
  17:00 New York, named by the New York date it ends on (the `us-asia-lead` / `index-overnight` definition, copied).

## Calendar

- **London time with UK / EU summer time**: `euSummer` from `council/histdata.mjs` (last Sunday of March 01:00 UTC to
  last Sunday of October 01:00 UTC; the UK and the euro area change on the same instants). London = UTC+1 in summer, UTC
  otherwise.
- **Cash session** of each market, in London time (the brief's clock for all three): **open 08:00, close 16:30**
  (Xetra / Euro Stoxx 09:00-17:30 CET = 08:00-16:30 London; LSE 08:00-16:30). In UTC: 07:00-15:30 in summer, 08:00-16:30
  in winter.
- **Open price** O of a day = the open of the M15 candle starting at 08:00 London. **Close price** C of a day = the close
  of the M15 candle starting at 16:15 London (ending 16:30).
- A **session day** of a market = a weekday (Monday to Friday, London date) on which BOTH of those candles exist in that
  market's file. European exchange holidays are not excluded by a calendar (none exists in this repository); a day the CFD
  did not trade at both times is not a session day; a holiday on which the CFD printed both candles is traded and this is
  said, not corrected. The **previous session** of a session day = the latest earlier session day of the same market.

## The rule (fixed; no parameter is tuned)

Constants: `MED_N = 20`, `TRIG = 0.5`, `ATR_N = 20`, `STOP_ATR = 1.0`, `COST = 0.0004` of the entry price a round trip.

1. **Gap** g = O (today's 08:00 open) − C_prev (the previous session's 16:30 close). Only candles at or before today's
   08:00 open are read for the gap and the trigger: no look-ahead.
2. **Trigger**: |g| > `TRIG` × the median of |g| over the `MED_N` = 20 previous session days of that market (today
   excluded). No trade before 20 earlier gaps exist, and none when g = 0.
3. **Side**: fade the gap. Gap up → **sell**; gap down → **buy**.
4. **Entry** = O, the open of the first M15 candle of the session (08:00 London).
5. **Stop** (every trade has one, on the losing side): entry ∓ `STOP_ATR` × ATR20 (above a sell, below a buy); ATR20 = the
   simple mean of the true range of the 20 most recent daily candles of THAT instrument that ended at or before the entry
   time; no trade without 21 such days. r0 = |entry − stop|. No target; the stop never moves.
6. **Stop checks** on every M15 candle from the entry candle (08:00) to the exit candle (16:15) of the same day, both
   included: a candle that opens through the stop exits at its open; otherwise a candle whose range reaches the stop exits
   at the stop. Missing candles in between are simply not checked.
7. **Exit**: not stopped → the close of the 16:15 London candle (the cash close).
8. **R** = side × (exit − entry) / r0 (gross). **Cost** = `COST` × entry / r0 a round trip; net R = R − cost. Also reported
   at twice the cost (not a pass condition). **No financing**: the hold is inside one London day and never spans the 17:00
   New York rollover (21:00 / 22:00 UTC).

## The tests

- **T1: DE40**, every triggered day.
- **T2: UK100 and EU50 pooled**: the triggered trades of both markets in one stream (month sums over the pooled trades).
- **T3: DE40, US-led gaps only**: T1's trades on days whose gap has the SAME sign as the prior US cash session's return.
  US cash session = SPX500 from the open of the M15 candle starting 09:30 New York to the close of the M15 candle ending
  at the cash close (16:00, or 13:00 on an NYSE early close), on an NYSE cash day (NYSE holidays, special closures and
  early closes copied from `us-asia-lead`, New York daylight time by the US rules of each year). The **prior US session**
  of a European session day = the latest US cash session whose close is after the previous European session's 16:30 close
  and at or before today's 08:00 London open (normally the New York session of the previous weekday). No such session, a
  missing US candle, or a US return of exactly 0 → no T3 trade (counted).

## Windows (by the European session day)

- **Decisive: 1 January 2016 to the end of the data.** Holm p is read here.
- **Replication: the start of the data to 31 December 2015.** Must be positive too.

## Statistics

- Per test and window: n, buys / sells, win rate, gross R, cost R, net R, net R at 2x cost, total, max drawdown (closed,
  in R), stops, by year, and the median stop as a % of price.
- **t on calendar-month sums** of net R (months with at least one trade); one-sided p (H1: net R > 0) from the normal
  approximation.
- **Holm** over the three tests (decisive p), family 0.05.
- **Placebo** (each test and window, reported, not a pass condition): 40 seeds (1 … 40); on every day the test traded the
  side is drawn at random (½ / ½) with the same entry, the same stop distance, same candles, same exit and costs;
  statistic = mean net R a trade; the real value's rank among the 40 and the 5th / 50th / 95th percentiles are reported.
- Descriptive (no test): the correlation of the European session's return (C / O − 1) with the gap (O / C_prev − 1), and,
  for DE40, with the prior US session's return.

## Pass bar (per test)

A test passes when ALL hold: decisive net R a trade > 0; replication net R a trade > 0; decisive Holm-adjusted p < 0.05;
decisive n ≥ 200 (T3: n ≥ 100). **Verdict PASS** when at least one of the three tests passes; **INCONCLUSIVE** when none
passes but at least one is net-positive in both windows; **FAIL** otherwise. A pass is a hypothesis for a forward paper
shadow, never a live rule.

## Not done, on purpose

No other trigger multiple, stop, target, exit time, gap band, weekday, news or volume filter, no other market (JP225 and
HK33 excluded above; US indices covered by `gap-fill`). Any of these needs its own pre-registration.
