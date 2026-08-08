import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);

    const unitAmount = Math.round(parseFloat(body.price || '0') * 100);
    const qty = Math.max(1, parseInt(body.attendees || '1', 10));

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Registration – ${body.eventName}`,
            description: `Romp for the Rescues event registration`
          },
          unit_amount: unitAmount
        },
        quantity: qty
      }],
      customer_email: body.email,
      success_url: `${new URL(request.url).origin}/?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${new URL(request.url).origin}/?canceled=1`,
      metadata: {
        type: 'registration',
        eventId: body.eventId || '',
        eventName: body.eventName || '',
        name: body.name || '',
        email: body.email || '',
        phone: body.phone || '',
        attendees: String(qty),
        notes: body.notes || ''
      }
    });

    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}