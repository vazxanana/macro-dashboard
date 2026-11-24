# Wider stops on the two Equinox fades (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Two fade rules pass before costs and lose after them:

- **Break fade**, `grid7-wide-fade` cell `m15 none atr 2R all`: +0.042R a trade in 2015-26 before costs (n 201,769), -0.118R
  after; the round trip is 0.160R of its 1 x ATR(14) M15 stop.
- **Big-candle fade**, `big-candle-fade` cell `m15 k1.5 nobreak half`: +0.193R before costs (n 54,443), -0.246R after; its stop
  sits just past the candle's extreme (+0.1 ATR), so the round trip is 0.439R.

Cost is a fixed price amount, so a wider stop makes it a smaller share of 1R. The question: with the SAME signals and the same
market entry, does a wider stop (1.5, 2 or 3 x the M15 ATR, or 1 x the H1 ATR) with a 2R target keep enough of the before-cost
tilt to be positive AFTER costs? `fade-zone-targets` found its zone stops (often wider) worse after costs on the break fade; this
study tests fixed ATR multiples, which it did not, and both rules.

## Signals and entry (imported, never edited)

- Data, markets, frames, exclusions, windows and costs exactly as the parent studies: OANDA mid 5-minute candles (shared
  `edgekit` cache), ten markets (`grid7-wide-core` `MARKETS`: xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy),
  `combo-grid-3` `frames`, `combo-grid-2` `exclusions` and `COSTS` (demo figures for gold and the four majors; **ASSUMED, not
  measured** for xag, nzdusd, usdcad, usdchf, eurjpy). Windows by fill time: **discovery 2005-01 to 2014-12, confirmation 2015-01
  to 2026-10** (the parents' windows, so the gate can reproduce them; month sums over every calendar month, empty = 0).
- Break fade: `grid7-wide-fade` `signals`, timeframe M15, context `none`. Big-candle fade: `big-candle-fade` `signals`, `big`
  list, timeframe M15, `kmax >= 0` (body over 1.5 x ATR) and not a break the same way (`nobreak`).
- Entry: market, against the signal, at the open of the first 5-minute candle at or after the signal candle's close.
- **The trade set = the parent cell's own trades** (the parent's skips apply: risk under one round trip, open at the data's end,
  bad intervals). Every variant below is run on exactly those trades (a variant still open at the data's end drops the trade
  from every variant, and the count says so). Gate: the parent's stop and exit on this set reproduce the parent cell's n and
  mean R before costs in both windows exactly (break fade 2R: n 171,523 / 201,769; big-candle fade "half": n 47,354 / 54,443).

## Stops (the variants)

Distance from the fill, against the trade:
- `p` = the parent's own stop (break fade 1 x ATR; big-candle fade candle extreme + 0.1 ATR) - the comparison.
- `a15` = 1.5, `a2` = 2, `a3` = 3 x the parent's M15 ATR(14) value `a` (break fade: ATR at the break candle; big-candle fade:
  ATR of the 14 candles before the candle).
- `h1` = 1 x ATR(14) of the last H1 candle closed at the signal candle's close (`dom-trade-through` `atr14` on the H1 frame).
Target 2R (from the fill, in that variant's own R). Time limit the parents' M15 limit, 1 day, at the last close. Stop first in a
5-minute candle that holds both; a gap through a level fills at the open (`grid7-wide-fade` `exits`, imported). Cost in R =
`COSTS[market]` / that variant's risk.

## Primary tests (8, fixed)

T1-T4: break fade with stop a15, a2, a3, h1, 2R target. T5-T8: big-candle fade with stop a15, a2, a3, h1, 2R target.
Each judged **after costs**: R - cost R per trade, summed per calendar month.

A test passes only if all hold:
1. n >= 200 in both windows;
2. mean R after costs > 0 in discovery AND in confirmation;
3. month-sum t after costs >= 2 in confirmation;
4. Holm-adjusted one-sided p (from the confirmation month-sum t after costs) < 0.05, Holm over the 8 tests.

Verdict: PASS if any test passes, else FAIL.

## Control

The mirror of each test: the same trade WITH the signal (same fill, same stop distance on the other side, same 2R), after costs.
Reported beside each test; if a mirror also clears bars 1-3 the test is marked "not separated from its mirror" and does not pass.

## Reported, not judged

- The 1R target with every stop (descriptive), and the parent stop with 2R (and big-candle "half") for the gate.
- Paired difference after costs, variant minus parent stop, per trade (month t), both windows.
- Exit shares per variant: stopped / target / time.
- **Stopped either way**: of the parent's trades stopped at the parent stop, the share also stopped at each wider stop; and
  the share of all trades stopped under both.
- Cost R per variant; mean risk in parent-ATR units.

## What a pass would and would not mean

A pass is a before-and-after-cost result on mid candles with partly assumed costs, in years the parents already read for this
signal (only the stop is new). It would justify a forward paper record of its own pre-registration, never a live rule. A
before-cost tilt is not an edge. One run, no variants beyond this list.
