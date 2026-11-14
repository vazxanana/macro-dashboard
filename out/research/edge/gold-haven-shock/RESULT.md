**Verdict: FAIL**: 0 of 3 tests pass. After an S&P 500 (or Nasdaq 100) shock day, a gold buy at the next UTC open does no better than the same buy on ordinary days: on 2016-26 the 5-day trade made +0.108R a trade net (n 92) against +0.120R on ordinary days, excess −0.012R, month-sum t −0.07; the 1-day trade's excess is +0.042R (t 0.54); no test reaches t 1 and every Holm p is 0.88. Gold is not a tradeable safe haven on the day after an equity shock here.

# Gold as a safe haven after equity shock days (14 Nov 2026)

Paper research only, a **standalone signal**: not a gate, filter, size or exit for the live gold systems (owner decision 44),
and nothing here was compared with or applied to the gold book. No live rule, size, filter, stop, config, cost constant or
council member changed. Rules fixed before any number in `PREREGISTRATION.md` (commit d964d6ac2).

## What was tested

- Data: OANDA mid daily candles (UTC), council-data `research/daily/xau.json`, `spx500.json`, `nas100.json` at commit
  `144ae242` (gold 2006-03-20 to 2026-11-06), weekends folded into Monday with `council/fills.mjs` `foldWeekend`.
- Shock day: the index's close-to-close return below −2 × the standard deviation of its 20 previous daily returns.
- Trade: buy gold at the open of its next UTC daily candle (the first price after the index's UTC close, which comes after
  the US cash close), stop 1 × gold's 20-day ATR below, out at the close of day 1 (T1) or day 5 (T2, T3), one at a time;
  net of $0.30 a round trip and financing by `council/fills.mjs` `nights` × `FIN.xau.long` (imported).
- Ordinary days: the same trade on every non-shock eligible day of the window (no one-at-a-time rule); excess = a signal
  trade's net R − their mean.
- T1 / T2: spx500 shocks, 1 / 5 days. T3: nas100 shocks, 5 days (replication market). Decisive window 2016-01-01 on,
  replication 2006-04-18 (first eligible day) to 2015-12-31.

## Results

| test | window | shock days | n | win | gross R | net R | ordinary days net R | net excess | month-sum t (excess) | net R at 2x cost |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 spx500, 1 day | 2016-26 | 110 | 110 | 53.6 % | +0.085 | +0.057 | +0.015 | +0.042 | 0.54 | +0.028 |
| T1 spx500, 1 day | 2006-15 | 112 | 112 | 47.3 % | +0.028 | −0.000 | −0.010 | +0.010 | 0.14 | −0.028 |
| T2 spx500, 5 days | 2016-26 | 110 | 92 | 39.1 % | +0.180 | +0.108 | +0.120 | −0.012 | −0.07 | +0.036 |
| T2 spx500, 5 days | 2006-15 | 112 | 89 | 39.3 % | +0.186 | +0.117 | −0.002 | +0.119 | 0.66 | +0.048 |
| T3 nas100, 5 days | 2016-26 | 106 | 93 | 40.9 % | +0.253 | +0.181 | +0.119 | +0.061 | 0.40 | +0.108 |
| T3 nas100, 5 days | 2006-15 | 110 | 90 | 33.3 % | −0.022 | −0.088 | +0.003 | −0.090 | −0.54 | −0.153 |

T1's 2006-15 net R is −0.000007R a trade (shown −0.000): not above zero, so T1 fails check 1 as well.

| test | p (one-sided, decisive t) | Holm p | check 1: net > 0 both windows | check 2: t ≥ 2 and Holm < 0.05 | check 3: n ≥ 30 | pass |
|---|---|---|---|---|---|---|
| T1 | 0.295 | 0.884 | no | no | yes | no |
| T2 | 0.528 | 0.884 | yes | no | yes | no |
| T3 | 0.345 | 0.884 | no | no | yes | no |

**Placebo** (40 seeds, the same number of random eligible days of 2016-26, the same trade and baseline): month-sum t median
0.35 / 0.22 / 0.15 for T1 / T2 / T3; the real t is matched or beaten by 14, 23 and 11 of the 40 random draws; a random draw
reached t ≥ 2 once (T1) and never for T2 / T3. The real signals sit in the middle of chance.

## Reading

- The positive net R on 2016-26 is gold's own rise over the decade, not the shock: ordinary days earned +0.120R on the
  same 5-day trade, more than the shock days' +0.108R. A 5-day gold buy on any day of 2016-26 was profitable after costs.
- About 40 % of the 5-day trades are stopped (44 of 92 on T2): gold is volatile right after equity shocks, often falling
  with them first (March 2020: three stops in a row).
- The one window where the shock days beat ordinary days (T2 2006-15, +0.119R excess) has t 0.66 and does not repeat on
  2016-26 or on the Nasdaq.
- Financing is small here (about 1 night for T1, 5 for T2 / T3); the verdict is the same before costs (gross excess at most 0.13R either way).

## Not tested

Entry at the US cash close itself (intraday candles), other shock sizes or look-backs, other havens (yen, Treasuries),
shorts, and any use inside the gold book. Any of them needs its own pre-registration.

To repeat: `node research/edge/gold-haven-shock/run.mjs fetch <dir>` (git show from `origin/council-data`, no network),
then `node research/edge/gold-haven-shock/run.mjs full <dir>`. Tests: `tests/gold-haven-shock.test.mjs`.
