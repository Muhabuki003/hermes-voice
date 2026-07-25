export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const h = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  if (request.method === "OPTIONS") return new Response("", { status: 204, headers: h });
  if (url.pathname !== "/api/hermes/voice" || request.method !== "POST") {
    return new Response("Hermes Voice API", { status: 200, headers: h });
  }
  try {
    const body = await request.text();
    const resp = await fetch("https://rpm-democrat-adapter-foto.trycloudflare.com/api/hermes/voice", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
      signal: AbortSignal.timeout(90000)
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    return new Response(JSON.stringify(data), { headers: { ...h, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ response: "Hermes is offline. Try again." }), {
      headers: { ...h, "Content-Type": "application/json" },
    });
  }
}