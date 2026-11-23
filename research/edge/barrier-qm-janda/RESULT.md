# Barrier, QM, then the second break: entry at the engulf inside it (gold) — result

Verdict: **FAIL** (pre-registered in PREREGISTRATION.md, run 23 Nov 2026; `run.mjs`, `result.json`, `trades.json`).

The primary rule loses money in every window, before and after costs. Out of sample 2024 to Nov 2026 it made −0.101R a trade
after costs (n 311, month t −1.08); in sample 2020-23 −0.095R (n 431); on the 2010-2019 replication −0.166R (n 1111, month
t −3.48). None of the three secondary tests passes either; two of them are worse than the primary.

| Test | 2010-19 n / R a trade (month t) | 2020-23 n / R a trade | 2024-26 n / R a trade (month t) | 2024-26 at 2x costs | 2024-26 before costs | Holm p |
|---|---|---|---|---|---|---|
| P (primary, Daily side) | 1111 / −0.166 (−3.48) | 431 / −0.095 | 311 / −0.101 (−1.08) | −0.157 | −0.045 | 0.58 |
| S1 no direction filter | 2207 / −0.151 (−4.52) | 894 / −0.101 | 614 / −0.138 (−2.58) | −0.189 | −0.087 | 0.04 (t negative) |
| S2 head in the near quarter | 385 / −0.277 (−3.60) | 153 / −0.207 | 91 / −0.374 (−2.79) | −0.417 | −0.331 | 0.03 (t negative) |
| S3 buys only | 542 / −0.112 (−1.57) | 255 / −0.104 | 173 / −0.041 (−0.34) | −0.110 | +0.028 | 0.74 |

R a trade is after the $0.30 round trip and the council's gold financing on buys, over the opening risk; month t uses
calendar-month sums with empty months counted as zero. The two small Holm p values belong to NEGATIVE t: the rule is reliably
worse there, not better.

## In plain words
- **Direction helps a little and is not enough.** With the Daily structure the loss halves against every fresh zone (S1), but
  stays a loss before costs in two of three windows and after costs in all three.
- **A shallow turn at the zone's edge is the worst variant** (S2, −0.37R a trade out of sample). The deep turns inside the
  zone are the less bad ones.
- **Buys before costs are at zero** (S3 +0.028R out of sample, +0.013R on 2010-19), so costs and financing make them a loss.
  Out of sample sells lost −0.177R a trade (n 138), buys −0.041R (n 173).
- **By pair, out of sample after costs**: Daily → H1 3 trades, H4 → M15 20 trades −0.233R, H1 → M5 129 trades +0.006R (month
  t 0.05), M30 → M5 159 trades −0.169R (t −1.93). No pair is positive in sample (H1 → M5 −0.097R, n 158) or on 2010-19
  (−0.220R, n 403), so the one flat pair is not a lead.
- **By year**: 3 of 17 years positive after costs (2011, 2022, 2026), none by more than +0.04R a trade.
- 24 % of trades reach their target (2R or more away), 60 % are stopped, 17 % leave at the time exit (all windows, P).

## How the rule was read (only where the pre-registration left a choice)
- The touch is known at the close of the touching barrier candle ("closed"); the confirming QM must break after that close and
  within 48 confirmation candles. Of several QMs of the zone's side, the first whose head lies inside the zone is taken; QMs with
  the head outside are passed over (they do not end the setup). The touch candle closing beyond the far side ends the setup.
- The target is the nearest confirmed barrier-timeframe swing at least 2R away, whether or not price has traded through it since.
- One position or resting order at a time per pair; the four pairs run side by side in the pooled tests.
- Engulf: a newer candle of the base's colour becomes the base; a close through the base's other side cancels it; a doji is
  never a base.

## What it does NOT show
- It does not judge the barrier entry as a person reads it: a person picks the best barrier, while this takes every fresh
  break-origin and engulf zone (65,473 on M30 alone).
- No one-minute pairs (no M1 candles in the cache), no other market, and no other stop, target or window was tried; none should
  be tried on these years after this result.
- Fills are OANDA mid 5-minute candles with today's cost for every year; a trade touched in a gap is booked at the open.

Checks passed before the run (`tests/barrier-qm-janda.test.mjs`): no setup known by a moment changes when every later price
changes or the series is cut there; every order and trade has its stop on the losing side, at least $1.00 away, and a target
2R or more away. Nothing live changed; no proposal follows.

## Audit (23 Nov 2026)
An independent read of `run.mjs` against PREREGISTRATION.md found no defect that changes a figure or the verdict.
- Look-ahead: zones are used only from the candle after the one that completes them; swings only after their confirming
  candle; the Daily side is read on 17:00 New York days closed by the touch; the QM must break after the touch candle's close;
  the second break uses swings confirmed after the QM break; the target swing is confirmed by the order's time. None found.
- Fills and costs: every trade pays the $0.30 round trip and buys pay financing; a limit's fill candle can only stop it; a
  candle that opens past the stop exits at the open; stop first when one candle holds both. All 1,853 primary trades and every
  secondary trade have the stop on the losing side.
- Holm is over the four tests' out-of-sample month p; no variant was added or promoted.
- One wording fix: the M30 zone count was written "about 60,000"; result.json has 65,473.
- Months are keyed by the fill time here; the toolkit's `stats` keys them by the exit time. Recomputed that way the
  out-of-sample month t is −1.16 (P), −2.82 (S1), −2.79 (S2), −0.37 (S3) and the 2010-19 t −3.43 for P: no verdict changes.
