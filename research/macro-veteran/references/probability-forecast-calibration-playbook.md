# Probability forecasting and calibration playbook

**Purpose:** Turn analyst judgments into forecasts that can be resolved, scored, compared fairly, and translated into decisions without confusing prediction skill with trading profit. This complements the [research brief template](research-brief-template.md) and [empirical validation protocol](empirical-market-research-validation.md).

## The discipline: make a forecast that can fail clearly

A useful forecast names an observable outcome, a probability, a horizon, an information cutoff, and a resolution source. “Gold looks constructive” is a view. “There is a 60% probability that the selected XAUUSD instrument closes above its 7 November close on 7 December, using the broker’s daily close convention” is a forecast that can be scored.

Before assigning probability, write:

```text
Forecast ID:
Outcome / event:
Resolution rule and source:
Forecast origin time (UTC and local timezone):
Information cutoff:
Horizon / deadline:
Probability or predictive distribution:
Reference class / base rate:
Main evidence and likelihood direction:
Strongest contrary evidence:
Known source, regime and instrument limits:
```

Freeze the resolution rule at issuance. If the rule or horizon must change, preserve the original forecast and issue a new linked forecast; never quietly move the goalposts.

## 1. Define the event before estimating its chance

### Binary outcomes

Use a binary question when the market-relevant event genuinely has two outcomes. Define the threshold and timing precisely. Specify the instrument, venue, currency, price field, close convention, corporate-action adjustment, timezone, and fallback behavior for holidays or missing data.

Good: “The CME December gold futures settlement is above $4,100/oz on the final trading day of November, as reported in CME’s final Daily Bulletin.”

Weak: “Gold breaks higher this month.”

For a macro event, specify which first-release value resolves the event, whether a revision counts, what “recession” or “rate cut” means, and the relevant jurisdiction or central bank. A forecast should not depend on the analyst later choosing among several plausible series.

### Continuous outcomes

For a price or macro variable, forecast a distribution or quantiles instead of only a point estimate when uncertainty matters. Record the target variable, units, horizon, and whether the distribution is unconditional or conditional on a stated scenario. A point forecast alone does not communicate uncertainty and cannot be fully evaluated with a distributional score.

