# Pre-registration: does a big commodity day lead its commodity currency the next day? (14 Nov 2026)

Written and committed alone, before any return, signal or trade of this study was computed. Paper research only: no live
rule, size, filter, stop, config, cost constant, council member or mirror setting changes whatever the verdict. A PASS would
only allow a written proposal for a paper shadow that the owner decides on; a FAIL ends it. Nothing here touches the gold
book (owner decision 44) or the ICT edge.

## The idea

Canada exports oil and Australia exports copper (and other metals), so their currencies are often said to follow those
commodities. The published evidence runs mostly the other way: Chen, Rogoff & Rossi (2010, "Can exchange rates forecast
commodity prices?") found that commodity-currency exchange rates help forecast commodity prices at quarterly horizons, not the
reverse. A common trader claim is the opposite at a daily horizon: a big move in the commodity futures is "priced into the
currency a day late". This study tests that claim as a one-day trade, net of costs, with a stop on every trade.

## What is already known (seen before this was written)

- No study in this repository tests a commodity → commodity-currency lead. Branches read for duplicates: `copper-gold`
  (the copper / gold ratio as a weekly signal for US indices, FAIL), `nas-crypto-spill` (NAS100 sessions into crypto
  overnight), `oil-wednesday` (oil on inventory days), `fx-carry` (a monthly carry book). None trades USD/CAD or AUD/USD on a
  commodity's move.
- From the data I read only the number of candles and the first and last times: council-data `research/daily/` holds
  `wtico` (from 23 Jan 2003), `xcu` (from 31 Mar 2003), `usdcad` and `audusd` (from May 2002), all to 6 Nov 2026; the candle
  proxy serves H1 for all four from 2 / 3 Jan 2005 (first window only read for its first time and count).
- The `fx-carry` study's policy-rate table (`research/edge/fx-carry/rates.json` on branch `fx-carry`) is written from memory
  and says so; it is copied here for the three currencies needed (USD, CAD, AUD), never imported.

## Data, and one departure from the brief

- **OANDA mid H1 candles** for `wtico` (WTI crude), `xcu` (copper), `usdcad`, `audusd`, through the site's keyless candle
  proxy (`/md/bars`, the pattern of `research/edge/trend-breadth-h1/fetch.mjs`), from 2005-01-01 to the end of the data
  (`node --use-env-proxy run.mjs fetch <dir>`; files kept out of git).
- **Departure (stated before any result)**: the brief names council-data `research/daily/<key>.json` for daily candles. Those
  files are UTC days (00:00 to 00:00 UTC), while this study's day is the **17:00 New York day** (the brief's "17:00 NY close
  to close", the forex market's own day). So every daily candle is built from the H1 file: an H1 candle starting at time t
  belongs to the New York trading date of t + 7 h in New York local time (`Intl` America/New_York; a 17:00 NY candle opens the
  next date, so Sunday evening counts into Monday). A day's open = its first H1 open, close = its last H1 close, high / low
  over its H1 candles. The daily files are not used for any figure.
- **A day counts** for a market only when it has at least **6 H1 candles** (drops holiday stubs) and falls Monday to Friday.
  For each market, "the previous day" is the previous counted day of that market.

## The rule (fixed)

- **Commodity move on day d**: r(d) = ln(close(d) / close(d − 1)) of the commodity. **Threshold**: σ(d) = the sample
  standard deviation of the 60 commodity returns r(d − 60) … r(d − 1) (day d itself excluded; 60 earlier returns required).
  **Up day**: r(d) > 1.5 σ(d). **Down day**: r(d) < −1.5 σ(d). Everything uses candles that closed by day d's close.
- **T1, oil → USD/CAD**: an up day of `wtico` = **sell USD/CAD** (CAD should strengthen); a down day = **buy USD/CAD**.
- **T2, copper → AUD/USD**: an up day of `xcu` = **buy AUD/USD**; a down day = **sell AUD/USD**.
- **Trade day d + 1** = the first counted day of the FX pair after d, at most 4 calendar days after d (else no trade).
- **Entry**: market at the open of day d + 1 (its first H1 open).
- **Stop (every trade has one)**: entry − 1 × ATR(20) for a buy (+ for a sell), ATR(20) = the mean true range of the FX
  pair's last 20 counted days up to and including day d (past data only; 21 days required). Checked on every H1 candle of day
  d + 1 in order: a candle that **opens** past the stop exits at that open (a gap); otherwise a candle whose low (buy) / high
  (sell) reaches the stop exits at the stop. The entry candle is checked by its range only.
- **Exit**: otherwise at the close of day d + 1 (its last H1 close). One trade per signal; trades of one test never overlap
  (each ends at its day's close, the next can only open at a later day's open).
- **R** = side × (exit − entry) / r0, r0 = |entry − stop| (1 ATR).

## Costs (net R = price R − cost + carry)

- The raw-spread forex model of CLAUDE.md "Forex spreads": quoted spread **0.3 pip**, **half a spread of slippage on each
  market order** (entry and exit, a stop included), commission **22.5 USD per million a side** (0.000045 × entry a round
  trip for both pairs). Cost in R = (0.3 + 0.15 + 0.15) × 0.0001 + 0.000045 × entry, divided by r0.
- **Financing**: a trade still open at day d + 1's close is held over that 17:00 New York rollover: nights =
  `council/fills.mjs` `nights` (imported) counted over the rollover of that trading date, i.e. `nights(D + 21 h, D + 23 h)`
  with D the trading date's UTC midnight (Monday to Friday one night, **Wednesday three**). A trade stopped before the close
  holds no rollover (0 nights). Per night: (side × (r_base − r_quote) − 1.0) / 100 / 365 × entry / r0, with the policy rates
  in force on that trading date from `rates.json` (copied from `fx-carry`); the 1.0 % a year markup is charged whichever side
  (credited carry is allowed, as in `fx-carry`). Base / quote: USD / CAD for USD/CAD, AUD / USD for AUD/USD.
- **At 2x cost**: spread, slippage, commission and the markup doubled.

## Windows

The signal date d decides the window. **Decisive: 2016-01-01 to the last trade day on file. Replication: 2006-01-01 to
2015-12-31** (2005 is warm-up for σ and the ATR; the files reach January 2005, so nothing earlier is used).

## Statistics

- Per test and window: n, win rate, mean net R a trade, total net R, worst drawdown (closed, trade by trade), gross and at 2x
  cost.
- **Month-sum t**: net R summed by calendar month of entry, every month from the window's first to last month counted (a
  month with no trade is 0), t = mean / (sd / √months). One-sided p from the normal distribution.
