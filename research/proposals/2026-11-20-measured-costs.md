# What the demo broker really charges, and what it changes (20 Nov 2026)

**For the owner. Paper research only: nothing here changes a live rule, size, stop, filter or council member.** On 20 Nov 2026
the tick probe (`council/tick-probe.mjs`) read the demo broker's own past bid / ask (its history reaches at least 1,095 days),
and seven pre-registered studies priced earlier results at those real quotes. Each study pushed its plan before reading its data.

## In plain words

- **Gold is cheap to trade on this account, at every hour.** The quoted spread is $0.07-0.10 in every UTC hour, Asian hours
  included, plus a 0.0024 % commission. The studies had charged $0.30-0.60 a round trip.
- **The gold volatility breakout (T1) survives real fills.** Filled at the broker's own ticks (first tick across the trigger and
  the stop, last quote before 21:00 UTC) over the last three years it made **+0.184R a trade after commission (n 572, month t
  3.54)**. A stop order slipped $0.07 in the median (0.011R). These years are in sample for the rule; the ten best trades carry
  55 % of the total and 2024 was +0.07R. It is the best-evidenced candidate the desk has, and only a forward record can say more
  (item 62, open).
- **The gotobi fade (item 61, running on a demo account) costs 0.8 pip at the fix**, not the 2.0 assumed: the cost no longer
  threatens the study. On executable quotes it made +0.163R a trade over 211 gotobi days (month t 1.80, short of 2).
- **Things that do not work, now with real prices:** trading gold in the first hour after US CPI / payrolls / FOMC (the spread
  is about 18× normal at T+5 s, both pre-registered trades FAIL); the silver breakout (silver costs 20× gold, 0 of 4); the forex
  Sunday reopen gap (11 pips at entry, and the broker was not quoting on 237 of 488 weekends: FAIL); the index breakout on
  NAS100 / SPX500 (cheap too, but random entries do nearly as well: FAIL, 0 of 2).

## The studies

| Study | What was measured | Verdict |
|---|---|---|
| `gold-vol-breakout-hourcost` | gold spread by UTC hour, applied to T1 2007-26 | accounting: T1 +0.105R 2021-26 (t 2.79), +0.139R pooled (t 6.47) |
| `gold-vol-breakout-exec` | T1 filled at the broker's ticks, Nov 2023 - Nov 2026 | **PASS**, +0.184R, n 572, month t 3.54 |
| `gotobi-exec` | USD/JPY quotes at 00:55 and 06:00 UTC, 211 gotobi days | cost 0.81 pip; return month t 1.80 (FAIL on its bar) |
| `gold-release-quotes` | gold quotes around 93 US releases | FAIL (continuation +0.03R, reversal −0.33R) |
| `silver-vol-breakout-hourcost` | silver spread by hour | 0 of 4 |
| `fx-weekend-gap-exec` | quotes at the Sunday reopen, 18 pairs | FAIL, +0.165R, month t 1.52; often unquoted |
| `index-vol-breakout-hourcost` | NAS100 / US500 spread by hour | FAIL, 0 of 2 (NAS100 fails the placebo only) |

## What this means for decisions

1. **Item 62 (new): run gold T1 as a forward paper / demo stream?** The costs are measured; what is left is whether the rule
   still pays going forward. Nothing is built until you say so; a stream would have a stop on every trade and stay on demo.
2. **Item 61 (gotobi, running):** no change. Its first morning was missed (20 Nov); the next gotobi day is 25 Nov.
3. **The repository secret `GH_DISPATCH_TOKEN`** ("What needs you now" #6) lets the website's timer start the gotobi job and the
   watchdog on time instead of waiting for GitHub's cron.

Never call any of these an edge on the strength of this page: the in-sample warning above stands, and the forward record decides.
