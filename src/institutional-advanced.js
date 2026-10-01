import { UNIVERSE } from './universe.js';
import { alignAssets } from './analytics.js';

const metaMap = new Map(UNIVERSE.map(x => [x.ticker, x]));
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));

export function parseWeightText(text, tickers=[]) {
  const out = Object.fromEntries(tickers.map(t=>[t,0]));
  String(text||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>{
    const [k,v]=x.split(':'); const n=Number(v); if(k&&Number.isFinite(n)&&(!tickers.length||tickers.includes(k.trim()))) out[k.trim()]=n/100;
  });
  const s=Object.values(out).reduce((a,b)=>a+b,0); if(s>0) Object.keys(out).forEach(k=>out[k]/=s); return out;
}

export function vectorFromMap(tickers, obj={}) { return tickers.map(t=>Number(obj?.[t]||0)); }
export function mapFromVector(tickers, arr=[]) { return Object.fromEntries(tickers.map((t,i)=>[t,Number(arr[i]||0)])); }

export function buildGroupConstraints(tickers, cfg={}) {
  const rows=[];
  const metas=tickers.map(t=>metaMap.get(t)||{ticker:t,region:'Unknown',assetClass:'Unknown',group:'Unknown'});
  const push=(name,members,lower,upper)=>{if(members.length&&(Number.isFinite(lower)||Number.isFinite(upper)))rows.push({name,members,lower:Number.isFinite(lower)?lower:0,upper:Number.isFinite(upper)?upper:1});};
  const commodityMembers=metas.filter(m=>['Commodity','Commodity ETF'].includes(m.assetClass)).map(m=>m.ticker);
  const equityMembers=metas.filter(m=>['Equity','Equity ETF','Factor ETF','Index','Mining ETF'].includes(m.assetClass)).map(m=>m.ticker);
  const bondMembers=metas.filter(m=>m.assetClass==='Bond ETF').map(m=>m.ticker);
  if(Number.isFinite(cfg.commodityMax)) push('Commodity cap',commodityMembers,0,cfg.commodityMax);
  if(Number.isFinite(cfg.equityMin)) push('Equity minimum',equityMembers,cfg.equityMin,1);
  if(Number.isFinite(cfg.bondMin)) push('Bond minimum',bondMembers,cfg.bondMin,1);
  if(Number.isFinite(cfg.regionMax)) {
    const regions=[...new Set(metas.map(m=>m.region))];
    regions.forEach(r=>push(`Region cap — ${r}`,metas.filter(m=>m.region===r).map(m=>m.ticker),0,cfg.regionMax));
  }
  if(Number.isFinite(cfg.groupMax)) {
    const groups=[...new Set(metas.map(m=>m.group))];
    groups.forEach(g=>push(`Group cap — ${g}`,metas.filter(m=>m.group===g).map(m=>m.ticker),0,cfg.groupMax));
  }
  return rows;
}

export function buildLiquidityCaps(payloads, portfolioValue, participation, maxDays, hardUpper=1) {
  if(!Array.isArray(payloads)||!Number.isFinite(portfolioValue)||portfolioValue<=0||!Number.isFinite(participation)||participation<=0||!Number.isFinite(maxDays)||maxDays<=0)return {};
  const caps={};
  for(const p of payloads){
    const rows=(p.rows||[]).slice(-63).filter(r=>Number.isFinite(r.volume)&&Number.isFinite(r.adjClose??r.close));
    if(!rows.length)continue;
    const adtv=rows.reduce((s,r)=>s+(r.adjClose??r.close)*r.volume,0)/rows.length;
    const cap=adtv*participation*maxDays/portfolioValue;
    if(Number.isFinite(cap))caps[p.ticker]=clamp(cap,0,hardUpper);
  }
  return caps;
}

export function parseRelativeViews(text){
  return String(text||'').split(',').map(x=>x.trim()).filter(Boolean).map(x=>{
    const [pair,val]=x.split(':'); const [long,short]=String(pair||'').split('>').map(s=>s.trim()); const view=Number(val);
    return long&&short&&Number.isFinite(view)?{long,short,view,confidence:0.5}:null;
  }).filter(Boolean);
}

export function applyViewConfidences(absViews={}, relViews=[], text=''){
  const conf={}; String(text||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>{const [k,v]=x.split(':');const n=Number(v);if(k&&Number.isFinite(n))conf[k.trim()]=clamp(n,0.01,0.99);});
  const rv=relViews.map(x=>({...x,confidence:conf[`${x.long}>${x.short}`]??x.confidence??0.5}));
  return {view_confidences:Object.fromEntries(Object.keys(absViews).map(k=>[k,conf[k]??0.5])),relative_views:rv};
}

