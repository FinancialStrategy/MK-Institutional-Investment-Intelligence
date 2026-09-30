const ALLOWED_RANGES = new Set(["1mo","3mo","6mo","1y","2y","5y","10y","max"]);
const ALLOWED_INTERVALS = new Set(["1d","1wk"]);

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": statusCode === 200 ? "public, max-age=300" : "no-store"
    },
    body: JSON.stringify(payload)
  };
}

export async function handler(event) {
  try {
    const ticker = String(event.queryStringParameters?.ticker || "AAPL").trim();
    const range = String(event.queryStringParameters?.range || "2y").trim();
    const interval = String(event.queryStringParameters?.interval || "1d").trim();

    if (!ticker || ticker.length > 32) return json(400, { error: "Invalid ticker" });
    if (!ALLOWED_RANGES.has(range)) return json(400, { error: "Unsupported range" });
    if (!ALLOWED_INTERVALS.has(interval)) return json(400, { error: "Unsupported interval" });

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includeAdjustedClose=true&events=div%2Csplits`;
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 MKInstitutional/0.1",
        "accept": "application/json,text/plain,*/*"
      }
    });

    if (!response.ok) {
      return json(response.status, { error: `Yahoo Finance upstream error ${response.status}` });
    }

    const raw = await response.json();
    const result = raw?.chart?.result?.[0];
    if (!result) return json(502, { error: raw?.chart?.error?.description || "No Yahoo Finance result" });

    const q = result.indicators?.quote?.[0] || {};
    const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    const timestamps = result.timestamp || [];

    const rows = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? null,
      high: q.high?.[i] ?? null,
      low: q.low?.[i] ?? null,
      close: q.close?.[i] ?? null,
      adjClose: adj?.[i] ?? q.close?.[i] ?? null,
      volume: q.volume?.[i] ?? null
    })).filter(r => [r.open,r.high,r.low,r.close].every(Number.isFinite));

    return json(200, {
      source: "Yahoo Finance",
      ticker,
      currency: result.meta?.currency || null,
      exchange: result.meta?.exchangeName || null,
      timezone: result.meta?.exchangeTimezoneName || null,
      dataThrough: rows.at(-1)?.date || null,
      regularMarketPrice: result.meta?.regularMarketPrice ?? null,
      rows
    });
  } catch (err) {
    return json(500, { error: err?.message || "Unhandled server error" });
  }
}