- **Holm** over T1 and T2 (one-sided p of the decisive month-sum t, α 0.05).
- **Pooled**: T1 and T2 trades together (one stream of R; month sums of both), its own test, not in the Holm family.
- **Placebo** (reported, not part of the bar): 40 seeds (1 to 40). Each seed draws, for each test, the same number of trades
  as the real decisive stream on random FX trade days of the decisive window (days with an ATR, drawn without replacement)
  with random sides, same stop, exit and costs. Reported: the 5th / 50th / 95th percentile of the placebo mean net R a trade
  and month-sum t, and how many of 40 placebos reached the real figure.
- **Descriptive context** (not part of the bar), per pair and window: the Pearson correlation of the commodity's day return
  r(d) with the pair's log return of the same New York day d (close to close), and with the pair's return of day d + 1
  (the trade day, close(d) to close(d + 1)), over every day with both.

## The pass bar

A test (T1 or T2) PASSES only when all of:
1. decisive window n ≥ 30;
2. decisive mean net R a trade > 0;
3. decisive month-sum t ≥ 2 and Holm-adjusted one-sided p < 0.05;
4. decisive mean net R a trade > 0 at 2x cost;
5. replication mean net R a trade > 0 (same sign).

The pooled test passes on 1, 2, 4, 5 and a month-sum t ≥ 2 (no Holm). **Verdict: PASS if T1 or T2 passes, else FAIL**; the
pooled result is reported beside it. Nothing (1.5 σ, 60 days, 1 ATR(20), the one-day hold, the costs, the windows) is changed
after this file; anything added later is labelled post hoc in `RESULT.md`.
