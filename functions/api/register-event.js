export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { email, name, eventName, date, time, type, fee, location, description, charity } = body;

    if (!email || !eventName) {
      return new Response(JSON.stringify({ error: 'Email and event required' }), { status: 400 });
    }

    // DEMO: In production replace this block with real Stripe Checkout Session + webhook
    // For now we just treat the payment as accepted.

    const subject = `Registration Confirmation – ${eventName}`;
    const html = `
      <h2>Thank you for registering!</h2>
      <p>This is your receipt for <strong>${eventName}</strong>.</p>
      <ul>
        <li><strong>Date:</strong> ${date}</li>
        <li><strong>Time:</strong> ${time}</li>
        <li><strong>Type:</strong> ${type}</li>
        <li><strong>Location:</strong> ${location}</li>
        <li><strong>Fee paid (demo):</strong> ${fee}</li>
        <li><strong>Supporting:</strong> ${charity}</li>
      </ul>
      <p>${description}</p>
      <p>Please bring this email (or a screenshot) to the event.</p>
      <p>See you there!<br>Romp for the Rescues</p>
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
        cc: 'RompfortheRescues@gmail.com',
        subject,
        html
      })
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error('Email failed: ' + err);
    }

    return new Response(JSON.stringify({
      message: `Demo payment accepted. Receipt emailed to ${email}.`
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}