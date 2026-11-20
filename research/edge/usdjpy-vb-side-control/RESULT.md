# USD/JPY T1: timing or direction? (20 Nov 2026)

Paper research only. The control and bar were fixed in `PREREGISTRATION.md` before any control trade was computed. Nothing live changed.

**Verdict: INVALID (look-ahead in the pre-registered control; see RESULT.md), computed FAIL: USD/JPY T1 +0.071R a trade vs same-day, same-side random entries +0.359R (n 4168; paired difference −0.288R, month t −23.23; beats 0 of 40); fails: beat, t2, halves**

| | n | Real R/trade | Paired difference (real − control) |
|---|---|---|---|
| all | 4168 | +0.071 | −0.288 (month t −23.23) |
| buys | 1998 | +0.148 | −0.288 |
| sells | 2170 | +0.001 | −0.287 |
| 2005-15 | | | −0.280 |
| 2016 → | | | −0.296 |

**Why this result is invalid, not a FAIL.** The control takes the side of the real trade, and that side is decided by which way the day's breakout fired. A control entry drawn from 01:00-18:00 lands before the breakout on most days, so it is long or short with knowledge of the move that caused the breakout: look-ahead, which is why same-side random entries earn an impossible +0.36R a trade. The pre-registered design cannot answer the question. The corrected control (`usdjpy-vb-side-control-v2`, pre-registered separately) draws entries only after the real fill, when the side is known. No conclusion is drawn from the figures above.
