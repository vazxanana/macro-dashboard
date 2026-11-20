// Probe 3b (20 Nov 2026): the exact fields of the sources council/hard-sources.mjs reads. Prints only, writes nothing, no secrets.
const UA = { 'user-agent': 'Mozilla/5.0 (macro desk; public data)', accept: '*/*' };
const get = async (u) => { const r = await fetch(u, { headers: UA }); return { s: r.status, t: await r.text() }; };
const say = (...a) => console.log(...a);
try { const { t } = await get('https://www.treasurydirect.gov/TA_WS/securities/auctioned?format=json&days=150'); const j = JSON.parse(t);
  say('== auctioned rows', j.length, 'types', JSON.stringify([...new Set(j.map((r) => r.type + '/' + r.securityType))]));
  const n = j.filter((r) => /Note|Bond/i.test(r.type || r.securityType || '')); say('notes+bonds', n.length);
  const full = Object.fromEntries(Object.entries(n[0] || {}).filter(([, v]) => v !== '' && v != null)); say('first non-empty fields', JSON.stringify(full));
  say('empty keys', Object.keys(n[0] || {}).filter((k) => n[0][k] === '' || n[0][k] == null).join(','));
  for (const r of n.slice(0, 14)) say('  ', r.auctionDate, r.type, r.securityType, r.securityTerm, '| hy', r.highYield, 'btc', r.bidToCoverRatio, 'off', r.offeringAmount, 'reopen', r.reopening, 'tips', r.tips, 'frn', r.floatingRate);
} catch (e) { say('auctioned ERR', e.message); }
try { const { t } = await get('https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXCPICORE&status=open&with_nested_markets=true&limit=2'); const j = JSON.parse(t);
  const e = j.events[0]; say('== kalshi event keys', Object.keys(e).join(','), '\n event', JSON.stringify({ ...e, markets: undefined }));
  say(' market keys', Object.keys(e.markets[0]).join(',')); say(' market', JSON.stringify(e.markets[0]).slice(0, 2500));
} catch (e) { say('kalshi ERR', e.message); }
try { const { t } = await get('https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXFED&status=open&with_nested_markets=true&limit=3'); const j = JSON.parse(t);
  for (const e of j.events) say('== KXFED', e.event_ticker, e.sub_title, (e.markets || []).map((m) => `${m.yes_sub_title}|${m.floor_strike}|${m.last_price_dollars}/${m.yes_bid_dollars}-${m.yes_ask_dollars}|v${m.volume_fp}`).join(' , '));
} catch (e) { say('kxfed ERR', e.message); }
try { const { t } = await get('https://api.elections.kalshi.com/trade-api/v2/events?series_ticker=KXGOLDMON&status=open&with_nested_markets=true&limit=1'); const j = JSON.parse(t);
  for (const e of j.events) say('== KXGOLDMON', e.event_ticker, e.sub_title, (e.markets || []).map((m) => `${m.yes_sub_title}|${m.floor_strike}|${m.last_price_dollars}/${m.yes_bid_dollars}-${m.yes_ask_dollars}`).join(' , '));
} catch (e) { say('gold ERR', e.message); }
for (const u of ['https://markets.newyorkfed.org/api/rates/all/latest.json', 'https://markets.newyorkfed.org/api/rp/reverserepo/propositions/search.json?startDate=' + new Date(Date.now() - 12 * 86400e3).toISOString().slice(0, 10),
  'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=40&filter=account_type:eq:Treasury%20General%20Account%20(TGA)%20Closing%20Balance'])
  try { const { s, t } = await get(u); say('==', u.slice(0, 90), s, t.replace(/\s+/g, ' ').slice(0, 2600)); } catch (e) { say('ERR', u, e.message); }
for (const id of ['GVZ', 'VIX1D', 'VIX9D', 'SKEW']) try { const { t } = await get(`https://cdn.cboe.com/api/global/us_indices/daily_prices/${id}_History.csv`); const L = t.trim().split('\n'); say('== cboe', id, 'rows', L.length, 'head', L[0], '| first', L[1], '| last', L[L.length - 1]); } catch (e) { say('cboe ERR', id, e.message); }
try { const { t } = await get('https://www.bls.gov/schedule/news_release/bls.ics'); const ev = t.split('BEGIN:VEVENT').slice(1); say('== bls events', ev.length, '\n', ev.slice(-3).join('\n---\n').slice(0, 1500)); } catch (e) { say('bls ERR', e.message); }
try { const { t } = await get('https://apps.bea.gov/API/signup/release_dates.json'); const j = JSON.parse(t); say('== bea', Object.keys(j).map((k) => `${k}: ${(j[k].release_dates || []).slice(-2).join(',')}`).join(' | ').slice(0, 2500)); } catch (e) { say('bea ERR', e.message); }
try { const { t } = await get('https://www.ssga.com/us/en/intermediary/etfs/library-content/products/fund-data/etfs/us/holdings-daily-us-en-gld.xlsx'); say('== gld holdings xlsx', t.length, t.slice(0, 4)); } catch (e) { say('gld ERR', e.message); }
try { const { s, t } = await get('https://www.federalreserve.gov/feeds/speeches.xml'); say('== fed speeches', s, (t.match(/<title>[^<]*<\/title>/g) || []).slice(0, 8).join(' ')); } catch (e) { say('ERR', e.message); }
