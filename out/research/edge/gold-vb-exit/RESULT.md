# Gold T1: does it depend on the 21:00 UTC exit and the 00:00 UTC day, at the measured hourly cost? (24 Nov 2026)

**Verdict: BROAD: gold T1 at the measured hourly cost (C1), pooled 2007 → 2026-11-12: exit 12:00 +0.094R (t +5.06), exit 15:00 +0.129R (t +6.45), exit 18:00 +0.130R (t +6.18), day from 17:00 New York +0.086R (t +4.19), against the rule's 21:00 +0.139R (n 3713, t +6.47); net R > 0 in both windows at all four: yes, month t ≥ 2 at 4 of 4; early-fill combinations holding: 4 of 4; the rule stays as it is**

Paper research only. Settings, combinations, gate and reading were fixed in `PREREGISTRATION.md` (pushed alone before any figure at another exit was computed under this cost; sha256 in `result.json`). The rule's functions come unchanged from `gold-vol-breakout-hourcost/original.mjs` (the verbatim `gold-vol-breakout` code) and `costs.mjs`, the exit candles and the 17:00 New York days from `gold-vol-breakout-k`; the cost is that study's C1, frozen from its `result.json`. **Nothing is adopted**: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC, every fill time. Nothing live changed and no proposal is written.

Gate: at 21:00 / 00:00 UTC, C1 reproduces gold-vol-breakout-hourcost's published grid in every window (W1 n 929 +0.202R t +4.93; W2 n 728 +0.170R t +2.93; W3 n 935 +0.094R t +2.41; W4 n 1121 +0.105R t +2.79; POOLED n 3713 +0.139R t +6.47): yes, exactly; the exit-filter path at 21:00 gives 3740 of 3740 trades identical.

## Exits and day anchor (net R a trade after C1; month t of calendar-month sums)

| Setting | 2007-15 n / net / month t | 2016 → 2026-11-12 n / net / month t | Pooled n | Net R | Gross R | Net 2x cost | Win | Month t | Gross t | Total R | Worst DD R | Holm p (8) | Placebos beaten (of 40) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| exit 12:00 | 874 / +0.138 / +4.64 | 1177 / +0.062 / +2.63 | 2051 | +0.094 | +0.111 | +0.078 | 49.2 % | +5.06 | +5.93 | +193.7 | −14.5 | < 0.001 | 40 |
| exit 15:00 | 1395 / +0.182 / +5.53 | 1763 / +0.087 / +3.60 | 3158 | +0.129 | +0.145 | +0.113 | 46.0 % | +6.45 | +7.29 | +407.2 | −35.5 | < 0.001 | 40 |
| exit 18:00 | 1596 / +0.178 / +5.41 | 1955 / +0.091 / +3.39 | 3551 | +0.130 | +0.146 | +0.115 | 44.9 % | +6.18 | +6.93 | +462.6 | −28.9 | < 0.001 | 40 |
| exit 21:00 (rule) | 1657 / +0.188 / +5.49 | 2056 / +0.100 / +3.70 | 3713 | +0.139 | +0.155 | +0.123 | 44.3 % | +6.47 | +7.24 | +517.0 | −28.3 | — | 40 |
| day from 17:00 New York | 1559 / +0.146 / +4.57 | 1990 / +0.038 / +1.48 | 3549 | +0.086 | +0.102 | +0.069 | 43.5 % | +4.19 | +5.00 | +303.7 | −52.3 | < 0.001 | — |
| day from 17:00 New York, strict open | 1341 / +0.116 / +3.43 | 1 / −1.021 / +0.00 | 1342 | +0.116 | +0.130 | +0.101 | 44.7 % | +3.40 | +3.82 | +155.2 | −27.2 | — | — |

Reading (pre-registered): net R > 0 in both windows at all four alternatives: yes; pooled month t ≥ 2 at 4 of 4 (3 needed); pooled net R ≤ 0 at 0 of 4 (2 = FAIL): **BROAD**.

## The four pre-registered combinations: early fills only (fill candle before 06:00 UTC) × each UTC exit

