# Gotobi fade: how sensitive the result is to execution timing

**Verdict: sensitivity report, no class (gate held): the result sits on the 00:55 entry minute; one minute late net R a trade is +0.048 against +0.148 at the base, month t +1.07; the exit minute hardly matters.**

**A sensitivity report, not a test and not a choice.** The base row (entry 00:55, exit 06:00 UTC) is the pre-registered rule of #878 (T2); every other row moves one time and keeps the day list, the stop distance D, the side and the costs frozen. Nothing is chosen from this grid: a row with better figures is noise around the same trade unless a new pre-registration on other data says otherwise. Paper research only; nothing live changed.

**Gate: PASSED.** The frozen code on #878's M5 file gives n 771, +0.1481R a trade (#878: 771, +0.1481). The M1 base gives n 771 (tolerance ±8) and +0.1481R a trade (tolerance ±0.010R), month t +2.74. The M1 open at 00:55 equals the M5 open at 00:55 on 771 of 771 days (100.00 %; required 99 %).

**What it means for a live copy.** Net R a trade falls below half of the base (+0.0741R) at 1 minute late and below zero not within the 5 minutes tested, entry measured from 00:55 with the exit at 06:00.

## Entry moved (exit 06:00 UTC)

| Row | Entry (UTC) | Exit (UTC) | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % |
|---|---|---|---|---|---|---|---|---|---|---|
| entry 00:53 | 00:53 | 06:00 | 771 | +0.0646 | +0.1772 | 0.1126 | +49.8 | +1.33 | 48.5 | 30.5 |
| entry 00:54 | 00:54 | 06:00 | 771 | +0.0720 | +0.1846 | 0.1126 | +55.5 | +1.46 | 48.8 | 29.7 |
| **base (the rule)** | 00:55 | 06:00 | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 | 51.4 | 27.6 |
| entry 00:56 | 00:56 | 06:00 | 771 | +0.0483 | +0.1609 | 0.1126 | +37.3 | +1.07 | 48.4 | 29.3 |
| entry 00:57 | 00:57 | 06:00 | 771 | +0.0263 | +0.1389 | 0.1126 | +20.3 | +0.57 | 46.9 | 29.6 |
| entry 00:58 | 00:58 | 06:00 | 770 | +0.0060 | +0.1184 | 0.1124 | +4.6 | +0.13 | 46.2 | 30.3 |
| entry 01:00 | 01:00 | 06:00 | 771 | +0.0101 | +0.1227 | 0.1126 | +7.8 | +0.22 | 45.0 | 30.0 |

## Exit moved (entry 00:55 UTC)

| Row | Entry (UTC) | Exit (UTC) | n | Net R a trade | Gross R | Cost R | Total net R | Month t | Win % | Stopped % |
|---|---|---|---|---|---|---|---|---|---|---|
| exit 05:55 | 00:55 | 05:55 | 771 | +0.1494 | +0.2620 | 0.1126 | +115.2 | +2.78 | 50.6 | 27.4 |
| **base (the rule)** | 00:55 | 06:00 | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 | 51.4 | 27.6 |
| exit 06:02 | 00:55 | 06:02 | 771 | +0.1536 | +0.2662 | 0.1126 | +118.5 | +2.77 | 50.1 | 27.9 |
| exit 06:05 | 00:55 | 06:05 | 771 | +0.1575 | +0.2701 | 0.1126 | +121.4 | +2.80 | 49.8 | 28.1 |

## Gate detail

| Source | n | Net R a trade | Gross R | Cost R | Total net R | Month t |
|---|---|---|---|---|---|---|
| #878 (as published) | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 |
| frozen.mjs on the M5 file | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 |
| M1 base (00:55 / 06:00) | 771 | +0.1481 | +0.2607 | 0.1126 | +114.2 | +2.74 |

Days traded on M5 only: none. On M1 only: none. Open mismatches at 00:55: none.

## Notes

- D, the day list, the side and the costs are frozen; the stop sits D above the actual (shifted) fill, as a live copy would place it. Costs are the frozen model at every minute: the measured cost of a late fill at the fix (wider spread, faster price) is not in them.
- Entry at 00:53 / 00:54 and exit at 05:55 are shown only to see whether the effect sits on the fix minute itself; they are not an option.
- Month t is on calendar-month sums of net R (frozen monthT); it is a measure of each row's noise, not a test. No Holm, no placebo: nothing here is judged as an edge.
- Tolerance is read off the entry rows after 00:55 only (tested up to 5 minutes late, with the exit at 06:00).
- Plain reading, after the gate and not a choice: the result sits on the 00:55 minute itself. One minute late the trade makes +0.048R (month t +1.07), two minutes +0.026R (t +0.57), three minutes +0.006R (t +0.13); one or two minutes EARLY it also loses about half (+0.072R, +0.065R). The exit is not sensitive: 05:55 +0.149R, 06:00 +0.148R, 06:02 +0.154R, 06:05 +0.158R.
- For a live copy: a loop that runs about once a minute plus broker latency would usually fill one to two minutes after 00:55, where this grid shows about two thirds to four fifths of the base net R lost and no row with a month t above 1.1 (before any extra cost of trading at the fix). Only an order that fills at the 00:55:00 price keeps the measured figure; how to place one is not tested here and would need its own proposal.
