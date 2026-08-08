import Stripe from 'stripe';
import { Resend } from 'resend';

export async function onRequestPost(context) {
  const { request, env } = context;
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    if (meta.type !== 'registration') {
      return new Response('ok', { status: 200 });
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const amount = (session.amount_total / 100).toFixed(2);
    const html = `
      <h2>Registration Receipt – Romp for the Rescues</h2>
      <p>Thank you for registering and supporting animal charities!</p>
      <p><strong>Event:</strong> ${meta.eventName || '—'}</p>
      <p><strong>Name:</strong> ${meta.name || '—'}</p>
      <p><strong>Email:</strong> ${meta.email || session.customer_email}</p>
      <p><strong>Phone:</strong> ${meta.phone || '—'}</p>
      <p><strong>Attendees:</strong> ${meta.attendees || '1'}</p>
      <p><strong>Amount Paid:</strong> $${amount} ${session.currency?.toUpperCase() || 'USD'}</p>
      <p><strong>Notes:</strong> ${meta.notes || '—'}</p>
      <p><strong>Stripe Session:</strong> ${session.id}</p>
      <p>Please bring this email (or a screenshot) to the event as your receipt.</p>
    `;

    await resend.emails.send({
      from: env.FROM_EMAIL || 'donotreply@RompfortheRescues.org',
      to: meta.email || session.customer_email,
      cc: env.CC_EMAIL || 'rompfortherescues@gmail.com',
      subject: 'receipt',
      html
    });
  }

  return new Response('ok', { status: 200 });
}