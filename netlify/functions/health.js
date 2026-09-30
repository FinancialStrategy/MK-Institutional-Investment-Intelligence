export async function handler() {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      ok: true,
      service: "mk-institutional-investment-intelligence",
      timestamp: new Date().toISOString()
    })
  };
}
