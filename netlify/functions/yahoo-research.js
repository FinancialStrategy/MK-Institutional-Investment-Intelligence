import { yahooAuth, yahooJson, raw, num } from './_yahoo-auth.js';

const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json','cache-control':status===200?'public,max-age=300':'no-store'}});

async function chartFallback(ticker){
  const u=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&events=div%2Csplits`;
  const j=await yahooJson(u); const r=j?.chart?.result?.[0]; if(!r) throw new Error(j?.chart?.error?.description||'Yahoo chart unavailable');
  const meta=r.meta||{}; const q=r.indicators?.quote?.[0]||{}; const closes=(q.close||[]).filter(Number.isFinite);
  const ts=(r.timestamp||[]); const lastIdx=[...q.close||[]].map((v,i)=>Number.isFinite(v)?i:-1).filter(i=>i>=0).pop();
  const lastClose=lastIdx!==undefined && lastIdx!==null ? q.close[lastIdx] : (closes.length?closes[closes.length-1]:null);
  const dataThrough=lastIdx!==undefined && lastIdx!==null && ts[lastIdx] ? new Date(ts[lastIdx]*1000).toISOString() : (meta.regularMarketTime?new Date(meta.regularMarketTime*1000).toISOString():null);
  return {meta,closes,lastClose,dataThrough};
}

async function quoteEndpoint(ticker,authState){
  const urls=[
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`
  ];
  let err='';
  for(const u of urls){
    try{const j=await yahooJson(u,{auth:true,authState}); const q=j?.quoteResponse?.result?.[0]; if(q) return {data:q,error:null};}catch(e){err=e.message;}
  }
  return {data:null,error:err||'No quote result'};
}

async function quoteSummary(ticker,authState){
  const modules='price,summaryDetail,defaultKeyStatistics,financialData,calendarEvents';
  const urls=[
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`,
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`
  ];
  let err='';
  for(const u of urls){
    try{const j=await yahooJson(u,{auth:true,authState}); const q=j?.quoteSummary?.result?.[0]; if(q) return {data:q,error:null};}catch(e){err=e.message;}
  }
  return {data:null,error:err||'No quoteSummary result'};
}

export default async (req) => {
  const u=new URL(req.url); const ticker=(u.searchParams.get('ticker')||'').trim();
  if(!ticker) return json({error:'ticker is required'},400);
  try{
    const chart=await chartFallback(ticker); // hard fallback first: if this fails the symbol/data source is not usable
    const authState=await yahooAuth();
    const [quoteRes,summaryRes] = await Promise.all([
      authState.crumb ? quoteEndpoint(ticker,authState) : Promise.resolve({data:null,error:authState.error}),
      authState.crumb ? quoteSummary(ticker,authState) : Promise.resolve({data:null,error:authState.error})
    ]);
    const quote=quoteRes.data, summary=summaryRes.data;
    const price=summary?.price||{}, detail=summary?.summaryDetail||{}, keys=summary?.defaultKeyStatistics||{}, fin=summary?.financialData||{}, cal=summary?.calendarEvents||{};
    const meta=chart.meta||{}; const closes=chart.closes||[];
    const high52 = num(raw(detail.fiftyTwoWeekHigh)) ?? (closes.length?Math.max(...closes):null);
    const low52  = num(raw(detail.fiftyTwoWeekLow))  ?? (closes.length?Math.min(...closes):null);
    const metrics={
      'Name': raw(price.longName)||raw(price.shortName)||quote?.longName||quote?.shortName||meta.longName||meta.shortName||ticker,
      'Exchange': raw(price.exchangeName)||quote?.fullExchangeName||quote?.exchange||meta.fullExchangeName||meta.exchangeName||meta.exchange||'N/A',
      'Currency': raw(price.currency)||quote?.currency||meta.currency||'N/A',
      'Market Price': num(raw(price.regularMarketPrice)) ?? num(quote?.regularMarketPrice) ?? num(meta.regularMarketPrice) ?? num(chart.lastClose),
      'Market Cap': num(raw(price.marketCap)) ?? num(quote?.marketCap),
      'Trailing P/E': num(raw(detail.trailingPE)) ?? num(quote?.trailingPE),
      'Forward P/E': num(raw(detail.forwardPE)) ?? num(quote?.forwardPE),
      'Price / Book': num(raw(keys.priceToBook)) ?? num(quote?.priceToBook),
      'EPS TTM': num(raw(keys.trailingEps)) ?? num(quote?.epsTrailingTwelveMonths),
      'EPS Forward': num(raw(keys.forwardEps)) ?? num(quote?.epsForward),
      'Book Value / Share': num(raw(keys.bookValue)) ?? num(quote?.bookValue),
      'Dividend Yield': num(raw(detail.dividendYield)) ?? num(quote?.dividendYield),
      '52W High': high52,
      '52W Low': low52,
      'Beta': num(raw(keys.beta)) ?? num(quote?.beta),
      'Profit Margin': num(raw(fin.profitMargins)),
      'Operating Margin': num(raw(fin.operatingMargins)),
      'ROA': num(raw(fin.returnOnAssets)),
      'ROE': num(raw(fin.returnOnEquity)),
      'Revenue Growth': num(raw(fin.revenueGrowth)),
      'Earnings Growth': num(raw(fin.earningsGrowth)),
      'Debt / Equity': num(raw(fin.debtToEquity)),
      'Current Ratio': num(raw(fin.currentRatio)),
      'Quick Ratio': num(raw(fin.quickRatio)),
      'Free Cash Flow': num(raw(fin.freeCashflow)),
      'Operating Cash Flow': num(raw(fin.operatingCashflow))
    };
    const earningsDate=(cal?.earnings?.earningsDate||[]).map(x=>raw(x)).filter(Number.isFinite).map(x=>new Date(x*1000).toISOString());
    const sources=['Yahoo chart']; if(summary)sources.unshift('Yahoo quoteSummary'); if(quote)sources.unshift('Yahoo quote');
    const nonMissing=Object.values(metrics).filter(v=>v!==null&&v!==undefined&&v!=='N/A').length;
    const partial=!summary || nonMissing<10;
    const diagnostics={
      chart:'PASS',
      auth:authState.crumb?'PASS':'FAILED',
      quote:quote?'PASS':'FAILED',
      quoteSummary:summary?'PASS':'FAILED',
      quoteError:quoteRes.error||null,
      quoteSummaryError:summaryRes.error||null,
      authError:authState.error||null
    };
    const notes=[];
    if(!summary) notes.push('Yahoo quoteSummary is unavailable; chart data remains active. Valuation fields that require authenticated Yahoo metadata may be N/A unless EODHD fills them.');
    if(!authState.crumb) notes.push('Yahoo authenticated metadata handshake failed (cookie/crumb). This does not affect the chart endpoint.');
    return json({ticker,source:sources.join(' + '),status:partial?'PARTIAL':'PASS',dataThrough:chart.dataThrough,metrics,events:{earningsDate},diagnostics,notes});
  }catch(e){ return json({error:`Yahoo research connector failed: ${e.message}`},502); }
};
