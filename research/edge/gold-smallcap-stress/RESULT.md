# Result: gold after small caps fall behind large caps (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying gold 5 days after a small-cap stress day beat the every-day buy by +0.031R out of sample (n 104, month t 0.39), +0.094R net; 27 of 40 placebos, 28 of 40 controls.**

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit `4682e23e9`). The test ran once; no threshold, hold or
market was changed after the result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new
stand-alone daily rule on gold; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and
reads none of its 2006-17 positions. Not an edge.

## Data and rule
council-data `research/daily/{xau,spx500,us2000}.json` (OANDA mid daily candles, UTC days, commit `bd4865a88`, read with
`git show`, no network), weekend candles folded into the next weekday (`council/fills.mjs` `foldWeekend`); gold 20 Mar 2006
to 13 Nov 2026 (5,369 candles). `z` = 5-day log return of the Russell 2000 CFD minus the S&P 500 CFD, divided by the sd of
its 250 previous values. Stress day = a fresh crossing to `z <= -1.25`, rally day = a fresh crossing to `z >= +1.25`. Entry
at gold's next open, stop 2 x ATR20 (1R), out at the close of the 5th (T3: 10th) candle; $0.60 a round trip and `FIN`
financing on buys; one position at a time per test. Signal days: stress 121 (2007-16) / 122 (2017-26), rally 123 / 100, all
counted before the pre-registration. One position at a time leaves fewer trades than signals (skipped: T1 15 / 18, T2 20 /
13, T3 33 / 29).

## The three tests (R a trade; excess = net R minus the same-side every-day trade of the window; t on calendar-month sums)

| Test | Window | n | gross R | net R | excess R | t gross | t net | t excess |
|---|---|---|---|---|---|---|---|---|
| T1 buy 5d after stress (primary) | 2007-16 | 106 | +0.094 | +0.047 | +0.054 | 1.23 | 0.62 | 0.71 |
| | 2017-26 | 104 | +0.146 | +0.094 | +0.031 | 1.77 | 1.15 | 0.39 |
| T2 sell 5d after rally | 2007-16 | 103 | +0.099 | +0.084 | +0.142 | 1.27 | 1.08 | 1.81 |
| | 2017-26 | 87 | -0.047 | -0.061 | +0.047 | -0.58 | -0.74 | 0.58 |
| T3 buy 10d after stress | 2007-16 | 88 | +0.003 | -0.067 | -0.075 | 0.02 | -0.57 | -0.63 |
| | 2017-26 | 93 | +0.252 | +0.167 | +0.055 | 2.30 | 1.57 | 0.52 |

Every-day baselines (net R a trade): 5-day buy -0.007 (2007-16) / +0.062 (2017-26), 5-day sell -0.058 / -0.108; 10-day buy
+0.008 / +0.112, 10-day sell -0.088 / -0.165.

| Test | OOS one-sided p | Holm p | net R at 2x costs (OOS) | placebo: real t beats | control: real t beats | pass |
|---|---|---|---|---|---|---|
| T1 | 0.348 | 0.848 | +0.041 | 27 of 40 | 28 of 40 | no |
| T2 | 0.283 | 0.848 | -0.074 | 34 of 40 | 33 of 40 | no |
| T3 | 0.301 | 0.848 | +0.081 | 26 of 40 | 31 of 40 | no |

Placebo = the same number of random eligible days of the window (seed 125-127); control = each signal day replaced by a
random eligible day of the same year (seed 1125-1127), so gold's drift and volatility of that year stay and the signal's
information goes.

## Reading
- The positive out-of-sample net figures of T1 and T3 are gold's 2017-26 rise: the every-day buy made +0.062R (5 days) and
  +0.112R (10 days) a trade there, and the stress days add +0.031R and +0.055R, t 0.39 and 0.52, inside the placebo and the
  control. T3's gross t of 2.30 is the drift, not the signal.
- T2 (sell after a small-cap rally) beat its baseline in sample (+0.142R, t 1.81) and nearly vanished out of sample (+0.047R,
  t 0.58) with a net loss.
- So a week of small caps lagging large caps tells nothing measurable about gold over the next one or two weeks, net of
  costs, in either window. Not an edge; no proposal; nothing live changed.

Files: `PREREGISTRATION.md`, `run.mjs` (`node run.mjs fetch <dir>`, then `node run.mjs full <dir>`), `result.json` (every
out-of-sample trade), `tests/gold-smallcap-stress.test.mjs`.
