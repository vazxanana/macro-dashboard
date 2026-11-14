# Result: a completed nine-day count against the close four days earlier does not mark a gold turn (14 Nov 2026)

**Verdict: FAIL: 0 of 3 pass; buy setup +0.024R net OOS (n 29, t 0.21), sell setup -0.265R (n 44, t -2.27), perfected buy +0.137R (n 28, t 0.87).**

Pre-registered in `PREREGISTRATION.md` (pushed alone first). Item 44: a stand-alone daily rule on spot gold; not a gate, exit,
entry or size of the live gold book, and it never read the book's positions. Nothing live changed; no proposal is written.

Data: OANDA mid daily XAU_USD (council-data `research/daily/xau.json`), 5,369 trading days, 2006-03-20 to 2026-11-13, weekend
candles folded. Entry at the next open, stop 1.5 x ATR(14), time exit; $0.60 a round trip and `FIN.xau.long` financing on buys.
R a trade; t on calendar-month sums; Holm over the three tests. IS 2007-16, OOS 2017-2026-10.

| Test | IS n | IS gross | IS net | IS t | OOS n | OOS gross | OOS net | OOS t | Holm p | OOS net 2x | OOS 2017-21 | OOS 2022-26 | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 39 | +0.008 | -0.038 | -0.36 | 29 | +0.077 | +0.024 | 0.21 | 0.837 | -0.029 | +0.234 | -0.172 | 26 of 40 | no |
| T2 | 48 | -0.130 | -0.156 | -1.38 | 44 | -0.247 | -0.265 | -2.27 | 0.9883 | -0.284 | -0.196 | -0.318 | 2 of 40 | no |
| T3 | 30 | +0.048 | -0.008 | -0.04 | 28 | +0.209 | +0.137 | 0.87 | 0.5763 | +0.065 | +0.417 | -0.106 | 34 of 40 | no |

T1 = buy after a completed buy setup, hold 3 days; T2 = sell after a completed sell setup, hold 3 days; T3 = buy after a
perfected buy setup, hold 5 days.

## Against the same-side trade on every day (separates the count from gold's drift)

| Test | Baseline | Baseline OOS net | Excess IS (t) | Excess OOS (t) | Welch t vs baseline (OOS) |
|---|---|---|---|---|---|
| T1 | buy every day, hold 3 | +0.034 | -0.021 (-0.20) | -0.010 (-0.09) | -0.08 |
| T2 | sell every day, hold 3 | -0.097 | -0.106 (-0.95) | -0.169 (-1.48) | -1.35 |
| T3 | buy every day, hold 5 | +0.060 | -0.004 (-0.02) | +0.077 (0.49) | 0.47 |

## Reading
- The buy setup adds nothing to simply being long gold: its OOS net R a trade is below the every-day buy, and its two OOS halves
  have opposite signs. The perfected buy setup is positive OOS but carried by 2017-21 (+0.417R) and loses in 2022-26; t 0.87.
- The sell setup loses in every window: after nine closes above the close four days earlier gold kept rising more often than not
  (OOS win rate 32 %), worse than the every-day sell. That is the OPPOSITE of the claimed exhaustion; it was not a pre-registered
  test as a buy and is not evidence for one (the IS excess t is -0.95; read with gold's 2017-26 rise and the many studies of
  the day).
- Power is low, said plainly: a completed setup is rare once a position is held (29-48 trades a window, under the 100 aimed
  for). The study can rule out a large effect, not a small one.

Files: `run.mjs` (`node research/edge/gold-td-setup/run.mjs fetch <dir>`, then `… full <dir>`; the candle copy stays out of
git), `result.json`; tests `tests/gold-td-setup.test.mjs`.
