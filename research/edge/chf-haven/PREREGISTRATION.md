# Pre-registration: the Swiss franc after a sharp S&P 500 fall (14 Nov 2026)

Written and committed before any price of this study is read. Paper research only: nothing live changes, and a pass would
only be a proposal for a paper shadow the owner decides on (absolute rule 3).

## Claim and question

Ranaldo and Söderlind (2010, Review of Finance, "Safe haven currencies") find that the Swiss franc appreciates when US
stocks fall sharply. That is a same-day association. The question here: is there a **tradeable lag**, i.e. does the franc
keep appreciating over the five trading days AFTER a sharp fall of the S&P 500, net of costs including overnight
financing? A multi-day hold is chosen on purpose: the intraday studies here (for example `risk-spill-jpy`) found gross
effects smaller than the costs.

## Data (fixed)

- OANDA mid daily candles from council-data `research/daily/<key>.json`, read with `git show origin/council-data:…` (no
  network): `spx500` (SPX500_USD), `usdchf`, `eurchf`, `audchf`. All four keys exist in the cache's `_index.json`
  (AUD/CHF is served, so T3 is AUD/CHF; CHF/JPY is not used). The council-data commit read is recorded in result.json.
- The cache's candles are **UTC-aligned** (complete UTC daily candles): a candle runs 00:00 to 24:00 UTC, not from the
  17:00 New York (21:00 / 22:00 UTC) rollover. Saturday and Sunday stub candles are folded into the following Monday with
  `council/fills.mjs` `foldWeekend` (open = the first weekend open, high / low over all, close and time = Monday's), for
  the index and the pairs alike. So "the next daily open" is the open of the pair's next weekday candle, 00:00 UTC; after
  a Friday signal it is the Sunday reopen (about 21:00 / 22:00 UTC), carried by the folded Monday candle.

## Signal (closed candles only)

On the folded S&P 500 series, the day-t return r_t = C_t / C_(t-1) − 1. sd_t = the sample standard deviation of the 60
returns r_(t-60) … r_(t-1) (the day's own return is NOT in it). **Signal on day t when r_t < −2 × sd_t.** The signal is
known at the day's close (24:00 UTC), before the pair's next candle opens.

## Trade (each of the three tests, separately)

- T1 **short USD/CHF**, T2 **short EUR/CHF**, T3 **short AUD/CHF** (each is "long the franc").
- Entry: the open of the pair's first folded candle whose time is after day t (index i).
- Stop: entry + 2 × ATR(20), ATR = the simple mean of the true range of the pair's 20 folded candles up to and including
  the last one before the entry candle (closed only). Every trade has a stop (absolute rule 1).
- Hold: candles i … i+4 (five trading days, the entry day counted), exit at the close of candle i+4.
- Stop check on each candle from i on, high against the stop: an open at or above the stop exits at that open (a gap
  through the stop fills at the open, never at the stop); otherwise a high at or above the stop exits at the stop.
- One position per pair at a time: a signal whose entry candle is at or before the open trade's exit candle is ignored
  (an exit at candle k frees the pair for an entry at k+1).
- A trade whose five candles are not all on file is dropped (open at the data's end), not counted.
- R a trade = (entry − exit) / (2 × ATR), per unit.

## Costs (fixed)

The repository's raw-spread model (section "Forex spreads"):
- spread 0.3 pip paid once a round trip, plus half a spread (0.15 pip) of slippage on the entry and on the exit: 0.6 pip,
  pip = 0.0001 on all three pairs;
- commission 22.5 USD per million of notional a side = 0.0045 % of the entry price a round trip.

Overnight financing for a short X/CHF (long franc), charged per rollover by `council/fills.mjs` `nights` (Monday-Friday
22:00 UTC, Wednesday three) between the entry candle's time and the END of the exit candle (a stopped trade is charged
to the end of the candle it stopped in: conservative):
- USD/CHF: the demo broker's measured `swap.short` −1.314 pips a rollover (council-data `ctrader/symbols.json`, USDCHF,
  read 14 Nov 2026), i.e. 0.0001314 in price a rollover;
- EUR/CHF: not in the symbols file: an **assumed 4.0 % a year** of the price, /365 a rollover;
- AUD/CHF: not in the symbols file: an **assumed 5.5 % a year** of the price, /365 a rollover.

Today's rates are charged for every year (past rates are not known; when Swiss rates were negative a franc long paid
more, when the rate gaps were near zero it paid less). Net R = gross R − cost / (2 × ATR). A **2x cost** column doubles
every cost (spread, slippage, commission, financing). Net without financing is also reported.

## Windows

By entry date. **Decisive: 2016-01-01 → the last candle on file.** **Replication: from the first day with 60 earlier
S&P 500 returns and 20 earlier pair candles, to 2015-12-31.**

## The SNB floor removal (15 Jan 2015)

Candles are used as OANDA gives them; no candle or fill is edited. A gap through a stop fills at the open (never at the
stop, never better). The removal moved every X/CHF pair DOWN, so a short open across it would gain: any trade whose hold
spans 15 Jan 2015 is listed in the report, and the replication window is also shown without it. It is in the replication
window and cannot touch the decisive figures.

## Pass bar (per test; every item must hold)

1. Net R a trade > 0 in the decisive window AND in the replication window.
2. Decisive t on per-trade net R ≥ 2.
3. Decisive t on calendar-month sums ≥ 2 (every calendar month of the window, months with no trade count as 0; signals
   cluster, so this is the honest count).
4. Holm over the three tests at 0.05, on the one-sided normal p of the month-sum t.
5. n ≥ 30 closed trades in the decisive window.
6. Placebo: 40 seeds (1…40). Each seed draws, for each calendar year, as many entry days as that year had raw S&P 500
   signals, uniformly without replacement from that year's eligible S&P days (days with 60 earlier returns), and runs the
   same trade rules (entry, stop, hold, one at a time, costs). The real decisive mean net R must be above the placebo's
   95th percentile (the 38th of 40 sorted means: it must beat at least 38).

Verdict: PASS for a pair that meets all six, else FAIL; the study passes if any test passes. Never call a pass an edge
without n and t; a pass is a proposal for a paper shadow only.

## Reported, not part of the bar

Gross R, cost R, hit rate, share stopped, by year, the 2x-cost figures, net without financing, the number of raw signals
and of signals ignored because a trade was open, and the SNB-spanning trades.

## Related

`research/edge/risk-spill-jpy` (the yen after a strong S&P cash session, overnight, FAIL) and
`research/edge/gold-haven-shock` (gold after equity shock days, FAIL), on other branches; neither covers the franc. Their
code is not imported.
