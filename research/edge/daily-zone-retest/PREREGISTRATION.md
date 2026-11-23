# Daily zone retest, entered on an H1 box break (pre-registration, 23 Nov 2026)

Written before any candle of a test window is read and before any code exists. The idea is the owner's, described in chat on
22 Nov 2026 with marked charts (EUR/USD, a sell on the return to an April 2026 Daily zone in late August 2026; gold, a sell from
the 4,100-4,148 zone on 9-11 Nov 2026); the words are the desk's. Both examples sit inside the out-of-sample window and were
looked at by eye, so a 2010-2019 replication is part of the pass bar. Related studies that FAILED here: `box-zone` (Daily turn
box + H4 boxes, target the test box, median target 0.35R), `gold-box-breakout`, `gold-box-fade`, `h4-zone-trail`,
`ltf-structure`. This rule differs on purpose: the zone comes from a strong breakout candle, the entry is one H1 box break, and
the target is a structural H1 swing at least 1R away. Research only: nothing live changes whatever the result.

## The rule (one definition; the two tests differ only by the filter)
- **Candles**: OANDA mid; Daily = 17:00 New York trading days (`edgekit.dailyNY`, weekend folded into Monday); H1 and 5m UTC.
  Closed candles only; a break is a CLOSE beyond a level, never a wick.
- **Daily box**: `edgekit.boxesClose` on Daily candles (a box starts on the candle that closed out of the previous one, holds the
  highs and lows of its candles while they close inside it, ends on the first close outside).
- **Strong breakout candle**: the Daily candle that ends a box (closes out of it) and whose range (high - low) is at least 1.3 x
  the mean range of the 20 Daily candles before it. The box must hold at least 2 candles before the breakout candle.
- **Daily zone**: the highest high and lowest low of the LAST TWO candles of that box (the two candles just before the
  breakout candle). Breakout down = a sell zone; breakout up = a buy zone. Known at the breakout candle's close. It extends
  right and ends on the first Daily close beyond its far side (above the zone's top for a sell zone, below its bottom for a
  buy zone). Several zones may be alive at once.
- **Leave and return**: after the zone is known, price leaves it (an H1 candle wholly beyond its near side: high below the
  zone's low for a sell zone, low above its top for a buy zone), then comes back (the first later H1 candle that trades into
  it). That return opens a **visit**; the visit ends when an H1 candle is again wholly beyond the near side, when the zone
  ends, or after 120 H1 candles, whichever comes first.
- **Entry**: H1 boxes = `edgekit.boxesHL(H1, 3)` (between a confirmed swing high and swing low, 3 candles a side, ended by a
  close outside). The first H1 box whose breaking close falls inside the visit, breaks in the zone's direction (down for a
  sell zone, up for a buy zone) and whose range touches the zone. Market entry at the open of the next H1 candle.
- **Stop**: beyond the H1 box's other side by 10 % of the box's height (sell: box high + 0.1 x height). Every trade has a
  stop on its losing side; a trade whose entry is already past it is skipped.
- **Target (pre-registered, one)**: the most recent H1 swing low (sell) / swing high (buy), 3 candles a side, confirmed by the
  entry time, that lies at least 1R beyond the entry; none within the last 500 H1 candles = no trade.
- **Exits**: stop or target on 5m candles (stop first when one candle holds both; a gap through the stop fills at the open),
  else out at the close of the 240th H1 candle after entry (`edgekit.simulate`).
- One trade per visit; one open position per market (a new signal while one is open is skipped).
- **Weekly-box direction (test T2 only)**: weekly candles built from the Daily candles (Monday to Friday), `edgekit.boxesClose`
  on them; the side = the direction of the last weekly box that broke, using only weekly candles closed before the entry.
  T2 keeps a T1 trade only when that side equals the zone's direction.

## Markets, windows, costs
- Gold (XAU/USD) and EUR/USD, GBP/USD, USD/JPY, AUD/USD, pooled; from the shared candle cache (outside git).
- In sample: entries 2020-01-01 to 2023-12-31. Out of sample: entries 2024-01-01 to the last complete day in the cache.
  Replication: entries 2010-01-01 to 2019-12-31. Exits may run past a window's end. Windows are judged separately.
- Costs: `edgekit.COSTS` round trip per market in price units, taken off each trade as cost / risk; gold buys also pay
  overnight financing by `council/fills.mjs` `financing()`. Check at 2x costs (both doubled). Today's costs on every year.

## Tests and statistic
- **T1 (primary)**: the rule without a filter. **T2 (secondary)**: the rule with the Weekly-box direction filter. No other
  test is judged.
- Statistic: mean R a trade after costs, and the t of calendar-month sums of R after costs (`edgekit.stats`), by window.
- Holm over the two tests on the out-of-sample one-sided month-t p values.

## Pass bar (for each test, every line must hold)
1. Out-of-sample mean R after costs > 0, at least 30 out-of-sample trades.
2. Out-of-sample month t >= 2 and Holm-adjusted p < 0.05.
3. In-sample mean R after costs > 0.
4. Out-of-sample mean still > 0 at 2x costs.
5. Replication 2010-2019: mean R after costs > 0 and month t >= 2.

## Verdicts
- **PASS**: a test meets all five lines. A pass only allows proposing a forward paper record to the owner; it is not called an
  edge until that record has its own n and t.
- **INCONCLUSIVE**: fewer than 30 out-of-sample trades in a test, or lines 1-4 hold but line 5 fails with a positive
  replication mean (or line 5 holds and only line 2's Holm step fails).
- **FAIL**: anything else.
- Reported, never judged: each market alone, results before costs, buys and sells, median target distance in R, exit types,
  and whether the detector finds the owner's two examples (a harness check on picked trades, not evidence).
- No setting (1.3x, 20 candles, 10 % buffer, 1R minimum target, 120 / 240 / 500 candles, 3-a-side swings) is tuned after
  any result; a changed setting needs a new pre-registration on other data.
