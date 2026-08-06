export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, email, phone, duty, event } = body;

    if (!name || !email) {
      return json({ error: 'Name and email required' }, 400);
    }
    if (!event && !phone) {
      return json({ error: 'Phone is required for general volunteering' }, 400);
    }

    const subject = event
      ? `Volunteer Confirmation – ${event}`
      : 'General Volunteer Confirmation – Romp for the Rescues';

    const html = `
      <h2>Volunteer Registration Receipt</h2>
      <p>Thank you for volunteering with Romp for the Rescues!</p>
      <ul>
        <li><strong>Name:</strong> ${escape(name)}</li>
        <li><strong>Email:</strong> ${escape(email)}</li>
        <li><strong>Phone:</strong> ${escape(phone || 'Not provided')}</li>
        <li><strong>Event:</strong> ${escape(event || 'General (no specific event)')}</li>
        <li><strong>Preferred Duty:</strong> ${escape(duty || 'None specified')}</li>
      </ul>
      <p>We look forward to seeing you!</p>
      <p><em>This is an automated message. Do not reply.</em></p>
    `;

    await sendResend(env, {
      from: 'donotreply@RompfortheRescues.org',
      to: email,
      cc: ['rompfortherescues@gmail.com'],
      subject,
      html
    });

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: err.message || 'Server error' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendResend(env, opts) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(opts)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend error: ${t}`);
  }
}