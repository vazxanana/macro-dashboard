# Risk spillover into the yen: pre-registration

Written and committed **before** any candle was fetched for this study or any part of the rule was run (13 Nov 2026). The
signal, the trade, the costs, the windows, the tests and the pass bar are fixed here; nothing in them changes after the results
are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass would be a hypothesis for a
forward paper shadow that the owner decides on; it is never a live rule.

## Question

After a strong US cash-equity session, does the yen move with risk sentiment in the next Asian session: USD/JPY and AUD/JPY up
after a big S&P 500 up day, down after a big down day?

## What is already known (seen before this was written)

Nothing from this study. The repository has no study of equity-to-yen spillover. `research/edge/costs` and the "Forex
spreads: a raw-spread account" notes describe the demo broker's forex costs. Only the first few candles of each series were
read, to check that the proxy serves them from October 2007.

## Data

OANDA mid candles through the site's keyless proxy (`/md/bars`), complete candles, UTC buckets, 1 October 2007 to
12 November 2026: `spx500` **M30** (the 09:30 New York open falls inside an H1 candle; M30 places it exactly, a stated
departure from "H1"), `usdjpy` and `audjpy` H1. `node --use-env-proxy run.mjs fetch <dir>`; the files stay out of git.

## Signal (known at 16:00 New York, used from 18:00)

- Clock: New York time through `council/histdata.mjs` `nyOffsetH` (US daylight time, 2nd Sunday of March to 1st Sunday of
  November).
- Session return of day d = close of the M30 candle that starts 15:30 New York / open of the M30 candle that starts 09:30
  New York − 1. Both candles must be on file, else the day has no return.
- Days kept: NYSE full trading days only. Skipped: weekends, NYSE full holidays (New Year, MLK, Presidents', Good Friday,
  Memorial, Juneteenth from 2022, Independence, Labor, Thanksgiving, Christmas, with the NYSE's weekend observance), the
  special closures (2 Jan 2007, 29-30 Oct 2012, 5 Dec 2018, 9 Jan 2025) and the early-close days (3 July, the day after
  Thanksgiving, 24 December when weekdays), which have no 16:00 close.
- sd60 = sample standard deviation of the 60 previous kept days' session returns (day d excluded). Signal: r_d > +sd60 → up
  day (long); r_d < −sd60 → down day (short). Fewer than 60 previous days → no signal.

## Trade (each pair alone, same rule)

- Entry: the open of the H1 candle that starts at 18:00 New York after the signal day (17:00 rollover + 1 h). A Friday's
  signal therefore trades from the Sunday 18:00 open (the next Asian session). No H1 candle starting exactly then → no trade.
- Side: long after an up day, short after a down day.
- Stop: 1.5 × ATR(24) of the pair's H1 candles, the 24 H1 candles that ended at or before the entry (true range, simple mean).
  Every trade has its stop from the entry. Risk 1R = that distance.
- Exit: the open of the H1 candle that starts at 03:00 New York (Tokyo session end), i.e. after the nine H1 candles 18:00 to
  02:00. If that candle is missing, the last available close before 03:00 New York.
- Stop on the candles 18:00 to 02:00: a candle after the first that opens beyond the stop exits at its open (gap); otherwise a
  low (long) / high (short) at or through the stop exits at the stop. No target, no break-even, no trail.
- One trade per signal day per pair; trades never overlap (18:00 to 03:00 is inside one day's gap to the next signal).

## Costs (net R)

- Commission: the demo broker's 22.5 USD per million a side = round trip 0.000045 × entry price (`commissionRT` in
  council-data `ctrader/symbols.json`, measured 13 Nov 2026 on the majors).
- Spread + slippage: the measured majors' typical spread is 0 outside the rollover hour, but USD/JPY and AUD/JPY are not in
  the measured file and 18:00 New York is the thin hour after the rollover. Charged: **0.8 pip USD/JPY (0.008), 1.2 pip
  AUD/JPY (0.012)** a round trip, an assumption stated as such.
- Rollover (financing): a trade 18:00 → 03:00 New York crosses no 17:00 rollover, so none is charged; the run counts any trade
  that would cross one (expected 0).
- net R = gross R − (commission + spread) / risk. A x2 cost line is reported, not part of the bar.

## Windows

Signal days 2008-01-01 to 2015-12-31 (replication) and 2016-01-01 to 12 November 2026 (**decisive**).

## Tests and pass bar

Two tests, one per pair, on the decisive window. A pair PASSES only if all hold:

1. net R a trade > 0 and trade t (mean / (sd / √n), on net R per trade) ≥ 2;
2. Holm over the two pairs at 5 % on the one-sided normal p of that t;
3. n ≥ 150 trades;
4. net R a trade > 0 in 2008-15 too (same sign);
5. placebo: 40 seeded draws (seeds 1-40) of random kept days from the decisive window that have an entry for the pair, as many
   days as the real signal, with the same number of long and short trades assigned at random; the real net R a trade must
   beat at least 38 of the 40.

**Verdict**: PASS if at least one pair passes; else FAIL. Reported as well (not part of the bar): gross R, x2 costs, by year,
up vs down days, Friday signals apart, stop-out share, the hit rate.

## Not done here

No other session window, threshold, stop, pair or exit is tested; a variation needs its own pre-registration on other data.
