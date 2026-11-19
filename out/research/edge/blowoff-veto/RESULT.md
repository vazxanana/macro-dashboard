# Blow-off veto on the Gold Macro Score

**Verdict: FAIL** (pre-registered, 19 Nov 2026). On the score's own weekly clock the veto almost never applies, so it cannot raise
the chance that a BUY reading is right.

Pre-registration: `PREREGISTRATION.md` (committed before this run). The veto is from the owner's macro rule book: no new gold BUY
when gold is more than 15 % above its 50-day average, more than 20 % up in 20 sessions or more than 10 % up in 7 sessions (its
implied-volatility clause is left out: no gold volatility history is on file). Score: the council's own `council/macroscore.mjs`
drivers, read each Friday (parity: the last weekly value equals `goldMacroScore`'s, −0.96). Gold: OANDA daily closes.

| 2007 to 2024 (the window the veto was not fitted to) | |
|---|---|
| Weekly readings / BUY weeks (score > +0.25) | 906 / 177 |
| BUY weeks the veto flags | 1 (1 episode) |
| 4-week gold return, flagged / unflagged BUY weeks | +6.1 % / +1.9 % |
| Long-or-flat Sharpe without / with the veto | 0.343 / 0.338 |
| All weekly readings flagged | 3 of 906 |

With one flagged week the regression's t is meaningless; the verdict rests on the sign (the flagged week did better) and on the
book (the veto makes it no better). In 2025-26, the stretch the veto was fitted to, no Friday close was flagged: the January 2026
and October 2025 blow-offs peaked mid-week (27-29 Jan 2026, 16-20 Oct 2025) and had eased by the Friday reading.

**Reported after the result, descriptive only** (every DAY the veto fires, gold's next 20 sessions): 2007-24, 16 days in 7 episodes,
gold averaged −1.3 % (up 44 % of the time) against +0.5 % on all days; 2025-26 (in sample), 6 days in 4 episodes,
−5.1 %, none up. A consistent lean, on far too few episodes to call an edge. On the Macro desk the veto is a live check in "Your
research, applied" with this record beside it; it never changes the score, a call or a trade.

To repeat: `node research/edge/blowoff-veto/run.mjs fetch <dir>` (git, no network), then `… run <dir>`.
