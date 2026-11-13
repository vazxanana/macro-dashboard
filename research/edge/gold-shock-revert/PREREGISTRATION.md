# Pre-registration: after an extreme gold day, does the next day revert or continue? (13 Nov 2026)

Written and pushed before any number of this study is computed.

## What this is, and what it is not
A NEW stand-alone daily rule, judged on 2020 → now. It is **not** a gate, exit, entry or size of the gold book (Gold trend +
Gold daily engulf), and it is not tested on that book's 2006-17 window as a book question (docs/owner-decisions.md item 44 holds).
2006-19 is used only as a replication of the sign. Paper research: nothing live changes, whatever the verdict.

## Data
OANDA mid daily XAU_USD from council-data `research/daily/xau.json` (UTC daily candles, read with `git show
origin/council-data:research/daily/xau.json`; no network). **Trading days**: Saturday / Sunday candles are folded into the next
weekday with `council/fills.mjs` `foldWeekend` (imported, not copied); a trailing weekend candle is dropped. Silver
(`research/daily/xag.json`) is reported descriptively only, never judged.

## Definitions (fixed now)
- True range TR(i) = max(H(i), C(i-1)) - min(L(i), C(i-1)). ATR(i) = simple mean of TR over the 20 trading days BEFORE day i
  (i-20 … i-1); undefined with fewer than 21 prior days. Day i's own candle never enters its ATR.
- **Event**: day i with |C(i) - C(i-1)| > 2.0 x ATR(i). Up shock if C(i) > C(i-1), down shock otherwise.
- **Trade**: entered at the OPEN of day i+1 (the first trading day after the event). Initial risk = 1 x ATR(i), stop at entry
  minus (buy) / plus (sell) that distance; every trade has a stop. Exit: the stop, or the CLOSE of day i+3 (the third trading
  day counting the entry day as day 1). Each of the three days: a day that opens beyond the stop exits at its open (gap); else a
  day whose low (buy) / high (sell) touches the stop exits at the stop ("stop first"; there is no target); else the trade
  carries. No break-even, no trail.
- **Rule R (reversal)**: trade against the shock (sell after an up shock, buy after a down shock).
- **Rule C (continuation)**: trade with the shock.
- One position at a time per rule: an event whose entry day falls on or before the open trade's exit day is skipped.
- **Costs**: $0.30 a round trip on gold (in R: 0.30 / initial risk); financing on BUYS only, `council/fills.mjs` `nights(entry,
  exit) x FIN.xau.long x entry / initial risk` (imported), entry time = the entry day's candle time, exit time = the exit day's
  candle time + 24 h for a close exit, the day's candle time + 12 h for a stop exit (a stop inside the day is counted at mid-day).
  Sells pay nothing. Silver: $0.03 a round trip, no financing (no rate measured), said in the report.
- R of a trade = (exit - entry) / risk x side, net = R - cost R - financing R.

## Windows (by entry date)
Decisive: 2020-01-01 → end of file. Replication: start of file (2006) → 2019-12-31.

## Test
Statistic per rule: decisive net R a trade, trade t = mean / (sd / sqrt n), one-sided p = 1 - Phi(t). Holm over the 2 rules
at 0.05.
**PASS** for a rule only if all hold: (1) decisive mean net R > 0, t >= 2 and its Holm-adjusted p < 0.05; (2) decisive n >= 40;
(3) mean net R in 2006-19 > 0 (same sign); (4) placebo: the decisive mean beats the 95th percentile (38th of 40 sorted) of the
same rule's mean on 40 placebo draws. Verdict PASS if either rule passes, else FAIL.

## Placebo (fixed now)
Seeds 1-40 (a seeded mulberry32 generator). Each draw takes, without replacement, as many days as the decisive window has
events (before the one-position rule), from the decisive window's days that have an ATR and three following days; each drawn
day's "shock" direction is the sign of its own close-to-close move (a zero move is up); the same entry, stop, exit, one-position
rule and costs are applied.

## Reported, not tested
Up shocks and down shocks apart (the test pools them); gross R; year by year; exit reasons; silver.

## On a PASS
A proposal to the owner for a paper shadow only (`research/proposals/`), never a live change. A FAIL needs nothing more.
