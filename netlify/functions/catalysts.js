import { yahooAuth, yahooJson, raw } from './_yahoo-auth.js';
const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':s===200?'public,max-age=900':'no-store'}});
function eodTicker(t){ return t.includes('.') ? t : `${t}.US`; }

async function eodEvents(ticker,token){
  const from=new Date(); const to=new Date(Date.now()+180*86400000); const d=x=>x.toISOString().slice(0,10);
  const url=`https://eodhd.com/api/calendar/earnings?api_token=${encodeURIComponent(token)}&fmt=json&symbols=${encodeURIComponent(eodTicker(ticker))}&from=${d(from)}&to=${d(to)}`;
  const r=await fetch(url); if(!r.ok)throw new Error(`EODHD HTTP ${r.status}`); const j=await r.json(); const rows=Array.isArray(j?.earnings)?j.earnings:Array.isArray(j)?j:[];
  return rows.map(x=>({date:x.date||x.report_date||null,type:'EARNINGS',symbol:x.code||x.symbol||ticker,estimate:x.estimate??x.epsEstimate??null,actual:x.actual??null,currency:x.currency??null,source:'EODHD Earnings Calendar'}));
}
async function yahooEvents(ticker){
  const auth=await yahooAuth(); if(!auth.crumb)throw new Error(auth.error||'Yahoo authentication unavailable');
  const url=`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=calendarEvents`;
  const j=await yahooJson(url,{auth:true,authState:auth}); const cal=j?.quoteSummary?.result?.[0]?.calendarEvents||{}; const out=[];
  for(const x of (cal?.earnings?.earningsDate||[])){const ts=raw(x); if(Number.isFinite(ts))out.push({date:new Date(ts*1000).toISOString().slice(0,10),type:'EARNINGS',symbol:ticker,estimate:raw(cal?.earnings?.earningsAverage)??null,actual:null,currency:null,source:'Yahoo calendarEvents'});}
  const div=raw(cal?.dividendDate); if(Number.isFinite(div))out.push({date:new Date(div*1000).toISOString().slice(0,10),type:'DIVIDEND',symbol:ticker,estimate:null,actual:null,currency:null,source:'Yahoo calendarEvents'});
  return out;
}
export default async(req)=>{
  const u=new URL(req.url); const ticker=(u.searchParams.get('ticker')||'').trim(); if(!ticker)return json({error:'ticker is required'},400);
  const token=process.env.EODHD_API_TOKEN; const diagnostics=[];
  if(token){try{return json({ticker,status:'PASS',source:'EODHD Earnings Calendar',events:await eodEvents(ticker,token),diagnostics:[{source:'EODHD',status:'PASS'}]});}catch(e){diagnostics.push({source:'EODHD',status:'FAILED',error:e.message});}}
  else diagnostics.push({source:'EODHD',status:'NOT_CONFIGURED',error:'EODHD_API_TOKEN missing'});
  try{return json({ticker,status:'PASS',source:'Yahoo calendarEvents',events:await yahooEvents(ticker),diagnostics:[...diagnostics,{source:'Yahoo calendarEvents',status:'PASS'}]});}
  catch(e){diagnostics.push({source:'Yahoo calendarEvents',status:'FAILED',error:e.message});}
  return json({ticker,status:'SOURCE_UNAVAILABLE',source:'EODHD + Yahoo',events:[],message:'No sourced catalyst connector is currently available for this ticker.',diagnostics});
};
