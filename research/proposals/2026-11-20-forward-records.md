# The three forward records: what runs, and when each can first be judged (20 Nov 2026)

A note for the owner. Nothing here is a decision; nothing trades, alerts or copies. Each record follows the rule of a study that
passed on its own data, on days after every candle that study read, and was pre-registered before any forward day was computed.
The workflow `vb-forward.yml` (weekdays, Tuesday-Saturday 04:41 UTC, free) refreshes all three in council-data
`research/forward/`; the Edge lab shows the latest reading on each row to a signed-in member.

| Record | The rule | Forward from | Expected record (study, after costs) | Trades a year | First checkpoint | Second checkpoint |
|---|---|---|---|---|---|---|
| `gold-vol-breakout-forward` | Gold breakout T1, the measured hourly cost (C1) | 13 Nov 2026 | +0.105R a trade (2021-26, n 1,121, month t 2.79) | about 190 | 120 trades, about July 2027 | 240 trades, about February 2028 |
| `gold-pre-holiday-forward` | Gold before US holidays, T1 | 31 Oct 2026 | +0.133R a trade (2017-26, n 92) | about 9 | 20 events, about two years | 40 events, about four and a half years |
| `turnaround-tuesday-forward` | NAS100 after a Monday down more than 1 %, out at Tuesday's close (R2) | 12 Nov 2026 | +0.098R a trade (2016-26, n 81) | about 7.5 | 20 trades, about 2029 | 40 trades, about 2032 |

How each is read (the same in all three pre-registrations): under the minimum count it says "too few"; at the first checkpoint
it **fails** if the total is below the 5th percentile of what the study's own record gives for that many trades, otherwise it
**holds so far**; at the second it is **confirmed** only if the total is above the 95th percentile of a no-edge copy of the same
trades and t >= 2, **fails** below the 5th, otherwise **not shown either way**. The first crossing of each checkpoint stands.

What this means in practice:
- Only the gold breakout gives an answer inside a year. It is the one to watch; its first job on the demo account would be the
  stop-order slippage (proposal of 14 Nov, item 62), which the forward record does not measure.
- The other two are slow by nature (a handful of events a year). They are kept because they cost nothing; neither should be
  traded or sized on its forward record before its first checkpoint.
- None of them is an edge until its record says so. A study that passed in sample and a few weeks of forward days are not proof.

Readings on 20 Nov 2026 (the 07:20 UTC run): gold breakout 3 trades, +4.53R after the measured cost (16, 18 and 19 Nov, all
sells in gold's fall from about 3,885 to 3,560: +0.74R, +3.56R, +0.23R); pre-holiday 0 events (Thanksgiving is the first); Turnaround Tuesday 1 trade, −0.135R. All "too few".

Fixed today: the gold breakout record read candles only up to midnight UTC, so the last complete day was left out (the 06:07 run
on 20 Nov counted through 18 Nov); it now reads up to the run, and the 07:20 run counted 19 Nov.
