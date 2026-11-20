# Gold breakout T1 sized by the Gold Macro Score (20 Nov 2026)

Paper research only. The rule book's "size by the score, never short above +0.25" on gold-vol-breakout's T1, as fixed in `PREREGISTRATION.md` (pushed before any trade was joined to a score). Nothing live changed.

**Verdict: FAIL: H1 (longs above +0.25 better) fails, difference +0.149R (t +1.93); H2 (shorts above +0.25 worse) fails, difference −0.067R (t −0.88)**

T1, 2007-01-01 → 2026-11-12, net of the demo's measured hourly cost (route C1): 3713 trades (gate: n 3713, gross +0.155R a trade, reproduced); 120 before the score's first reading.

### H1: longs, above +0.25 better

- Score above +0.25: n 388, +0.268R net (+0.285R gross), 51.8 % won
- Score at or below: n 1397, +0.119R net (+0.135R gross), 43.7 % won
- Difference +0.149R, Welch t +1.93, one-sided p 0.027, Holm p 0.054; gross t +1.94; month-sum t (post hoc) −0.07 over 63 months
- Halves: 2007-16 +0.262R (t +1.79, 132 / 684); 2017-26 +0.113R (t +1.25, 256 / 713)
- **Fails** (longs)

### H2: shorts, above +0.25 worse

- Score above +0.25: n 364, +0.075R net (+0.090R gross), 40.9 % won
- Score at or below: n 1444, +0.142R net (+0.158R gross), 43.7 % won
- Difference −0.067R, Welch t −0.88, one-sided p 0.189, Holm p 0.189; gross t −0.90; month-sum t (post hoc) +1.19 over 60 months
- Halves: 2007-16 −0.046R (t −0.37, 126 / 775); 2017-26 −0.066R (t −0.69, 238 / 669)
- **Fails** (shorts)

## The book's sizing applied to T1 (reported, not tested)

| Window | Flat total R | Flat month t | Flat max DD | Sized total R | Risk units | Sized R per unit | Sized month t | Sized max DD |
|---|---|---|---|---|---|---|---|---|
| 2007-26 | +503.50 | +6.34 | −28.27 | +392.69 | 2530.5 | +0.155 | +6.28 | −29.19 |
| 2007-16 | +313.16 | +5.45 | −19.45 | +240.26 | 1249 | +0.192 | +4.99 | −16.02 |
| 2017-26 | +190.33 | +3.50 | −28.27 | +152.43 | 1281.5 | +0.119 | +3.84 | −29.19 |

## Deviation from the pre-registration (stated)

The plan named `GGO_TO=2026-11-13` for the candle download. The loader drops the last calendar day of a file, so candles ending at midnight on 13 Nov left 12 Nov out and the gate missed by one trade (3,712 against 3,713). The candles of 12-13 Nov were added (a second download, `GGO_FROM=2026-11-12`, merged by time) so that the plan's own window, days to 2026-11-12, and its gate hold. No trade was looked at before the gate passed.

## Reading

Longs taken with the score above +0.25 did better (+0.268R against +0.119R a trade, positive in both halves), but by a margin the test cannot separate from luck (t +1.93, Holm p 0.054); counted by calendar months it is nil (t −0.07). Shorts above +0.25 were not worse in a way that counts (t −0.88). Sized the book's way, T1 earns +0.155R per unit of risk against +0.140R flat, with the same month t and drawdown: no reason to size T1 by the score. T1's forward record stays flat 1R.

## Limits

- The score and the rule book were written knowing 2007-26; T1 was found on 2016-26. The split t counts trades of the same week as independent (the month-sum t beside it is post hoc).
- Today's cost profile is charged for every year.
