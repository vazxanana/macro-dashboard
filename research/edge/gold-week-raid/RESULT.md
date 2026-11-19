# Result: previous-week high / low raid and reversal on gold (13 Nov 2026)

**Verdict: FAIL, 0 of 3 rules** on the pre-registered bar (PREREGISTRATION.md, committed before any candle was read). No rule
reaches a month-sum t of 2 on 2020 to now (largest t 0.76, Holm p 0.67), and all three lose on 2008-19. Not an edge; nothing
live changes and no proposal is written.

A new stand-alone rule, decided on 2020 to now: not a test of the gold book (owner decision 44 untouched).

| Rule (net of $0.30, financing on buys) | 2020-now n | R a trade | PF | Month t | Holm p | 2008-19 n | R a trade | Month t | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|
| R1 base (target last week's 50 %) | 233 | -0.014 | 0.98 | -0.09 | 0.6709 | 420 | -0.150 | -1.86 | 33 of 40 |
| R2 raid Mon-Wed only | 190 | +0.116 | 1.15 | 0.64 | 0.6709 | 355 | -0.186 | -2.15 | 37 of 40 |
| R3 target last week's far extreme | 235 | +0.162 | 1.2 | 0.76 | 0.6709 | 423 | -0.109 | -1.09 | 40 of 40 |

- **Before costs the base rule is flat**: +0.048R a trade gross on 2020-now, -0.060R on 2008-19. Median stop $8.32 (2020-now),
  $5.09 (2008-19); win rate 25 % and 28 %. A raid back inside last week's range does not carry price to its middle more often
  than chance would.
- **Year by year it changes sign**: R1 made +21.4R in 2020 and +12.0R in 2026, lost -16.7R in 2021, -14.7R in 2023, -12.0R
  in 2024; on 2008-19 only 2011 and 2014-16 were positive. R2 and R3 follow the same years: their 2020-now plus comes from
  2020, 2025 and 2026.
- **R3 beat all 40 placebo seeds** (random same-week entries, same stops and target: median -0.225R) on 2020-now, but its
  month-sum t is 0.76 and it lost -0.109R a trade on 2008-19: a far target over a wide stop in a rising gold market, not a
  reversal edge.
- Buys and sells (2020-now, R1): buys -0.035R (n 111), sells +0.005R (n 122); on 2008-19 buys -0.201R, sells -0.105R.

Every trade had a stop $0.30 beyond the raid's extreme; stops were checked first in a candle holding both. Data: OANDA mid H1
XAU/USD, 1 Oct 2007 to 13 Nov 2026 (116,249 candles, 998 weeks), weeks from the Sunday 17:00 New York reopen, out at Friday
16:00 New York. Financing: `council/fills.mjs` `FIN.xau.long` at today's rate for every year.

Not tested, and not to be read into this: other markets, an M5 / M15 entry after the close back, partial exits, the previous
day's or month's extremes. A follow-up on any of these needs its own pre-registration.

To repeat: `node --use-env-proxy research/edge/gold-week-raid/run.mjs fetch <dir>` (candles outside git), then
`node research/edge/gold-week-raid/run.mjs full <dir>`. Tests: `tests/gold-week-raid.test.mjs`.
