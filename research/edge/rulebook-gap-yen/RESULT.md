# The 2-year against the policy rate, and the yen (20 Nov 2026)

Paper research only. Gauge, sample and bar fixed in `PREREGISTRATION.md`; `rulebook-gauges`' `gapRows` and `testB` imported unchanged, run on the yen's price in dollars (1 / USD/JPY). Nothing live changed.

**Verdict: B1 hikes priced → USD/JPY up FAIL (t 0.67, Holm 1, halves t 0.55 / 0.19); B2 cuts priced → USD/JPY down FAIL (t -0.04, Holm 1, halves t 1.53 / -0.92)**

| Class (2-year vs the upper policy target) | Weeks | USD/JPY next 20 sessions |
|---|---|---|
| Hikes priced (> +25 bp) | 381 | −0.01 % |
| Flat | 379 | +0.19 % |
| Cuts priced (< −25 bp) | 241 | +0.10 % |
| All weeks | 1001 | +0.09 % |

A test passes only with |t| >= 2 in the rule book's direction, Holm p < 0.05 and the same sign in 2007-16 and 2017 on.
