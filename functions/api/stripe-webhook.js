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
      const body = `Thank you for registering for a Romp for the Rescues event!

Event: ${meta.event_name || ''}
Date: ${meta.event_date || ''} ${meta.event_time || ''}
Fee: ${meta.event_fee || meta.fee || ''}
Quantity: ${meta.quantity || '1'}
Name: ${meta.registrant_name || meta.name || ''}
Email: ${session.customer_email || meta.email || ''}
Phone: ${meta.registrant_phone || meta.phone || 'N/A'}
${meta.event_location ? `Location(s): ${meta.event_location}\n` : ''}
${meta.event_charity ? `Supporting: ${meta.event_charity}\n` : ''}
Please bring this receipt (or show this email) to the event.

Romp for the Rescues
hello@RompfortheRescues.org`;

      try {
        // Buyer
        await sendEmail(env, {
          from: 'hello@RompfortheRescues.org',
          to: [session.customer_email || meta.email],
          subject: 'receipt',
          text: body
        });
        // Organization
        await sendEmail(env, {
          from: 'hello@RompfortheRescues.org',
          to: ['rompfortherescues@gmail.com'],
          subject: 'New Registration – ' + (meta.event_name || ''),
          text: body
        });
      } catch (emailErr) {
        console.error('Email send failed', emailErr);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}