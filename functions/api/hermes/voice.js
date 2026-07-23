// Hermes Voice API v2 — forwards to Telegram for processing
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders });
  }

  // Voice input → Telegram
  if (url.pathname === '/api/hermes/voice' && request.method === 'POST') {
    try {
      const ct = request.headers.get('content-type') || '';
      let text = '';
      if (ct.includes('json')) {
        const body = await request.json();
        text = body.text || '';
      } else {
        const fd = await request.formData();
        text = fd.get('text') || '';
      }

      const TOKEN=env.TE...KEN;
      const CHAT = env.TELEGRAM_CHAT_ID || '5470064076';

      if (TOKEN && text) {
        // Send to Adrien's Telegram — Hermes sees and responds here
        fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT,
            text: '\uD83C\uDFA4 **Voice:** ' + text + '\n\n_Reply to this and I\'ll respond through the voice app._',
            parse_mode: 'MarkdownV2',
          }),
        }).catch(function(){});
      }

      // Return a "sent to Hermes" response
      return new Response(JSON.stringify({
        response: text ? 'Sent to Hermes: "' + text + '"' : 'No text received',
        audio_url: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Hermes responds back through here
  if (url.pathname === '/api/hermes/respond' && request.method === 'POST') {
    try {
      const body = await request.json();
      // This endpoint is called by Hermes to push TTS audio back
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Hermes Voice API', { status: 200, headers: corsHeaders });
}
