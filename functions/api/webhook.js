import { sendEmail } from '../lib/email.js';
import { constructEvent } from '../lib/stripe-verify.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;
  try {
    event = await constructEvent(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};

    if (meta.type === 'registration') {
      const body = `Thank you for registering for a Romp for the Rescues event!\n\n` +
        `Event: ${meta.event_name || ''}\n` +
        `Date: ${meta.event_date || ''} ${meta.event_time || ''}\n` +
        `Fee: ${meta.event_fee || ''}\n` +
        `Quantity: ${meta.quantity || '1'}\n` +
        `Name: ${meta.name || ''}\n` +
        `Email: ${meta.email || ''}\n` +
        `Phone: ${meta.phone || 'N/A'}\n\n` +
        `Please bring this receipt (or show this email) to the event.\n\n` +
        `Romp for the Rescues`;

      try {
        await sendEmail(env, {
          from: 'donotreply@RompfortheRescues.org',
          to: [meta.email],
          cc: ['RompfortheRescues@gmail.com'],
          subject: 'receipt',
          text: body
        });
      } catch (emailErr) {
        console.error('Email send failed', emailErr);
        // Still return 200 so Stripe does not retry endlessly
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}