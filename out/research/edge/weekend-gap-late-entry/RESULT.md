# Forex Sunday-gap fade entered later, after the reopen spread settles (14 Nov 2026)

**Verdict: FAIL.** Entered one hour later (18:05 New York) Rule G loses on all four lines of the bar: −0.126R a trade after
costs on 2016 to now (n 1203, monthly t -2.85) and −0.103R on 2010-15 (n 925, monthly t -1.39); before any cost it is flat
(−0.005R and +0.0185R). Entering 30 minutes or two hours later is no better (Holm-adjusted p 1.0000 for all three delays).
Not an edge; no proposal; nothing live changed.

What it shows: the fill toward Friday's close happens in the first hour after the reopen. Waiting for the spread to settle
does not remove the cost problem, it removes the move. On the same 18 pairs Rule G at 17:05 makes +0.271R a trade before
costs on 2016 to now; at 17:35 +0.072R, at 18:05 −0.005R, at 19:05 −0.076R.

Paper research only. The late-entry rule, pairs, windows, costs, gate, bar and placebo were committed alone before any code
existed (`PREREGISTRATION.md`, commit 393abb19). `frozen.mjs` is #880's `research/edge/fx-weekend-gap/run.mjs` (branch
`fx-weekend-gap`) byte for byte, sha256 `3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273` (pinned by the
test); nothing in it was edited and nothing is imported across branches. `run.mjs` wraps the frozen `ruleG`: it takes Rule
G's trade and books the same side, target and stop level from a later candle through the frozen `book()`.

## The rule (as pre-registered)

Rule G as frozen (eligible weeks: 0.25 to 1.5 x ATR gap between Friday's last close and the Sunday 17:00 New York reopen;
side toward Friday's close; target Friday's close; stop at Rule G's own level, its 17:05 entry minus one 17:05 risk; out at
Monday 12:00 New York; stop checked first). Only the entry moves: the close of the first M5 candle starting at or after the
reopen candle's start + 30 / **60** / 120 minutes. No trade when, between the reopen candle and the entry, Friday's close was
touched (the gap closed) or Rule G's stop was touched, or when the new risk (entry to stop) is under 0.1 x ATR. The reward :
risk therefore moves off 1 : 1 (mean 0.74 at 60 minutes).

Pairs: the 18 pairs of #880, #928 and #938's headline tests, pooled. Decisive window: weeks with Friday 1 Jan 2016 to
6 Nov 2026; replication 1 Jan 2010 to 31 Dec 2015. OANDA mid M5 through the site's candle proxy, joined per pair from the
#928 / #938 files and six new files (#938's six pairs, Nov 2009 to Jan 2016, fetched here); 248,847 overlapping candles
compared across the joins, 0 differ. **Costs**: the frozen formula at each pair's quoted spread from the studies' tables
(0.3-1.3 pip + 1 pip slippage a side + 22.5 USD per million a side), **plus an entry spread** of 0.6 pip on the seven dollar
pairs and 1.0 pip on the eleven others (assumed: the settled reads of 8 Nov 2026). 2x = twice that. No financing (no trade
crossed a weekday 22:00 UTC rollover).

## The gate (passed)

1. The frozen `study()` on #880's own candle files reproduces #880's published Rule G exactly: the 2020-to-now and 2016-19
   statistics objects (n 243, gross +0.292, net +0.194, monthly t 2.14; n 173, +0.147, +0.034, 0.39) and the 416-trade list.
2. On the joined files, the wrapper at delay 0 without the entry spread gives the same two objects on #880's six pairs, and
   equals the frozen `ruleG` trade by trade (side, entry, risk, exit, R) on all 18 pairs and both windows.
3. On the joined files, delay 0 reproduces #928 R1 (294, +0.2385, 2.9878) and R2 (297, +0.0026, 0.0278) and #938 S1 (588,
   +0.0608, 1.0216) and S2 (481, +0.1532, 3.1876) at their own spreads.

## Primary: entry at 18:05 New York (60 minutes)

| Window | Cost | n | win | mean R | t (trades) | t (months) | total R | worst drawdown |
|---|---|---|---|---|---|---|---|---|
| 2016 to now | 0 | 1203 | 58 % | −0.005 | -0.20 | -0.11 | −5.9 | 72.0 |
| 2016 to now | base | 1203 | | −0.126 | -5.28 | -2.85 | −151.7 | 189.8 |
| 2016 to now | 2x | 1203 | | −0.247 | -10.28 | -5.40 | −297.5 | 312.7 |
| 2010-15 | 0 | 925 | 58 % | +0.0185 | 0.57 | 0.24 | +17.1 | 58.9 |
| 2010-15 | base | 925 | | −0.103 | -3.16 | -1.39 | −95.5 | 136.5 |
| 2010-15 | 2x | 925 | | −0.225 | -6.76 | -3.02 | −208.1 | 240.8 |

- The bar: net > 0 on 2016 to now (no), net > 0 on 2010-15 (no), monthly t ≥ 2 on 2016 to now (no, -2.85), net > 0 at 2x
  cost on 2016 to now (no). FAIL on all four.
