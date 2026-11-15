# Result: the playbook's weekly-bull daily rejection long and its two Daily-regime cuts, on platinum and palladium (15 Nov 2026)

**Verdict: FAIL, 0 of 4.** On neither metal does either cut pass: the best monthly-sum t is +0.81 (palladium, the signed cut,
Holm p 0.84). On platinum the rule loses with or without the cuts; on palladium the cuts make it worse, not better. So the two
cuts chosen on gold and seen to help on silver do not carry over: the silver result was not the start of a pattern.

Pre-registered in `PREREGISTRATION.md` (pushed alone before any number was computed). OANDA mid H1 XPT_USD and XPD_USD,
2 January 2006 to 13 November 2026 (122,016 and 119,516 candles), buffer 0.01 % of the signal day's low, 3R, 10 days, each
signal its own trade, net of a round trip of 0.30 % of price on platinum and 0.20 % on palladium (the repository's figures).

| Test | n | R a trade, net | PF | Month-sum t (months) | Holm p | PF 2006-19 / 2020-now | 2x costs | Without best year | Pass |
|---|---|---|---|---|---|---|---|---|---|
| T2-xpt ER20 >= 0.3 | 408 | -0.164 | 0.79 | -1.50 (122) | 1.00 | 0.76 / 0.90 | -0.357 | -0.242 (2008) | no |
| T3-xpt ER20 >= 0.2 and up | 481 | -0.183 | 0.77 | -1.88 (123) | 1.00 | 0.75 / 0.81 | -0.362 | -0.253 (2025) | no |
| T2-xpd ER20 >= 0.3 | 402 | +0.024 | 1.03 | +0.19 (113) | 1.00 | 0.98 / 1.25 | -0.126 | -0.017 (2018) | no |
| T3-xpd ER20 >= 0.2 and up | 525 | +0.092 | 1.13 | +0.81 (120) | 0.84 | 1.07 / 1.37 | -0.052 | +0.028 (2019) | no |

## Reported, not tested
- **Every signal (T1)**: platinum 1,124 trades, -0.162R, PF 0.79, month-sum t -2.66, worst drawdown -233.7R. Palladium
  1,120 trades, **+0.162R, PF 1.24, month-sum t +2.06**, PF 1.26 in 2006-19 and 1.16 in 2020-now, +0.017R at 2x costs, +0.132R
  without its best year (2019). It was not one of the four tests, it is the rule the silver study already showed to be weak on
  its own, and palladium's 2016-2021 rise from about $500 to $3,000 gave most of it (2016-2020: +163.9R of +181.7R). A
  weekly-bull buy rule on a market in a five-year rally is not evidence of selection; reported, never a finding.
- **The closing-strength condition helps on both**: the signal days beat every bullish-week day by +0.54R a trade on
  platinum (lift t 7.48; the baseline loses -0.697R a trade, its stops sit 0.01 % under a day's low on a market that costs 0.30 %
  a round trip) and +0.34R on palladium (t 4.80). As on silver, much of that lift is cost: the baseline's many tight stops pay the
  spread more often.
- **The cuts cut the drawdown, not the loss**: platinum -233.7R every signal, -129.0R with ER20 >= 0.3; palladium -71.9R,
  -59.5R and -52.0R.
- Year by year, platinum every signal: positive 2006-08, 2019 and 2025 only.

## What it means
Four metals now: on gold (`gold-drd-long`, `gold-drd-er`) the rule was profitable but no better than buying every bullish-week
day, and the cuts were chosen there; on silver (`gold-drd-silver`) the cuts passed a bar that counted overlapping trades and
fell to t about 1.3 on monthly sums; on platinum and palladium, on a monthly-sum bar fixed before the run, they fail. The cuts
are not a selection that travels. Do not test them on another market or another cut of these four. Nothing live changed and no
proposal is written; the gold playbook view's wording stays the skill's.

To repeat: `node --use-env-proxy research/edge/gold-drd-pgm/run.mjs fetch <dir>` (about 240,000 H1 candles, kept out of git),
then `node research/edge/gold-drd-pgm/run.mjs full <dir>`. Tests: `tests/gold-drd-pgm.test.mjs`.
