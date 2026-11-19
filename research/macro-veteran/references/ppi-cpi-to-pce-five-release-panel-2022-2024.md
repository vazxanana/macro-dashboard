# First CPI/PPI → PCE matched panel

The [five-row CSV](ppi-cpi-to-pce-five-release-panel-2022-2024.csv) joins archived PPI release figures, the separately captured CPI core first print, and the later **originally reported** BEA headline/core PCE print for five reference months. All figures are seasonally adjusted one-month percentage changes at the precision printed by the agency. The BEA target is the release for that reference month, not a current revised PCE series. All three scheduled or embargo clocks are UTC-converted from the release headers; actual first web publication and receipt remain unauthenticated.

| Reference month | PPI release | CPI release | BEA PCE release | Core CPI print | Core PCE original print | BEA release |
|---|---|---|---|---:|---:|---|
| 2022-09 | Oct 12 | Oct 13 | Oct 28 | 0.6 | 0.5 | [BEA 22-52](https://www.bea.gov/news/2022/personal-income-and-outlays-september-2022) |
| 2022-11 | Dec 9 | Dec 13 | Dec 23 | 0.2 | 0.2 | [BEA 22-65](https://www.bea.gov/news/2022/personal-income-and-outlays-november-2022) |
| 2023-09 | Oct 11 | Oct 12 | Oct 27 | 0.3 | 0.3 | [BEA 23-50](https://www.bea.gov/news/2023/personal-income-and-outlays-september-2023) |
| 2024-04 | May 14 | May 15 | May 31 | 0.3 | 0.2 | [BEA 24-20](https://www.bea.gov/news/2024/personal-income-and-outlays-April-2024) |
| 2024-07 | Aug 13 | Aug 14 | Aug 30 | 0.2 | 0.2 | [BEA 24-39](https://www.bea.gov/news/2024/personal-income-and-outlays-july-2024) |

**What this establishes:** A workable release sequence exists in these five cases: PPI and CPI both appear in dated agency releases before the corresponding PCE release. The archived BEA pages say their data have been superseded; the values here deliberately retain each page's originally reported current-month value. This is a seed panel and a source audit, not a scored forecast. Five selected months cannot estimate whether PPI adds useful information over CPI for core PCE, and selecting only PPI-before-CPI months would be an inappropriate restriction for the full CPI/PPI→PCE test.

**Next:** Extend to all 36 original release months, with PPI and BEA original-release fields, a versioned BEA component source map, and an expanding-window pre-release baseline. Add survey consensus only when its timestamp and usage rights are established. Gold execution remains a separate cTrader demo study with executable bid/ask data.

**Continuation:** The [36-month source panel](cpi-ppi-to-pce-36-month-source-and-baseline-2022-2024.md) and [expanding-window screening check](cpi-ppi-to-pce-expanding-model-check-2022-2024.md) now supersede this five-month collection queue. The historical BEA component map remains open.
