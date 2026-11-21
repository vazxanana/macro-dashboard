# Pre-registration: the desks' readings after the marking audit, and the methods' own conditions (21 Nov 2026)

Written and pushed alone, before any trade of these tests is computed. The tests run once; nothing below is changed after a
result is seen. Paper research only: nothing live changes, no council member, mirror, config or desk reads the result.

## Why
The owner (21 Nov 2026): "do a study in how to improve each edge, but before make sure you are marking the key levels …
some of them you are not following the strategy rigorously." The marking audit of the same day brought the Mosha, Engulfing
and MSNR desks to the methods' own definitions (VR and CF as a BO Structure, the barrier's confirmation timeframes and
pullback entry, body engulfs, A / V levels on the closes, the engulf zone that failed). Two questions follow, and both are
asked on years the desks' records do not cover:
1. Does each reading, as the desk now records it, make money after costs?
2. Does each condition the METHODS THEMSELVES name (not one found in the desks' results) pick the better trades?
The conditions are taken from the methods' text, fixed here, before any result on these years exists.

## What is tested
The desks' own code, imported and not edited after this file: `assets/mosha-sop.js` (`sopTrades`, `barrierTrades`) on the
page's own `msAnalyze` / `msMosha` / `msZones` / `msInternal`, `council/eg-methods.mjs` (`methodTrades`, `snrTrades`,
`direction`) and `council/edge-desks.mjs` (`msnrTrades`). No parameter is varied. One option is added to `msnrTrades` after
this file and before the run, and changes nothing the desk records: `against: true` returns the entries AGAINST the
direction instead of with it (needed for C6).

**Readings** (each: is net R a trade above zero?)
- **R1** Mosha sequence (BO, VR, CF, pullback, EG) on the ladder D1/H4, H4/H1, H1/M30, M30/M15, M15/M5.
- **R2** Mosha barrier entry on D1, H4 and H1 barriers (confirmation H1, M15, M5). The M15 barrier (confirmation M1) is
  left out: no one-minute history is on file for these years.
- **R3** Engulf "plan" (with the Daily's last engulf). **R4** Engulf "simple" (the same entry, not with the Daily).
  **R5** Engulf "direct entry" on fresh zones.
- **R6** MSNR: the direction reading in front of the M15 then M5 engulf entry, entries with the direction, every hour.
- **R7** MSNR gold plan (Daily level rejection, H4 break, H4 zones, M15 engulf; gold only).

**Conditions** (each: does the subset the method prefers make more net R a trade than the rest of the same reading?)
- **C1** R1 trades whose pullback reached 50% of the range before the CF, against those where it had not.
- **C2** R1 trades with the CF clear of the VR ("case 1"), against the CF inside the VR ("case 2").
- **C3** R2 barriers that are the origin of a major BO, against the origin of an internal BO.
- **C4** R2 entries WITH the Daily structure (the side of `msAnalyze`'s trend on the Daily candles closed by the entry),
  against entries not with it.
- **C5** R3 against R4: the same entry with the Daily's last engulf, against without it.
- **C6** R6 against the same entry taken AGAINST the direction.

Not retested: the LIT desk and the engulf reading on D1 / H4 / H1 (`desk-slices`, 21 Nov 2026, nothing in them changed).

## Markets and data
Gold, EUR/USD and GBP/USD (R7: gold only). OANDA mid candles through the keyless candle proxy, kept out of git: M5 from
2019-06-01 (warm-up), D1, H4 and H1 as the proxy serves them, M15 and M30 grouped from M5 on UTC clock buckets. Trades are
kept by their fill time. One reading on one market holds one position at a time only where the desk's code does.

## Windows
- In sample: fills 2020-01-01 to 2023-12-31.
- Out of sample: fills 2024-01-01 to 2025-12-31.
- **Nothing from 1 January 2026 on is in either window**: the desks' records start that day and their totals have been
  looked at (so has a 30-day check of the corrected Mosha rules, October to November 2026).

## Costs (per round trip, taken off every trade in R = cost / the trade's opening risk)
As `desk-slices`: gold 0.00005 of price (measured hourly spread about 0.000026 plus commission 0.000024); EUR/USD and
GBP/USD commission 0.000045 of price plus 0.5 pip. No financing is charged (reported as a limit: a Mosha sequence trade
from a Daily BO can live for days). 2x costs: twice every figure.

## Statistics and the bar
Per reading and window: n, win %, R a trade before and after costs, total, worst drawdown, t on calendar-month sums of net
R, by year and by market. For a condition: per calendar month the mean net R of the preferred subset minus the mean of the
rest (months where both have a trade), and the t of those monthly differences against zero. One-sided p (normal) from the
out-of-sample t, Holm over all thirteen tests.
- **A reading passes only if all hold**: out-of-sample n >= 100; out-of-sample net R a trade > 0 with month-sum t >= 2 and
  Holm p < 0.05; in-sample net R a trade > 0; out-of-sample net > 0 at 2x costs.
- **A condition passes only if all hold**: at least 50 out-of-sample trades on each side; the out-of-sample monthly
  difference > 0 with t >= 2 and Holm p < 0.05; the in-sample difference > 0.
- Fewer trades than the minimum is "too few to judge" and counts as not passed.

## What a result means
A reading that passes becomes a candidate for a forward paper record with its own pre-registration; it is not an edge on
its own. A condition that passes is proposed to the owner as a requirement on that desk's paper record (the desk would then
record only those trades, or mark them); nothing changes without the owner. A reading that fails stays what it is: a paper
record of one way to read the method, and what a person adds by choosing which setups to take is not in any rule. A
condition that fails is not made a requirement and is not looked at again on these years.
