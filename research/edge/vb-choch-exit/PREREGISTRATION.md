# The breakout managed by structure: exit on the first ChoCh against the trade (pre-registration, 24 Nov 2026)

Written and pushed alone BEFORE any run. Research only: nothing live reads it, nothing is placed, no rule is proposed.

## Why

Structure breaks alone carry no edge after costs here (`structure-bos-choch-wide`, 0 of 51; `structure-break-improve`, 0 of 5
on eight unread markets). Two ways of joining them to the rules that DO pass (the intraday volatility breakout T1 on gold and
USD/JPY) were already tested and failed: structure as a FILTER (`vb-structure-filter`, `gold-vol-breakout-h4-side`) and a
structure RETEST as the entry (`vb-retest-limit`). The one join not tested is structure as the EXIT: T1 holds every trade to
21:00 UTC unless its stop (the day's open) is hit; a ChoCh against the position may say the breakout has failed earlier.

## The trades (unchanged)

T1 exactly as `index-vol-breakout/original.mjs` (= `gold-vol-breakout`) `buildDays` / `vbTrade`, k 0.5, both sides: buy stop at the
00:00 UTC open + 0.5 x the previous folded day's range, sell stop at the open - 0.5 x it, stop at the open, out at 21:00 UTC;
on gold (xau) and USD/JPY (usdjpy), OANDA mid 5-minute candles from the shared cache (gold from March 2006, USD/JPY from 2004).

## The exits compared (on the SAME trades)

- **base**: T1's own exit (the stop, else the 21:00 close).
- **E1, E2, E3**: as base, but also out at the open of the first 5-minute candle starting at or after the close of the first
  **ChoCh against the position** on **M5 (E1), M15 (E2) or H1 (E3)** whose candle closes after the fill. ChoCh = edgekit
  `structure(T, 3)` kind 'ChoCh' (the first close beyond the last confirmed swing against the structure side), computed on the
  continuous candle series (M15 / H1 resampled from M5 in UTC buckets), closed candles only. If the stop or 21:00 comes first,
  the base exit stands. The stop never moves; every trade keeps its stop on the losing side.

## Statistics and the bar

Per trade, d = R(exit) - R(base), before costs (both exits pay the same round trip; the ChoCh exit is a market order, the
21:00 exit too). Windows by trade day: **early 2005-2015**, **late 2016 to Oct 2026**; gold and USD/JPY pooled. t on
calendar-month sums of d (every month of the window, an empty month 0).

An exit **passes** when ALL hold: (1) month-sum t of d >= 2 in the early window AND in the late window; (2) its mean R after
costs (gold $0.60 a round trip, `gold-vol-breakout` COST; USD/JPY `fx-vol-breakout` `charge`) is > 0 in both windows;
(3) the Holm-adjusted one-sided p over the three exits (late window t of d, df = months - 1) < 0.05.

Verdict: **PASS** if one exit or more passes, **FAIL** otherwise. Reported beside: per market, the base reproduced against
`usdjpy-vb-exit`'s GATE (USD/JPY early n 2,089, +0.079R; late n 2,079, +0.063R after costs), win rate, mean hold.

The T1 years have all been read before (by T1's own studies), so this is a paired test of a NEW exit on known trades, not a
fresh test of T1; a pass would go to a forward record, never straight to a live change. One run, no variants.
