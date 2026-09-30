import { yahooAuth, yahooJson, raw, num } from './_yahoo-auth.js';

const json=(b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json','cache-control':s===200?'public,max-age=900':'no-store'}});
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const safeDiv=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?a/b:null;

function eodTicker(t){ return t.includes('.') ? t : `${t}.US`; }
function ordered(obj){ return Object.entries(obj||{}).sort((a,b)=>new Date(b[1]?.date||b[0])-new Date(a[1]?.date||a[0])).map(([,v])=>v); }
function pick(x,...keys){ for(const k of keys){ const v=n(x?.[k]); if(v!==null)return v; } return null; }
function calcPeriod(is,bs,cf){
  const revenue=pick(is,'totalRevenue','revenue'); const gross=pick(is,'grossProfit'); const op=pick(is,'operatingIncome','operatingIncomeLoss'); const net=pick(is,'netIncome','netIncomeApplicableToCommonShares');
  const ebit=pick(is,'ebit','operatingIncome'); const tax=pick(is,'incomeTaxExpense'); const pretax=pick(is,'incomeBeforeTax');
  const assets=pick(bs,'totalAssets'); const equity=pick(bs,'totalStockholderEquity','totalEquity'); const debt=(pick(bs,'shortLongTermDebtTotal','longTermDebt')||0)+(pick(bs,'shortTermDebt')||0); const cash=pick(bs,'cash','cashAndEquivalents');
  const ocf=pick(cf,'totalCashFromOperatingActivities','cashFromOperatingActivities'); const capex=Math.abs(pick(cf,'capitalExpenditures')||0); const fcf=Number.isFinite(ocf)?ocf-capex:null;
  const nopat=Number.isFinite(ebit)?ebit*(1-(Number.isFinite(tax)&&Number.isFinite(pretax)&&pretax!==0?Math.max(0,Math.min(0.5,tax/pretax)):0.21)):null;
  const invested=Number.isFinite(equity)?equity+debt-(cash||0):null;
  return {date:is?.date||bs?.date||cf?.date||null,revenue,grossProfit:gross,operatingIncome:op,netIncome:net,totalAssets:assets,equity,debt,cash,operatingCashFlow:ocf,capex,freeCashFlow:fcf,grossMargin:safeDiv(gross,revenue),operatingMargin:safeDiv(op,revenue),netMargin:safeDiv(net,revenue),roe:safeDiv(net,equity),roa:safeDiv(net,assets),roic:safeDiv(nopat,invested),netDebt:Number.isFinite(debt)?debt-(cash||0):null};
}

function yahooStatementRow(is={},bs={},cf={}){
  const val=(obj,key)=>n(raw(obj?.[key]));
  const revenue=val(is,'totalRevenue'), gross=val(is,'grossProfit'), op=val(is,'operatingIncome'), net=val(is,'netIncome');
  const assets=val(bs,'totalAssets'), equity=val(bs,'totalStockholderEquity')??val(bs,'stockholdersEquity');
  const ltd=val(bs,'longTermDebt')||0, std=val(bs,'shortLongTermDebt')||val(bs,'shortTermDebt')||0, debt=ltd+std;
  const cash=val(bs,'cash')??val(bs,'cashAndCashEquivalents');
  const ocf=val(cf,'totalCashFromOperatingActivities')??val(cf,'operatingCashFlow'); const capex=Math.abs(val(cf,'capitalExpenditures')||0); const fcf=Number.isFinite(ocf)?ocf-capex:null;
  const ebit=val(is,'ebit')??op, pretax=val(is,'incomeBeforeTax'), tax=val(is,'incomeTaxExpense');
  const tr=Number.isFinite(tax)&&Number.isFinite(pretax)&&pretax!==0?Math.max(0,Math.min(.5,tax/pretax)):.21; const nopat=Number.isFinite(ebit)?ebit*(1-tr):null;
  const invested=Number.isFinite(equity)?equity+debt-(cash||0):null;
  const end=raw(is?.endDate)||raw(bs?.endDate)||raw(cf?.endDate); const date=Number.isFinite(end)?new Date(end*1000).toISOString().slice(0,10):null;
  return {date,revenue,grossProfit:gross,operatingIncome:op,netIncome:net,totalAssets:assets,equity,debt,cash,operatingCashFlow:ocf,capex,freeCashFlow:fcf,grossMargin:safeDiv(gross,revenue),operatingMargin:safeDiv(op,revenue),netMargin:safeDiv(net,revenue),roe:safeDiv(net,equity),roa:safeDiv(net,assets),roic:safeDiv(nopat,invested),netDebt:Number.isFinite(debt)?debt-(cash||0):null};
}

async function yahooFundamentals(ticker){
  const auth=await yahooAuth(); if(!auth.crumb) throw new Error(auth.error||'Yahoo authentication unavailable');
  const modules='price,summaryDetail,defaultKeyStatistics,financialData,incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory';
  const url=`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;
  const j=await yahooJson(url,{auth:true,authState:auth}); const q=j?.quoteSummary?.result?.[0]; if(!q)throw new Error('Yahoo quoteSummary returned no result');
  const inc=q?.incomeStatementHistory?.incomeStatementHistory||[], bal=q?.balanceSheetHistory?.balanceSheetStatements||[], cfs=q?.cashflowStatementHistory?.cashflowStatements||[];
  const m=Math.min(inc.length,bal.length,cfs.length,4); const annual=Array.from({length:m},(_,i)=>yahooStatementRow(inc[i],bal[i],cfs[i]));
  const latest=annual[0]||null, prev=annual[1]||null; const growth=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?a/b-1:null;
  const d=q?.summaryDetail||{}, k=q?.defaultKeyStatistics||{}, p=q?.price||{};
  const highlights={marketCapitalization:num(raw(p.marketCap)),pe:num(raw(d.trailingPE)),forwardPE:num(raw(d.forwardPE)),trailingPE:num(raw(d.trailingPE)),priceBook:num(raw(k.priceToBook)),eps:num(raw(k.trailingEps)),bookValue:num(raw(k.bookValue)),dividendYield:num(raw(d.dividendYield)),enterpriseValueEbitda:num(raw(k.enterpriseToEbitda)),revenueGrowth:growth(latest?.revenue,prev?.revenue),netIncomeGrowth:growth(latest?.netIncome,prev?.netIncome),fcfGrowth:growth(latest?.freeCashFlow,prev?.freeCashFlow),latest};
  return {ticker,status:annual.length?'PASS':'PARTIAL',source:'Yahoo authenticated fundamentals',general:{name:raw(p.longName)||raw(p.shortName)||ticker,exchange:raw(p.exchangeName),currency:raw(p.currency)},highlights,annual,quarterly:[],message:annual.length?'':'Yahoo returned valuation metadata but no complete annual statement history.'};
}

async function eodhdFundamentals(ticker,token){
  const url=`https://eodhd.com/api/v1.1/fundamentals/${encodeURIComponent(eodTicker(ticker))}?api_token=${encodeURIComponent(token)}`;
  const r=await fetch(url,{headers:{'user-agent':'MK-Institutional-Intelligence/0.10.3'}}); const txt=await r.text(); let j; try{j=JSON.parse(txt);}catch{throw new Error(`EODHD non-JSON response (HTTP ${r.status}): ${txt.slice(0,180)}`);} if(!r.ok)throw new Error(`EODHD HTTP ${r.status}: ${j?.message||j?.error||txt.slice(0,180)}`); if(j?.error||j?.message==='Forbidden')throw new Error(`EODHD API error: ${j.error||j.message}`);
  const F=j?.Financials||{};
  const build=(freq)=>{ const income=ordered(F?.Income_Statement?.[freq]); const balance=ordered(F?.Balance_Sheet?.[freq]); const cash=ordered(F?.Cash_Flow?.[freq]); const m=Math.min(income.length,balance.length,cash.length,8); return Array.from({length:m},(_,i)=>calcPeriod(income[i],balance[i],cash[i])); };
  const annual=build('yearly'), quarterly=build('quarterly');
  const latest=annual[0]||quarterly[0]||null, prev=annual[1]||quarterly[1]||null; const growth=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b!==0?a/b-1:null;
  const highlights={marketCapitalization:n(j?.Highlights?.MarketCapitalization),pe:n(j?.Highlights?.PERatio),peg:n(j?.Highlights?.PEGRatio),dividendYield:n(j?.Highlights?.DividendYield),eps:n(j?.Highlights?.EarningsShare),bookValue:n(j?.Highlights?.BookValue),wallStreetTargetPrice:n(j?.Highlights?.WallStreetTargetPrice),priceBook:n(j?.Valuation?.PriceBookMRQ),forwardPE:n(j?.Valuation?.ForwardPE),trailingPE:n(j?.Valuation?.TrailingPE),enterpriseValueEbitda:n(j?.Valuation?.EnterpriseValueEbitda),revenueGrowth:growth(latest?.revenue,prev?.revenue),netIncomeGrowth:growth(latest?.netIncome,prev?.netIncome),fcfGrowth:growth(latest?.freeCashFlow,prev?.freeCashFlow),latest};
  return {ticker,status:'PASS',source:'EODHD Fundamentals',general:{name:j?.General?.Name,exchange:j?.General?.Exchange,currency:j?.General?.CurrencyCode,sector:j?.General?.Sector,industry:j?.General?.Industry},highlights,annual,quarterly};
}

export default async(req)=>{
  const u=new URL(req.url); const ticker=(u.searchParams.get('ticker')||'').trim(); if(!ticker)return json({error:'ticker is required'},400);
  const token=process.env.EODHD_API_TOKEN;
  const diagnostics=[];
  if(token){
    try{return json({...await eodhdFundamentals(ticker,token),diagnostics:[{source:'EODHD',status:'PASS'}]});}
    catch(e){diagnostics.push({source:'EODHD',status:'FAILED',error:e.message});}
  } else diagnostics.push({source:'EODHD',status:'NOT_CONFIGURED',error:'EODHD_API_TOKEN missing'});
  try{return json({...await yahooFundamentals(ticker),diagnostics:[...diagnostics,{source:'Yahoo authenticated fundamentals',status:'PASS'}]});}
  catch(e){diagnostics.push({source:'Yahoo authenticated fundamentals',status:'FAILED',error:e.message});}
  return json({ticker,status:'SOURCE_UNAVAILABLE',source:'EODHD + Yahoo',message:'Deep fundamentals are unavailable. Configure EODHD_API_TOKEN or restore Yahoo authenticated metadata access. Price/chart data can still load independently.',annual:[],quarterly:[],highlights:{},diagnostics});
};
