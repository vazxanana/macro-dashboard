// Probe 2 (20 Nov 2026): the shape of the sources that answered, so the parser reads the right fields. Prints only.
const UA = { 'user-agent': 'Mozilla/5.0 (research probe)', accept: '*/*' };
const get = async (u) => { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text() }; };
try {
  const { t } = await get('https://www.clevelandfed.org/-/media/files/webcharts/inflationnowcasting/nowcast_month.json?sc_lang=en');
  const J = JSON.parse(t); console.log('== cleveland month: charts', J.length);
  for (const c of J.slice(-2)) {
    console.log('chart', JSON.stringify(c.chart && { sub: c.chart.subcaption, cmt: c.chart._comment }), 'keys', Object.keys(c));
    const cats = (c.categories && c.categories[0] && c.categories[0].category) || []; console.log(' cats', cats.length, JSON.stringify(cats.slice(-4)));
    for (const d of c.dataset || []) { const v = (d.data || []).filter((x) => x.value !== ''); console.log(' series', d.seriesname, 'n', (d.data || []).length, 'last', JSON.stringify(v.slice(-2))); }
  }
} catch (e) { console.log('cleveland ERR', e.message); }
try { const { t } = await get('https://fred.stlouisfed.org/graph/fredgraph.csv?id=GDPNOW'); console.log('== gdpnow tail', t.trim().split('\n').slice(-3).join(' | ')); } catch (e) { console.log('gdpnow ERR', e.message); }
try {
  const { t } = await get('https://www.federalreserve.gov/json/calendar.json'); const J = JSON.parse(t.replace(/^﻿/, ''));
  const ev = J.events.filter((e) => e.month >= '2026-11'); console.log('== fed calendar', J.events.length, 'from Nov', ev.length, 'types', [...new Set(J.events.map((e) => e.type))].join(','));
  console.log(JSON.stringify(ev.slice(0, 12)).slice(0, 3000));
} catch (e) { console.log('fed ERR', e.message); }
for (const u of ['https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=KXFEDDECISION-26DEC',
  'https://api.elections.kalshi.com/trade-api/v2/markets?event_ticker=KXFED-26DEC']) {
  try { const { s, t } = await get(u); const J = JSON.parse(t); console.log('==', u, s, (J.markets || []).length);
    for (const m of J.markets || []) console.log('  ', m.ticker, '|', m.yes_sub_title || m.subtitle, '| last', m.last_price_dollars, 'bid', m.yes_bid_dollars, 'ask', m.yes_ask_dollars, 'vol', m.volume_fp || m.volume, 'oi', m.open_interest_fp, 'close', m.close_time);
  } catch (e) { console.log('kalshi ERR', e.message); }
}
try { const { t } = await get('https://gamma-api.polymarket.com/events?slug=fed-decision-in-december-2026'); console.log('== poly 2026 slug', t.slice(0, 300)); } catch (e) {}
try { const { t } = await get('https://gamma-api.polymarket.com/public-search?q=fed%20decision%20december%202026'); const J = JSON.parse(t);
  for (const e of (J.events || []).slice(0, 6)) console.log('  poly', e.slug, '|', e.title, '| end', e.endDate, '| markets', (e.markets || []).map((m) => `${m.groupItemTitle || m.question}=${m.outcomePrices}`).join(' ; ').slice(0, 400)); } catch (e) { console.log('poly ERR', e.message); }
try { const { t } = await get('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/upcoming_auctions?sort=-auction_date&page[size]=15');
  const J = JSON.parse(t); console.log('== auctions', J.data.map((d) => `${d.auction_date} ${d.security_type} ${d.security_term} ${d.offering_amt}`).join(' | ')); } catch (e) { console.log('auction ERR', e.message); }
// 20 Nov 2026: the Treasury auction sources council/hard-data.mjs reads (SRC.auctions): raw shape and what the parser keeps.
{
  const { SRC, parseAuctions } = await import('../council/hard-data.mjs');
  const from = new Date(Date.now() - 86400e3).toISOString().slice(0, 10), to = new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10);
  for (const u of SRC.auctions) {
    try { const { s, t } = await get(u); const J = JSON.parse(t.replace(/^﻿/, '')); const rows = Array.isArray(J) ? J : (J.data || []);
      console.log('== auctions', u, s, 'rows', rows.length, 'first', JSON.stringify(rows[0] || null).slice(0, 600));
      console.log('   fields', JSON.stringify(rows.slice(0, 12).map((r) => [r.securityType, r.securityTerm, r.auctionDate, r.offeringAmount, r.type, r.security_type, r.security_term, r.auction_date])), 'window', from, to);
      console.log('   kept', JSON.stringify(parseAuctions(J, from, to)).slice(0, 1500));
    } catch (e) { console.log('auctions ERR', u, e.message); }
  }
}
