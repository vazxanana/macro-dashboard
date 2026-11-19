# Month-end US dollar rebalancing flow into the London 4 pm fix: pre-registration

Written and committed **before** any number below was computed (13 Nov 2026). The rule, the costs, the windows and the pass
bar are fixed here; nothing in them changes after the results are seen. Anything added later is labelled a post-hoc
diagnostic in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. A pass makes a candidate for a
paper shadow that the owner decides on (`research/proposals/`); it is never a live change.

## Why this study

Melvin and Prins (2015, Journal of Financial Markets, "Equity hedging and exchange rates at the London 4 p.m. fix") report
that on the last trading day of a month foreign investors who hold US equities rebalance their currency hedges: when US
equities outperformed foreign equities over the month, hedges are topped up by selling dollars into the 4 pm London fix, so
the dollar tends to weaken into the fix; when US equities underperformed, the dollar tends to strengthen. One published
flow effect, one rule, nothing fitted. (Not the same effect as the FX weekly reversal or the index turn-of-month studies.)

## Data

- **FX**: OANDA mid **H1** candles of `eurusd gbpusd audusd usdjpy usdchf usdcad` through the keyless candle proxy
  (`https://meridianx.dev/md/bars?sym=<key>&tf=1h&from=&to=`), fetched by `node --use-env-proxy
  research/edge/fx-month-end/run.mjs fetch <dir>`, kept outside git. OANDA H1 candles start on the UTC hour.
- **Equities**: the council's OANDA **daily** candles (00:00 UTC days) of `spx500`, `de40`, `uk100`, `jp225`, council-data
  `research/daily/<key>.json` (copied by the same `fetch` step with `git show`, no network). Index CFD prices in their own
  currency.

## Clock

- **London time with daylight saving**: UTC+1 from the last Sunday of March 01:00 UTC to the last Sunday of October 01:00
  UTC, otherwise UTC. 10:00 London = 09:00 UTC in summer, 10:00 UTC in winter; 16:00 London = 15:00 / 16:00 UTC.
- **Last London business day of a month**: the last Monday-Friday of the month that is not an England and Wales bank
  holiday (New Year's Day with its substitute, Good Friday, Easter Monday, early May (moved in 2020), spring (last Monday
  of May, moved in 2012 and 2022), summer (last Monday of August), Christmas and Boxing Day with substitutes, and the
  one-off days of 2011, 2012, 2022 and 2023). The day must also have all six FX H1 candles 10:00-15:00 London and the 24
  candles before them; otherwise that month has no event (counted and reported).

## The rule

- **Signal at 10:00 London** of the event day. For each index, month-to-date return = close of the last daily candle that
  had **closed by 10:00 London that day** (start + 24 h at or before the signal time) ÷ close of the last daily candle that
  closed at or before 00:00 UTC of the 1st of the month − 1. Nothing at or after 10:00 London is read.
  gap = MTD(spx500) − mean(MTD(de40), MTD(uk100), MTD(jp225)). A missing index = no event.
- **Direction**: gap > 0 (US outperformed) → **short USD**: buy EUR/USD, GBP/USD, AUD/USD; sell USD/JPY, USD/CHF, USD/CAD.
  gap < 0 → **long USD** (the opposite of every leg). gap = 0 → no event.
- **Entry**: the open of the H1 candle that starts at 10:00 London. **Exit**: the close of the H1 candle that starts at
  15:00 London (the 16:00 London fix). Six H1 candles.
- **Stop, every leg**: 1.5 × ATR(24) from the entry, ATR(24) = mean true range of the 24 H1 candles that closed by 10:00
  London (the candles before the entry candle). Each H1 candle of the hold is checked in order: a candle that opens past the
  stop exits at its open; otherwise a candle whose low (buy) or high (sell) reaches the stop exits at the stop. Every trade
  has a stop.
- **Basket**: equal risk, the six legs. Leg R = (side × (exit − entry) − round-trip cost) ÷ stop distance; **basket R per
  event = the mean of the six leg R** (1R of risk split across six legs).
- **Variant (pre-stated, the second of two rules)**: the same, traded only when |gap| is above the median |gap| of the
  events of the discovery window 2008-2015 (that median is computed on 2008-2015 events only and then fixed).

## Costs (net of all of them)

The measured raw-spread model of `council/fills.mjs` (section "Forex spreads: a raw-spread account" of CLAUDE.md), on the
broker quotes pinned in `tests/fixtures/ctrader/symbols-raw-12nov.json`: commission 22.5 USD per million a side = 0.0045 %
of the price a round trip; quoted spread = the measured median (0 on EUR/USD, GBP/USD, AUD/USD, USD/CHF, USD/CAD; USD/JPY is
not in the fixture and pays the default 1-pip spread); slippage half the default 1-pip spread at entry and at exit (1 pip a
round trip). Per leg: (spread + 1 pip) + 0.0045 % of the entry price, charged in price and divided by the stop distance.
No financing: the hold (10:00-16:00 London) never crosses the 17:00 New York rollover.

## Windows and statistics

- **Discovery / check**: events of 2008-01 to 2015-12. **Decisive**: events of 2016-01 to the last month-end with data
  (October 2026).
- t on events = mean ÷ (sd ÷ √n) of the per-event basket R. One-sided p from the normal approximation of t. **Holm over the
  two rules** (base and variant) on the decisive window: the smaller p must be ≤ 0.025, the larger ≤ 0.05.
- **Placebo**: the same rule (signal at 10:00 London from the month-to-date gap, the same legs, stops, costs) on **40 random
  London business days a year that are not the last London business day of their month**, drawn with a seeded generator
  (mulberry32, seed 1) from each year's eligible days of the decisive window. From the placebo events 2,000 resamples (seed
  2) of the same size as the decisive base-rule sample give a distribution of the mean; its 95th percentile is the bar.

## Pass bar (a rule passes only with all of these)

1. Decisive window: basket net R per event **> 0** with **t ≥ 2**, and Holm-significant as above.
2. Decisive window: **n ≥ 100 events** (the variant, about half the months, will very likely miss this; it is reported
   regardless and cannot pass on fewer events).
3. 2008-2015: basket net R per event of the **same sign** (positive).
4. Base rule only: the decisive mean is above the **placebo's 95th percentile**. (The variant is compared with the same
   placebo, for information.)

Otherwise **FAIL**. Reported regardless: n, mean, sd, t, total R, win share, worst drawdown, share of legs stopped, gross
(before costs) figures, per-pair mean R, per-year totals, and the share of events with US outperformance. Gross figures,
per-pair and per-year splits are descriptive and cannot change the verdict. No parameter (10:00 entry, 16:00 exit, 1.5 ×
ATR(24), equal risk, the three foreign indices) is varied; a variant would need its own pre-registration.
