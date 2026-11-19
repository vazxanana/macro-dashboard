# Result: the standard Supertrend reversal system on gold's H4 chart (14 Nov 2026)

**Verdict: FAIL, 0 of 3: best is buys only, +0.138R a trade net out of sample (n 197, month t 1.80, Holm p 0.22), beating 35 of 40 placebos; both-sides +0.018R (t 0.39).**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). Supertrend with Wilder ATR on H4 candles
built from OANDA mid XAU/USD H1 on 17:00 New York blocks (19 Mar 2006 to 13 Nov 2026, 31,998 closed H4 candles, weekend stubs
dropped). Stop-and-reverse at the next H4 open after a close through the line; every trade also carries a hard stop at the
line -/+ 1 ATR (checked on H1, trailed tighter only); 1R = entry to that initial hard stop. $0.60 a round trip and overnight
financing on buys (`council/fills.mjs` `nights` x `FIN.xau.long`). In sample = entries 2007-16, out of sample = 2017 to
October 2026; t on calendar-month sums of net R, Holm over the three tests. A stand-alone rule: not a gate, exit, entry or size
of the live gold book (owner decision 44 untouched), and it reads nothing of it. Not an edge; no proposal; nothing live changed.

| Test | Window | n | Win (net) | R gross | R net | R at 2x | Total net | Month t gross | Month t net | Month t 2x | Worst DD R |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 both sides, 10 x 3 | IS 2007-16 | 378 | 38.9 % | +0.092 | +0.047 | +0.002 | +17.76R | 1.89 | 0.96 | 0.05 | -17.42 |
| | OOS 2017-26 | 395 | 37.0 % | +0.066 | +0.018 | -0.029 | +7.21R | 1.41 | 0.39 | -0.62 | -25.02 |
| T2 buys only, 10 x 3 | IS 2007-16 | 189 | 39.7 % | +0.150 | +0.080 | +0.010 | +15.12R | 2.01 | 1.10 | 0.14 | -8.85 |
| | OOS 2017-26 | 197 | 37.6 % | +0.217 | +0.138 | +0.059 | +27.13R | 2.76 | 1.80 | 0.78 | -8.68 |
| T3 both sides, 10 x 4 | IS 2007-16 | 264 | 33.7 % | +0.077 | +0.031 | -0.014 | +8.29R | 1.18 | 0.49 | -0.23 | -10.11 |
| | OOS 2017-26 | 257 | 37.0 % | +0.096 | +0.040 | -0.016 | +10.22R | 1.30 | 0.55 | -0.23 | -25.05 |

## The pass bar, check by check (out of sample)

| Check | T1 | T2 | T3 |
|---|---|---|---|
| Month t net >= 2, Holm p < 0.05 | no (t 0.39, p 0.70, Holm 1.00) | no (t 1.80, p 0.07, Holm 0.22) | no (t 0.55, p 0.58, Holm 1.00) |
| In sample same sign (positive) | yes | yes | yes |
| Still positive at 2x costs | no (-11.55R) | yes (+11.55R) | no (-4.18R) |
| Beats >= 38 of 40 placebos | no (34; placebo median t -0.30) | no (35; median t 1.20) | no (29; median t 0.17) |
| **Pass** | no | no | no |

Placebo: 40 seeded runs in the OOS window with as many flips as the rule (395 for 10 x 3, 257 for 10 x 4) at random H4
candles, sides alternating, the same engine with a hard stop at close -/+ (M + 1) x ATR. The buys-only placebo already has a
median month t of 1.20: buying gold at random H4 candles with a wide trailed stop made money in 2017-26.

## Where the R comes from: the buy legs, i.e. gold's rise
- T1 split by side (OOS): buys +0.138R a trade net (n 197, t 1.80), sells -0.101R (n 198, t -1.86); in sample buys +0.080R,
  sells +0.014R. T3 the same picture (OOS buys +0.206R, t 1.59; sells -0.125R, t -2.15).
- Correlation of monthly net R with gold's monthly buy-and-hold return: T1 0.11 IS / 0.17 OOS, **T2 0.49 IS / 0.48 OOS**,
  T3 0.11 / 0.17. The buys-only rule is largely a long gold position that steps aside in down legs.
- By entry year, net R (T1 | T2 | T3): 2007 +4.3 | +7.6 | +2.3; 2008 +2.1 | +1.7 | -2.5; 2009 -0.1 | +3.3 | +3.1;
  2010 -11.0 | -1.7 | -7.7; 2011 +7.1 | +8.3 | +9.0; 2012 -3.5 | -3.4 | -2.5; 2013 +9.5 | -1.7 | +2.9; 2014 +2.8 | -0.7 | +1.8;
  2015 +1.3 | -3.1 | +1.8; 2016 +5.3 | +4.9 | +0.2; 2017 -0.3 | +0.8 | +9.1; 2018 -4.0 | -3.8 | -10.3; 2019 -6.9 | +0.6 | -2.1;
  2020 -0.9 | +4.2 | -4.1; 2021 -4.0 | -2.9 | -2.4; 2022 -1.6 | -0.1 | -3.6; 2023 +4.5 | +4.0 | +6.6; 2024 +6.6 | +8.8 | +4.6;
  2025 +6.2 | +12.3 | +8.0; 2026 +7.7 | +3.2 | +4.2. Out of sample, 2017-22 lose on every test and 2023-26 (gold's bull run)
  carries the whole total.
- Costs (T1 OOS): 0.048R a trade, of which the $0.60 round trip 0.016R (median initial risk $39.6) and financing on buys the
  rest (buys held about 9 days).
- Exits: about half of the trades leave on the hard stop (T1 OOS 158 of 395), the rest on a flip; average hold 9-14 days.

## Reading
Not an edge. The always-in Supertrend on gold H4 gives a few hundredths of an R a trade either way; the buys-only version's
out-of-sample gain is gold's 2023-26 rise (correlation 0.48 with buy-and-hold, and a random-entry long placebo with the same
stop scores a median t of 1.20). No follow-up is proposed: a buys-only trend rule on gold is the live book's own question
(item 44), not this study's.

To repeat: `node research/edge/gold-h4-supertrend/run.mjs <xau-h1.json>` (OANDA mid H1 rows `[t, o, h, l, c]`, kept out of git).
Tests: `tests/gold-h4-supertrend.test.mjs`.
