# What USD/JPY's breakout would have felt like (20 Nov 2026)

Accounting for decision 63, not a study: no rule is tested and there is no verdict. From the forward study's committed baseline
(2,079 trades, 2016 → 19 Nov 2026, after the demo's cost; `2026-11-20-usdjpy-risk.mjs` → `.json`). **These are years the rule
was found on**: this is the shape of the record, not a promise.

| | |
|---|---|
| Total | +131.7R over about 11 years (+12.0R a year) |
| Worst drawdown | −33.8R, Dec 2022 → Oct 2023 |
| Longest time below a previous high | 574 days, from Dec 2022 |
| Worst losing streak | 10 trades |
| Worst month | −7.7R |
| Months positive | 74 of 131 |
| Losing years | 2016 (−0.4R), 2019 (−8.8R), 2023 (−15.4R) |

At a fixed risk a trade (simple %, no compounding): 0.1 % → about +1.2 % a year with a 3.4 % worst drawdown; 0.25 % → +3.0 %
and 8.4 %; 0.5 % → +6.0 % and 16.9 %; 1 % → +12.0 % and 33.8 %.

What it means for a demo stream (decision 63): a year like 2023 (−15R) is part of the record, so a forward record of a few
months cannot tell a working rule from a broken one; the forward study's bands (started today) are the judge. Nothing live changed.

**By weekday (reported after looking, not a test):** Monday −0.009R a trade (n 378, t −0.16), Tuesday +0.026R (n 430, t 0.45),
Wednesday +0.144R (n 440, t 2.26), Thursday +0.153R (n 421, t 2.20), Friday −0.009R (n 410, t −0.15). The gain sits in the middle
of the week. A weekday filter chosen from this table would be fitted to it: it is not a rule and would need its own
pre-registration on data no study has read (there is none left on OANDA; the forward record will show whether the pattern holds).
Gold's breakout over 2021-26 (its forward baseline) shows the opposite: Monday strongest (+0.256R a trade, t 2.75), Wednesday
negative (−0.051R). Two markets, two different "best days": read the weekday splits as noise.
