export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const { name, email, phone, qty, eventName, fee, date, time, location } = body;

    if (!name || !email || !eventName) {
      return json({ error: 'Name, email and event required' }, 400);
    }

    const subject = 'receipt';
    const html = `
      <h2>Event Registration Receipt</h2>
      <p>Thank you for registering with Romp for the Rescues!</p>
      <h3>Event Details</h3>
      <ul>
        <li><strong>Event:</strong> ${escape(eventName)}</li>
        <li><strong>Date:</strong> ${escape(date)}</li>
        <li><strong>Time:</strong> ${escape(time)}</li>
        <li><strong>Location:</strong> ${escape(location)}</li>
        <li><strong>Fee:</strong> ${escape(fee)} × ${escape(qty)} = total due at Stripe (demo)</li>
      </ul>
      <h3>Your Information</h3>
      <ul>
        <li><strong>Name:</strong> ${escape(name)}</li>
        <li><strong>Email:</strong> ${escape(email)}</li>
        <li><strong>Phone:</strong> ${escape(phone || 'Not provided')}</li>
        <li><strong>Attendees:</strong> ${escape(qty)}</li>
      </ul>
      <p>Please bring this email (or a screenshot) to the event.</p>
      <p><em>Demo mode – no payment was processed. In production this email is sent only after Stripe confirms payment.</em></p>
      <p>Do not reply to this address.</p>
    `;

    await sendResend(env, {
      from: 'donotreply@RompfortheRescues.org',
      to: email,
      cc: ['RompfortheRescues@gmail.com'],
      subject,
      html
    });

    // Production: create Stripe Checkout Session here and return { checkoutUrl }
    // For demo we just confirm the email was sent.
    return json({ success: true, demo: true });
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