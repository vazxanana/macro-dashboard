# Gold's T1 breakout on platinum and palladium at the demo broker's measured spread (20 Nov 2026)

Paper research only. Method and bar fixed in `PREREGISTRATION.md` before any platinum or palladium quote of the broker was read. Nothing live changed.

**Verdict: FAIL: T1 on xpt, xpd at the demo's measured hourly spread, pooled −0.474R a trade net (n 4082, month t −17.85; 2016-20 −0.612R, 2021→ −0.364R; 26 of 40 placebos); fails: bothWindows, t2, cost2x, placebo**

| Series | n | Net R/trade | Gross R/trade | Net 2x | 2016-20 | 2021→ | Month t | Placebos | All checks |
|---|---|---|---|---|---|---|---|---|---|
| pool | 4082 | −0.474 | +0.060 | −1.009 | −0.612 | −0.364 | −17.85 | 26 of 40 | no |
| xpt (XPTUSD) | 2086 | −0.424 | +0.048 | −0.895 | −0.570 | −0.302 | −13.77 | 23 of 40 | no |
| xpd (XPDUSD) | 1996 | −0.527 | +0.072 | −1.127 | −0.658 | −0.427 | −16.02 | 28 of 40 | no |

Spread profiles (median quoted spread as a share of the mid, by UTC hour 00-20): xpt (XPTUSD) 55.7 57.3 53.0 49.5 54.2 56.5 39.8 45.7 47.6 40.8 39.0 31.8 37.1 45.3 37.4 32.0 40.6 43.6 43.1 43.1 45.9 bp; xpd (XPDUSD) 83.9 91.3 73.3 69.4 71.4 86.1 70.2 72.8 72.8 67.6 67.1 65.5 73.4 76.3 73.6 70.6 63.7 66.9 67.4 64.9 68.5 bp. Commission: 0 (none listed in the council's symbols file; the demo charges gold a commission, so this may understate the cost).
Harness gate (the original assumed costs reproduce pgm-vol-breakout): {"xpt":{"n":2086,"netR":-0.262,"t":-9.53,"want":{"n":2086,"netR":-0.262,"t":-9.53}},"xpd":{"n":1996,"netR":-0.095,"t":-3.59,"want":{"n":1996,"netR":-0.095,"t":-3.59}}}.

