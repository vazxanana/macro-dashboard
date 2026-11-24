# Pre-registration: vb-reentry (24 Nov 2026)

Paper research only. On the gold and USD/JPY T1 volatility breakouts (UTC open O ± 0.5 × the previous folded day's range,
stop back at O, out at 21:00 UTC), when the day's first fill is stopped back at O, does taking the SAME side again when
price crosses the same trigger a second time make money after costs? `gold-vol-breakout-reverse` tested the OTHER side after
the stop-out (FAIL); no study has computed a same-side re-entry. Nothing live changes; no council, page or API file is read
or edited; nothing is adopted.

Written and pushed alone, before any re-entry figure was computed. Only the harness gates below were run first (they
re-compute published T1 figures from the candle cache and reproduced them exactly: gold 2007-15 at $0.60 n 1,657, net
+0.111R, month t 3.19; USD/JPY 2005-15 n 2,089 +0.079R, 2016 → 2026-11-19 n 2,079 +0.063R).

## The base rule (imported, unchanged)

`research/edge/index-vol-breakout/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f,
the same bytes as `gold-vol-breakout`'s run.mjs): `buildDays`, `daySkip`, `vbTrade` (k 0.5, both sides, cost 0), `rng`,
`monthT`, `normP`, `holm`. Candles: OANDA mid M5 from `research/edge/_lib/edgekit.mjs` `load(market, '5m')` (shared cache,
out of git), the forming last day dropped.

## The re-entry (the only new piece)

- A **stopped day** = a T1 trade with `how === 'stop'`. The stop-out candle is the candle whose start is the trade's exit
  time (the fill candle itself when it also reached O).
- From the candle AFTER the stop-out candle to the 20:55 UTC candle, a stop order on the SAME side at the SAME trigger
  (buy stop at O + 0.5 × range after a stopped buy; sell stop at O − 0.5 × range after a stopped sell). Fill = the first
  candle whose range reaches the level; a candle opening through it fills at its open. At most one re-entry a day.
- Stop at O (the same stop). A fill candle that also reaches O is booked as a stop at O (worst case); a later candle opening
  through O exits at its open; otherwise out at the close of the 20:55 candle. 1R = |entry − O|. R before costs.
- Walker gate: the same walker applied to the T1 entries reproduces `vbTrade`'s exits and R trade for trade (else stop).

## Costs (after costs is the judged figure)

- Gold: `gold-vol-breakout-hourcost` route C1, frozen (`profile`, `commission` of its result.json): half the median quoted
  spread of the fill hour + half of hour 20 + commission, as a share of the entry, plus 0.05 × M (median high − low of the
  12 M5 candles ending with the fill candle, `costs.mjs` `medRange`). Financing as the rule (0 for an exit at 21:00 UTC).
  These are TODAY'S measured relative spreads charged on every year (said in the result).
- USD/JPY: `fx-vol-breakout` `charge` (commission 0.000045 of the entry + 0.5 pip a round trip), the cost every USD/JPY
  breakout study used. 2x cost reported for both.

## Windows

Discovery 2005-01-01 → 2014-12-31 (gold's candles start March 2006, so gold's discovery is 2006-14); confirmation
2015-01-01 → the last complete day on file. Both windows have been read for T1 itself; the re-entry trades have not.

## Tests (three, fixed; Holm over the three on the confirmation one-sided p of the month-sum t)

- **E1** gold re-entry trades alone, net R a trade.
- **E2** USD/JPY re-entry trades alone, net R a trade.
- **E3** both markets pooled (month sums of both markets' re-entry net R).

A test passes only if ALL hold: net R a trade > 0 in discovery AND in confirmation; confirmation month t ≥ 2 and Holm p
< 0.05; confirmation n ≥ 200 (E3: the pooled n); net at 2x cost > 0 in confirmation; and the real confirmation mean beats
the control's mean in at least 38 of 40 seeds.

## Control (placebo)

For every real re-entry (in each window), a same-side MARKET entry at the open of a candle drawn uniformly (seeded `rng`,
40 seeds) from the candles after the stop-out candle up to the 20:50 candle of the same day, stop the same distance as the
real re-entry's 1R (from its own entry), out at 21:00 UTC or the stop (the original's `placeboTrade`), the same cost rule
(gold: the hour and M of that candle). This asks whether crossing the trigger again adds anything over being in the same
side at a random later time on those days.

## Reported, not judged

Per window: n, win share, gross and net R a trade, total, month t, 2x-cost mean, stops / time exits, the share of stopped
days that re-entered, buys / sells; T1 alone vs T1 + re-entry per stopped day; by year.

## Reading

Whatever the result, nothing changes on any desk, job or rule. A pass would be a candidate for the owner, in sample for T1,
and would need a forward record of its own; a before-cost tilt is not an edge.
