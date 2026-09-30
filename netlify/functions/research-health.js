const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

async function probe(url){
  try{
    const r=await fetch(url,{headers:{'user-agent':'MK-Institutional-Intelligence/0.10.3'}});
    const text=await r.text();
    let parsed=null; try{parsed=JSON.parse(text);}catch{}
    return {ok:r.ok,status:r.status,preview:parsed?.General?.Code||parsed?.code||parsed?.error||parsed?.message||text.slice(0,160)};
  }catch(e){return {ok:false,status:null,preview:e.message};}
}

export default async(req)=>{
  const u=new URL(req.url); const ticker=(u.searchParams.get('ticker')||'AAPL').trim();
  const token=process.env.EODHD_API_TOKEN;
  const yahooTicker=ticker;
  const eodTicker=ticker.includes('.')?ticker:`${ticker}.US`;
  const out={
    environment:{eodhdTokenConfigured:Boolean(token),tokenLength:token?token.length:0},
    ticker:{input:ticker,yahoo:yahooTicker,eodhd:eodTicker},
    checks:{}
  };
  out.checks.yahooChart=await probe(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?range=5d&interval=1d`);
  if(token){
    out.checks.eodhdFundamentals=await probe(`https://eodhd.com/api/v1.1/fundamentals/${encodeURIComponent(eodTicker)}?api_token=${encodeURIComponent(token)}&filter=General::Code,General::Name,General::Exchange,General::CurrencyCode,Highlights::MarketCapitalization,Highlights::PERatio,Valuation::PriceBookMRQ`);
    out.checks.eodhdEod=await probe(`https://eodhd.com/api/eod/${encodeURIComponent(eodTicker)}?api_token=${encodeURIComponent(token)}&fmt=json&from=2026-09-20`);
  } else {
    out.checks.eodhdFundamentals={ok:false,status:null,preview:'EODHD_API_TOKEN is not visible to this Netlify Function runtime'};
    out.checks.eodhdEod={ok:false,status:null,preview:'EODHD_API_TOKEN is not visible to this Netlify Function runtime'};
  }
  out.overall=out.environment.eodhdTokenConfigured&&out.checks.eodhdFundamentals.ok?'PASS':'FAIL';
  return json(out);
};
