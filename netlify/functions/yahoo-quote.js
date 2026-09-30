export default async (req) => {
  const url = new URL(req.url);
  const ticker = (url.searchParams.get('ticker') || '').trim();
  if (!ticker) return new Response(JSON.stringify({error:'ticker is required'}), {status:400, headers:{'content-type':'application/json'}});
  try {
    const endpoint = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const r = await fetch(endpoint, {headers:{'user-agent':'Mozilla/5.0'}});
    if (!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);
    const j = await r.json();
    const q = j?.quoteResponse?.result?.[0];
    if (!q) throw new Error('No quote metadata returned.');
    const metrics = {
      'Name': q.longName || q.shortName || ticker,
      'Exchange': q.fullExchangeName || q.exchange || 'N/A',
      'Currency': q.currency || 'N/A',
      'Market Price': Number.isFinite(q.regularMarketPrice) ? q.regularMarketPrice : null,
      'Market Cap': Number.isFinite(q.marketCap) ? q.marketCap : null,
      'Trailing P/E': Number.isFinite(q.trailingPE) ? q.trailingPE : null,
      'Forward P/E': Number.isFinite(q.forwardPE) ? q.forwardPE : null,
      'Price / Book': Number.isFinite(q.priceToBook) ? q.priceToBook : null,
      'EPS TTM': Number.isFinite(q.epsTrailingTwelveMonths) ? q.epsTrailingTwelveMonths : null,
      'EPS Forward': Number.isFinite(q.epsForward) ? q.epsForward : null,
      'Book Value / Share': Number.isFinite(q.bookValue) ? q.bookValue : null,
      'Dividend Yield': Number.isFinite(q.dividendYield) ? q.dividendYield : null,
      '52W High': Number.isFinite(q.fiftyTwoWeekHigh) ? q.fiftyTwoWeekHigh : null,
      '52W Low': Number.isFinite(q.fiftyTwoWeekLow) ? q.fiftyTwoWeekLow : null,
      'Beta': Number.isFinite(q.beta) ? q.beta : null
    };
    return new Response(JSON.stringify({ticker,source:'Yahoo Finance quote metadata',dataThrough:q.regularMarketTime?new Date(q.regularMarketTime*1000).toISOString():null,metrics}), {status:200,headers:{'content-type':'application/json','cache-control':'public,max-age=300'}});
  } catch (e) {
    return new Response(JSON.stringify({error:e.message}), {status:502,headers:{'content-type':'application/json'}});
  }
};
