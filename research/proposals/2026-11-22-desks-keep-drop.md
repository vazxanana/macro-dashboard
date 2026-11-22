# The four desks, part by part: what to keep, what to drop (22 Nov 2026)

Owner, 22 Nov 2026: "recheck every part of the edges, pin point which ones are better for direction, precision, tp sl,
reversals", "compare everything and find what to drop and what to keep", and the hypothesis "if you follow market structure
most of the edges will turn profitable".

What this is: a reading of the desks' own 2026 paper records (50,049 closed trades: Mosha 23,561, Engulfing 23,104, MSNR
2,786, LIT 598), all BEFORE costs, split after the fact. It is in sample, on one year, with hundreds of comparisons: nothing
here is a tested edge, and a split that looks good is a hypothesis for a pre-registered test on other years, never a rule.
Five independent readers also went through the owner's private documents and skills page by page against the code (their
notes stay outside the repository; nothing of the documents is quoted here). Nothing live changed. No desk rule was changed
by this document.

## 1. The headline

Every desk is at zero before costs: Mosha -0.010R a trade (t -1.33), Engulfing -0.011R (t -1.13), MSNR +0.007R (t 0.19),
LIT -0.053R (t -0.71). After costs each loses. No part, split or filter found here changes that.

## 2. "Follow market structure": measured

Each trade was tagged with the structure of M15, H1, H4 and D1 at its entry (the direction of the last close beyond the
last confirmed swing, closed candles only), and with where the entry sat in the last 20 H4 candles' range.

| All four desks together | n | R a trade | t | t by day |
|---|---|---|---|---|
| with the H4 structure | 25,949 | -0.030 | -3.56 | -1.78 |
| against the H4 structure | 23,931 | +0.012 | 1.48 | 0.78 |
| with H4 and H1 | 15,985 | -0.023 | -2.09 | -1.08 |
| with D1, H4 and H1 | 10,147 | -0.030 | -2.14 | -1.13 |
| with H4, on an M15 pullback | 13,402 | -0.027 | -2.31 | -1.33 |
| with D1 and H4, M15 pullback, in the discount half | 2,653 | -0.007 | -0.28 | -0.18 |
| with the D1 structure | 25,339 | -0.008 | -0.97 | -0.52 |
| against the D1 structure | 23,211 | -0.014 | -1.65 | -0.88 |

The hypothesis does not hold on these records: trading with the structure was not better than trading against it on any
timeframe, alone or stacked, and no stack is positive. By desk: Mosha with H4 -0.036R against +0.018R; LIT with H4 -0.366R
(n 217, t -3.91) against +0.134R (n 378): these two desks' entries are reversals at a level, so "against" is their own
design. The Engulfing desk leans the other way on the Daily (with D1 +0.005R, against -0.036R, t -2.59), still zero.
The Mosha sequence with its own tags (with the week and a Daily that is not ranging): +0.023R, n 201, t 0.19.
The Mosha barriers' own with / against tag (the page's structure of the timeframe above): -0.019R / -0.004R.

One caution on any side reading: sells beat buys on three desks (Mosha -0.055R buys / +0.035R sells; Engulfing -0.082R /
+0.060R; LIT -0.352R / +0.204R). That is the year's move, as the replica study found: never a rule.

## 3. Part by part

**Direction.** Nothing adds: with / against any structure, the week, the Daily regime, the barriers' own direction tag.
The nearest to a lean is the Engulfing desk with the Daily structure (plan with the next-candle engulf +0.147R with D1,
n 251, t 2.34, against -0.042R; direct entry +0.70R with D1, n 51, against -0.49R, n 33). Small samples picked after looking.

**Precision (what the entry is).**
- The engulf completed by the NEXT candle beats the four-candle engulf on the same methods: plan +0.081R (n 379) against
  -0.092R (n 1,537, t -3.61); short method +0.061R (n 325) against -0.073R (n 1,481, t -2.81). This agrees with the owner's
  "the less candles the better". It is the one consistent difference in the file.
- Higher-timeframe zones do better than lower ones: Daily engulf +0.137R (n 184, t 1.38), Daily barriers +0.154R (n 89),
  against M15 barriers -0.015R (n 16,868) and the M1 entry -0.013R (n 13,968). Fewer trades, same noise band.
- A lower-timeframe confirmation in front of the entry adds nothing measurable (M1 entry, M5 confirm, Janda all about zero).
- Barrier entry "at the zone" +0.014R (n 1,781) against at the broken level -0.066R (n 2,117, t -3.00).

**Stop and target.** Done on 22 Nov (each reading keeps its best of 1R / 2R / 3R / 4R / its own exit). The share of trades
that reach a target is what a random walk gives (49 / 32 / 24 / 19 %): no target makes a reading profitable. On gold the
30-pip stop sits inside the zone the order rests at; the documents' own answer (skip a zone wider than the stop) is not coded.

