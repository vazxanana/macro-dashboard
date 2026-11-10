# Mosha selection: which sweeps are worth taking? Result (10 Nov 2026)

**Verdict: FAIL. None of the eighteen cells made money on the discovery years (2006-12), so none was selected, validated or confirmed. Every cell loses in all three periods: 54 period results, 54 negative, the best −0.05R a trade. H4 direction, the level swept, the session and the room to the target do not separate the setups worth taking.**

Paper research only. No live rule, size, filter or mirror setting was changed. The conditions, the rule for a cell and the
verdict were fixed in `PREREGISTRATION.md` (commit b8815305) before any number was computed.

## What was asked

`mosha-sweep` found that the owner's pattern (a swept H1 swing, the M5 VR, its CF) loses when every one is taken. The
owner's own examples all won, so the question here was the selection: among the same candidates, is there a simple
condition, visible when the order is placed, that picks the good ones? Four conditions read from the owner's examples, each
splitting the candidates into two or three cells; a cell had to be positive on 2006-12, hold on 2013-19 (Holm-adjusted)
and still be positive on 2020 to now.

Same candidates, stops, targets, $0.30 cost and M5 fills as `mosha-sweep` (OANDA gold M5, June 2006 to 9 Nov 2026). A
condition filters the candidates; the one-at-a-time rule is applied afterwards, so each cell is a stream that could have
been traded.

## Result: R a trade after costs (trades, t)

Unfiltered, for comparison: at the CF −0.11R (2,023, t −2.62) | −0.10R (1,968, t −2.34) | −0.12R (2,269, t −3.01); at
the zone −0.24R (2,013, t −4.61) | −0.23R (2,046, t −4.71) | −0.18R (2,419, t −3.63).

### Entry at the CF (stop past the extreme)

| Cell | Discovery 2006-12 | Validation 2013-19 | Confirmation 2020 on |
|---|---|---|---|
| With the last H4 BO | −0.07 (1,373, t −1.29) | −0.07 (1,363, t −1.40) | −0.16 (1,483, t −3.60) |
| Against the last H4 BO | −0.11 (1,767, t −2.39) | −0.13 (1,744, t −3.17) | −0.11 (1,958, t −2.66) |
| The sweep also took an H4 swing | −0.12 (1,147, t −2.25) | −0.14 (1,115, t −2.77) | −0.08 (1,213, t −1.43) |
| The sweep took an H1 swing only | −0.12 (1,715, t −2.52) | −0.09 (1,671, t −1.89) | −0.17 (1,949, t −3.96) |
| Order placed in Asia | −0.15 (1,106, t −2.38) | −0.11 (1,141, t −1.87) | −0.11 (1,303, t −2.02) |
| Order placed in London | −0.07 (1,025, t −1.15) | −0.10 (976, t −1.76) | −0.10 (967, t −1.68) |
| Order placed in New York | −0.09 (1,187, t −1.69) | −0.12 (1,226, t −2.41) | −0.14 (1,355, t −2.99) |
| Target 4R or more away | −0.15 (1,191, t −2.21) | −0.22 (1,011, t −3.20) | −0.19 (1,403, t −3.14) |
| Target under 4R away | −0.09 (1,536, t −2.20) | −0.05 (1,623, t −1.35) | −0.14 (1,666, t −3.78) |

### Entry at the zone of the next break (tight stop)

| Cell | Discovery 2006-12 | Validation 2013-19 | Confirmation 2020 on |
|---|---|---|---|
| With the last H4 BO | −0.29 (948, t −4.33) | −0.17 (1,008, t −2.50) | −0.11 (1,230, t −1.68) |
| Against the last H4 BO | −0.25 (1,430, t −3.83) | −0.32 (1,408, t −5.59) | −0.18 (1,646, t −2.80) |
| The sweep also took an H4 swing | −0.23 (805, t −2.68) | −0.34 (820, t −4.65) | −0.12 (932, t −1.32) |
| The sweep took an H1 swing only | −0.24 (1,501, t −4.01) | −0.18 (1,484, t −3.16) | −0.12 (1,805, t −2.08) |
| Order placed in Asia | −0.42 (603, t −4.55) | −0.18 (664, t −1.96) | −0.05 (934, t −0.50) |
| Order placed in London | −0.17 (644, t −1.67) | −0.35 (643, t −4.48) | −0.28 (708, t −3.36) |
| Order placed in New York | −0.19 (1,087, t −2.84) | −0.20 (1,048, t −3.09) | −0.21 (1,196, t −3.33) |
| Target 4R or more away | −0.28 (1,343, t −3.91) | −0.30 (1,208, t −4.21) | −0.18 (1,593, t −2.58) |
| Target under 4R away | −0.19 (894, t −3.36) | −0.15 (1,049, t −2.78) | −0.13 (1,101, t −2.58) |

## What it says

- **No cell is positive anywhere.** The pre-registered rule needed a cell positive on discovery before it could be tested
  further; none was, so the Holm step had nothing to test. The least bad single results are the zone entry in Asia on
  2020 to now (−0.05R, t −0.50, after −0.42R and −0.18R in the two earlier periods) and the CF entry with a near target
  on 2013-19 (−0.05R).
- **Trading with the H4 does not rescue the pattern.** At the CF it is a little less bad than against the H4 in the first
  two periods (−0.07R against −0.11R and −0.13R) and worse in the third (−0.16R against −0.11R). Not a difference to build on.
- **A sweep of an H4 swing is no better than a sweep of an H1 swing.** The two cells swap places from period to period.
- **More room is worse, not better.** A target 4R or more away wins less often (12 to 19 % of trades) and loses more per
  trade than a near target in every period, for both entries.
- **No session stands out.** The order of the three sessions changes from period to period.
- **One example, read by the rule.** The owner's 28 Oct sell reads `against the H4 · H4 swing swept · Asia · near target`
  (the owner labelled it with the H4 sell; the last 3-a-side H4 BO before it was a buy). The conditions as a fixed rule
  do not describe the owner's choice the way the owner does.

## With the day's four other studies

Five pre-registered Mosha studies on 10 Nov: the level tap (−0.35R), the retracement chain (+0.02R), the buy at the
barrier (−0.22R), the sweep with its VR and CF (−0.11R and −0.21R), and now eighteen filtered versions of the sweep, all
negative in every period. Thirty-three tests; the retracement chain breaks even and everything else loses. What makes the
owner's own trades win is not the pattern and not one of these four simple conditions. The measurement left is the
owner's own logged trades.

## Reproduce

```sh
node research/edge/mosha-sweep/run.mjs fetch /tmp/oanda             # the candle file, 18 MB, kept out of git
CANDLES=/tmp/oanda node research/edge/mosha-select/run.mjs example  # the conditions on the last three weeks' candidates
CANDLES=/tmp/oanda node research/edge/mosha-select/run.mjs run      # writes result.json
```
