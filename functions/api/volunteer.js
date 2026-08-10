import { Resend } from 'resend';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const body = await request.json();
    const { name, email, phone, duty, event } = body;
    if (!name || !email) return json({ error: 'Name and email required' }, 400);
    if (!event && !phone) return json({ error: 'Phone required for general volunteering' }, 400);

    const resend = new Resend(env.RESEND_API_KEY);

    const eventLine = event ? `<p><strong>Event:</strong> ${event}</p>` : '<p><strong>Event:</strong> General / any</p>';
    const dutyLine = duty ? `<p><strong>Preferred duty:</strong> ${duty}</p>` : '';
    const phoneLine = phone ? `<p><strong>Phone:</strong> ${phone}</p>` : '';

    const html = `
      <h2>Volunteer Confirmation – Romp for the Rescues</h2>
      <p>Thank you, ${name}!</p>
      ${eventLine}
      ${dutyLine}
      ${phoneLine}
      <p>Email: ${email}</p>
      <p>We look forward to seeing you. No further action needed.</p>
      <p>– Romp for the Rescues</p>
    `;

    await resend.emails.send({
      from: 'Romp for the Rescues <donotreply@RompfortheRescues.org>',
      to: [email],
      cc: ['rompfortherescues@gmail.com'],
      subject: event ? `Volunteer confirmation – ${event}` : 'Volunteer confirmation – General',
      html
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