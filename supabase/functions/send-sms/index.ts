const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SMS_API_TOKEN = Deno.env.get('SMS_API_TOKEN') ?? '';
const SMS_SENDER_ID = Deno.env.get('SMS_SENDER_ID') ?? 'AGENCY';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('94')) return digits;
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  return '94' + digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, message } = await req.json()

    if (!to || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const recipient = normalizePhone(String(to))

    const response = await fetch('https://app.text.lk/api/v3/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SMS_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        recipient,
        sender_id: SMS_SENDER_ID,
        message,
        type: 'plain',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[send-sms] API error:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: 'SMS API error', details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[send-sms] Sent to', recipient)
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[send-sms] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