export function migrationAnalysis(tickers,current,target,portfolioValue=1,costBps=0,mu=null,cov=null,rf=0){
  const c=vectorFromMap(tickers,current), t=vectorFromMap(tickers,target); const pv=Number(portfolioValue)||1;
  const trades=tickers.map((x,i)=>({ticker:x,current:c[i],target:t[i],delta:t[i]-c[i],notional:(t[i]-c[i])*pv,action:t[i]-c[i]>1e-8?'BUY':t[i]-c[i]<-1e-8?'SELL':'HOLD'}));
  const turnover=trades.reduce((s,x)=>s+Math.abs(x.delta),0); const cost=turnover*pv*(Number(costBps)||0)/10000;
  const perf=(w)=>{if(!mu||!cov)return null; const ret=w.reduce((s,wi,i)=>s+wi*Number(mu[i]||0),0); let v=0;for(let i=0;i<w.length;i++)for(let j=0;j<w.length;j++)v+=w[i]*w[j]*Number(cov[i]?.[j]||0);const vol=Math.sqrt(Math.max(0,v));return {ret,vol,sharpe:vol?(ret-rf)/vol:NaN};};
  return {trades,turnover,cost,currentPerformance:perf(c),targetPerformance:perf(t)};
}

export function riskDecompositionLocal(tickers,weights,cov){
  const w=vectorFromMap(tickers,weights); const n=w.length; if(!cov||!n)return null;
  let variance=0; const sw=Array(n).fill(0); for(let i=0;i<n;i++){for(let j=0;j<n;j++){const cij=Number(cov[i]?.[j]||0);variance+=w[i]*cij*w[j];sw[i]+=cij*w[j];}}
  const vol=Math.sqrt(Math.max(0,variance)); const mrc=sw.map(x=>vol?x/vol:0); const rc=mrc.map((x,i)=>x*w[i]); const total=rc.reduce((a,b)=>a+b,0); const rcPct=rc.map(x=>total?x/total:0); const hhi=w.reduce((s,x)=>s+x*x,0);
  const assetVol=tickers.map((_,i)=>Math.sqrt(Math.max(0,Number(cov[i]?.[i]||0))));
  return {vol,mrc,rc,rcPct,hhi,effectiveN:hhi?1/hhi:NaN,diversificationRatio:vol?w.reduce((s,x,i)=>s+Math.abs(x)*assetVol[i],0)/vol:NaN};
}

function resolvedScenarioMeta(ticker){
  const base=metaMap.get(ticker);
  if(base)return {...base,mapped:true};
  const t=String(ticker||'').trim();
  if(/=F$/.test(t))return {ticker:t,assetClass:'Commodity',group:'Unclassified Commodity',factors:[],mapped:false};
  return {ticker:t,assetClass:'Unknown',group:'Unknown',factors:[],mapped:false};
}

function isEquityLike(m){return ['Equity','Equity ETF','Factor ETF','Index'].includes(m.assetClass);}
function isGold(m){return m.ticker==='GC=F'||m.ticker==='GLD'||m.factors?.includes('Gold');}
function isIndustrialMetal(m){return m.group==='Industrial Metals'||m.factors?.includes('Copper')||m.factors?.includes('Aluminium');}
function isEnergy(m){return m.group==='Energy'||m.factors?.includes('Energy');}

function strategyWeightVector(tickers,strategy){
  const src=strategy?.weights;
  const raw=Array.isArray(src)?tickers.map((_,i)=>Number(src[i]||0)):tickers.map(t=>Number(src?.[t]||0));
  if(!raw.every(Number.isFinite))return Array(tickers.length).fill(0);
  const sum=raw.reduce((a,b)=>a+b,0);
  return Math.abs(sum)>1e-10?raw.map(x=>x/sum):raw;
}

function portfolioVol(weights,cov){
  if(!Array.isArray(cov)||cov.length!==weights.length)return NaN;
  let v=0;
  for(let i=0;i<weights.length;i++)for(let j=0;j<weights.length;j++)v+=weights[i]*weights[j]*Number(cov[i]?.[j]||0);
  return Math.sqrt(Math.max(0,v));
}

