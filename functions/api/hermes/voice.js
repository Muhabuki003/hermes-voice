export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: h });
  if (url.pathname === '/api/hermes/voice' && request.method === 'POST') {
    try {
      const ct = request.headers.get('content-type') || '';
      let t = '';
      if (ct.includes('json')) {
        const b = await request.json();
        t = b.text || '';
      } else {
        const fd = await request.formData();
        t = fd.get('text') || '';
      }
      return new Response(JSON.stringify({ response: t || 'ok', audio_url: null }), {
        headers: { ...h, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...h, 'Content-Type': 'application/json' },
      });
    }
  }
  return new Response('Hermes Voice API', { status: 200, headers: h });
}