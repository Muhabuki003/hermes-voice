const MODEL = 'claude-opus-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TURNS = 20;

const SYSTEM = `You are Hermes, a voice assistant. Your replies are spoken aloud by a
text-to-speech engine, so write the way a person talks.

- Keep answers to one to three sentences unless the user asks for depth.
- Plain prose only: no markdown, no bullet points, no headings, no emoji, no code fences.
- Write numbers, dates and units the way they should be read out loud.
- If you need something from the user, ask one short question and stop.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Keep only well-formed turns and cap how much history we replay to the model.
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .filter((m) => typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
    .slice(-MAX_TURNS);
  // The API requires the first message in the array to be from the user.
  while (turns.length && turns[0].role !== 'user') turns.shift();
  return turns;
}

async function readRequest(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('json')) {
    const b = await request.json();
    return { text: b.text || '', history: b.history };
  }
  const fd = await request.formData();
  let history = [];
  try {
    history = JSON.parse(fd.get('history') || '[]');
  } catch (_) {}
  return { text: fd.get('text') || '', history };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 204 must carry a null body — an empty string is rejected by strict runtimes.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (url.pathname !== '/api/hermes/voice' || request.method !== 'POST') {
    return new Response('Hermes Voice API', { status: 200, headers: CORS });
  }

  try {
    const { text, history } = await readRequest(request);
    if (!text.trim()) return json({ error: 'No text provided.' }, 400);

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY is not set on this deployment.' }, 500);
    }

    const messages = [...sanitizeHistory(history), { role: 'user', content: text.trim() }];

    const upstream = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        // Route policy declines to the recommended fallback model instead of
        // handing the caller an empty answer.
        'anthropic-beta': 'server-side-fallback-2026-07-01',
      },
      body: JSON.stringify({
        model: env.HERMES_MODEL || MODEL,
        max_tokens: 1024,
        // Voice wants low latency; low effort still thinks, just briefly.
        output_config: { effort: 'low' },
        fallbacks: 'default',
        system: SYSTEM,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = (data && data.error && data.error.message) || `Upstream error ${upstream.status}`;
      return json({ error: msg }, upstream.status);
    }

    if (data.stop_reason === 'refusal') {
      return json({ response: "I can't help with that one.", refused: true });
    }

    const reply = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return json({ response: reply || '...', model: data.model });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
