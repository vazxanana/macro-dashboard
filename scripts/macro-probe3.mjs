// Probe 3 (20 Nov 2026): candidate keyless sources for council/hard-data.mjs, read once from a GitHub runner. Prints only:
// status, size and the start of each answer, so a parser is written against the real shape. Writes nothing, no secrets.
const UA = { 'user-agent': 'Mozilla/5.0 (macro desk; public data)', accept: '*/*' };
const get = async (u, ms = 25000) => { const c = new AbortController(); const k = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(u, { headers: UA, signal: c.signal }); return { s: r.status, ct: r.headers.get('content-type'), t: await r.text() }; } finally { clearTimeout(k); } };
const show = async (name, u, n = 500, f = null) => {
  try { const r = await get(u); let extra = '';
    if (f && r.s === 200) { try { extra = '\n   >> ' + f(r.t); } catch (e) { extra = '\n   >> parse ERR ' + e.message; } }
    console.log(`== ${name} | ${r.s} | ${r.ct} | ${r.t.length} bytes\n   ${r.t.slice(0, n).replace(/\s+/g, ' ')}${extra}`);
  } catch (e) { console.log(`== ${name} ERR ${e.name} ${e.message} ${e.cause ? e.cause.code || e.cause.message : ''}`); }
};
const tail = (k = 3) => (t) => t.trim().split('\n').slice(-k).join(' | ');
const d = (off) => new Date(Date.now() + off * 86400e3).toISOString().slice(0, 10);
const J = (f) => (t) => { const j = JSON.parse(t.replace(/^﻿/, '')); return String(f(j)).slice(0, 2500); };

// 1. Treasury auction RESULTS (bid-to-cover, high yield, who bought)
await show('auctioned', 'https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&days=12', 200, J((j) => `rows ${j.length} keys ${Object.keys(j[0] || {}).join(',')}\n   notes ${JSON.stringify(j.filter((r) => /Note|Bond|TIPS|FRN/i.test(r.type || r.securityType || '')).slice(0, 2))}`));
// 2. Kalshi: which economics series exist, and the open events of the likely ones
await show('kalshi series econ', 'https://api.elections.kalshi.com/trade-api/v2/series?category=Economics', 200, J((j) => `n ${(j.series || []).length}: ${(j.series || []).map((s) => `${s.ticker}=${s.title}`).join(' ; ')}`.slice(0, 6000)));
for (const s of ['KXCPI', 'KXCPICORE', 'KXCPIYOY', 'KXCPICOREYOY', 'KXPAYROLLS', 'KXU3', 'KXGDP', 'KXPCECORE', 'KXFED', 'KXRATECUTCOUNT', 'KXRECSSNBER', 'KXGOLD', 'KXGOLDMON', 'KXUSDJPY', 'KXTNOTEW', 'KXFEDCHAIRNOM'])
  await show('kalshi ' + s, `https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=${s}&status=open&with_nested_markets=true&limit=4`, 0, J((j) => (j.events || []).map((e) => `${e.event_ticker} | ${e.title} | ${e.sub_title} | strike ${e.strike_date} | ${(e.markets || []).slice(0, 14).map((m) => `${m.yes_sub_title || m.subtitle}:${m.last_price_dollars}/${m.yes_bid_dollars}-${m.yes_ask_dollars} v${m.volume_fp || m.volume}`).join(' , ')}`).join('\n      ') || 'no open events'));
