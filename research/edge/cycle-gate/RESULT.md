# The market-cycle gate: result (13 Nov 2026)

**Verdict: FAIL, 0 of 11 systems.** The primary gate G2 (trade only on the side of the last H4 break, and not while H1 is
in the pullback against it) does not improve any system's own trades measurably on 2020 → now. No system meets the
pre-registered bar (kept beats all in both halves, kept − blocked Welch t >= 2, Holm over 33 tests, drawdown not deeper);
the largest G2 t is 0.99 (Gold daily engulf), every Holm p is 1.00. The two secondary gates fail too (largest t 1.90, G1 on
the engulf, Holm p 0.94). No proposal is written; nothing live changed.

Pre-registration: `PREREGISTRATION.md` (committed and pushed alone, before any trade was split). Paper research only.

Plainly: the gate is a direction filter, and like the earlier ones here (`msnr-direction`, `mosha-retrace`, `mosha-cycle`) it
does not separate winners from losers in a way that repeats. Where it looks better in one half it is worse or flat in the
other, and the placebo (blocking the same number of trades at random) passes about as often as the gate.

## G2, per system (net R a trade after each system's own costs, financing on gold buys)

First half = entries 2020-01-01 to 2023-12-31, second half = 2024-01-01 to the end of the source. "month t" = kept − blocked
on calendar-month means (descriptive: the trades of a stream overlap in time, which flatters a per-trade t).

| system | n (2020 →) | blocked | first half: all → kept | second half: all → kept | kept − blocked | Welch t | Holm p | month t | worst DD all → kept | placebo passes |
|---|---|---|---|---|---|---|---|---|---|---|
| Gold trend | 49 | 9 | +0.305 → +0.250 | +2.264 → +2.322 | -0.204 | -0.169 | 1 | -0.753 | 4.15 → 4.95 | 0 / 40 |
| Gold daily engulf | 150 | 78 | +0.329 → +0.356 | +0.255 → +0.560 | +0.284 | 0.986 | 1 | 1.765 | 6.479 → 7.02 | 0 / 40 |
| Gold trend fast | 78 | 12 | +0.363 → +0.574 | +1.722 → +1.581 | +0.439 | 0.356 | 1 | 0.938 | 4.543 → 3.827 | 6 / 40 |
| H4 trendline | 238 | 101 | -0.105 → -0.242 | +0.286 → +0.327 | -0.142 | -0.924 | 1 | -0.245 | 23.085 → 22.071 | 1 / 40 |
| Momentum pullback | 760 | 278 | +0.022 → -0.039 | +0.194 → +0.232 | -0.059 | -0.611 | 1 | 0.698 | 14.036 → 32.495 | 0 / 40 |
| Gold replica | 212 | 144 | -1.085 → -1.085 | +0.884 → +0.878 | -0.067 | -0.132 | 1 | -0.063 | 18.004 → 16.407 | 0 / 40 |
| Mosha BO | 122 | 85 | -0.565 → -0.807 | -0.152 → +0.775 | +0.212 | 0.635 | 1 | 0.328 | 49.45 → 25.142 | 0 / 40 |
| Engine scalp (gold + 5 forex) | 53718 | 24137 | -0.265 → -0.256 | -0.266 → -0.275 | +0.003 | 0.209 | 1 | 0.038 | 14300.26 → 7877.172 | 2 / 40 |
| Engine intraday (gold + 5 forex) | 12113 | 4837 | -0.168 → -0.172 | -0.118 → -0.148 | -0.036 | -1.089 | 1 | -1.62 | 1837.385 → 1182.216 | 2 / 40 |
| Engine retrace scalp (gold + 5 forex) | 27844 | 21969 | -0.232 → -0.227 | -0.257 → -0.255 | +0.004 | 0.2 | 1 | 0.019 | 6746.957 → 1406.232 | 2 / 40 |
| Engine retrace intraday (gold + 5 forex) | 6575 | 5817 | -0.137 → -0.080 | -0.149 → -0.099 | +0.061 | 0.882 | 1 | 0.394 | 939.876 → 97.113 | 0 / 40 |

What each line says:
- **Gold trend** (live): a 20-day breakout long is almost always WITH an up H4 move already; G2 blocks 9 of 49 and those 9
  did better than the rest. Nothing to gain.
- **Gold daily engulf** (live): the nearest thing to a result. G2 blocks 78 of 150; kept is ahead in both halves (+0.36 vs
  +0.33, +0.56 vs +0.26) but kept − blocked is t 0.99 (month t 1.77), the worst drawdown is deeper (7.0R against 6.5R), and
  2020-26 is in sample for this rule (built on). Not a finding. G1 (H4 direction only) is +0.52R kept − blocked, t 1.90,
  Holm p 0.94, chosen-looking and not significant after the 33 tests.
- **Gold trend fast, H4 trendline, momentum pullback, replica**: worse or flat in one half; the trendline's first half gets
  WORSE with the gate (−0.11 → −0.24R).
- **Mosha BO**: the second half turns positive (+0.77R kept) but the first half gets worse (−0.56 → −0.81R); t 0.64.
- **Engine shadow setups** (about 100,000 trades): within ±0.06R of the ungated stream, still deeply negative after costs.
  Drawdowns shrink only because fewer losing trades are taken.