function stressedCovariance(cov,metas,overlay){
  if(!Array.isArray(cov)||!cov.length||!overlay)return null;
  const n=cov.length, vols=Array(n).fill(0).map((_,i)=>Math.sqrt(Math.max(0,Number(cov[i]?.[i]||0))));
  const mult=metas.map(m=>{
    const x=Number(overlay.volMultiplier?.(m));
    return Number.isFinite(x)&&x>0?x:1;
  });
  const target=Number(overlay.correlationTarget);
  const blend=clamp(Number(overlay.correlationBlend)||0,0,1);
  return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>{
    const vi=vols[i]*mult[i], vj=vols[j]*mult[j];
    if(i===j)return vi*vi;
    const den=vols[i]*vols[j];
    const base=den?Number(cov[i]?.[j]||0)/den:0;
    const corr=Number.isFinite(target)?clamp((1-blend)*base+blend*target,-0.99,0.99):clamp(base,-0.99,0.99);
    return corr*vi*vj;
  }));
}

function overlaySummary(sc){
  const o=sc.riskOverlay;
  if(!o)return 'No stochastic risk overlay';
  return `ρ target ${Number(o.correlationTarget).toFixed(2)} • blend ${(100*Number(o.correlationBlend)).toFixed(0)}% • scenario-specific vol multipliers`;
}

export function scenarioDefinitions(){
  return [
    {
      name:'Equity Shock',
      description:'Broad equity / factor / index assets -20%; mining equities -15%; direct commodities unchanged.',
      shock:m=>m.assetClass==='Mining ETF'?-0.15:isEquityLike(m)?-0.20:0,
      riskOverlay:{correlationTarget:0.65,correlationBlend:0.55,volMultiplier:m=>m.assetClass==='Mining ETF'?1.90:isEquityLike(m)?1.75:m.assetClass==='Commodity'?1.25:m.assetClass==='Bond ETF'?1.20:1.30}
    },
    {
      name:'Inflation Shock',
      description:'Gold +15%; energy +12%; industrial metals +8%; long-duration bonds -10%; other bond ETFs -4%.',
      shock:m=>isGold(m)?0.15:isEnergy(m)?0.12:isIndustrialMetal(m)?0.08:m.factors?.includes('Long Duration')?-0.10:m.assetClass==='Bond ETF'?-0.04:0,
      riskOverlay:{correlationTarget:0.45,correlationBlend:0.35,volMultiplier:m=>isGold(m)?1.30:isEnergy(m)?1.50:isIndustrialMetal(m)?1.45:m.assetClass==='Bond ETF'?1.35:isEquityLike(m)?1.30:1.20}
    },
    {
      name:'Rates +100bp Proxy',
      description:'Long-duration bonds -14%; intermediate duration -7%; short duration -1.5%; equities -4%; direct commodities unchanged.',
      shock:m=>m.factors?.includes('Long Duration')?-0.14:m.factors?.includes('Duration')?-0.07:m.factors?.includes('Short Duration')?-0.015:isEquityLike(m)||m.assetClass==='Mining ETF'?-0.04:0,
      riskOverlay:{correlationTarget:0.50,correlationBlend:0.40,volMultiplier:m=>m.factors?.includes('Long Duration')?1.80:m.factors?.includes('Duration')?1.55:m.factors?.includes('Short Duration')?1.20:isEquityLike(m)||m.assetClass==='Mining ETF'?1.30:m.assetClass==='Commodity'?1.15:1.20}
    },
    {
      name:'Growth Recession',
      description:'Broad equities -12%; cyclical/mining assets -15%; high yield -10%; government bonds +6%; gold +8%.',
      shock:m=>isGold(m)?0.08:m.ticker==='HYG'?-0.10:m.group==='Government Bonds'?0.06:m.assetClass==='Mining ETF'||m.factors?.includes('Cyclical')?-0.15:isEquityLike(m)?-0.12:0,
      riskOverlay:{correlationTarget:0.75,correlationBlend:0.65,volMultiplier:m=>m.assetClass==='Mining ETF'||m.factors?.includes('Cyclical')?1.85:m.ticker==='HYG'?1.70:isEquityLike(m)?1.65:m.group==='Government Bonds'?1.20:isGold(m)?1.35:1.30}
    },
    {
      name:'Correlation Spike',
      description:'Deterministic return shock is 0%; risk overlay blends off-diagonal correlations toward 0.85 and multiplies all asset volatilities by 1.35.',
      shock:()=>0,
      riskOverlay:{correlationTarget:0.85,correlationBlend:0.75,volMultiplier:()=>1.35}
    }
  ];
}

