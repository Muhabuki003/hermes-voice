// Hermes Voice API
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

  if (url.pathname === '/api/hermes/voice' && request.method === 'POST') {
    try {
      const contentType = request.headers.get('content-type') || '';
      let text = '';
      if (contentType.includes('json')) {
        const body = await request.json();
        text = body.text || '';
      } else {
        const fd = await request.formData();
        text = fd.get('text') || '';
      }

      const TOKEN = env.TELEGRAM_BOT_TOKEN;
      const CHAT = env.TELEGRAM_CHAT_ID || '5470064076';

      if (TOKEN && text) {
        fetch('https://api.telegram.org/bot' + TOKEN + '/sendMessage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT,
            text: '\uD83C\uDFA4 Voice: ' + text,
          }),
        }).catch(function(){});
      }

      return new Response(JSON.stringify({ response: text || 'ok', audio_url: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Hermes Voice API', { status: 200, headers: corsHeaders });
}