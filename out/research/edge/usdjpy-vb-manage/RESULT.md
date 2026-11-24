# USD/JPY T1: break-even, trailing stop or half at +1R? (24 Nov 2026)

**Verdict: FAIL: 0 of 3 managements improve USD/JPY T1 after costs; d vs the rule's exit a trade (2005-15 / 2016 → now, month t of d 2016 →): BE1 −0.023 / −0.007 (t −0.82, NO BETTER); TR1 −0.032 / −0.034 (t −2.28, WORSE); PH1 −0.025 / −0.034 (t −3.56, WORSE); rule +0.079 / +0.063R net (n 2089 / 2079)**

Paper research only. Variants, tests and bar were fixed in `PREREGISTRATION.md` (pushed alone before any managed figure was computed; sha256 in `result.json`). The rule's functions come unchanged from `index-vol-breakout/original.mjs`, the cost from `fx-vol-breakout` `charge` (0.000045 of the entry + 0.5 pip a round trip; 2x reported), the windows from `usdjpy-vb-exit`. No variant ever moves the stop away from the entry. **Nothing is adopted and nothing live changed.**

Gates: the rule from the candle cache reproduces both published figures (2005-15 n 2089, +0.079R; 2016 → n 2079, +0.063R): yes; the management walker with no management matches `vbTrade` on 4168 of 4168 trades.

| Management | Window | n | Win | Gross R | Net R | Net 2x cost | Month t (net) | Max DD R | Reached +1R | d vs rule (R a trade) | Month t of d |
|---|---|---|---|---|---|---|---|---|---|---|---|
| rule (stop at the open, out 21:00 UTC) | 2005-01-04 → 2015-12-31 | 2089 | 44.7 % | +0.109 | +0.079 | +0.050 | +2.95 | −42.2 | 737 | — | — |
| rule (stop at the open, out 21:00 UTC) | 2016-01-01 → 2026-11-19 | 2079 | 44.4 % | +0.096 | +0.063 | +0.031 | +2.50 | −33.8 | 687 | — | — |
| BE1: stop to entry once +1R reached | 2005-01-04 → 2015-12-31 | 2089 | 38.7 % | +0.086 | +0.057 | +0.027 | +2.25 | −51.6 | 737 | −0.023 | −2.15 |
| BE1: stop to entry once +1R reached | 2016-01-01 → 2026-11-19 | 2079 | 39.6 % | +0.089 | +0.057 | +0.024 | +2.37 | −27.3 | 687 | −0.007 | −0.82 |
| TR1: trail 1R behind the best price from +1R | 2005-01-04 → 2015-12-31 | 2089 | 50.3 % | +0.077 | +0.047 | +0.018 | +2.16 | −29.5 | 737 | −0.032 | −1.95 |
| TR1: trail 1R behind the best price from +1R | 2016-01-01 → 2026-11-19 | 2079 | 49.5 % | +0.062 | +0.030 | −0.003 | +1.33 | −29.6 | 687 | −0.034 | −2.28 |
| PH1: half at +1R, rest to the rule's exit | 2005-01-04 → 2015-12-31 | 2089 | 46.8 % | +0.084 | +0.055 | +0.025 | +2.63 | −35.0 | 737 | −0.025 | −2.55 |
| PH1: half at +1R, rest to the rule's exit | 2016-01-01 → 2026-11-19 | 2079 | 46.4 % | +0.062 | +0.029 | −0.003 | +1.49 | −27.7 | 687 | −0.034 | −3.56 |

**Tests (Holm over three, one-sided p of the confirmation month t of d):**

| Variant | d 2005-15 | d 2016 → | Month t of d, 2016 → | p | Holm p | (1) d > 0 both | (2) t ≥ 2, Holm | (3) net > 0 both, t ≥ 2 | Reading |
|---|---|---|---|---|---|---|---|---|---|
| BE1 | −0.023 | −0.007 | −0.82 | 0.794 | 1 | no | no | yes | **NO BETTER** |
| TR1 | −0.032 | −0.034 | −2.28 | 0.989 | 1 | no | no | no | **WORSE** |
| PH1 | −0.025 | −0.034 | −3.56 | 1 | 1 | no | no | no | **WORSE** |

**Control (reported, not in the verdict):** the same managements on the parent studies' placebo trades (a random 5-minute entry 01:00-18:00 UTC and a random side every tradable day, stop 0.5 x the previous range, out 21:00 UTC; 40 seeds), mean d a trade over 2005 → 2026-11-19:

