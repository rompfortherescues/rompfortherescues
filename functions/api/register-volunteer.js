export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { event, duty, name, email, phone } = body;

    if (!email || !name || !event) {
      return new Response(JSON.stringify({ error: 'Name, email and event required' }), { status: 400 });
    }

    const subject = `Volunteer Confirmation – ${event}`;
    const html = `
      <h2>Thank you for volunteering!</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
      <p><strong>Event:</strong> ${event}</p>
      <p><strong>Duty preference:</strong> ${duty || 'General help'}</p>
      <p>We will be in touch with more details. See you at the event!</p>
      <p>Romp for the Rescues</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'donotreply@RompfortheRescues.org',
        to: email,
        cc: 'rompfortherescues@gmail.com',
        subject,
        html
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error('Email failed: ' + err);
    }

    return new Response(JSON.stringify({
      message: `Confirmation emailed to ${email}. Thank you!`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}