**Reversals.** The reversal desks (Mosha barriers, LIT) are zero like the rest. LIT loses most where it fades a sweep WITH
the H4 structure against it, and a reader found why: 238 London sweeps were of a box built from that same night's candles,
never tested for structure outside it (-59.8R).

**Session and market.** Nothing stable: MSNR after 16:00 UTC -0.10R; Mosha and Engulfing on gold are the weakest markets
(-0.035R, -0.053R, t about -2.7), forex about zero.

## 4. Keep / drop (the desk's recommendation; the owner decides)

Drop (largest samples, clearly negative before costs, no part that rescues them):
- Engulfing plan and short method with the four-candle engulf (keep their next-candle twins).
- MSNR gold plan, both entries (-0.171R, n 322; QM -0.53R, n 34).
- LIT "loose" (-0.081R, n 418; breaks the method's own R:R and stop limits on 40 % of its records) and LIT sweeps of the
  night's own box in London.
- Mosha: the barrier entry at the broken level on EG barriers, the turned-chart CF entry (-0.348R, n 41), second-BO (Janda)
  on EG barriers (-0.096R, n 398).
- The M1 EF entry as built (13,968 trades at zero: it reads every M15 zone; the documents' entry zone is an M5 engulf inside
  an M15 engulf inside an H4 zone).

Keep recording (zero or slightly above, small or sensible, worth a real test):
- Daily and H4 engulf (4R), H1 engulf (its own trail), the direct entry, the next-candle plan and short method.
- MSNR earlier scalp method at 12-16 UTC, 4R (+0.103R, n 507, t 1.11): the one group that rose steadily with the target.
- Mosha sequence (+0.019R, n 733) and barriers "at the zone"; LIT "rule".

One test worth pre-registering on years no desk has read (2007-2019), one rule only: the next-candle engulf plan with the
Daily structure, its target fixed beforehand. Everything else on this list has already failed a holdout in some form.

## 5. Where the code still differs from the documents (readers' findings, the owner's or the teacher's call)

Mosha: (1) small breaks against a BO are drawn as the retracement itself, with the best CF at the origin afterwards; the
desk stops that BO's CF entries instead (the 21 Nov turned-chart rule); (2) sequence stop past the pullback or past the CF
zone's far side; (3) target the VR's extreme or the VR box's near edge; (4) a bad CF = overlap with the VR, or any CF
before price is back at the origin; (5) what the second BO of a Janda must break, and how long it may take.
Engulfing: (6) which candle is the first candle when a small inside candle comes before the close; (7) how long the short
method's limit lives (the document's own trade fills after the desk's hour is over); (8) the direct entry's trail uses
zones formed before the fill; (9) the M1 entry's zone (any M15 zone, or the full H4 > M15 > M5 stack); (10) skip a zone wider
than 30 pips; (11) does a doji count as a first candle.
MSNR: (12) the gold plan's engulf and entry are not required inside the H4 zone (the plan method does require it);
(13) the QM order's two hours are shorter than the plan's own example; (14) a level completed by the tap candle counts in
one function and not in the other; (15) an A / V level is a pair of closes or two closes a side; (16) one entry per H4 zone
or per visit; (17) H4 zones older than the side.
LIT: (18) the night's own box in London; (19) the 09:30 sweep is thrown away, the method only forbids entering on that
candle; (20) the order block cannot be the candle before the extreme (188 setups dropped); (21) the day's direction and
"no reversal before the cycle's target" are not read at all.

Fixed without a question: the desk notes that still named the older targets and "any number of candles".

## 6. Half the stop, target 1R or 2R of it (owner, 22 Nov 2026: "try half the size of the sl and target 1 or 2r")

The M1 EF entry's last 30 days (1,271 closed trades on five markets), each replayed alone on ONE-MINUTE candles from its
own fill, stop first when one candle holds both, before costs; R counted in units of the stop used.

| Exit | Total R | reached target |
|---|---|---|
| full stop, 1R | +49.7 | 52 % |
| full stop, 2R (the desk's) | +16.6 | 34 % |
| half stop, 1R | -1.4 | 51 % |
| half stop, 2R | +35.5 | 35 % |
| half stop, 4R (the same price as full 2R) | +41.5 | 21 % |

Every line is inside noise of zero (the largest is +0.04R a trade, t under 1), and the shares reaching the target are
what a coin gives (50 / 33 / 20 %). A half stop does not pick better trades; it only doubles what the spread costs in R
(gold: a $2.50 stop against about $0.15-0.30 a round trip is 0.06-0.12R a trade, more than any line above earns).
On the other desks the 5-minute candles on file cannot judge a half stop fairly (a 5-minute candle is often wider than
the stop), so no figure is given for them. Nothing changed on the desks.
