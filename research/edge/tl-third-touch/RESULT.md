# Trendline third touch inside an engulf zone, gold: result (13 Nov 2026)

**Verdict: FAIL, on every condition: the trendline entry lost −0.441R a trade after costs over 2020-26 (n 42, month-sum t −2.87; 2020-23 −0.258R, n 25; 2024-26 −0.709R, n 17), worse than the same zones taken on their first touch with no line (−0.159R, n 249; Welch −1.59), and below every one of 40 random entries in the same zones (beaten in 0 of 40 seeds). The line adds nothing; the zones themselves lose too.**

Paper research only. No live rule, size, filter, council member or page was changed, and there is no proposal. Every rule,
number and test was fixed in `PREREGISTRATION.md` (commit e90cc75a8) before a zone, line or trade was computed.

## What was tested (my wording of the owner's idea)

- **Zone (H4)**: the last opposite candle at the origin of a move that then broke two swing levels in a row (a close beyond the
  most recent swing, then beyond a new swing formed after the first break, within 30 H4 candles) and also closed beyond the
  extreme of the candle before the zone candle (the ISL). Zone = that candle's high to low. Live from the close of the second
  break until an H4 close through its far side or 120 H4 candles.
- **Line (H1)**: through two pullback pivots (3 a side, at least 6 candles apart, falling for buys, rising for sells), counted
  from the second break's H4 candle on. **Entry** at the line's value on its **third touch** (the first candle reaching the
  line after it was known), only when that value is inside the live zone.
- **Stop** $0.30 beyond the zone's far side, **target** 2R, out after 72 h, one trade at a time.
- **Control**: the same zones, a limit at the zone's near edge, filled on the first touch.
- **Costs**: $0.30 a round trip and overnight financing on buys (`council/fills.mjs` `nights`, `FIN.xau.long`).
- Data: OANDA spot gold H1, 1 Oct 2019 to 13 Nov 2026 (42,134 candles), H4 built from it (11,394). Trades entering 2020-01-01 to
  2026-10-31 count: halves 2020-23 and 2024-26.

Funnel: 1,468 first breaks; 570 zones (344 demand, 226 supply; 295 died before the second break, 69 had no second break);
2,108 third touches of a line in those zones; 46 zones gave a third touch inside the zone (on 458 the line was touched
outside the zone, the last reason recorded for each zone), 42 trades after the one-at-a-time rule. The control had 321
candidates and 249 trades.

## Result

Net = after $0.30 and financing. Win rate = share of trades with net R above zero. t is the plain t of per-trade net R.

| Stream | Half | Trades | Win rate | R a trade, before costs | R a trade, net | t | Profit factor | Total R | Max drawdown R |
|---|---|---|---|---|---|---|---|---|---|
| Trendline | 2020-23 | 25 | 28.0% | −0.208 | −0.258 | −1.15 | 0.58 | −6.46 | 10.22 |
| Trendline | 2024-26 | 17 | 11.8% | −0.672 | −0.709 | −3.46 | 0.19 | −12.06 | 12.06 |
| Trendline | 2020-26 | 42 | 21.4% | −0.396 | −0.441 | −2.77 | 0.39 | −18.52 | 22.28 |
| Control | 2020-23 | 139 | 34.5% | −0.098 | −0.149 | −1.42 | 0.77 | −20.64 | 26.73 |
| Control | 2024-26 | 110 | 34.5% | −0.142 | −0.173 | −1.47 | 0.74 | −18.99 | 29.31 |
| Control | 2020-26 | 249 | 34.5% | −0.118 | −0.159 | −2.05 | 0.76 | −39.64 | 44.11 |

- **T1** (trendline on its own): net below 0 in both halves; month-sum t **−2.87** (82 months, Jan 2020 to Oct 2026). Fails.
  (The control's month-sum t is −1.91.)
- **T2** (the line against the control): −0.441R against −0.159R, Welch t **−1.59**. Fails. Holm p 1.00 on both tests.
- **Placebo**: random entries inside the same live zones (40 seeds) made −0.175R a trade at the median (5th to 95th
  percentile −0.240 to −0.040R); the trendline stream is below the placebo in all 40: beaten in **0 of 40** seeds.
- Exits of the trendline stream: 27 stops, 10 time exits, 5 targets. Trades by side: 24 buys, 18 sells. Only 2020 was
  positive (+0.344R, n 8); every year from 2021 to 2026 lost.

## Reading

- Taken on the third touch, the line's value is usually deep in the zone, close to the stop, so the stop distance is small
  and the move has already spent itself: 27 of 42 trades were stopped. Before costs the stream already loses 0.40R a trade.
- The zone alone (control) also loses before and after costs in both halves; nothing in these zones holds an edge on gold
  H1 2020-26.
- n is small (42): the trendline stream is too thin to be judged finely, but it fails in the losing direction, and its gap
  to the control and to the placebo is negative.

## What this does not test

A line chosen by eye, another pivot size or minimum spacing, other timeframes (an M15 line in an H1 zone), a target at the
next opposite zone, or entries before the third touch. Each would need its own pre-registration on data this study did not
read. Never call this method an edge; nothing here becomes a rule.

## To repeat

`node --use-env-proxy research/edge/tl-third-touch/run.mjs fetch <dir>` (the H1 file is kept out of git), then
`CANDLES=<dir> node research/edge/tl-third-touch/run.mjs run`. Tests: `tests/tl-third-touch.test.mjs`.
