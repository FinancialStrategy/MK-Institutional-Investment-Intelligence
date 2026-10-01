export default async (req) => {
  const jsonHeaders = {'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'POST required'}), {status:405, headers:jsonHeaders});
  const base = (process.env.PORTFOLIOOPTIM_API_URL || '').trim().replace(/\/$/,'');
  const secret = (process.env.QUANT_SERVICE_SECRET || '').trim();
  if (!base) return new Response(JSON.stringify({error:'PortfolioOPTIM service is not configured. Set PORTFOLIOOPTIM_API_URL.'}), {status:503, headers:jsonHeaders});
  if (!secret) return new Response(JSON.stringify({error:'Quant service authentication is not configured. Set QUANT_SERVICE_SECRET in Netlify.'}), {status:503, headers:jsonHeaders});
  const u = new URL(req.url);
  const action = (u.searchParams.get('action') || '').trim();
  if (!['walkforward','robustness'].includes(action)) return new Response(JSON.stringify({error:'Unsupported advanced PortfolioOPTIM action.'}), {status:400, headers:jsonHeaders});
  try {
    const body = await req.text();
    const r = await fetch(`${base}/${action}`, {
      method:'POST',
      headers:{'content-type':'application/json','accept':'application/json','authorization':`Bearer ${secret}`},
      body
    });
    const text = await r.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = {error:`PortfolioOPTIM returned non-JSON (HTTP ${r.status}).`, upstream_preview:text.slice(0,180)}; }
    return new Response(JSON.stringify(payload), {status:r.status, headers:jsonHeaders});
  } catch (e) {
    return new Response(JSON.stringify({error:`PortfolioOPTIM advanced proxy failed: ${e.message}`}), {status:502, headers:jsonHeaders});
  }
};
export const config={path:'/api/portfolio-advanced'};
