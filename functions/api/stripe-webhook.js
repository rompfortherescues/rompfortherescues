import Stripe from 'stripe';
import { Resend } from 'resend';

export async function onRequestPost(context) {
  const { request, env } = context;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20'
  });

  const signature = request.headers.get('stripe-signature');
  const body = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const email = session.customer_email || session.customer_details?.email;
    const amount = (session.amount_total / 100).toFixed(2);

    if (!email) {
      console.error('No email on session');
      return new Response('ok', { status: 200 });
    }

    const resend = new Resend(env.RESEND_API_KEY);

    const htmlBuyer = `
      <h2>Receipt – Romp for the Rescues</h2>
      <p>Thank you for registering!</p>
      <p><strong>Event:</strong> ${meta.event_name || 'Event'}</p>
      <p><strong>Date:</strong> ${meta.event_date || ''} ${meta.event_time || ''}</p>
      <p><strong>Location:</strong> ${meta.event_location || ''}</p>
      <p><strong>Supports:</strong> ${meta.event_charity || ''}</p>
      <p><strong>Name:</strong> ${meta.registrant_name || ''}</p>
      <p><strong>Tickets:</strong> ${meta.quantity || 1}</p>
      <p><strong>Amount paid:</strong> $${amount} USD</p>
      <p>Please bring this email (or a screenshot) to the event.</p>
      <p>– Romp for the Rescues · hello@RompfortheRescues.org</p>
    `;

    // Buyer receipt
    await resend.emails.send({
      from: 'Romp for the Rescues <hello@RompfortheRescues.org>',
      to: [email],
      subject: 'receipt',
      html: htmlBuyer
    });

    // Business notification
    await resend.emails.send({
      from: 'Romp for the Rescues <hello@RompfortheRescues.org>',
      to: ['rompfortherescues@gmail.com'],
      subject: `Payment received – ${meta.event_name || 'Event'} – $${amount}`,
      html: htmlBuyer + `<hr><p>Stripe session: ${session.id}</p>`
    });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}