// 3. Polymarket economy events
await show('poly economy', 'https://gamma-api.polymarket.com/events?tag_slug=economy&closed=false&limit=40&order=volume24hr&ascending=false', 0, J((j) => j.map((e) => `${e.slug} | ${e.title} | end ${e.endDate} | v24 ${Math.round(e.volume24hr || 0)} | ${(e.markets || []).slice(0, 8).map((m) => `${m.groupItemTitle || m.question}=${m.outcomePrices}`).join(' ; ')}`.slice(0, 330)).join('\n      ')));
await show('poly fed tag', 'https://gamma-api.polymarket.com/events?tag_slug=fed&closed=false&limit=25&order=volume24hr&ascending=false', 0, J((j) => j.map((e) => `${e.slug} | ${e.title} | end ${e.endDate} | v24 ${Math.round(e.volume24hr || 0)}`).join('\n      ')));
// 4. NY Fed: reference rates, reverse repo
await show('nyfed rates', 'https://markets.newyorkfed.org/api/rates/all/latest.json', 1500);
await show('nyfed rrp', 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate=' + d(-10), 900);
await show('nyfed repo ops', 'https://markets.newyorkfed.org/api/rp/all/all/results/lastTwoWeeks.json', 200, J((j) => JSON.stringify((j.repo && j.repo.operations || []).slice(0, 3)).slice(0, 1800)));
await show('nyfed soma', 'https://markets.newyorkfed.org/api/soma/summary.json', 200, J((j) => JSON.stringify((j.soma && j.soma.summary || []).slice(-2))));
await show('nyfed pd', 'https://markets.newyorkfed.org/api/pd/latest/SBN2024.json', 600);
// 5. Treasury cash (TGA) and debt
await show('tga', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=8', 200, J((j) => JSON.stringify(j.data.map((r) => [r.record_date, r.account_type, r.open_today_bal, r.close_today_bal]))));
// 6. FRED series (keyless csv)
for (const id of ['GVZCLS', 'OVXCLS', 'VXNCLS', 'WALCL', 'RRPONTSYD', 'WTREGEN', 'WRESBAL', 'T5YIFR', 'STLFSI4', 'NFCI', 'THREEFYTP10', 'SOFR', 'EFFR', 'IORB', 'USEPUINDXD', 'BAMLH0A0HYM2', 'DCOILWTICO', 'STLENI', 'PCETRIM1M158SFRBDAL', 'CORESTICKM159SFRBATL', 'MEDCPIM158SFRBCLE', 'FRBATLWGT3MMAUMHWGO', 'ICSA', 'WEI', 'DTWEXBGS', 'EXPINF1YR', 'REAINTRATREARAT10Y'])
  await show('fred ' + id, 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + id, 0, tail(2));
// 7. Cboe index histories and gold options
for (const id of ['GVZ', 'SKEW', 'VVIX', 'OVX', 'VIX9D', 'VIX1D', 'VXTLT']) await show('cboe ' + id, `https://cdn.cboe.com/api/global/us_indices/daily_prices/${id}_History.csv`, 0, tail(2));
await show('cboe pcr', 'https://cdn.cboe.com/api/global/us_indices/daily_prices/PCALL_History.csv', 200, tail(2));
await show('cboe gld options', 'https://cdn.cboe.com/api/global/delayed_quotes/options/GLD.json', 0, J((j) => `keys ${Object.keys(j.data || {}).join(',')} | close ${j.data.close} iv30 ${j.data.iv30} iv30chg ${j.data.iv30_change} options ${(j.data.options || []).length} first ${JSON.stringify((j.data.options || [])[0])}`));
await show('cboe gvz quote', 'https://cdn.cboe.com/api/global/delayed_quotes/quotes/_GVZ.json', 500);
// 8. OFR: financial stress index and funding monitor
await show('ofr fsi', 'https://www.financialresearch.gov/financial-stress-index/data/fsi.csv', 200, tail(2));
await show('ofr stfm repo', 'https://data.financialresearch.gov/v1/series/timeseries?mnemonic=REPO-TYLD_AR_OO-P&start_date=' + d(-14), 600);
await show('ofr stfm mnemonics', 'https://data.financialresearch.gov/v1/metadata/mnemonics?dataset=repo', 600);
await show('ofr hfm', 'https://data.financialresearch.gov/hf/v1/series/timeseries?mnemonic=FPF-ALLQHF_LEVERAGERATIO_GAVWMEAN', 300, (t) => t.slice(-200));
// 9. Gold holdings of the two big funds
await show('gld csv', 'https://www.spdrgoldshares.com/assets/dynamic/GLD/GLD_US_archive_EN.csv', 300, tail(2));
await show('gld ssga nav', 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/navhist-us-en-gld.xlsx', 80);
await show('iau csv', 'https://www.ishares.com/us/products/239561/ishares-gold-trust-fund/1467271812596.ajax?fileType=csv&fileName=IAU_holdings&dataType=fund', 900);
await show('iau json', 'https://www.ishares.com/us/products/239561/ishares-gold-trust-fund/1467271812596.ajax?tab=all&fileType=json', 500);
// 10. Other nowcasts and trackers
await show('nyfed nowcast json', 'https://www.newyorkfed.org/medialibrary/Research/Interactives/Data/NowCast/Downloads/nowcast_data.json', 300);
await show('stl nowcast page', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPNOW,STLENI', 0, tail(2));
await show('cleveland yoy', 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_year.json?sc_lang=en', 0, J((j) => `charts ${j.length} last ${JSON.stringify(j[j.length - 1].chart && j[j.length - 1].chart.subcaption)} series ${(j[j.length - 1].dataset || []).map((x) => x.seriesname + ':' + JSON.stringify((x.data || []).filter((y) => y.value !== '').slice(-1))).join(' ; ')}`));
await show('cleveland quarter', 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_quarter.json?sc_lang=en', 0, J((j) => `charts ${j.length} last ${JSON.stringify(j[j.length - 1].chart && j[j.length - 1].chart.subcaption)} series ${(j[j.length - 1].dataset || []).map((x) => x.seriesname + ':' + JSON.stringify((x.data || []).filter((y) => y.value !== '').slice(-1))).join(' ; ')}`));
await show('cleveland expectations', 'https://www.clevelandfed.org/-/media/files/webcharts/inflationexpectations/ie_latest.json?sc_lang=en', 500);
await show('atlanta mpt', 'https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/cenfis/market-probability-tracker/mpt_histdata.csv', 300, tail(2));
// 11. Central-bank calendars beyond the Fed
await show('ecb cal', 'https://www.ecb.europa.eu/press/calendars/weekly/html/index.en.html', 200);
await show('boe rss', 'https://www.bankofengland.co.uk/rss/news', 300);
await show('boj rss', 'https://www.boj.or.jp/en/rss/whatsnew.xml', 300);
// 12. BLS / BEA release schedules (ics), Fed H.4.1 release dates
await show('bls ics', 'https://www.bls.gov/schedule/news_release/bls.ics', 400);
await show('bea schedule', 'https://apps.bea.gov/API/signup/release_dates.json', 500);
// 13. CFTC weekly gold disaggregated (already used) skipped. LBMA prices, Shanghai premium
await show('lbma gold pm', 'https://prices.lbma.org.uk/json/gold_pm.json', 0, J((j) => JSON.stringify(j.slice(-2))));
await show('lbma silver', 'https://prices.lbma.org.uk/json/silver.json', 0, J((j) => JSON.stringify(j.slice(-2))));
await show('sge', 'https://en.sge.com.cn/data_BenchmarkPrice', 200);
// 14. Fed speeches feed with speaker names, FOMC voters
await show('fed speeches rss', 'https://www.federalreserve.gov/feeds/speeches.xml', 500);
await show('fed press monetary rss', 'https://www.federalreserve.gov/feeds/press_monetary.xml', 500);
