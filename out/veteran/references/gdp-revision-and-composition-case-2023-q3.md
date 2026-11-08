# GDP revisions and composition — 2023 Q3 worked case

**Research question:** Does an unchanged headline GDP estimate mean the economic assessment is unchanged?

**Finding:** The advance and third releases both reported 4.9% annualized real GDP growth. Between them, estimated consumption growth fell from 4.0% to 3.1% and quarterly core PCE inflation from 2.4% to 2.0%. The headline alone conceals material changes in composition. This is a historical reconstruction, prepared 8 November 2026, rather than a forecast made in 2023. [Advance release](https://www.bea.gov/sites/default/files/2023-10/gdp3q23_adv.pdf), [third release](https://www.bea.gov/sites/default/files/2023-12/gdp3q23_3rd.pdf)

## Freeze the information set

| Vintage | Date | Stated release time | UTC equivalent | Q3 GDI in this release? |
|---|---|---|---|---|
| Advance | 26 October 2023 | 08:30 EDT | 12:30Z | No |
| Second | 29 November 2023 | 08:30 EST | 13:30Z | Yes |
| Third | 21 December 2023 | 08:30 EST | 13:30Z | Yes |

These times come from the PDF embargo headers. They establish the stated publication clock, not a participant's actual receipt time. The switch from EDT to EST matters. Historical system availability remains unknown in the evidence records. Each PDF was retrieved and hashed during this audit; its hash identifies those retrieved bytes. [Advance, page 1](https://www.bea.gov/sites/default/files/2023-10/gdp3q23_adv.pdf), [second, page 1](https://www.bea.gov/sites/default/files/2023-11/gdp3q23_2nd.pdf), [third, page 1](https://www.bea.gov/sites/default/files/2023-12/gdp3q23_3rd.pdf)

## Read the composition within each vintage

All growth rates below are seasonally adjusted annual rates (SAAR). Contributions are percentage points of annualized real GDP growth, rather than component growth rates.

| Measure | Advance | Second | Third | Source table / line |
|---|---:|---:|---:|---|
| Real GDP growth, % SAAR | 4.9 | 5.2 | 4.9 | Table 1 / 1 |
| Real PCE growth, % SAAR | 4.0 | 3.6 | 3.1 | Table 1 / 2 |
| Real final sales to private domestic purchasers, % SAAR | 3.3 | 3.3 | 3.0 | Table 1 / 32 |
| Private inventory contribution, pp | 1.32 | 1.40 | 1.27 | Table 2 / 40 |
| PCE contribution, pp | 2.69 | 2.44 | 2.11 | Table 2 / 2 |
| Core PCE price growth, % SAAR | 2.4 | 2.3 | 2.0 | Table 4 / 34 |
| Real GDI growth, % SAAR | Not released | 1.5 | 1.5 | Table 1 / 27 |
| BEA GDP/GDI average growth, % SAAR | Not released | 3.3 | 3.2 | Table 1 / 28 |

Table locations use printed PDF page numbers: Tables 1/2/4 are on pages 7/8/11 in the [advance PDF](https://www.bea.gov/sites/default/files/2023-10/gdp3q23_adv.pdf), 8/9/12 in the [second PDF](https://www.bea.gov/sites/default/files/2023-11/gdp3q23_2nd.pdf), and 9/10/13 in the [third PDF](https://www.bea.gov/sites/default/files/2023-12/gdp3q23_3rd.pdf). Read the real, rather than current-dollar, final-sales row and the Q3 column.

Real final sales to private domestic purchasers combines consumer spending with private fixed investment. It helps examine domestic private demand while excluding inventory accumulation, government spending and net exports. It is still an aggregate: it does not identify every household, firm or industry. Use BEA's published growth and contributions; subtracting component growth rates or adding chained-dollar levels does not reconstruct the aggregate.

## What changed in the assessment?

| Comparison | GDP growth revision, pp | PCE growth revision, pp | Private domestic final-sales growth revision, pp | Core PCE inflation revision, pp |
|---|---:|---:|---:|---:|
| Advance → second | +0.3 | −0.4 | 0.0 | −0.1 |
| Second → third | −0.3 | −0.5 | −0.3 | −0.3 |
| Advance → third | 0.0 | −0.9 | −0.3 | −0.4 |

These are differences between rounded published estimates. A data revision is different from an actual-versus-consensus surprise.

At the second release, higher headline GDP coexisted with lower estimated consumption growth and unchanged private domestic final-sales growth. Calling the revision a broad upgrade to household demand would contradict the component evidence. Inventory contribution rose by 0.08 percentage point, while other components also changed; that is not a complete decomposition of the 0.3-point headline revision.

At the third release, PCE's contribution fell by 0.33 percentage point from the second estimate. The headline returned to its advance value, while spending and inflation estimates were lower. The published income-side measure also grew more slowly than headline GDP. That is evidence of measurement and composition uncertainty, rather than proof that either measure must be wrong or that a recession must follow.

Q3 GDI and the GDP/GDI average remain missing in the advance information set. The average is BEA's published aggregate; averaging rounded GDP and GDI growth rates is not a substitute for it. The third estimate can still change in later updates. This case uses those three release vintages, not today's revised history.

## Check annualization before comparing markets or forecasts

For a published SAAR growth rate r, the corresponding quarterly rate is:

`quarterly % = 100 × ((1 + r / 100)^(1/4) − 1)`

Thus 4.9% SAAR corresponds to approximately **1.2031% quarter over quarter**, and 5.2% to **1.2754%**. These conversions inherit rounding in the published rate. Contributions of 1.27 percentage points and a component's 3.1% growth rate are different quantities and cannot be interchanged.

## What further evidence is needed for a market claim?

This case has no archived contemporaneous consensus distribution or timed instrument prices. It therefore makes no claim about a consensus surprise, forecast accuracy, tradable return or causal asset-price response. A market study would also need the exact contract, quotes before and after publication, spreads, concurrent releases, event-window design and a predefined comparison rule.

A prospective research brief must select its resolution target in advance: the first estimate, a fixed later vintage or another published measure. Changing the target after observing revisions would change what is being scored. A retrospective reconstruction is useful evidence training but does not establish a predictive track record.

## Reusable evidence files

- [45 reported/calculated evidence records](gdp-vintage-evidence-2023-q3.json): 24 vintage observations, including explicit missing GDI fields, plus 21 calculations. Input record IDs and revision links preserve lineage; all records share BEA's source-dependence group.
- [Source manifest](gdp-vintage-source-manifest-2023-q3.json): official URLs, byte counts, SHA-256 values and actual retrieval times.
- [Research operating standard](research-analyst-operating-standard.md) and [empirical validation guide](empirical-market-research-validation.md): apply the same publication, units and missing-information controls to a new case.
