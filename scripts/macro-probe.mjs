// One-off probe (20 Nov 2026): which keyless public sources of hard-to-find macro data answer from a GitHub runner, and in what
// shape. Prints status, type and the first bytes of each; writes nothing. Run by .github/workflows/macro-probe.yml.
const UA = { 'user-agent': 'Mozilla/5.0 (research probe)', accept: '*/*' };
const SRC = [
  ['cleveland nowcast page', 'https://www.clevelandfed.org/indicators-and-data/inflation-nowcasting'],
  ['cleveland nowcast json (month)', 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en'],
  ['cleveland nowcast json (quarter)', 'https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_quarter.json?sc_lang=en'],
  ['fred GDPNOW', 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPNOW'],
  ['atlanta gdpnow page', 'https://www.atlantafed.org/cqer/research/gdpnow'],
  ['GLD holdings csv', 'https://www.spdrgoldshares.com/assets/dynamic/GLD/GLD_US_archive_EN.csv'],
  ['treasury upcoming auctions', 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/upcoming_auctions?page[size]=20'],
  ['fed calendar json', 'https://www.federalreserve.gov/json/calendar.json'],
  ['polymarket fed december', 'https://gamma-api.polymarket.com/events?slug=fed-decision-in-december'],
  ['polymarket search fed', 'https://gamma-api.polymarket.com/public-search?q=fed%20decision%20december'],
  ['kalshi fed', 'https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXFEDDECISION&status=open'],
  ['kalshi fed2', 'https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXFED&status=open'],
  ['cme gold stocks xls', 'https://www.cmegroup.com/delivery_reports/Gold_Stocks.xls'],
  ['ff next week', 'https://nfs.faireconomy.media/ff_calendar_nextweek.json'],
];
for (const [name, url] of SRC) {
  try {
    const ac = new AbortController(), to = setTimeout(() => ac.abort(), 20000);
    const r = await fetch(url, { headers: UA, signal: ac.signal, redirect: 'follow' }); clearTimeout(to);
    const buf = Buffer.from(await r.arrayBuffer());
    const txt = buf.toString('utf8').replace(/\s+/g, ' ');
    console.log(`=== ${name} | ${r.status} | ${r.headers.get('content-type')} | ${buf.length} bytes`);
    console.log(txt.slice(0, 900));
    if (/clevelandfed\.org\/indicators/.test(url)) { const m = txt.match(/[^"' ]*nowcast[^"' ]*\.json[^"' ]*/gi); console.log('json links:', [...new Set(m || [])].slice(0, 10)); }
    if (/atlantafed/.test(url)) { const m = txt.match(/Latest estimate:?[^<]{0,80}/i); console.log('latest:', m && m[0]); }
  } catch (e) { console.log(`=== ${name} | ERROR ${e && e.message}`); }
}