| Variant | T1 d (pooled) | Placebo d, median over seeds | 5-95 % over seeds | T1 inside the band |
|---|---|---|---|---|
| BE1 | −0.015 | +0.002 | −0.003 … +0.007 | no |
| TR1 | −0.033 | −0.003 | −0.012 … +0.004 | no |
| PH1 | −0.029 | −0.008 | −0.012 … −0.003 | no |

**What it says.** The rule's own exit nets +0.079R a trade in 2005-15 (month t +2.95) and +0.063R in 2016 → now (t +2.50). BE1: stop to entry once +1R reached: +0.057R / +0.057R net (t +2.25 / +2.37), max drawdown −51.6 / −27.3R against the rule's −42.2 / −33.8R. TR1: trail 1R behind the best price from +1R: +0.047R / +0.030R net (t +2.16 / +1.33), max drawdown −29.5 / −29.6R against the rule's −42.2 / −33.8R. PH1: half at +1R, rest to the rule's exit: +0.055R / +0.029R net (t +2.63 / +1.49), max drawdown −35.0 / −27.7R against the rule's −42.2 / −33.8R. About 34 % of trades reach +1R after their fill candle. The difference with the rule is the same before and after costs (the cost depends on entry and risk only). Control: on the random-entry placebo trades the same managements change little (median d BE1 +0.002, TR1 −0.003, PH1 −0.008), while on T1 each costs more than the placebo's 5-95 % band (BE1 −0.015, TR1 −0.033, PH1 −0.029): cutting or locking in at +1R takes away the days the breakout runs to 21:00, which is where its result comes from. TR1 and PH1 lower the drawdown a little; they also about halve the net R in 2016 → now. No management meets the pre-registered bar: the rule keeps its own exit (stop at the open, out at 21:00 UTC). Paper research; nothing live changes and no proposal is written.

Net R by year (rule / BE1 / TR1 / PH1):

| Year | Rule | BE1 | TR1 | PH1 |
|---|---|---|---|---|
| 2005 | +30.08 | +32.24 | +21.47 | +27.29 |
| 2006 | +0.54 | −4.27 | −1.63 | −1.72 |
| 2007 | +32.67 | +28.08 | +15.45 | +25.18 |
| 2008 | +5.43 | −0.18 | +5.87 | +7.79 |
| 2009 | +27.74 | +19.22 | +21.06 | +23.74 |
| 2010 | −7.29 | −10.09 | −0.88 | −7.10 |
| 2011 | −24.57 | −29.89 | −21.54 | −19.43 |
| 2012 | +41.64 | +35.37 | +20.53 | +25.59 |
| 2013 | +57.67 | +46.84 | +37.63 | +39.71 |
| 2014 | +11.01 | +11.25 | +11.74 | +6.02 |
| 2015 | −9.17 | −10.27 | −10.70 | −13.06 |
| 2016 | −0.40 | −2.34 | −2.91 | −3.07 |
| 2017 | +6.51 | −5.33 | +2.94 | +2.56 |
| 2018 | +19.40 | +13.44 | +16.13 | +14.33 |
| 2019 | −8.80 | −4.01 | −20.40 | −14.05 |
| 2020 | +17.73 | +8.78 | +10.08 | +9.03 |
| 2021 | +31.20 | +36.08 | +33.33 | +23.83 |
| 2022 | +19.82 | +23.23 | +12.28 | +9.16 |
| 2023 | −15.42 | −9.12 | −15.70 | −16.16 |
| 2024 | +37.84 | +39.06 | +13.49 | +18.84 |
| 2025 | +10.41 | +8.23 | +6.61 | +6.86 |
| 2026 | +13.40 | +9.74 | +5.67 | +9.94 |

Data: OANDA mid M5 USD/JPY from the shared candle cache (edgekit), 2005-01-02 → 2026-11-19 (1651787 candles read); windows 2005-01-04 → 2015-12-31 and 2016-01-01 → 2026-11-19. No financing: nothing is held over the 17:00 New York rollover. The fill candle never moves a stop or takes a partial (its favourable extreme may have printed before the fill); a stop moved by a candle's extreme applies from the next candle; when one candle reaches both the stop and +1R the stop is taken. These choices are conservative for the managed variants.
