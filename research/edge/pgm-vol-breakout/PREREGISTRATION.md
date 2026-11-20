# Gold's T1 breakout on platinum and palladium, 2016 → now (pre-registration, 20 Nov 2026)

Paper research only. Written and pushed alone, before any platinum or palladium candle was fetched.

## Why
T1 (UTC open ± 0.5 × the previous folded day's range, stop at the open, out at 21:00 UTC) passed on gold and on USD/JPY and
failed on silver, indices, forex majors, yen crosses and energies. Platinum and palladium are the metals not yet tried.

## Rule, data, cost
- `index-vol-breakout/original.mjs` (`buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `rng`, `summary`) imported unchanged;
  k 0.5 (`fx-vol-breakout` `K`), both sides, the same skips, stop and exit as the energy and forex studies.
- OANDA mid M5 for `xpt` and `xpd` through the candle proxy, 2016-01-01 → the last complete day (kept out of git).
- Cost a round trip, as a share of the entry price, the repository's own figures (`gold-drd-pgm`): platinum 0.30 %, palladium
  0.20 % (no demo quote of either has been measured).

## Pass bar (the pool of both markets)
All four: net R a trade > 0 in 2016-2020 AND in 2021 → now; month-sum t >= 2 over 2016 → now; net > 0 at twice the cost;
the real pool beats at least 38 of 40 placebo pools (random entries on the same days, same distance and stop; seeds 1-40).
Per market: the same checks, descriptive only.

## Reading
A fail ends T1 on the metals other than gold. A pass is a candidate for its own forward record, never a live rule without the owner.
Nothing live changes.
