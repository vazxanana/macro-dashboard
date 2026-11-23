# USD/JPY: H4 dominant zone with an M15 failed engulf, on years the grid did not read (pre-registration)

Written 23 Nov 2026, before any run on these years. The combination grid (`research/edge/combo-grid`, FAIL) left one family of
rules that held in both its windows, all on USD/JPY: an H4 dominant zone (DOM) with an M15 failed engulf (EF) as the trigger.
Picked after looking at 463,064 results, so it is a hypothesis. This tests it once, on data the grid did not read.

**Rule (one, fixed here, the grid's code unchanged):** chain H4 -> M15; key zone DOM (two H4 candles of one colour, the
second closing beyond the first's extreme; zone = the first candle's body); the first and second touch; no direction filter;
trigger = an M15 engulf of the other side failing (a close through it) within 12 M15 candles of the touch; entry at the
trigger's close (market); stop past the far side of the DOM zone by half the round-trip cost; target 2R; out after 5 days.
This is the grid's cell `usdjpy 4h>15m dom first2 none ef mkt/zone 2R` (the variant with the most trades of the family).

**Data:** OANDA mid 5-minute USD/JPY candles, 2005-01-01 to 2019-12-31 (the grid read 2020 on), cost `edgekit.COSTS.usdjpy`.

**Pass:** mean R after costs > 0 with month-sum t >= 2 over 2005-2019; positive in both 2005-2011 and 2012-2019; positive at
twice the cost. Reported, no verdict: the same rule on the other four grid markets and on the holdout markets (nzdusd, usdcad,
usdchf, eurjpy, xag) over 2005-2019, and buys and sells apart.
