# Empirical Market Research Validation Protocol

**Purpose:** Prevent a plausible market story or attractive backtest from being mistaken for robust evidence. Use this before presenting statistical results or treating a signal as research-supported. A demo or paper-trading result can verify implementation and operations; it does not by itself establish a durable edge.

## 1. Pre-specify the claim

Write this before exploring model variations:

- **Hypothesis:** [one mechanism and predicted relationship]
- **Unit of analysis:** [instrument, event, bar, portfolio]
- **Information set:** [what a market participant could observe at each decision time]
- **Outcome and horizon:** [e.g. XAU/USD return over a specified event window]
- **Primary test:** [one stated model or comparison]
- **Falsification condition:** [result that would materially weaken or reject the claim]
- **Variants planned:** [features, windows, thresholds, instruments, regimes, and parameter choices to be explored]

Record every model variant tried, including unsuccessful experiments. Selecting only the best-looking result creates data-snooping bias. Research on multiple testing in asset pricing shows that conventional significance thresholds can be inadequate after many signals have been searched. [Harvey, Liu, and Zhu (NBER)](https://www.nber.org/papers/w20592)

## 2. Lock down the data timeline

For every predictor and label, verify:

- **Available-at time:** the timestamp when the value could actually have been consumed, not just its observation date.
- **Vintage:** the value first published at that time, not a later revision.
- **Time alignment:** timezone, daylight-saving transitions, exchange calendar, session close, and bar construction.
- **Market identity:** spot, CFD, futures contract, benchmark, venue, and currency are not interchangeable.
- **Corporate/action handling:** adjusted prices, futures rolls, contract multipliers, dividends, splits, and survivorship are treated consistently.
- **Series construction:** retain raw contract/month observations and record the continuous-series roll trigger, roll timestamp, adjustment method, and back-adjusted status. Use exact contract prices for event windows. Mark benchmark or product-methodology changes (for example, London Gold Fix to LBMA Gold Price in March 2015) as known measurement breaks; do not infer a tradable intraday response from a source published after the event window.
- **Missingness:** stale observations, closed markets, holidays, outages, and imputation are documented.

Use only features available at the forecast origin. In a walk-forward evaluation, fit transformations, scaling, feature selection and hyperparameters using the training information available then; estimate any historical base rate or benchmark probability from cases fully resolved by that forecast origin. Score the model and baseline on the same untouched evaluation cases. If labels overlap in time or features leak across adjacent observations, purge or embargo affected observations. For macro data, store the historical vintage and original source-release timestamp/timezone: ALFRED vintages are daily and cannot by themselves establish intraday availability. Compare important ALFRED snapshots with the primary release archive and flag series without reliable historical vintages.

## 3. Separate research questions by design

Use the [2023 Q3 GDP revision case](gdp-revision-and-composition-case-2023-q3.md) as an applied vintage exercise: the [evidence records](gdp-vintage-evidence-2023-q3.json) keep unreleased GDI missing, distinguish growth rates from contribution points and preserve calculation inputs. A correct historical reconstruction does not by itself demonstrate a successful prospective forecast or a tradable market reaction.

### Event studies

Specify the event definition, event timestamp, pre-event expectation source, event window, estimation window, and comparison benchmark. Report multiple windows only when planned or clearly label them exploratory. Check overlapping announcements and concurrent rate/FX news. Use uncertainty estimates appropriate to serial dependence and repeated events; do not interpret an average response as proof that the event caused it without a defensible identification design.

For macro surprises, use consensus captured **before** the release. If no archived consensus exists, analyze the observed price reaction and call it that; do not relabel it a surprise study.

### Predictive models and strategies

Use a chronological split:

1. **Training period:** estimate candidate models.
2. **Validation period:** choose among predeclared candidates and tune parameters.
3. **Untouched test period:** evaluate once after choices are frozen.
4. **Walk-forward or forward period:** repeat the actual update process using only then-available information.

Keep a final holdout sealed. Repeatedly checking it turns it into validation data. If history is short or regimes differ, report the limitation rather than manufacture a large effective sample from highly correlated bars.

## 4. Model the tradable outcome

For any trade-like backtest, state the exact instrument and execution convention. Include, where applicable:

- Bid/ask spread at the decision and execution time.
- Commission, exchange fees, and broker charges.
- Slippage, latency, partial fills, rejected orders, and market impact assumptions.
- Overnight financing, swap/rollover, borrow, and futures roll costs.
- Contract size, tick value, margin, currency conversion, and forced liquidation rules.
- Gaps, stop execution behavior, market closures, and data-feed interruptions.

Show gross and net results separately. If costs are modeled from a broker or vendor feed, record its source and whether it matches the intended account, instrument, session, and order size. For CFD or FX research, results from one broker's prices and execution conditions do not automatically transfer to another.

## 5. Use strong baselines and diagnostic metrics

Compare with relevant simple alternatives: no position/cash, buy-and-hold or exposure-matched hold, a simple carry or trend baseline when appropriate, and the existing rule being replaced. Report at least:

- Number of trades/events and calendar duration.
- Net return and volatility, plus drawdown and tail losses.
- Sharpe or other risk-adjusted measures with sampling caveats.
- Turnover, exposure, leverage, concentration, and costs.
- Results by pre-specified subperiod/regime and major loss episodes.
- Sensitivity to reasonable cost increases and parameter perturbations.

Do not rank models on a single Sharpe ratio. Serial correlation, skew, fat tails, changing leverage, and selection across many variants can make conventional Sharpe inference misleading. Bailey and López de Prado propose a Deflated Sharpe Ratio that adjusts for selection and non-normality; it is a diagnostic, not a substitute for an untouched test or a sound trading-cost model. [Deflated Sharpe Ratio paper](https://doi.org/10.3905/jpm.2014.40.5.094)

When claiming that forecast A beats a baseline, compare paired losses on the **same test origins** and report the mean loss difference, its uncertainty interval and the test assumptions. A Diebold–Mariano test can handle serially correlated loss differences when the long-run variance is estimated appropriately; overlapping multi-period targets require a dependence horizon that reflects that overlap. For nested forecast models, an ordinary equal-accuracy comparison can be biased against the larger model; consider the Clark–West adjustment or a dependence-preserving block bootstrap suited to the design. These comparisons do not correct for model selection on the same holdout: keep the final test untouched and disclose all candidates tried. [Diebold–Mariano](https://doi.org/10.1080/07350015.1995.10524599), [Clark–West](https://www.kansascityfed.org/documents/5368/pdf-RWP05-05.pdf)

## 6. Correct for search and selection

If a family of strategies, assets, features, or thresholds was explored, evaluate the family rather than reporting only the winner. Appropriate tools depend on the design and may include:

- Bootstrap or reality-check methods that account for the full searched rule universe. [Sullivan, Timmermann, and White, Journal of Finance](https://doi.org/10.1111/0022-1082.00163)
- Deflated Sharpe Ratio for selection bias and non-normal return distributions.
- Probability of Backtest Overfitting or related resampling diagnostics. [Bailey et al., Probability of Backtest Overfitting](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253)
- Multiple-testing corrections or higher evidentiary thresholds when many hypotheses were tried.

These procedures have assumptions and can themselves be misapplied. Report how many variants were tried, what was selected on, and what information was used to select it. The cleanest correction is often a genuinely untouched future sample.

## 7. Test stability, not just average performance

Check whether the result depends on:

- One crisis, one year, one currency pair, one contract, or a few extreme trades.
- A narrow parameter value or a convenient event-window choice.
- A single vendor, broker feed, data-cleaning decision, or roll method.
- A changing macro/market regime or structural break.
- A proxy that is correlated with the intended driver but does not measure it directly.

Use sensitivity analysis and walk-forward splits. Do not treat many neighboring intraday bars as independent evidence. For event datasets, account for clustered events and overlapping windows. For return series, preserve dependence when resampling; naive random shuffling usually destroys the time structure relevant to the test.

### Structural breaks and regime changes

Do not let an algorithmic regime label silently rewrite the historical information set. First classify the candidate break:

1. **Measurement or market-structure break:** definition, sample, seasonal factors, source coverage, contract specification, benchmark, venue, or publication process changed. Check the publisher's change log and decide whether to bridge, split or stop the series; a statistical test cannot make non-comparable data comparable.
2. **Known economic intervention:** policy or market rule changed on a documented date. Predefine the date from the primary record, then test whether the relationship changed around it; do not search dates until one gives the preferred story.
3. **Unknown parameter instability:** begin with the stable-model baseline. If a break was not prespecified, use a test designed for unknown break dates (such as an appropriately specified sup-Wald/LM/LR test) and account for nonstandard critical values. For multiple breaks, a Bai–Perron procedure can estimate break count and dates under its model assumptions; trimming, minimum segment length, dependence and candidate-variable selection still matter.
4. **Prospective regime monitoring:** date every alarm when it would actually have fired. A full-sample detected break date is retrospective information and cannot be used as a live signal or backtest feature. For an online rule, set its window, threshold, false-alarm tolerance, update frequency and reset behavior using training data only, then evaluate sequential alarms on untouched future data.

Report the evidence of instability, candidate timing uncertainty, subsample sizes and robustness to plausible dates. A break test identifies parameter instability under its assumptions; it does not establish its cause, predict the next regime, or prove that a strategy should switch. If many variables, dates or regime definitions are searched, count that as model selection. [Andrews, tests with unknown breakpoints](https://users.ssc.wisc.edu/~behansen/718/Andrews1993.pdf), [Bai and Perron, multiple structural changes](https://www.columbia.edu/~jb3064/papers/1998_Estimating_and_testing_linear_models_with_multiple_structural_changes.pdf), [Andrews, end-of-sample instability](https://doi.org/10.1111/1468-0262.00466), [Hansen, review of structural-change methods](https://www.aeaweb.org/articles?id=10.1257/jep.15.4.117)

## 8. Report results with calibrated language

Use these distinctions:

- **Descriptive:** variables moved together in this sample.
- **Predictive:** the feature improved forecasts on a defined out-of-sample period against a baseline.
- **Causal:** an identified design supports an effect under stated assumptions.
- **Robustness:** the conclusion survived specified alternative samples, costs, or methods.
- **Operational:** the code/feed/order path behaved as intended in a test or demo environment.

These are not interchangeable. A successful paper-trading connection is operational evidence, not evidence of profitability. A significant coefficient is not necessarily a useful forecast; a profitable backtest is not necessarily a deployable strategy.

For human or model probability forecasts, also use the [probability forecast calibration playbook](probability-forecast-calibration-playbook.md). It separates proper forecast scores and calibration from the economic value of actions taken using those forecasts.

## 9. Decision gate

Before describing a result as research-supported, answer:

- Is the hypothesis and primary test stated clearly?
- Were data vintages and availability timestamps respected?
- Is there an untouched out-of-sample or forward sample?
- Are all searched variants disclosed and addressed?
- Are execution costs and realistic constraints included?
- Does the finding survive strong baselines and key sensitivity checks?
- Is inference appropriate for non-normality, dependence, overlap, and sample size?
- Are the strongest failure cases and counterevidence shown?
- Does the conclusion use descriptive, predictive, causal, robustness, and operational terms accurately?

If any essential answer is no, classify the result as exploratory, identify the missing test, and do not upgrade its evidentiary status.

## Research anchors

- Harvey, Liu, and Zhu, “. . . and the Cross-Section of Expected Returns,” NBER Working Paper 20592 / *Review of Financial Studies*: [NBER page](https://www.nber.org/papers/w20592).
- White, “A Reality Check for Data Snooping,” *Econometrica* (2000): [journal page](https://onlinelibrary.wiley.com/doi/10.1111/1468-0262.00152).
- Sullivan, Timmermann, and White, “Data-Snooping, Technical Trading Rule Performance, and the Bootstrap,” *Journal of Finance* (1999): [journal page](https://doi.org/10.1111/0022-1082.00163).
- Bailey, Borwein, López de Prado, and Zhu, “The Probability of Backtest Overfitting”: [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2326253).
- Bailey and López de Prado, “The Deflated Sharpe Ratio”: [Journal of Portfolio Management DOI](https://doi.org/10.3905/jpm.2014.40.5.094).