| Combination | 2007-15 n / net / month t | 2016 → n / net / month t | Pooled n | Net R | Net 2x | Month t | Holm p (8) | Holds | Late fills, same exit: n / net | Early − late, Welch t |
|---|---|---|---|---|---|---|---|---|---|---|
| early fills, exit 12:00 | 268 / +0.247 / +2.86 | 488 / +0.132 / +2.80 | 756 | +0.172 | +0.153 | +4.01 | < 0.001 | yes | 1295 / +0.049 | +0.124 / +2.62 |
| early fills, exit 15:00 | 268 / +0.472 / +4.04 | 488 / +0.233 / +3.64 | 756 | +0.318 | +0.298 | +5.43 | < 0.001 | yes | 2402 / +0.069 | +0.248 / +3.85 |
| early fills, exit 18:00 | 268 / +0.465 / +3.83 | 488 / +0.265 / +3.54 | 756 | +0.336 | +0.317 | +5.20 | < 0.001 | yes | 2795 / +0.075 | +0.261 / +3.70 |
| early fills, exit 21:00 | 268 / +0.491 / +3.79 | 488 / +0.295 / +3.76 | 756 | +0.365 | +0.345 | +5.34 | < 0.001 | yes | 2957 / +0.082 | +0.283 / +3.81 |

Combinations holding (pooled net > 0, both windows > 0, Holm p < 0.05): 4 of 4. They do not change the label; a combination that holds is a hypothesis, not a rule.

**What it says.** Before costs, pooled: exit 12:00 +0.111, exit 15:00 +0.145, exit 18:00 +0.146, exit 21:00 (rule) +0.155, day from 17:00 New York +0.102; C1 takes about +0.016R a trade at 21:00. Windows with net R ≤ 0: day from 17:00 New York, strict open 2016 → (−1.021R). At 2x cost pooled: exit 12:00 +0.078, exit 15:00 +0.113, exit 18:00 +0.115, exit 21:00 (rule) +0.123, day from 17:00 New York +0.069. No alternative exit nets more than the rule's own 21:00 (+0.139R a trade): on gold the later the exit the more the trade keeps (USD/JPY peaked at 15:00 in usdjpy-vb-exit); the earlier exits keep most of it in both windows, so the result does not hang on the exact exit hour. The 17:00 New York day is the weak setting: positive in both windows but only +0.038R (month t +1.48) in 2016 →, worst drawdown −52.3R, so where the day is cut matters more than when it ends (18:00 and the New York day had been seen at $0.60 in gold-vol-breakout-k, 12:00 and 15:00 had not). Early fills (before 06:00 UTC): exit 12:00 +0.172R (n 756, t +4.01, holds), exit 15:00 +0.318R (n 756, t +5.43, holds), exit 18:00 +0.336R (n 756, t +5.20, holds), exit 21:00 +0.365R (n 756, t +5.34, holds); the late fills at 21:00 +0.082R (n 2957). The early split at 21:00 had been seen (holdout-vb-early, vb-early-exec), so none of these is new evidence. The 17:00 New York day's strict open keeps 1342 trades (+0.116R), almost none after 2015, when the feed's first candle of that day starts exactly 60 minutes after the anchor (the reason the inclusive reading is the main one). The early-fill combinations hold at 4 of 4 exits; early minus late is +0.124R (Welch t +2.62), +0.248R (Welch t +3.85), +0.261R (Welch t +3.70), +0.283R (Welch t +3.81) at 12:00 / 15:00 / 18:00 / 21:00. The early split was seen before on these years, so this is a hypothesis for the forward records (vb-early-forward), not a rule. Cautions: today's relative spread is charged on every past year (in 2007 a retail gold spread was surely wider), the stop-order slippage is assumed (0.05 × M), and OANDA mid candles are not broker fills. Paper research; nothing live changes and no proposal is written.

Data: OANDA mid XAU/USD M5 from the toolkit cache (1431423 candles, 2006-11-01 → 2026-11-13; the loader drops the last, forming day: data end 2026-11-12); windows 2007-01-01 → 2015-12-31 and 2016-01-01 → 2026-11-12. Cost C1: half the demo's median quoted spread share of the fill hour + half that of the exit window's last hour + commission 0.000024 of the entry + 0.05 × M (median high − low of the 12 M5 candles ending with the fill candle), plus the trade's financing on a buy held over the 22:00 UTC rollover (only the 17:00 New York day can); 2x = twice cost and financing. Placebo: 40 seeded random market entries from 01:00 UTC to the exit − 3 h, stop 0.5 × the previous day's range, charged the same.
