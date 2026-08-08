import { Resend } from 'resend';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const resend = new Resend(env.RESEND_API_KEY);

    const eventLine = body.eventName
      ? `<p><strong>Event:</strong> ${body.eventName}</p>`
      : `<p><strong>Event:</strong> General / No specific event</p>`;

    const html = `
      <h2>Volunteer Confirmation – Romp for the Rescues</h2>
      <p>Thank you for volunteering!</p>
      ${eventLine}
      <p><strong>Name:</strong> ${body.name}</p>
      <p><strong>Email:</strong> ${body.email}</p>
      <p><strong>Phone:</strong> ${body.phone || '—'}</p>
      <p><strong>Preferred Duty:</strong> ${body.duty || 'Any / General'}</p>
      <p><strong>Notes:</strong> ${body.notes || '—'}</p>
      <p>Please bring this email (or a screenshot) if needed. See you there!</p>
    `;

    await resend.emails.send({
      from: env.FROM_EMAIL || 'donotreply@RompfortheRescues.org',
      to: body.email,
      cc: env.CC_EMAIL || 'rompfortherescues@gmail.com',
      subject: 'receipt',
      html
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}