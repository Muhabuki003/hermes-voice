// Hermes Voice API — proxies to live Hermes processing
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: h });

  if (url.pathname === "/api/hermes/voice" && request.method === "POST") {
    try {
      const body = await request.text();
      
      // Forward to the live Hermes bridge on the VPS
      const bridgeUrl = "http://167.233.38.96:9379/api/hermes/voice";
      const resp = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
      });

      if (resp.ok) {
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          headers: { ...h, "Content-Type": "application/json" },
        });
      }

      // Bridge is down — return graceful fallback
      const fallback = body ? JSON.parse(body) : {};
      const text = fallback.text || "";
      return new Response(JSON.stringify({
        response: text ? "Hermes is offline right now. Try again in a moment." : "I can't reach Hermes. Try again."
      }), {
        headers: { ...h, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({
        response: "Connection issue. Trying to reach Hermes..."
      }), {
        headers: { ...h, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Hermes Voice API", { status: 200, headers: h });
}