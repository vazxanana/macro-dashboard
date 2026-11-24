# Big-candle fade, only the trades whose cost is small against their risk (pre-registration, 24 Nov 2026)

Owner: "there must be a way to improve the fade of m15". Paper research only; nothing live changes whatever the result.

## Why this question

Five studies of the desk's Big-candle fade (m15, k 1.5, no break, target the candle's 50 %) say the same thing: before costs
the trades make about +0.19R (2015-26), after costs −0.246R. The cost is about 0.44R a trade, because the stop sits just past
the candle's extreme and the entry is often close to it, so the risk in price is small while the round trip costs the same.
The target and the entry timing have been tested and are closed. What has not been tested: taking only the signals whose
cost is small against their own risk. Both numbers are known at the entry (the shared cost table and entry minus stop).

## The rule (one test)

The desk's own signals, fill, stop, target and 1-day limit, unchanged (`bigfade-target-65` `trade()`, target share 0.5; its
gate must reproduce: 47,354 trades / +0.307R in 2005-14 and 54,443 / +0.193R in 2015-26, before costs). A trade is KEPT when
its round-trip cost is at most **10 %** of its risk (cost ÷ |fill − stop| ≤ 0.10). No other change.

## Data, windows, costs

OANDA mid 5-minute candles, the ten markets of the fade studies, the shared cost table (assumed, not measured, on five of
them), the studies' exclusions. Discovery 2005-14, confirmation 2015-26, as in every fade study. The confirmation window has
been read by five target / entry studies of these same trades, never split by this ratio.

## Pass bar (all of them)

- kept trades: R a trade AFTER costs above zero in 2005-14 AND in 2015-26;
- t of calendar-month sums of the after-cost R at least 2 in both windows;
- at least 300 kept trades in each window;
- still above zero after costs in 2015-26 at twice the cost.

Anything else is FAIL. A pass would be a candidate for a forward paper record only (its own pre-registration), never a live
rule without the owner.

## Context only, no verdict

Thresholds 5 %, 15 %, 20 % and 30 %; the kept trades by market; the dropped trades; the kept trades with no target (the stop
or the 1-day limit ends the trade), since the target sweep found the before-cost R rises with the distance. None of these
can turn a FAIL into a pass, and no threshold is adopted from them.
