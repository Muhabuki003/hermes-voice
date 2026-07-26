// Text-to-speech for Hermes.
//
// Browser speechSynthesis is unreliable — it is silent on many mobile
// browsers and its voice list is whatever the device happens to ship. This
// endpoint returns real audio bytes so playback is the same everywhere.
//
// Providers, in priority order:
//   1. ElevenLabs        — set ELEVENLABS_API_KEY. Best quality.
//   2. Workers AI (Aura) — bind `AI` in Pages settings. No extra vendor.
// If neither is configured we return 501 and the client falls back to
// browser speech.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Daniel — British, male, authoritative. The closest stock voice to Jarvis.
const ELEVEN_VOICE = 'onwK4e9ZLuTAKqWW03F9';
const ELEVEN_MODEL = 'eleven_turbo_v2_5';

// Deepgram Aura 2 "draco" — British, male, calm and authoritative.
const AURA_MODEL = '@cf/deepgram/aura-2-en';
const AURA_VOICE = 'draco';

const MAX_CHARS = 1800;

function err(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function audio(body, type = 'audio/mpeg') {
  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': type,
      'Cache-Control': 'private, max-age=300',
    },
  });
}

async function viaElevenLabs(env, text) {
  const voice = env.ELEVENLABS_VOICE_ID || ELEVEN_VOICE;
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: env.ELEVENLABS_MODEL_ID || ELEVEN_MODEL,
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.15 },
      }),
    }
  );

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`ElevenLabs ${r.status}: ${detail.slice(0, 200)}`);
  }
  return audio(r.body);
}

async function viaWorkersAI(env, text) {
  const out = await env.AI.run(AURA_MODEL, {
    text,
    speaker: env.HERMES_VOICE || AURA_VOICE,
    encoding: 'mp3',
  });

  // The binding has returned different shapes across model versions —
  // accept a stream, a buffer, or base64 rather than assuming one.
  if (out instanceof ReadableStream) return audio(out);
  if (out instanceof ArrayBuffer) return audio(out);
  if (out && typeof out.audio === 'string') {
    const bin = atob(out.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return audio(bytes);
  }
  if (out && out.body) return audio(out.body);
  throw new Error('Workers AI returned an unrecognized audio payload.');
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return err('POST only.', 405);

  let text = '';
  try {
    const body = await request.json();
    text = (body.text || '').trim().slice(0, MAX_CHARS);
  } catch (_) {
    return err('Invalid JSON body.', 400);
  }
  if (!text) return err('No text provided.', 400);

  try {
    if (env.ELEVENLABS_API_KEY) return await viaElevenLabs(env, text);
    if (env.AI) return await viaWorkersAI(env, text);
    return err('No TTS provider configured on this deployment.', 501);
  } catch (e) {
    return err(e.message, 502);
  }
}
