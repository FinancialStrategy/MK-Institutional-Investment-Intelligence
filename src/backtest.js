const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : NaN;
const stdev = a => {
  if (a.length < 2) return NaN;
  const m=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1));
};
const maxDrawdown = nav => {
  let peak=nav[0] ?? 1, mdd=0;
  const dd=nav.map(v=>{ if(v>peak)peak=v; const d=v/peak-1; if(d<mdd)mdd=d; return d; });
  return {mdd,dd};
};
const cagr = (nav, periods) => nav.length>1 && periods>0 ? (nav.at(-1)/nav[0])**(252/periods)-1 : NaN;
const sharpe = r => { const s=stdev(r); return s ? mean(r)/s*Math.sqrt(252) : NaN; };
const sortino = r => {
  const downside=r.filter(x=>x<0); const ds=Math.sqrt(mean(downside.map(x=>x*x)));
  return ds ? mean(r)/ds*Math.sqrt(252) : NaN;
};
const profitFactor = r => {
  const gp=r.filter(x=>x>0).reduce((a,b)=>a+b,0), gl=Math.abs(r.filter(x=>x<0).reduce((a,b)=>a+b,0));
  return gl ? gp/gl : NaN;
};

function smaAt(values, endExclusive, n){
  if(endExclusive<n)return NaN;
  let s=0; for(let i=endExclusive-n;i<endExclusive;i++)s+=values[i]; return s/n;
}

export function maCrossBacktest(rows, fast=21, slow=200, costBps=5, slippageBps=2, startIndex=0, endIndex=null){
  const clean=rows.filter(r=>Number.isFinite(r.adjClose ?? r.close));
  const prices=clean.map(r=>r.adjClose ?? r.close), dates=clean.map(r=>r.date);
  const end=endIndex==null?prices.length-1:Math.min(endIndex,prices.length-1);
  const begin=Math.max(startIndex,slow);
  const gross=[], net=[], positions=[], outDates=[]; let prevPos=0;
  for(let t=begin;t<=end;t++){
    // Strict no-lookahead: position for return t-1 -> t is formed only from prices through t-1.
    const fastMA=smaAt(prices,t,fast), slowMA=smaAt(prices,t,slow);
    const pos=Number.isFinite(fastMA)&&Number.isFinite(slowMA)&&fastMA>slowMA?1:0;
    const assetRet=prices[t]/prices[t-1]-1;
    const turnover=Math.abs(pos-prevPos);
    const tradingCost=turnover*(costBps+slippageBps)/10000;
    gross.push(pos*assetRet); net.push(pos*assetRet-tradingCost); positions.push(pos); outDates.push(dates[t]); prevPos=pos;
  }
  const nav=[1], bench=[1];
  net.forEach(r=>nav.push(nav.at(-1)*(1+r)));
  for(let t=begin;t<=end;t++) bench.push(bench.at(-1)*(prices[t]/prices[t-1]));
  const dd=maxDrawdown(nav), annVol=stdev(net)*Math.sqrt(252), cg=cagr(nav,net.length);
  const entries=positions.reduce((n,p,i)=>n+(p===1&&(i===0||positions[i-1]===0)?1:0),0);
  const exits=positions.reduce((n,p,i)=>n+(p===0&&i>0&&positions[i-1]===1?1:0),0);
  const turnover=positions.reduce((n,p,i)=>n+(i===0?Math.abs(p):Math.abs(p-positions[i-1])),0);
  return {
    dates:outDates, returns:net, grossReturns:gross, positions, nav:nav.slice(1), benchmarkNav:bench.slice(1),
    metrics:{cagr:cg,annVol,sharpe:sharpe(net),sortino:sortino(net),mdd:dd.mdd,calmar:Math.abs(dd.mdd)>0?cg/Math.abs(dd.mdd):NaN,
      hitRate:net.length?net.filter(x=>x>0).length/net.length:NaN,profitFactor:profitFactor(net),entries,exits,turnover,
      exposure:positions.length?mean(positions):NaN,terminal:nav.at(-1),benchmarkTerminal:bench.at(-1)},
    params:{fast,slow,costBps,slippageBps,begin,end}
  };
}

export function walkForwardMA(rows, opts={}){
  const train=opts.train ?? 504, test=opts.test ?? 126, costBps=opts.costBps ?? 5, slippageBps=opts.slippageBps ?? 2;
  const fastGrid=opts.fastGrid ?? [10,20,30,40,50];
  const slowGrid=opts.slowGrid ?? [100,150,200];
  const clean=rows.filter(r=>Number.isFinite(r.adjClose ?? r.close));
  const maxSlow=Math.max(...slowGrid), folds=[]; let cursor=maxSlow+train;
  const oosReturns=[], oosDates=[];
  while(cursor+test<clean.length){
    const trainStart=cursor-train, trainEnd=cursor-1, testStart=cursor, testEnd=Math.min(cursor+test-1,clean.length-1);
    let best=null;
    for(const fast of fastGrid)for(const slow of slowGrid){
      if(fast>=slow)continue;
      const bt=maCrossBacktest(clean,fast,slow,costBps,slippageBps,trainStart,trainEnd);
      const score=bt.metrics.sharpe;
      if(Number.isFinite(score)&&(!best||score>best.score))best={fast,slow,score};
    }
    if(!best)break;
    const testBt=maCrossBacktest(clean,best.fast,best.slow,costBps,slippageBps,testStart,testEnd);
    oosReturns.push(...testBt.returns); oosDates.push(...testBt.dates);
    folds.push({trainFrom:clean[trainStart]?.date,trainTo:clean[trainEnd]?.date,testFrom:clean[testStart]?.date,testTo:clean[testEnd]?.date,fast:best.fast,slow:best.slow,trainSharpe:best.score,testSharpe:testBt.metrics.sharpe,testReturn:testBt.metrics.terminal-1});
    cursor+=test;
  }
  const nav=[]; let v=1; for(const r of oosReturns){v*=1+r;nav.push(v);} const dd=maxDrawdown([1,...nav]);
  const cg=oosReturns.length? v**(252/oosReturns.length)-1:NaN, av=stdev(oosReturns)*Math.sqrt(252);
  return {dates:oosDates,nav,folds,metrics:{cagr:cg,annVol:av,sharpe:sharpe(oosReturns),sortino:sortino(oosReturns),mdd:dd.mdd,calmar:Math.abs(dd.mdd)>0?cg/Math.abs(dd.mdd):NaN,terminal:v},config:{train,test,costBps,slippageBps}};
}
