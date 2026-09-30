export default async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'POST required'}), {status:405, headers:{'content-type':'application/json'}});
  const base = process.env.PYPORTFOLIOOPT_API_URL;
  if (!base) return new Response(JSON.stringify({error:'PyPortfolioOpt service is not configured. Set PYPORTFOLIOOPT_API_URL.'}), {status:503, headers:{'content-type':'application/json'}});
  try {
    const body = await req.text();
    const r = await fetch(`${base.replace(/\/$/,'')}/optimize`, {method:'POST', headers:{'content-type':'application/json'}, body});
    const text = await r.text();
    return new Response(text, {status:r.status, headers:{'content-type':'application/json','cache-control':'no-store'}});
  } catch (e) {
    return new Response(JSON.stringify({error:`Optimizer proxy failed: ${e.message}`}), {status:502, headers:{'content-type':'application/json'}});
  }
};
