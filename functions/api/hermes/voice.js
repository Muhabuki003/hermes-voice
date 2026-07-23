// Hermes Voice API — CF Pages Function
// Routes under /api/* on the Pages site

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

  // ── Forward voice input to Telegram ──
  if (url.pathname === '/api/hermes/voice' && request.method === 'POST') {
    const formData = await request.formData();
    const text = formData.get('text') || '';
    
    // Mirror to Telegram
    const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = env.TELEGRAM_CHAT_ID || '5470064076';
    
    if (TELEGRAM_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `🎤 **Voice Input**${text ? ': "' + text + '"' : ''}\n\n⏳ Processing...`,
          parse_mode: 'MarkdownV2',
        }),
      }).catch(() => {});
    }
    
    return new Response(JSON.stringify({
      response: `Received${text ? ': "' + text + '"' : ''}`,
      audio_url: null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // ── Mirror action to Telegram ──
  if (url.pathname === '/api/telegram/mirror' && request.method === 'POST') {
    const { text } = await request.json();
    const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = env.TELEGRAM_CHAT_ID || '5470064076';
    
    if (TELEGRAM_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'MarkdownV2' }),
      }).catch(() => {});
    }
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response('Hermes Voice API', { status: 200, headers: corsHeaders });
}