## G1 and G3 (secondary, counted in the Holm correction)

| system | G1 kept − blocked (t) | G1 halves all → kept | G3 kept − blocked (t) | G3 halves all → kept |
|---|---|---|---|---|
| Gold trend | — (—) | +0.305 → +0.351; +2.264 → +2.264 | +1.137 (0.564) | +0.305 → -0.178; +2.264 → +4.024 |
| Gold daily engulf | +0.517 (1.895) | +0.329 → +0.514; +0.255 → +0.339 | +0.011 (0.04) | +0.329 → +0.233; +0.255 → +0.390 |
| Gold trend fast | — (—) | +0.363 → +0.394; +1.722 → +1.722 | -0.641 (-0.833) | +0.363 → +0.763; +1.722 → -0.145 |
| H4 trendline | -0.164 (-1.065) | -0.105 → -0.252; +0.286 → +0.316 | -0.354 (-1.947) | -0.105 → -0.508; +0.286 → +0.232 |
| Momentum pullback | -0.062 (-0.612) | +0.022 → -0.017; +0.194 → +0.212 | -0.092 (-0.964) | +0.022 → -0.047; +0.194 → +0.187 |
| Gold replica | -0.730 (-1.592) | -1.085 → -1.085; +0.884 → +0.476 | +0.756 (1.13) | -1.085 → —; +0.884 → +1.482 |
| Mosha BO | +0.152 (0.492) | -0.565 → -0.721; -0.152 → +0.532 | -0.365 (-1.326) | -0.565 → -0.950; -0.152 → +0.024 |
| Engine scalp (gold + 5 forex) | +0.004 (0.226) | -0.265 → -0.257; -0.266 → -0.274 | -0.023 (-1.355) | -0.265 → -0.280; -0.266 → -0.286 |
| Engine intraday (gold + 5 forex) | -0.063 (-1.499) | -0.168 → -0.172; -0.118 → -0.145 | +0.021 (0.659) | -0.168 → -0.134; -0.118 → -0.136 |
| Engine retrace scalp (gold + 5 forex) | +0.008 (0.456) | -0.232 → -0.235; -0.257 → -0.239 | +0.009 (0.433) | -0.232 → -0.224; -0.257 → -0.249 |
| Engine retrace intraday (gold + 5 forex) | -0.016 (-0.3) | -0.137 → -0.151; -0.149 → -0.162 | +0.074 (0.956) | -0.137 → -0.078; -0.149 → -0.071 |

G1 blocks a single trade of each trend leg (the breakout itself is an up H4 break), so its t cannot be computed there.

## This week, and the live book since 1 Nov (descriptive, gate read at each entry on the same OANDA candles)

| trade | side | entry (UTC) | result | H4 | H1 | G2 |
|---|---|---|---|---|---|---|
| H4 trendline `xau-gtl-1793836800-1794182400` | buy | 2026-11-09 20:00 | -1R | up (broken at that same H4 close) | move | take |
| Gold daily engulf `xau-geg-1794096000` | buy | 2026-11-10 10:30 | -1R | up | pullback | block |
| Gold daily engulf `xau-geg-1793664000` | buy | 2026-11-12 00:09 | -1R | down | move | block |

The gate would have blocked two of this week's three losses (and taken the trendline buy, whose own H4 break up was the
last before the fall). Over the 13 non-shadow gold trades since 1 Nov (old-engine scalps of 1-3 Nov, the replica, the
book): G2 takes 7 (all losses, −7R) and blocks 6 (−2R: four losses, a break-even and the replica's +2R win). A week is an
anecdote either way; the 2020-26 split above is the evidence, and it shows nothing.

## Data and method, as run

- Gate candles: OANDA mid H1 and H4, 2019-06-02 to 13 Nov 2026, UTC buckets (`run.mjs candles`, kept out of git). H4 breaks
  `boEvents(H4, 3)`, H1 breaks `boEvents(H1, 1)` of `mosha-retrace`, imported. States counted per stream in result.json
  `streams.<id>.states`.
- Trades: Gold trend / Gold trend fast / Gold daily engulf from `supported-book/legs.json` (positions after $0.30 a unit and
  financing on every unit; engulf on the raw-day engine of before 12 Nov); H4 trendline, momentum pullback, Mosha BO from the
  robustness rebuilds (to Oct 2026) with financing on buys; the replica from the council replay (rows from Dec 2023 only, so
  its first half holds 2 trades); the engine setups from shadow-best's per-trade output, checked against its result.json cell
  by cell (to 31 Oct 2026).
- One departure from the pre-registration: the engine setups' rows carry no exit time, so their drawdowns are cumulated in
  order of signal time. It changes no verdict (they fail on halves and t).
- To repeat: `node --use-env-proxy research/edge/cycle-gate/run.mjs candles <dir>`, shadow-best's `market <key>` for the six
  markets, `git show origin/council-data:research/replay-2w.json` and `trades.json` into a folder, then
  `node research/edge/cycle-gate/run.mjs study <candleDir> <shadowDir> <councilDataDir>`.