For example, store a median return and fixed 10th/50th/90th percentiles, or a full predictive distribution. Do not add or remove quantiles after seeing the outcome. Use CRPS for a full continuous distribution, or a pinball/quantile score for a predeclared quantile; proper scoring rules encourage honest probability distributions in expectation. [Gneiting and Raftery (2007)](https://doi.org/10.1198/016214506000001437)

## 2. Start with base rates, then update with evidence

### Choose a defensible reference class

Estimate how often an outcome occurred in cases that resemble the current one. Match as closely as possible on:

- instrument and measurement convention;
- horizon and event definition;
- macro or market regime, if that regime was defined before seeing outcomes;
- seasonality, policy framework and contract/market structure;
- data availability and resolution method.

Record the numerator, denominator, sample dates, exclusions, and whether the sample was chosen before or after inspecting the result. A base rate used for a forecast issued at time *t* must include only reference-class cases whose outcomes had fully resolved and were observable by *t*; never use later-resolving cases to set an earlier forecast prior. Show a broad unconditional base rate beside any narrow conditional rate. If the matched sample is tiny, use the broad rate as a stabilizing anchor and report the uncertainty instead of treating a handful of episodes as a reliable frequency. When evaluating the model, compare it with a baseline built from the same point-in-time information and score both on the same resolved out-of-sample cases.

### Bayesian-style updating as a reasoning aid

When an observation has a defensible likelihood under both the event and its alternative, posterior odds can be represented as:

```text
posterior odds = prior odds × likelihood ratio
likelihood ratio = P(evidence | event) / P(evidence | no event)
```

This is a structure for disciplined reasoning, not a demand to fabricate numerical likelihoods. If the evidence is only loosely connected to the event, state a qualitative update. If several observations are correlated (for example, payrolls, unemployment, wages and a market-implied policy repricing), do not multiply their likelihood ratios as if they were independent. Explain the common information source and avoid double-counting.

Keep the probability anchored to the event and horizon. The probability of gold finishing higher over one month is not the same as the probability that a rate cut occurs, even if the latter is one driver.

## 3. Record the probability and its provenance

Record the probability at the actual decision time, before the outcome. If the view changes, append a forecast update containing the new timestamp, new probability, new evidence, and reason for change. Preserve the original forecast so the log measures what was believed when.

Keep forecast families distinct:

| Forecast family | Example | Important comparison |
|---|---|---|
| Event probability | “A 25 bp policy cut occurs at the next meeting.” | Market-implied probability or a simple frequency for comparable meetings, timestamped before the decision. |
| Direction / threshold | “XAUUSD is above level L at date T.” | Unconditional hit rate at the same horizon, a naive base rate, and any market-implied benchmark that can be constructed consistently. |
| Continuous return | “One-month return distribution for XAUUSD.” | Historical distribution, volatility-scaled baseline, option-implied distribution only if instrument and risk-neutral/physical distinction are stated. |
| Fundamental outcome | “Issuer revenue growth is above 10% next quarter.” | Comparable company/quarter base rate, contemporaneous consensus, and definition of reported revenue. |
| Conditional scenario | “If CPI is above X, the two-year yield rises by more than Y.” | Conditional event sample with overlapping news controlled or transparently acknowledged. |

Do not present a prediction-market price, option-implied distribution, or consensus estimate as a neutral objective probability. Each embeds market structure, risk premia, contract rules, liquidity and/or participant selection. Treat it as a named comparator with its own measurement method.

## 4. Score forecasts with proper scores and strong baselines

### Binary Brier score

For forecast probability `p` and outcome `y` (1 if the event occurred, 0 otherwise):

```text
Brier = (p - y)^2
```

Lower is better; a perfect forecast scores 0. Score the full forecast set, not only the forecasts that were confident or successful. Compare against a predeclared baseline probability such as the reference-class frequency or a consistently measured market comparator. A Brier skill score can be defined relative to the baseline Brier score:

```text
Brier skill = 1 - mean(Brier_model) / mean(Brier_baseline)
```

Positive indicates lower mean Brier loss than that baseline on the same resolved cases; negative indicates worse. Always show the underlying scores, sample count, time range and baseline definition. A skill score is a relative summary whose value depends on the chosen comparator; keep the raw losses visible and do not compare skill scores computed against different baselines. Brier's original paper introduced verification of forecasts stated as probabilities. [Brier (1950)](https://doi.org/10.1175/1520-0493(1950)078%3C0001:VOFEIT%3E2.0.CO;2)

For forecast probability `p` and outcome `y`, logarithmic loss is:

```text
Log loss = -[y × ln(p) + (1-y) × ln(1-p)]
```

Use a documented numerical floor only if the production system requires one; disclose it because it caps the penalty for a confident miss. Log loss is highly sensitive to assigning near-zero or near-one probabilities when wrong, which makes it useful as a discipline but noisy in small samples.

### Proper scores for distributions

- **CRPS:** compares the full predictive cumulative distribution with the realized value; lower is better. It reflects both calibration and concentration of the distribution.
- **Quantile / pinball loss:** evaluates a predeclared quantile. Score each requested quantile separately and compare coverage as well as average loss.
- **Interval score:** evaluates a prediction interval using both width and penalties for misses; state the nominal coverage before the outcome.

Keep an interval score separate from **empirical interval coverage**. The interval score is a loss for an individual forecast; coverage is the fraction of a defined forecast cohort whose realized outcomes fell inside its intervals. Report coverage with the nominal level, horizon, cohort definition, resolution window and sample count. It is an aggregate calibration diagnostic, not a per-forecast score. If recording a target-based diagnostic in the [forecast ledger](forecast-ledger.schema.json), store its numeric target and the deviation rule explicitly.

For distribution forecasts, supplement proper scores with a **probability integral transform (PIT) histogram**: transform each realized outcome through its issued predictive CDF. A well-calibrated continuous forecast should have an approximately uniform PIT distribution over a comparable evaluation sample. Use randomized PIT for discrete outcomes and account for serial dependence when inspecting the sequence; a histogram alone can conceal time-varying or conditional miscalibration. PIT diagnostics complement CRPS and interval coverage; they do not replace a proper score or an untouched evaluation design. [Gneiting, Balabdaoui and Raftery (2007)](https://doi.org/10.1111/j.1467-9868.2007.00587.x)

Strictly proper scoring rules reward truthful probabilistic forecasts in expectation. They do not guarantee that a forecast is useful for a particular trading decision, nor do they identify a causal driver. [Gneiting and Raftery (2007)](https://doi.org/10.1198/016214506000001437)

### Calibration, resolution and sharpness

- **Calibration:** among forecasts issued at probability `p`, the event should occur about `p` of the time over a sufficiently large, comparable set.
- **Resolution / discrimination:** forecasts should distinguish cases with different outcome frequencies; assigning the same base rate to everything can be calibrated but uninformative.
- **Sharpness:** predictive distributions are concentrated. Sharpness is desirable only subject to calibration; a narrow but miscalibrated range is false precision.

For binary outcomes, a reliability table or plot can group forecasts into fixed probability bins and compare mean forecast probability with the observed event frequency. Publish the number of forecasts in every bin. Avoid choosing bin boundaries after inspecting which ones look best. Add uncertainty intervals (for example, Wilson intervals for binomial frequencies) and remember that clustered or overlapping cases reduce effective sample size. Murphy's empirical Brier decomposition separates **reliability − resolution + uncertainty**: calibration/reliability and resolution are different properties, while uncertainty reflects the event base rate. The decomposition depends on grouping and sample; show bin definitions and counts. [Murphy (1973)](https://doi.org/10.1175/1520-0450(1973)012%3C0595:ANVPOT%3E2.0.CO;2)

## 5. Prevent a flattering but misleading scorecard

### Sample-size and dependence checks

- Report resolved count, event count, forecast horizon and calendar coverage. A 70% hit rate from 10 forecasts is highly uncertain.
- Use uncertainty intervals for rates and score differences. Preserve temporal blocks or clusters when cases share the same event, regime or overlapping outcome window.
- Do not treat daily forecasts for overlapping 30-day returns as 30 independent observations. Cluster by origin episode or use a method that preserves dependence.
- Keep unresolved forecasts visible. Do not drop them because the horizon is inconvenient or the market is still in the trade.
- If one forecaster repeatedly updates a probability, distinguish *forecast vintages* from independent forecast cases. Choose in advance whether the scored object is the initial forecast, the last forecast before resolution, or each timestamped nowcast series.

### Selection and multiple testing

Keep an experiment log of every outcome definition, horizon, reference class, probability model, threshold, binning scheme and forecast pool tried. If you select a method after comparing variants, evaluate the selected approach on untouched future data and report the selection process. The [empirical validation protocol](empirical-market-research-validation.md) covers holdouts, data snooping and tradable-cost checks.

Do not combine forecasts from changed specifications as if they came from one stable method. Version the model and the scoring rule. For human judgment, preserve the evidence available at issuance so a later audit can distinguish poor reasoning from new information that legitimately changed the forecast.

## 6. Forecast quality is not the same as trading value

Forecast scores answer, “Were the probability statements accurate relative to the chosen score and comparator?” Trading evaluation asks, “Did a specified action produce acceptable net utility under real costs and constraints?” Report these separately.

For a simplified binary action with gain `G` if correct, loss `L` if wrong, and total expected cost `C`, the action's expected value is positive when:

```text
p × G - (1-p) × L - C > 0
break-even p = (L + C) / (G + L)
```

This toy rule assumes fixed gains/losses and omits path risk, position sizing, liquidity, financing, gap risk, portfolio correlation, margin and risk preferences. A more complete decision evaluates expected utility or a risk-constrained portfolio objective using the predictive distribution and execution model. A forecast with excellent Brier score may have little value if it does not change the optimal action; a modest probability edge may still be valuable for a payoff with asymmetry, if costs and tail risk are controlled. Forecast accuracy and decision value need not rank methods the same way; this relationship depends on the loss function and decision context. [Murphy and Ehrendorfer (1987)](https://doi.org/10.1175/1520-0434(1987)002%3C0243:OTRBTA%3E2.0.CO;2), [Granger and Pesaran (2000)](https://www.repository.cam.ac.uk/items/43831a4b-6c91-4c15-9319-5f3c74001371)

For a trading hypothesis, maintain two linked ledgers:

1. **Forecast ledger:** probability/distribution, target, horizon, baseline, resolution rule, proper score, calibration diagnostics and version.
2. **Decision ledger:** action or no-action, instrument, size, expected payoff, cost model, constraints, realized net result, drawdown and operational outcome.

Never upgrade a research forecast to a trade claim just because a simulated account made money. A demo result can validate quote capture or order handling, not generalizable predictive value.

## 7. A compact review after each forecast resolves

1. Resolve from the predeclared primary source and save the exact release/price record.
2. Check whether the outcome met the event definition, including venue, close convention, units and cutoff.
3. Calculate the proper score and baseline score with the same cases.
4. Update aggregate score, calibration table, sharpness/resolution diagnostics and uncertainty interval.
5. Examine misses: bad base rate, double-counted evidence, mistimed information, regime shift, poor probability translation, resolution ambiguity or noise.
6. Write one falsifiable method change, if warranted. Version it and evaluate it prospectively; do not retroactively rewrite past forecasts.

## Research anchors

- Brier, Glenn W. (1950), “Verification of Forecasts Expressed in Terms of Probability,” *Monthly Weather Review*. [Journal of the Atmospheric Sciences](https://doi.org/10.1175/1520-0493(1950)078%3C0001:VOFEIT%3E2.0.CO;2).
- Gneiting, Tilmann, and Adrian E. Raftery (2007), “Strictly Proper Scoring Rules, Prediction, and Estimation,” *Journal of the American Statistical Association*. [DOI](https://doi.org/10.1198/016214506000001437).
- Gneiting, Tilmann, Fadoua Balabdaoui, and Adrian E. Raftery (2007), “Probabilistic Forecasts, Calibration and Sharpness,” *Journal of the Royal Statistical Society: Series B*. [DOI](https://doi.org/10.1111/j.1467-9868.2007.00587.x).
- Murphy, Allan H. (1973), “A New Vector Partition of the Probability Score,” *Journal of Applied Meteorology*. [DOI](https://doi.org/10.1175/1520-0450(1973)012%3C0595:ANVPOT%3E2.0.CO;2).
- Murphy, Allan H., and J. S. Ehrendorfer (1987), “On the Relationship between the Accuracy and Value of Forecasts in the Cost-Loss Ratio Situation,” *Weather and Forecasting*. [DOI](https://doi.org/10.1175/1520-0434(1987)002%3C0243:OTRBTA%3E2.0.CO;2).
- [Empirical Market Research Validation Protocol](empirical-market-research-validation.md) — point-in-time evaluation, holdouts, multiplicity, dependence and execution costs.
- [Research Brief Template](research-brief-template.md) — timestamped forecast ledger and resolution rules.
