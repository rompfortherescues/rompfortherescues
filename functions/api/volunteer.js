import { Resend } from 'resend';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const body = await request.json();
    const { name, email, phone = '', duty = '', notes = '', event } = body;

    if (!name || !email) {
      return json({ error: 'Name and email required' }, 400);
    }

    const isGeneral = !event || !event.name;
    if (isGeneral && !phone) {
      return json({ error: 'Telephone is required for general volunteering' }, 400);
    }

    const resend = new Resend(env.RESEND_API_KEY);

    let text = `Thank you for volunteering with Romp for the Rescues!\n\n`;
    text += `Name: ${name}\n`;
    text += `Email: ${email}\n`;
    text += `Phone: ${phone || 'N/A'}\n`;
    text += `Preferred Duty: ${duty || 'General'}\n`;

    if (event && event.name) {
      text += `Event: ${event.name}\n`;
      text += `Date: ${event.date || ''} ${event.time || ''}\n`;
    } else {
      text += `Event: General / Any event\n`;
    }
    if (notes) text += `Notes: ${notes}\n`;
    text += `\nWe look forward to your help!\n\nRomp for the Rescues`;

    await resend.emails.send({
      from: 'donotreply@RompfortheRescues.org',
      to: [email],
      cc: ['rompfortherescues@gmail.com'],
      subject: 'volunteer',
      text
    });

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}