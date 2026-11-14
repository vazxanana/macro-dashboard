# Pre-registration: does the gold / platinum (and gold / palladium) ratio carry a signal for gold itself? (14 Nov 2026)

Written and pushed alone, before any ratio, z-score or return was computed. Paper research only: a **standalone cross-asset
signal on spot gold**, never a gate, entry, exit or size of the live gold book (Gold trend, Gold daily engulf). Owner decision
44 (no further gate, exit, entry or size tested on the gold book's 2006-17 window) is about that book's positions; this study
reads none of them, so the window below is the signal studies' usual one. Nothing live changes, whatever the result.

## Dedupe (read before writing this)

- `gold-silver-ratio` (#829, FAIL): the gold / silver ratio z-score traded as a two-leg pair back to its mean. Different metal
  and a different trade (here gold alone is traded; the second metal is only the signal).
- `gold-silver-divergence` (FAIL): intraday H1 non-confirmation, not a ratio level.
- `copper-gold` (FAIL): the copper / gold ratio as a risk-on signal for US indices, not for gold.
- `high52-cmdfx`, `commodity-xs-momentum` (FAIL): cross-sectional ranks over a whole commodity set, not the pairwise gold
  versus platinum spread traded on gold.
- `intermarket-lead` F3 (the dollar leads the metals), `gold-oil-lead` (oil / copper days lead gold): other leaders.
- No study on any branch or in `research/proposals/2026-11-14-untested-backlog.md` reads platinum or palladium as a signal for
  gold. So the three tests below are new.

## Data

council-data `research/daily/xau.json`, `xpt.json`, `xpd.json` (OANDA mid daily candles, UTC days; gold from 2006-03-20,
platinum and palladium from 2005-01-04, all to 2026-11-06), read with `git show origin/council-data:…` (no network), weekends
folded into Monday with `council/fills.mjs` `foldWeekend`. Days are matched by their UTC day stamp, never by row number; a
ratio exists only on a day both markets have a candle.

## Signals (all from closes known before the entry; entry = gold's next daily open after the signal day)

- **Ratio z**: L_D = ln(gold close_D / metal close_D); z_D = (L_D − mean of the 250 L values before D) / sd of those 250 (D's own
  value not in the mean or sd). The first z needs 251 joint days (about March 2007).
- **T1 (primary), gold / platinum extreme, reversion traded on gold**: z_D >= +2 (gold rich against platinum) → SELL gold;
  z_D <= −2 → BUY gold. Taken on any such day while no T1 trade is open (one at a time). Hold 10 gold candles (two weeks).
- **T2, gold / palladium extreme**: the same rule with palladium.
- **T3, monthly gold-versus-platinum relative momentum**: on the last joint trading day of each calendar month, m_g = gold's
  return and m_p = platinum's return over the 21 joint days before it (close to close, ending at that day's close);
  m_g > m_p → BUY gold, m_g < m_p → SELL gold. Hold 21 gold candles (about one month). One at a time.

## Trades (gold only; platinum and palladium are never traded: `council/fills.mjs` has no cost model for them)

- Entry at the open of the first gold candle later than the signal day. Stop 3 x ATR(20) from the entry (ATR of the 20 true
  ranges before the entry candle), fixed. A candle after the entry opening through the stop exits at its open; else a touch
  exits at the stop; else out at the close of the last held candle (entry candle = 1). 1R = the stop distance.
- Costs: $0.30 spread + half a spread ($0.15) of slippage on each of the two market orders = $0.60 a round trip, as the
  gold signal studies; financing on longs `nights(entry, exit) x FIN.xau.long x entry` (the demo broker's rate of 11 Nov
  2026, charged for every year), nothing on shorts. 2x costs doubles both.

## Windows, statistics, pass bar

- In sample: first signal (about 2007) to 2016-12-31. Out of sample: 2017-01-01 to 2026-10-31 (by signal date).
- t on calendar-month sums of net R (by exit month, empty months 0). One-sided p from the normal; Holm over the three OOS p.
- **Placebo**, per test: 40 seeded draws (seeds 1-40) of random OOS days with a valid signal input, as many as the real OOS
  trades, given the real trades' sides in a random order (same long / short mix), traded by the same rule; the real OOS
  month t is compared with their distribution.
- **Pass (a test)**: OOS net month t >= 2 with Holm p < 0.05; in-sample net mean of the same sign (> 0); OOS net mean > 0 at
  2x costs; OOS n >= 30; real OOS t above the placebo's 95th percentile. **Verdict**: PASS if T1 passes, PARTIAL if only T2
  or T3 passes, else FAIL. A pass would be a hypothesis for a proposal, never a live change by itself.

Nothing else is tested (no other z cut, lookback, hold or stop); anything seen afterwards is reported as unregistered.