- No trade (both windows): 214 weeks the gap closed within the hour, 69 the stop was touched, 22 the risk was too small.
  Exits 2016 to now: 619 targets, 360 stops, 3 gapped stops, 221 time exits. Median risk 38.1 pips, median base cost
  0.10R a trade.
- By group, 2016 to now, base cost: #880's six −0.086R (n 372, monthly t -1.31), #928's crosses −0.153R (n 438, -2.98),
  #938's six −0.134R (n 393, -2.89). By year only 2022 (+0.020R, n 74) and 2026 (+0.150R, n 185) are positive; 2010-15
  only 2015 (+0.289R, n 112).

## Secondaries (Holm over the three delays, on the 2016-to-now monthly t at base cost)

| Delay | Window | n | mean R, 0 cost | mean R, base | mean R, 2x | t (trades), base | t (months), base | worst drawdown, base | p | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| 30 min (17:35) | 2016 to now | 1309 | +0.072 | −0.059 | −0.189 | -2.58 | -1.36 | 143.4 | 0.9124 | 1.0000 |
| 30 min (17:35) | 2010-15 | 969 | +0.038 | −0.090 | −0.217 | -3.10 | -1.45 | 123.4 | | |
| 60 min (18:05) | 2016 to now | 1203 | −0.005 | −0.126 | −0.247 | -5.28 | -2.85 | 189.8 | 0.9978 | 1.0000 |
| 120 min (19:05) | 2016 to now | 1012 | −0.076 | −0.191 | −0.306 | -7.61 | -3.98 | 211.8 | 1.0000 | 1.0000 |
| 120 min (19:05) | 2010-15 | 819 | −0.014 | −0.127 | −0.241 | -4.30 | -1.97 | 125.3 | | |

Monthly t before costs, 2016 to now: 1.65 (30 min), -0.11 (60), -1.64 (120). At 2x cost: -4.19, -5.40, -5.97.

**Reference, not a test** (Rule G at 17:05 on the same 18 pairs and windows): 2016 to now n 1411, +0.271R before costs,
+0.149R at the frozen model alone (monthly t 3.28), **+0.114R with the added entry spread** (monthly t 2.55, drawdown
30.9R), −0.043R at 2x; 2010-15 n 1022, +0.147R, +0.039R, +0.008R (monthly t 0.13), −0.132R.

## Placebo (what the delay alone does)

Per delay, 40 seeded runs on random non-gap Sundays of the same pair and window, random side, the same delay after the
reopen, each trade's own stop and target distances in ATR units, the same base cost. Mean base net R a trade:

| Delay | Window | placebo 5th | median | 95th | the test | runs at or above the test |
|---|---|---|---|---|---|---|
| 30 min | 2016 to now | −0.156 | −0.128 | −0.099 | −0.059 | 0 of 40 |
| 30 min | 2010-15 | −0.165 | −0.126 | −0.083 | −0.090 | 3 of 40 |
| 60 min | 2016 to now | −0.158 | −0.118 | −0.078 | −0.126 | 23 of 40 |
| 60 min | 2010-15 | −0.177 | −0.130 | −0.086 | −0.103 | 9 of 40 |
| 120 min | 2016 to now | −0.160 | −0.115 | −0.077 | −0.191 | 40 of 40 |
| 120 min | 2010-15 | −0.152 | −0.114 | −0.067 | −0.127 | 26 of 40 |

From one hour on, the gap fade does no better than a random-side trade on a Sunday with no gap; at two hours it does worse.
At 30 minutes some of the direction is still there (above every placebo run on 2016 to now) but not enough to pay the cost.

## Post hoc (not in the bar)

- In the 1203 decisive-window weeks the 60-minute entry traded, Rule G at 17:05 made +0.217R a trade before costs; the late
  entry on the same weeks −0.005R. The 208 Rule G trades it dropped (gap closed or stop hit within the hour) had made
  +0.583R. So the first hour carries the fill.
- The fixed stop level makes a late entry after a move toward Friday's close a trade with less reward than risk (mean 0.74).
  A late entry with a fresh 1 : 1 stop was not pre-registered and not run; with gross R at about zero over the remaining
  move to Friday's close there is no sign it would pay costs either.

## Departures from the brief

- The stop kept at Rule G's own level (the brief's "stop stays as frozen"), so the risk is measured from the new entry.
- EUR/JPY counted as a cross (1.0 pip entry spread), though it was one of #880's "six majors".
- The placebo matches each trade's stop / target distances in ATR units rather than a fixed 1R, so it isolates the delay.
- Candles: most from the #928 / #938 caches (same proxy and fetch code), six pair-stretches fetched here; joined per pair.

To repeat: `node --use-env-proxy fetch.mjs <dir>/wglate/E`, the #928 / #938 caches in `<dir>/fxrep`, `<dir>/fxrep2`, then
`CANDLES=<dir> GATE=<dir>/fxrep2 R880=… R928=… R938=… node --max-old-space-size=11000 run.mjs run`.
