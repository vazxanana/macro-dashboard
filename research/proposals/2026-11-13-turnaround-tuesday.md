# Proposal: a paper shadow of "Nasdaq 100 after a Monday down more than 1 %" (13 Nov 2026)

For the owner. A proposal only: nothing live changed, no Trader block, user rule, config, alert or mirror setting was added
(absolute rule 3). Evidence: `research/edge/turnaround-tuesday/` (PREREGISTRATION.md pushed first, RESULT.md, result.json).

## In plain words
1. **What was tested.** "Turnaround Tuesday": when US stocks close down on Monday, buy the Monday close and sell Tuesday's
   close (one session, stop 2 x the daily ATR(20), costs and a night of financing). Two markets (S&P 500, Nasdaq 100) x two
   rules (any down Monday; down more than 1 %), judged on 2016 to now with 2008-15 as the replication.
2. **What came out.** The common version (any down Monday) does not pay after costs on either market. One cell passed every
   pre-registered check, narrowly: **Nasdaq 100 after a Monday down more than 1 %: +0.098R a trade net, t 2.33, n 81 on
   2016-now (Holm p 0.039 over the four cells), +0.103R, t 2.12, n 70 on 2008-15**; it beat ordinary Tuesdays (Welch t 2.59)
   and random 1 %-down days (40 of 40 placebo seeds). About 8 trades a year.
3. **Why it is not proven.** One cell of four; a Holm p just under 0.05; the same day's sister calendar studies
   (turn-of-month, overnight drift, pre-holiday: all FAIL) were not corrected for together with it; the S&P 500 version of the
   same rule did not pass (t 1.10). Never call it an edge on this evidence.

## What is proposed (your decision)
- **A paper shadow only**: record each signal (NAS100, the first trading day of the week closes more than 1 % under the
  previous trading day's close at 16:00 New York; buy that close, stop 2 x ATR(20) of New York days below, exit at the next
  trading day's 16:00 New York close) as a shadow record, never alerted, never copied to a demo account, never on the futures
  ticket. Judge it on its own forward record (about 8 a year, so years before a forward t means anything).
- Or do nothing: the backtest stays in the Edge lab as a PASS with its caveats.
- Not proposed: any live trade, size, or the base rule.

If you say yes, the build is a separate change (a Trader block reading the NAS100 New York close, which the Trader does not
read today, plus a test), made after your word.