export function strategyScenarioMatrix(tickers,strategies,cov=null){
  const metas=tickers.map(resolvedScenarioMeta), defs=scenarioDefinitions();
  const unmapped=metas.filter(m=>!m.mapped).map(m=>m.ticker);
  return defs.map(sc=>{
    const stressedCov=stressedCovariance(cov,metas,sc.riskOverlay);
    const values=strategies.map(s=>{
      const weights=strategyWeightVector(tickers,s);
      const contributions=tickers.map((ticker,i)=>{
        const shock=Number(sc.shock(metas[i])||0), weight=Number(weights[i]||0);
        return {ticker,weight,shock,contribution:weight*shock,assetClass:metas[i].assetClass,group:metas[i].group,mapped:metas[i].mapped,volMultiplier:Number(sc.riskOverlay?.volMultiplier?.(metas[i])||1)};
      });
      const stressReturn=contributions.reduce((sum,x)=>sum+x.contribution,0);
      const baseVol=portfolioVol(weights,cov), stressedVol=stressedCov?portfolioVol(weights,stressedCov):NaN;
      return {key:s.key,label:s.label,weights,return:stressReturn,baseVol,stressedVol,deltaVol:Number.isFinite(stressedVol)&&Number.isFinite(baseVol)?stressedVol-baseVol:NaN,contributions};
    });
    return {scenario:sc.name,description:sc.description,riskOverlay:sc.riskOverlay||null,riskOverlaySummary:overlaySummary(sc),values,unmapped};
  });
}

export function regimeDiagnostic(metrics){
  if(!metrics)return {name:'UNAVAILABLE',score:0,preset:'balanced',notes:['Load a reference asset first.']};
  let score=0; const notes=[];
  if(metrics.volRegime==='EXPANSION'){score-=2;notes.push('Volatility expansion.');}
  if(metrics.volRegime==='COMPRESSION'){score+=1;notes.push('Volatility compression.');}
  if(metrics.structural==='POSITIVE'){score+=2;notes.push('Positive structural trend.');}
  if(metrics.structural==='NEGATIVE'){score-=2;notes.push('Negative structural trend.');}
  if(metrics.tactical==='POSITIVE')score+=1; if(metrics.tactical==='NEGATIVE')score-=1;
  if(Number.isFinite(metrics.mdd)&&metrics.mdd<-0.15){score-=1;notes.push('Material drawdown state.');}
  if(score<=-3)return {name:'RISK-OFF',score,preset:'defensive',notes};
  if(score>=3)return {name:'RISK-ON',score,preset:'growth',notes};
  return {name:'NEUTRAL',score,preset:'balanced',notes};
}

export function regimeConstraintPreset(name){
  if(name==='defensive') return {commodityMax:0.30,equityMin:0.20,bondMin:0.20,regionMax:0.55,groupMax:0.45,minEffectiveN:4,turnoverLimit:0.60};
  if(name==='growth') return {commodityMax:0.25,equityMin:0.55,bondMin:0.00,regionMax:0.65,groupMax:0.50,minEffectiveN:3,turnoverLimit:0.80};
  return {commodityMax:0.30,equityMin:0.40,bondMin:0.10,regionMax:0.60,groupMax:0.50,minEffectiveN:4,turnoverLimit:0.70};
}

export function frontierDiagnostics(frontier=[],strategies=[]){
  if(!frontier.length)return {curvature:NaN,efficiency:[]};
  const pts=[...frontier].sort((a,b)=>a.volatility-b.volatility); let curvature=[];
  for(let i=1;i<pts.length-1;i++){const x0=pts[i-1].volatility,x1=pts[i].volatility,x2=pts[i+1].volatility,y0=pts[i-1].return,y1=pts[i].return,y2=pts[i+1].return;const d1=(y1-y0)/(x1-x0||1e-9),d2=(y2-y1)/(x2-x1||1e-9);curvature.push((d2-d1)/((x2-x0)/2||1e-9));}
  const med=curvature.length?[...curvature].sort((a,b)=>a-b)[Math.floor(curvature.length/2)]:NaN;
  const interp=(vol)=>{if(vol<=pts[0].volatility)return pts[0].return;if(vol>=pts.at(-1).volatility)return pts.at(-1).return;for(let i=1;i<pts.length;i++){if(vol<=pts[i].volatility){const a=pts[i-1],b=pts[i],q=(vol-a.volatility)/(b.volatility-a.volatility);return a.return+q*(b.return-a.return);}}return NaN;};
  return {curvature:med,efficiency:strategies.map(s=>({label:s.label,gap:Number.isFinite(s.vol)?interp(s.vol)-s.ret:NaN}))};
}

export function alignedReturnMatrix(payloads){
  const a=alignAssets(payloads); return {dates:a.dates,returns:a.returns};
}
