# Result: the direction of gold's widest H4 candle of the day, followed the next day (14 Nov 2026)

**Verdict: FAIL, 0 of 3: following the day's widest H4 earns nothing over the same-side day (T1 OOS lift −0.010R, t −0.70, net −0.033R a trade, n 2,435; in sample lift −0.009R).**

Pre-registered in `PREREGISTRATION.md` (pushed alone, before any trade was simulated). Paper research only; a stand-alone
daily rule, never a gate, exit, entry or size of the live gold book (item 44); nothing live changed.

OANDA mid H1 XAU/USD (19 Mar 2006 to 13 Nov 2026, 125,704 candles) grouped into New York days (17:00 to 17:00 New York,
`council/histdata.mjs` `nyOffsetH`) and six H4 blocks a day by New York hour. Usable signal days 2,304 in sample / 2,435 out
of sample (the counts read before the run). The widest block was 09-13 New York on 2,439 of 4,739 days (05-09: 1,072;
01-05: 477; 13-17: 372; 17-21: 195; 21-01: 184). Entry at the first open of the next New York day, stop 1 × ATR(20 New York
days), out at that day's last close (T3: the third day's), stop first, gaps at the open. Net of $0.60 a round trip and
financing on buys (`nights` × `FIN.xau.long`). t on calendar-month sums; Holm over the three tests on the OOS lift t.

| Test | IS n | IS R gross / net | IS lift (t) | OOS n | OOS R gross / net | OOS t gross / net | OOS net x2 | OOS lift (t) | Holm p | Placebo beaten | Control beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 follow the widest H4, 1 day (primary) | 2304 | +0.001 / −0.041 | −0.009 (−0.64) | 2435 | −0.005 / −0.033 | −0.33 / −2.25 | −0.061 | −0.010 (−0.70) | 0.758 | 10 of 40 | 10 of 40 |
| T2 as T1, only when the day closed against it | 475 | +0.057 / +0.014 | +0.053 (+1.65) | 513 | +0.027 / −0.001 | +0.84 / −0.03 | −0.029 | +0.032 (+1.01) | 0.313 | 33 of 40 | 34 of 40 |
| T3 as T2, held 3 days | 373 | +0.059 / +0.002 | +0.057 (+1.02) | 504 | +0.056 / +0.016 | +1.10 / +0.31 | −0.024 | +0.066 (+1.36) | 0.261 | 37 of 40 | 37 of 40 |

IS = signal days 2007-01 to 2016-12 (120 months), OOS = 2017-01 to 2026-10 (118 months). Lift = net R − the mean net R of
the same trade on the same side on every usable day of the same year (the baseline).

- **The bar, T1:** OOS lift −0.010R (needs > 0, t ≥ 2 after Holm), OOS net −0.033R (t −2.25), in-sample lift −0.009R, 2x
  costs −0.061R, placebo 10 of 40 and control 10 of 40 (each needs 38): every check but n fails. Before costs T1 is zero in
  both windows (−0.005R / +0.001R); the cost (0.028R a trade OOS) is the loss. Lift positive in 7 of 20 years.
- **T2 and T3** (the day gave the widest candle's move back by its close; follow the candle, not the close): positive lift
  in both windows (+0.053R / +0.032R; +0.057R / +0.066R) and 13 of 20 years each, but no t reaches 2 (largest 1.65 in
  sample, 1.36 out of sample), net is about zero (T2 −0.001R, T3 +0.016R OOS), both lose at 2x costs, and neither beats the
  placebo or the control 38 of 40 (33-37). Not an edge.
- **Financing:** the New York day's first H1 candle is 18:00 New York (the 17:00-18:00 halt prints none), so a one-day hold
  starts and ends between rollovers and pays 0 nights out of sample (0.004R in sample, older candles); T3 pays 0.013R OOS.
  This is the entry the pre-registration calls "17:00 New York": the first candle of the next day.
- **Placebo** (random side on the same signal days, OOS mean lift): T1 median +0.004R (5th-95th −0.030 to +0.021R).
  **Control** (same side on random days of the same year, OOS mean net): T1 median −0.025R (−0.050 to −0.008R): T1 is at
  or below a random day of the same year.
- **Seen after the run, not tested (a hypothesis only):** in T2 and T3 the whole gain is the BUY side, a day that closed
  down while its widest H4 was up: T2 longs lift +0.162R in sample (n 238, t 3.11) and +0.080R out of sample (n 217, t 1.69);
  T3 longs +0.167R (n 192, t 1.66) and +0.203R (n 211, t 2.31, net +0.251R). The sells lose in both windows. This slice was
  chosen by looking, on the same data, and is one of six side splits: it is not evidence. Any follow-up needs its own
  pre-registration on data this study did not read (another market, e.g. silver), never a re-test on gold 2007-26.

**Reading.** On spot gold, the direction of the day's widest H4 candle does not tell the next day's direction out of
sample, on all days or on the days the close gave the move back. This joins `gold-h4-day-open`, `gold-session-agreement`
and `gold-overlap-lead` (all FAIL): an intraday candle's direction is not handed to the next day. Not an edge, not a filter,
not a bias input; nothing here judges the live gold book.

To repeat: `node --use-env-proxy research/edge/gold-dominant-h4/run.mjs fetch <dir>` (cache out of git), then
`node research/edge/gold-dominant-h4/run.mjs full <dir>`. Tests: `tests/gold-dominant-h4.test.mjs`.
