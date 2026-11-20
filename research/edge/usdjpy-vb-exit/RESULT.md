# USD/JPY T1: does it depend on the 21:00 UTC exit and the 00:00 UTC day? (20 Nov 2026)

Paper research only. Settings, gate and reading were fixed in `PREREGISTRATION.md` (pushed alone before any figure at another setting was computed; sha256 in `result.json`). The rule's functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge`, the 17:00 New York days from `gold-vol-breakout-k`. **Nothing is adopted**: the rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC. Nothing live changed.

**Verdict: BROAD: USD/JPY T1 net R positive in 2005-15 and 2016 → now at every alternative (exits 12:00 / 15:00 / 18:00 UTC, 17:00 New York day), pooled month t ≥ 2 at 4 of 4; rule +0.071R (n 4168, t +3.86); the rule stays as it is**

Gate: exit 21:00 / 00:00 UTC day reproduces both published studies (early n 2089, +0.079R; late n 2079, +0.063R): yes; the exit-filter path at 21:00 gives 4168 of 4168 trades identical.

| Setting | 2005-15 n / net / month t | 2016 → 2026-11-19 n / net / month t | Pooled n | Net R | Gross R | Net 2x cost | Win | Month t | Gross t | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|
| exit 12:00 | 1449 / +0.062 / +2.61 | 1365 / +0.014 / +0.56 | 2814 | +0.039 | +0.072 | +0.006 | 44.8 % | +2.23 | +4.14 | 0.013 |
| exit 15:00 | 1860 / +0.104 / +3.83 | 1812 / +0.068 / +2.54 | 3672 | +0.086 | +0.118 | +0.055 | 46.1 % | +4.52 | +6.19 | < 0.001 |
| exit 18:00 | 2013 / +0.085 / +3.31 | 1992 / +0.071 / +2.74 | 4005 | +0.078 | +0.110 | +0.047 | 44.8 % | +4.29 | +6.00 | < 0.001 |
| exit 21:00 (rule) | 2089 / +0.079 / +2.95 | 2079 / +0.063 / +2.50 | 4168 | +0.071 | +0.102 | +0.041 | 44.6 % | +3.86 | +5.55 | — |
| day from 17:00 New York | 2048 / +0.046 / +1.82 | 2045 / +0.052 / +1.99 | 4093 | +0.049 | +0.081 | +0.017 | 44.2 % | +2.70 | +4.46 | 0.007 |
| day from 17:00 New York, strict open | 2048 / +0.046 / +1.82 | 2042 / +0.053 / +2.00 | 4090 | +0.049 | +0.081 | +0.018 | 44.2 % | +2.71 | +4.47 | — |

Reading (pre-registered): net R > 0 in both windows at all four alternatives: yes; pooled month t ≥ 2 at 4 of 4 (3 needed): **BROAD**.

**What it says.** Net R a trade pooled: exit 12:00 +0.039 (t +2.23), exit 15:00 +0.086 (t +4.52), exit 18:00 +0.078 (t +4.29), exit 21:00 (rule) +0.071 (t +3.86), day from 17:00 New York +0.049 (t +2.70). Before costs: exit 12:00 +0.072, exit 15:00 +0.118, exit 18:00 +0.110, exit 21:00 (rule) +0.102, day from 17:00 New York +0.081. Net R is positive in both windows at every setting. At 2x costs pooled: exit 12:00 +0.006, exit 15:00 +0.055, exit 18:00 +0.047, exit 21:00 (rule) +0.041, day from 17:00 New York +0.017. Cautions: the 12:00 exit is thin in 2016 → now (+0.014R, month t +0.56) and near zero at 2x costs, and the 17:00 New York day keeps about two thirds of the rule's net R (+0.049R against +0.071R; +0.017R at 2x costs), so the margin over costs moves with where the day is cut and how long the trade is held; the sign does not. The strict reading of the New York open keeps 4090 trades (+0.049R). None of this selects a setting: every cell was read on data already used for the rule, so a better-looking exit or anchor would need its own pre-registration on untouched history, and none is left. Paper research; nothing live changes and no proposal is written.

Data: OANDA mid M5 USD/JPY, early cache 2004-12-01 → 2016-01-07 (834318 candles), late cache 2015-12-01 → 2026-11-20 (817614 candles); windows 2005-01-04 → 2015-12-31 and 2016-01-01 → 2026-11-19. Cost: commission 0.000045 of the entry + 0.5 pip a round trip, no financing (no variant holds over the 17:00 New York rollover). The 17:00 New York day's open is read inclusively (first candle within 60 minutes of the anchor); the strict reading is the last row.
