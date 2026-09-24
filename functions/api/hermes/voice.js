// Voice proxy for the Hermes voice page.
//
// The page POSTs { text, history } here; this forwards it to the voice bridge on
// the VPS and hands the bridge's JSON straight back.
//
// Targets, in order — both land on the bridge (127.0.0.1:9379) on the VPS:
//   1. https://hermes-api.bookistudios.com/api/hermes/voice
//      Named Cloudflare tunnel BOOKISTUDIO -> 127.0.0.1:9379. Stable: a named
//      tunnel does not expire the way a `trycloudflare` quick tunnel does.
//   2. https://lazusai.com/api/hermes/voice
//      Kept as a fallback only.
//
// History of this file, so nobody re-breaks it:
//   - v1 pointed at a trycloudflare quick tunnel. It expired and every reply
//     became an empty 200.
//   - v2 pointed at lazusai.com. That hostname is served by the Lazusai app,
//     not by the bridge, so it answers 403
//     {"error":"no_credentials_configured","client_id":"hermes"} — a 200 to the
//     page with no `response` field, which the page renders as a bare "…".
//     That is exactly what users saw: instant replies that were just "…".
// Hence the explicit "did we actually get a reply" test below: an unusable
// upstream now returns a real 502 with the upstream's own message, so a wrong
// target shows up as a visible error instead of a plausible-looking ellipsis.

const TARGETS = [
  'https://hermes-api.bookistudios.com/api/hermes/voice',
  'https://lazusai.com/api/hermes/voice',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const reply = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

// A usable bridge answer: real text, or real audio, or a voice command
// ("hide voice text" legitimately comes back as response:"" + command).
function usable(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.command) return true;
  if (typeof data.response === 'string' && data.response.trim()) return true;
  return !!data.audio_url;
}

export async function onRequest(c) {
  const r = c.request;
  const u = new URL(r.url);

  if (r.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (u.pathname !== '/api/hermes/voice' || r.method !== 'POST')
    return new Response('HVA', { status: 200, headers: CORS });

  const body = await r.text();
  const problems = [];

  for (const target of TARGETS) {
    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(75000),
      });
      const data = await upstream.json().catch(() => null);
      if (upstream.ok && usable(data)) return reply(data);
      problems.push(`${target} -> ${upstream.status} ${JSON.stringify(data).slice(0, 140)}`);
    } catch (e) {
      problems.push(`${target} -> ${(e && e.message) || e}`);
    }
  }

  return reply({ error: 'voice backend returned no reply', detail: problems }, 502);
}
