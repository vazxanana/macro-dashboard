# Result: the playbook's weekly-bull daily rejection long, out of its own sample (11 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). Out of the skill's
sample (March 2006 to October 2022, OANDA mid H1 gold, 17:00 New York days) the rule makes money, but not measurably more
than taking the same trade on every day of a bullish week: lift +0.10R a trade net, Welch t 1.58 (the bar was t >= 2).

| Long, 0.70, 3R, net of $0.35 | Rule n | Rule R a trade | Rule PF | Max DD | Baseline R a trade | Lift | t |
|---|---|---|---|---|---|---|---|
| 2006 - Oct 2022 (the test) | 910 | +0.141 | 1.22 | -77.4R | +0.040 | +0.101 | 1.58 |
| 2006 - 2019 | 751 | +0.117 | 1.18 | -77.4R | +0.040 | +0.077 | 1.10 |
| 2020 - Oct 2022 | 159 | +0.256 | 1.43 | -20.7R | +0.044 | +0.212 | 1.37 |
| Nov 2022 - now (the skill's own window, not a test) | 294 | +0.594 | 2.17 | -14.8R | +0.336 | +0.258 | 2.13 |

- **The code reproduces the skill**: on its own window 294 trades and PF 2.17 against the skill's 271 and 2.20 (different
  feed: OANDA here, Dukascopy there).
- **Year by year it follows gold's trend**: strong in 2007, 2009, 2011, 2016, 2020, 2023-25 (PF 1.4-2.9); losing in
  2012-15, 2017-19 and 2021 (PF 0-0.92). The worst drawdown out of sample is -77R (2012-19), against -15R in the skill's window.
  Sized at the skill's 0.5% a trade, that is far past a prop firm's limits.
- Reported, not tested: 2R (+0.089R, PF 1.15, lift t 1.60), the 0.80 threshold (+0.179R, PF 1.30, lift +0.139, t 1.90:
  closest to the bar, still under it), and the mirror short (PF 0.86, lift -0.05: no edge, as in the skill's window).
- Caveat: each signal is its own trade, as the skill tested it, so trades overlap; the t above treats them as independent and
  if anything flatters the rule.

What it means for the playbook: the closing-strength condition adds a little over "buy dips in a bullish week" but the result
is mostly gold's own trend; in sideways or falling years the rule gives back a lot. It is not proven as an edge of its own.
Nothing live changed; no proposal is written. A follow-up (its own pre-registration) could test the playbook's Daily-regime
filter (20-day efficiency ratio >= 0.2) on this rule, the one thing the yearly pattern points to.

To repeat: `node --use-env-proxy research/edge/gold-drd-long/run.mjs fetch <dir>` (about 126,000 H1 candles, kept out of git),
then `node research/edge/gold-drd-long/run.mjs full <dir>`. Tests: `tests/gold-drd-long.test.mjs`.
