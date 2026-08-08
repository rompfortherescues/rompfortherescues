export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { name, email, phone, event, duty } = data;

    if (!name || !email) {
      return Response.json({ error: 'Name and email required' }, { status: 400 });
    }

    const isGeneral = !event || event.startsWith('General');
    if (isGeneral && !phone) {
      return Response.json({ error: 'Phone is required for general volunteering' }, { status: 400 });
    }

    const html = `
      <h2>Volunteer Registration</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
      <p><strong>Event:</strong> ${escapeHtml(event)}</p>
      <p><strong>Duty preference:</strong> ${escapeHtml(duty || 'None specified')}</p>
      <p>Thank you for offering to help Romp for the Rescues!</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'donotreply@RompfortheRescues.org',
        to: [email],
        cc: ['rompfortherescues@gmail.com'],
        subject: 'Volunteer Registration Confirmation',
        html
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.json();
      return Response.json({ error: err.message || 'Email failed' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}