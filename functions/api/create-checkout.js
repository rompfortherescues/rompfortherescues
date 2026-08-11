import Stripe from 'stripe';

export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const body = await request.json();
    const { event, name, email, quantity = 1, phone } = body;
    if (!event || !name || !email) {
      return json({ error: 'Missing fields' }, 400);
    }

    const feeStr = (event.fee || '$10.00').replace(/[^0-9.]/g, '');
    const unitAmount = Math.round(parseFloat(feeStr) * 100);
    if (!unitAmount || unitAmount < 50) {
      return json({ error: 'Invalid fee' }, 400);
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2024-06-20'
    });

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${event.name} – ${event.date}`,
            description: event.description || event.type
          },
          unit_amount: unitAmount
        },
        quantity
      }],
      metadata: {
         type: 'registration',
         event_name: event.name,
         event_date: event.date,
         event_time: event.time || '',
         event_location: event.location || '',
         event_charity: event.charity || '',
         registrant_name: name,
         registrant_phone: phone || '',
         quantity: String(quantity)
      },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/#events`,
      // Helps Stripe send its own receipt once enabled
      payment_intent_data: {
        receipt_email: email
      }
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}