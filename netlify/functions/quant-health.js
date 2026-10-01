export default async () => {
  const jsonHeaders = {'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  const base=(process.env.PORTFOLIOOPTIM_API_URL||'').trim().replace(/\/$/,'');
  if(!base) return new Response(JSON.stringify({ok:false,error:'PORTFOLIOOPTIM_API_URL is not configured'}),{status:503,headers:jsonHeaders});
  try{
    const r=await fetch(`${base}/health`,{headers:{accept:'application/json'}});
    const raw=await r.text(); let p={}; try{p=JSON.parse(raw)}catch{}
    if(!r.ok) return new Response(JSON.stringify({ok:false,status:r.status,error:p.detail||p.error||raw.slice(0,160)}),{status:502,headers:jsonHeaders});
    return new Response(JSON.stringify({ok:!!p.ok,engine:p.engine||'PortfolioOPTIM',version:p.version||null,auth_required:p.auth_required??null}),{status:200,headers:jsonHeaders});
  }catch(e){
    return new Response(JSON.stringify({ok:false,error:e.message||String(e)}),{status:502,headers:jsonHeaders});
  }
};
export const config={path:'/api/quant-health'};
