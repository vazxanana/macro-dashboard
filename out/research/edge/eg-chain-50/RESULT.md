# Engulf chain with an entry at the confirming engulf's middle: result

Verdict: **FAIL**. The primary chain (H1 zone -> M15 engulf -> M5 confirmation, gold) misses all five checks of the pre-registered
bar: out of sample 2024-01-01 to 22 Nov 2026 it made −0.219R a trade after costs (n 1031, month t −2.06), in sample
2020-23 −0.399R (n 283), replication 2010-19 −0.639R (n 231). Before costs it is −0.045R out of sample. Neither secondary
passes either (Holm p 1.000 for both).

One run, as written in PREREGISTRATION.md (23 Nov 2026). Research only: nothing live reads it, nothing changed.

| Chain | Repl. n | Repl. R/trade | Repl. month t | IS n | IS R/trade | IS month t | OOS n | OOS R/trade | OOS month t | OOS before costs | OOS 2x costs | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P (H1 -> M15 -> M5) | 231 | −0.639 | −2.99 | 283 | −0.399 | −2.62 | 1031 | −0.219 | −2.06 | −0.045 | −0.393 | 0.142 |
| S1 (D1 -> H4 -> H1) | 230 | −0.005 | −0.02 | 144 | 0.137 | 0.43 | 99 | 0.206 | 0.50 | 0.303 | 0.108 | 1.000 |
| S2 (P, next-candle engulf) | 74 | −0.498 | −1.55 | 80 | −0.050 | −0.19 | 323 | −0.090 | −0.47 | 0.087 | −0.268 | 1.000 |

R a trade after $0.30 a round trip (charged in R), t of calendar-month sums by exit month. A trade belongs to the window of
its fill. Holm over the three out-of-sample month-t p values.

## In plain words
- The chain as written loses, and loses in every window. Before any cost the primary is at zero out of sample (−0.045R) and
  negative in the earlier years; the M5 zone is small (1R of $1-3 on gold), so the $0.30 cost is a large share.
- The close-based cut is expensive: on the primary 622 trades left on the cut at −1.88R on average after costs (an M5
  close beyond the zone is usually well past it), 467 on the hard stop at −1.61R, against 450 targets at +3.13R.
- S1 (the daily chain) is positive before costs in every window and +0.206R after costs out of sample, but with month t
  0.50 and 99 trades it is nowhere near the bar, and the replication years are flat after costs. Not an edge; by the
  pre-registration not even a hypothesis (it did not pass alone).
- S2 (next-candle engulf) is slightly better than the primary and still negative after costs.

## Reported only (no verdict)
- Primary by year (after costs, R a trade): 2020 −0.50, 2021 −0.18, 2022 −0.25, 2023 −0.82, 2024 −0.01, 2025 −0.33,
  2026 −0.20; 2010-19 negative in 6 of the 9 years with trades (few trades before 2020: 1R under $1 skips most of them).
- Primary buys −0.352R (n 791), sells −0.275R (n 754), all windows together.
- Roadblock: 8 primary trades had no opposite zone ahead (ran to the time limit or another exit); every other trade had one.
- Counts (primary): 50,952 chain setups, 43,621 skipped for 1R under $1, 445 for a hard stop not on the losing side, 2,371
  for a roadblock under 1R away, 473 while another order or position was live; 4,042 orders, 2,497 not filled, 1,545 trades.
  Per-chain counts, by-year tables, exit splits and the 2x-cost and before-cost figures are in result.json.

## Choices the pre-registration left open (also in result.json `choices`)
The engulf reading (a bearish candle replaces a buy base, only a bullish close above the base high completes it, a doji is
never a base); the TF2 touch may come any time after the TF1 zone is known, up to the TF2 engulf's completion; several TF1
zones may qualify (alive while any is) and the most recent TF2 engulf gives the hard stop; a setup whose hard stop is not on
the losing side of the entry is skipped (rule 1); the fill is checked before the target on a 5-minute candle; R is measured
from the fill in units of the planned 1R; one position at a time includes a resting order; S1's five trading days are counted
on 17:00 New York days.

## What it does NOT show
- It does not test the owner's own reading of the chain: picking which zone counts, which engulf is clean, or skipping a
  messy chart. It tests one mechanical reading, once.
- It does not say engulf zones never work: other timeframes, targets or stops were not tried and will not be on these years.
- One market (gold), OANDA mid candles, a fixed $0.30 cost for every year; no financing charged (holds are under a day on P).
- No result here should be quoted as evidence for or against the desks' Engulfing readings, which differ in entry, stop
  and target.
