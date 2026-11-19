# CPI seed actuals for September–November 2021

Verified three official release archives, using links selected from the freshly captured [BLS archive index](https://www.bls.gov/bls/news-release/cpi.htm). These are one-decimal monthly seasonally adjusted CPI-U percent changes.

| Reference month | Release date | Headline | Core |
|---|---|---:|---:|
| 2021-09 | 2021-10-13 | 0.4 | 0.2 |
| 2021-10 | 2021-11-10 | 0.9 | 0.6 |
| 2021-11 | 2021-12-10 | 0.8 | 0.5 |

The seventh/current-month Table A column matches the reference month in all three text tables. Each monthly headline/core number agrees with the opening narrative: six checks pass. Literal source tokens without leading zeros are preserved in the JSON; normalized strings add a leading zero without adding precision. All five raw captures have HTTP 200 receipts, saved-byte lengths and SHA-256 hashes. The JSON retains source URLs, index-link labels, release identifiers, headers and retrieval times.

The official source releases are [September 2021](https://www.bls.gov/news.release/archives/cpi_10132021.htm), [October 2021](https://www.bls.gov/news.release/archives/cpi_11102021.htm), and [November 2021](https://www.bls.gov/news.release/archives/cpi_12102021.htm). Scheduled 08:30 ET is separately converted using America/New_York; it is not observed first dissemination.

## Correction-date and field scope

Both the November 2021 release note and [official errata register](https://www.bls.gov/errata/) document a **same-day December 10, 2021 reissue**. The described correction changes October to November in a sentence about the annual headline change. The captured official sources establish no December 21 correction. This corrects the date premise while retaining the reissue flag. The notice does not specify a change to either selected monthly SA Table A number; that scope finding does not authenticate original release-day bytes or an exact same-day reissue time.

A separate November 22, 2021 erratum concerns August collection-method shares in COVID-impact companion reports. That product and measure differ from these national monthly CPI-U Table A observations; its correction is not silently transferred to them.

These current 2026 archive captures support the historical first-release-column convention, with the producer archive and correction limitations retained. Footer last-modified labels are not proof of immutable bytes. No later release historical column, current database revision, extra decimal precision, forecast error or baseline forecast was used or computed.

Files: work/cpi-model-baseline-seed-2021.json; raw captures and manifests under work/raw/cpi-model-baseline-2021/. Acquisition and parsing helpers are separate. No master ledger or frozen archive was modified.
