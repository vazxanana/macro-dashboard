# How many trades before Luxus's record can say anything (14 Nov 2026)

**Arithmetic, not evidence.** No market data, no candles and no trade of Luxus's were read; no rule was tested (owner item 44,
"no more tests on the gold book", is untouched). Every figure comes from `2026-11-14-luxus-record-power.json`, made by the
script of the same name (seeded, 20,000 simulated records a case; a test compares this page with it).

## In plain words

1. **Only his time-stamped pre-entry trades count.** The five examples he shared (+2.8R, +4.6R, +2.1R, +16.4R, +5.6R;
   +6.15R a trade after the assumed cost) were picked by him, after the fact, from a few weeks of trading. Picked winners
   say nothing about how often he wins, so they are **not** the estimate here. The Mosha desk's record counts a trade only
   when it was written down before it was entered (`pre`, the setAt rule of PR #1226); every figure below is about that record.
2. **The desk's "Too few to judge" line at 20 trades is far too early to judge.** At 20 trades even a trader exactly like
   the heavy-tailed case at a 30 % win rate (+1.02R a trade after costs, a strong edge) reaches t ≥ 2 only **4 %** of the
   time. Twenty trades can only show that something is clearly broken, not that it works.
3. **A trader with no edge almost never looks good by luck under this test.** With his kind of win sizes, a zero-edge
   trader (all wins and losses, nothing left after costs) shows t ≥ 2 in 0.09 % of records at 20 trades and 0.37 % at
   100. So when the record does reach t ≥ 2, believe it; the danger is the other way: **giving up on a real edge too soon.**
4. **Recommendation: judge the record at about 150 pre-entry trades, not 20.** At 150 a trader like the heavy-tailed case at
   30 % wins is found 4 times in 5 (152 needed); a better one (35-40 % wins) is found sooner (61-90). Under 150, show the
   record and its t, and say "too few to judge".
5. **What separates skill from luck at that point.** A record of n trades shows skill when its average R a trade is at least
   2 x sd / √n. For the heavy-tailed case at 30 % wins (sd 4.82R a trade) that is **+2.16R a trade at 20 trades, +1.36R at
   50, +0.96R at 100, +0.68R at 200**, after costs. A record under those lines is not proof he lacks skill, only that it
   is not shown yet.

## The assumptions, stated

- **A trade** is a loss of −1R (the stop) or a win of W R; both pay a cost of **0.15R**: $0.60 a round trip (spread,
  commission, slippage on gold) on a typical stop of $4. On a $3 stop it is 0.20R, on a $5 stop 0.12R. Every trade has a
  stop; partial closes, break-even exits and trades closed by hand are not modelled.
- **W**: fixed at 2R, 3R or 5R, or **heavy tailed**: a lognormal with a median of 4R where about 1 win in 11 (9.3 %) is
  15R or more, capped at 30R (mean win 6.23R). It is meant to resemble the shape of his examples, not to be fitted to them.
- **The test**: one-sided t ≥ 2 on the record's average R a trade (the bar the desk already uses), "found" with 80 % power.
  Trades are treated as independent; real trades that cluster (several on one move) make every count here larger.

## The table

Each cell: **expectancy a trade after costs · trades needed to reach t ≥ 2 four times in five**. "no edge" = the expectancy
is zero or below, there is nothing to find. "over 1,000" = not found within 1,000 trades. The last row is a trader with
exactly zero expectancy after costs (the win rate that gives it in brackets) and how often luck alone shows t ≥ 2 at
20 / 50 / 100 trades.

| Win rate | Every win 2R | Every win 3R | Every win 5R | Heavy tail (median 4R) |
|---|---|---|---|---|
| 15 % | −0.70 · no edge | −0.55 · no edge | −0.25 · no edge | −0.07 · no edge |
| 20 % | −0.55 · no edge | −0.35 · no edge | +0.05 · over 1,000 | +0.30 · over 1,000 |
| 25 % | −0.40 · no edge | −0.15 · no edge | +0.35 · 425 | +0.66 · 330 |
| 30 % | −0.25 · no edge | +0.05 · over 1,000 | +0.65 · 134 | +1.02 · 152 |
| 35 % | −0.10 · no edge | +0.25 · 452 | +0.95 · 65 | +1.38 · 90 |
| 40 % | +0.05 · over 1,000 | +0.45 · 147 | +1.25 · 44 | +1.74 · 61 |
| 45 % | +0.20 · 441 | +0.65 · 74 | +1.55 · 29 | +2.10 · 45 |
| 50 % | +0.35 · 141 | +0.85 · 43 | +1.85 · 21 | +2.46 · 34 |
| **No edge** (win rate) | 38.3 %: 1.55 % / 1.86 % / 1.89 % | 28.7 %: 1.24 % / 1.43 % / 1.77 % | 19.2 %: 0.68 % / 0.95 % / 1.15 % | 15.9 %: 0.09 % / 0.22 % / 0.37 % |

Read it this way: a small edge (+0.05R to +0.30R a trade) cannot be shown by any record he will keep; a large one
(+1R a trade or more) needs one to two hundred trades; the cost matters most for small wins (with 2R wins he must win
more than 38 % of the time only to break even).

## What this does not do

It does not estimate Luxus's edge (there is no pre-entry record yet), it does not say his method works or fails, and it
changes nothing on the desk, the council or any rule. If the owner agrees, the Mosha desk's verdict line could later say
"judge at about 150 trades" instead of only "too few to judge" under 20: a separate, small page change, not made here.
