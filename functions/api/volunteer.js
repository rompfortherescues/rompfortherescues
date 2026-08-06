export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { name, email, phone, event, duty, notes, isGeneral } = body;

    if (!name || !email) {
      return json({ ok: false, error: 'Name and email required' }, 400);
    }
    if (isGeneral && !phone) {
      return json({ ok: false, error: 'Phone required for general volunteering' }, 400);
    }

    const htmlBody = `
      <h2>Volunteer Registration Receipt</h2>
      <p>Thank you for volunteering with <strong>Romp for the Rescues</strong>!</p>
      <p><strong>Name:</strong> ${escape(name)}<br>
         <strong>Email:</strong> ${escape(email)}<br>
         <strong>Phone:</strong> ${escape(phone) || '—'}<br>
         <strong>Event:</strong> ${event ? escape(event) : 'General / No specific event'}<br>
         <strong>Duty Preference:</strong> ${escape(duty) || '—'}<br>
         ${notes ? `<strong>Notes:</strong> ${escape(notes)}` : ''}</p>
      <p>We will be in touch with further details.</p>
      <p>— Romp for the Rescues</p>
    `;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'donotreply@RompfortheRescues.org',
        to: [email],
        cc: ['rompfortherescues@gmail.com'],
        subject: 'receipt',
        html: htmlBody
      })
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      return json({ ok: false, error: 'Email failed: ' + errText }, 500);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}

function escape(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}