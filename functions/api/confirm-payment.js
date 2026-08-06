export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  if (!sessionId) return json({ ok: false, error: 'Missing session_id' }, 400);

  try {
    const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    const session = await stripeRes.json();

    if (session.payment_status !== 'paid') {
      return json({ ok: false, error: 'Payment not completed' });
    }

    const m = session.metadata || {};
    const htmlBody = `
      <h2>Registration Receipt</h2>
      <p>Thank you for registering with <strong>Romp for the Rescues</strong>!</p>
      <p><strong>Name:</strong> ${escape(m.name)}<br>
         <strong>Email:</strong> ${escape(m.email)}<br>
         <strong>Phone:</strong> ${escape(m.phone) || '—'}<br>
         <strong>Tickets:</strong> ${escape(m.qty)}</p>
      <h3>Event Details</h3>
      <p><strong>${escape(m.event_name)}</strong><br>
         ${escape(m.event_date)} · ${escape(m.event_time)}<br>
         ${escape(m.event_location)}<br>
         Supporting: ${escape(m.event_charity)}</p>
      <p>${escape(m.event_desc)}</p>
      ${m.notes ? `<p><strong>Notes:</strong> ${escape(m.notes)}</p>` : ''}
      <p>Please bring this email (or a screenshot) to the event.</p>
      <p>— Romp for the Rescues</p>
    `;

    // Send receipt via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'donotreply@RompfortheRescues.org',
        to: [m.email],
        cc: ['rompfortherescues@gmail.com'],
        subject: 'receipt',
        html: htmlBody
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error', err);
      // Still return ok so user sees success; you will see the CC
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