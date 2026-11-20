# Pre-registration: usdjpy-vb-side-control-v2 (20 Nov 2026)

Written and pushed alone, before any v2 control trade is computed. Paper research only; nothing live changes. Not part of ICT.

## Why, and what v1 got wrong
`usdjpy-vb-side-control` (v1) took each real trade's side and entered at a random time on the same day. The side is decided by
which way the day's breakout fired, and most random entries came before it: look-ahead (same-side random entries earned +0.36R
a trade). v1 is INVALID and nothing is concluded from it. The question stands: USD/JPY T1's gain is almost all on the buy side
(2005-26 OANDA mid: buys +0.148R a trade, n 1,998; sells +0.001R, n 2,170). **Is that more than simply being long USD/JPY?**

## Control (no day or side chosen with information from later in the day)
- Days: every tradable day of T1 on USD/JPY OANDA mid M5, **2005-01-04 → 2026-11-19** (the original `daySkip`).
- Per seed (1-40, the original `rng(seed)`), on EVERY tradable day: one LONG market entry at the open of an M5 candle drawn
  uniformly from 01:00-18:00 UTC, stop 0.5 × the previous folded day's range below it, out at 21:00 UTC or the stop
  (`placeboTrade`), cost `fx-vol-breakout` `costPx('usdjpy')`. Likewise one SHORT entry per day (its own draw, the next number of
  the same generator).
- Long-control mean per seed and short-control mean per seed.

## Test and bar (one test)
**PASS** (T1's buys earn more than being long USD/JPY at a random time on any day) only if the mean net R of T1's BUY trades beats
the long-control mean in at least 38 of the 40 seeds. Reported, not tested: T1's sells against the short control, the same per
half (2005-15, 2016 →). A FAIL says T1 on USD/JPY is not shown to beat being long, i.e. the lead may be the pair's drift and carry
(and an always-long rule is a different, untested strategy). Nothing live changes either way.
