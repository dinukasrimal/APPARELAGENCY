const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? '';
const SMS_API_TOKEN = Deno.env.get('SMS_API_TOKEN') ?? '';
const SMS_SENDER_ID = Deno.env.get('SMS_SENDER_ID') ?? 'AGENCY';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('94')) return digits;
  if (digits.startsWith('0')) return '94' + digits.slice(1);
  return '94' + digits;
}

async function sendSms(to: string, message: string) {
  const recipient = normalizePhone(to);
  const res = await fetch('https://app.text.lk/api/v3/sms/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SMS_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ recipient, sender_id: SMS_SENDER_ID, message, type: 'plain' }),
  });
  const data = await res.json();
  if (!res.ok) console.error('[birthday-sms] SMS error:', JSON.stringify(data));
  else console.log('[birthday-sms] Sent to', recipient);
}

Deno.serve(async (_req) => {
  try {
    // Find customers whose birthday month and day match today (Sri Lanka time UTC+5:30)
    const nowUtc = new Date();
    const sriLankaOffset = 5.5 * 60 * 60 * 1000;
    const today = new Date(nowUtc.getTime() + sriLankaOffset);
    const todayMonth = today.getUTCMonth() + 1; // 1–12
    const todayDay = today.getUTCDate();         // 1–31

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/customers?select=name,phone,shop_owner_birthday&shop_owner_birthday=not.is.null`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[birthday-sms] DB fetch error:', err);
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }

    const customers: Array<{ name: string; phone: string | null; shop_owner_birthday: string }> = await res.json();

    const birthdayCustomers = customers.filter(c => {
      if (!c.shop_owner_birthday || !c.phone) return false;
      const bday = new Date(c.shop_owner_birthday);
      return (bday.getUTCMonth() + 1) === todayMonth && bday.getUTCDate() === todayDay;
    });

    console.log(`[birthday-sms] Found ${birthdayCustomers.length} birthdays today (${todayDay}/${todayMonth})`);

    for (const customer of birthdayCustomers) {
      const message = `Dear ${customer.name}, wishing you a very Happy Birthday from all of us at DAG Clothing Pvt Ltd! May this special day bring you joy, happiness, and wonderful moments. Thank you for being our valued customer. Have a fantastic birthday! 🎂`;
      await sendSms(customer.phone!, message);
    }

    return new Response(
      JSON.stringify({ success: true, sent: birthdayCustomers.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[birthday-sms] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
