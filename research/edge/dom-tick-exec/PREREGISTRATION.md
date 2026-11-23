# Pre-registration: dom-tick-exec (23 Nov 2026)

Paper research only. Nothing live changes, no rule is proposed from it.

## Why

`dom-zone-holdout`, `dom-placebo` and `combo-grid-4` found that a resting LIMIT at the near edge of an H1 dominant zone makes
about +0.05R a trade before costs on OANDA **mid** 5-minute candles (and that a random recent candle body does as well). A limit
judged on mid candles fills whenever the mid touches the limit. On a broker a buy limit fills only when the **ask** comes down
to it, a sell limit only when the **bid** comes up to it; the orders that the mid only just touches and then leaves (often the
best ones) do not fill. This study asks one question: does the before-cost tilt survive when fills and exits are judged on the
demo broker's own bid / ask ticks? Written and pushed alone, **before any broker tick of these orders is read**.

## The rule (unchanged)

Exactly `combo-grid-3/run.mjs`'s chain `1h>5m`, zone `dom`, no trigger, entry `zedge`, stop `zatr`, as
`dom-zone-holdout/run.mjs` `trades()` builds it (imported, not edited): an H1 dominant zone (two H1 candles of one colour, the
second closing beyond the first's extreme; zone = the first candle's body), alive until an H1 close through its far side or 120
H1 candles; first and second visits on M5 (`signalsFor`, visits `first2`); a limit at the near edge (buy: the zone top; sell: the
zone bottom) from the start of the touching 5-minute candle, alive 12 five-minute candles; stop = the far side minus (plus) half
the round-trip cost of `combo-grid-2` `COSTS` and a quarter of H1 ATR(14) of the last closed H1 candle; the rule's own skips
(planned risk under 2 x cost, risk under cost, data-quality exclusions). Exit **2R** (the demo job's), out at the close of the
first 5-minute candle ending two days after the fill candle's start (`multi`, cap of the 1h chain). Every order has its stop on
the losing side.

## Markets, window, sample

- XAUUSD (OANDA `xau`) and USDJPY (OANDA `usdjpy`): the two markets with a long tick history on the demo broker. The probe's
  depth check of 20 Nov 2026 (council-data `research/probe/ticks-XAUUSD.json`, `ticks-USDJPY.json`) reached 1,095 days on both.
- Orders whose start (the touching candle's start) is in **2023-11-24 00:00 to 2026-11-20 00:00 UTC**.
- The probe reads at most 4,000 fill windows a run and needs about 1-2 hours for 1,500. So a **seeded random sample of 1,200
  orders per market** (mulberry32, seed 20261123, without replacement, from every order the rule places in the window; all of
  them if fewer), split into query files of at most 1,500 fill windows (whole orders per file). Power, said now: with about
  2,400 orders and a per-trade R sd near 1.3, the pooled T2 can reach t 2 only if the tick tilt is about +0.055R or more; a
  FAIL at this n means "not shown", not "disproved". T1 is paired and much tighter.

## The measurement (tick probe `fills` and `marks`, unchanged code)

The probe answers only two kinds of first crossing in a window of at most 30 minutes: `dir +1` = the first tick with
**ask >= level**, `dir -1` = the first tick with **bid <= level**, returning that tick's time, bid and ask. A buy limit needs
"ask <= L", which the probe cannot ask directly, so it is bracketed with a fixed spread allowance **c** (XAUUSD $0.20,
USDJPY 0.006 yen: above every hour's 90th-percentile quoted spread the probe has measured, $0.09-0.17 and 0.004). For a buy (a
sell mirrors every line: bid and ask swap, signs flip):

1. **E0**: the first tick in [order start, +30 min] with bid <= L. None: the ask never reached L, **not filled** (certain).
   If that tick's ask <= L as well (price went through): **filled** at that ask.
2. **E1**: the first tick in the same window with bid <= L - c. If its ask <= L: **filled**, at L (a limit fills at its price),
   at a time no later than that tick.
3. E0 found but neither tick shows ask <= L: **fill unresolved** (the ask may have touched L while the spread was under c).
   Primary: counted **not filled** (R 0). Sensitivity, reported: counted filled at L.
4. **Stop** (exact): the first tick with bid <= S (buy) / ask >= S (sell), in windows over every 5-minute candle from the order
   start whose mid low (high) came within NEAR of S (XAUUSD $0.50, USDJPY 0.05, the basis margins of the two `-exec` studies);
   windows merged up to 30 minutes.
5. **Target**: T = L + 2 x (L - S), fixed when the order is placed (the demo job's absolute take-profit). It needs bid >= T,
   so it is read as the first tick with ask >= T + c, accepted only if that tick's bid >= T, over every candle whose mid high
   came within NEAR of T. A bid that reached T while the ask never reached T + c is missed (a bias against the rule, said now).
6. Candles for 4 and 5 run from the order start to the earlier of the two-day deadline candle and one hour after the mid exit
   candle. The exit is the earlier of the stop tick and the accepted target tick; a crossing before the fill does not count.
7. **Time exit**: where the mid path ended at its deadline, the quote last seen at or before that candle's end (probe `marks`,
   `marks_back` 300 s): the bid (buy) / ask (sell).
8. A filled order with no stop, no target and no time quote found is **unresolved** and left out of both tests (reported). If
   more than 10 % of the filled orders of a market are unresolved, that market's verdict is INCONCLUSIVE and a second query
   pass for them is the next step.

## R

Planned risk r = |L - S|. Tick R = side x (exit - fill) / r (0 when not filled). After commission: minus 2 x k x fill / r with
k = 0.000024 (XAUUSD) and 0.0000225 (USDJPY), the demo's commission a side. "Before costs" here still pays the spread, because a
bid / ask fill is the spread; only commission is left out. Mid R = `multi`'s 2R result on the same order, as the grids measured
it (0 when the mid did not fill).

## Tests (pooled XAUUSD + USDJPY; each market reported)

- **T1 (paired)**: per order, tick R minus mid R; its mean and the t of its calendar-month sums. Read: real fills take part of
  the tilt when the mean is below 0 with month t <= -2. Reported before costs and after commission.
- **T2**: tick R a filled trade > 0 with month-sum t >= 2 and n >= 300 filled trades. **PASS / FAIL** is judged **before
  costs** (as above) and, separately, **after commission**; the after-commission line is the one that would matter for money.

Also reported: fill rate on ticks vs mid, the unresolved counts and the sensitivity of item 3, by year and side, entry slippage
(fill minus L, and the time from order start to fill), the share of mid wins that did not fill on ticks. These years were read by
`combo-grid-3` / `-4` (2020 on): this prices the rule at real fills, it is not new evidence that the tilt exists, and a PASS is
no reason to trade by itself. Deliverables: `run.mjs` (`queries`, `report`), the query files, `RESULT.md`, `result.json`.

## Amendment (23 Nov 2026, 18:00 UTC): a code bug against item 5, fixed before the verdict

The first query files put a SELL order's target on the wrong side of its entry (`entry + d * 2 * (entry - stop)`, where
`entry - stop` already carries the side), against item 5 above (T = L + 2 x (L - S)). Found while checking the first probe
batch (dom-b1): its report read -0.94R a filled trade, with "target" exits scoring -2R. The mid-candle results were not
affected (they come from the grid's own `multi()`). Fix: `T = entry + 2 * (entry - stop)`; the target queries get new ids
(`|u<k>`) so the wrong ones (`|t<k>`) are never read; the order sample, entries, stops and every other query are unchanged
(the same 1,200 orders a market, checked id for id). Batch dom-b1's entry, stop and time answers are kept; everything it did
not answer is asked again in batches dom-c1 and dom-c2. The rule, the bar and the windows are unchanged.
