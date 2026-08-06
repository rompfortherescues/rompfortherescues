export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const body = await request.json();
    const { name, email, phone, qty, notes, event } = body;

    if (!name || !email || !event || !qty) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const feeStr = (event.fee || '$10.00').replace(/[^0-9.]/g, '');
    const unitAmount = Math.round(parseFloat(feeStr) * 100); // cents
    if (isNaN(unitAmount) || unitAmount < 50) {
      return json({ error: 'Invalid fee' }, 400);
    }

    const origin = new URL(request.url).origin;
    const form = new URLSearchParams();
    form.append('mode', 'payment');
    form.append('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    form.append('cancel_url', `${origin}/`);
    form.append('customer_email', email);
    form.append('line_items[0][price_data][currency]', 'usd');
    form.append('line_items[0][price_data][product_data][name]', `${event.name} Registration`);
    form.append('line_items[0][price_data][product_data][description]', `${event.date} ${event.time}`);
    form.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    form.append('line_items[0][quantity]', String(qty));

    // Metadata for the receipt email
    form.append('metadata[name]', name);
    form.append('metadata[email]', email);
    form.append('metadata[phone]', phone || '');
    form.append('metadata[qty]', String(qty));
    form.append('metadata[notes]', notes || '');
    form.append('metadata[event_name]', event.name);
    form.append('metadata[event_date]', event.date || '');
    form.append('metadata[event_time]', event.time || '');
    form.append('metadata[event_location]', (event.locations || []).join(' | '));
    form.append('metadata[event_charity]', event.charity || '');
    form.append('metadata[event_desc]', event.desc || '');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    });

    const session = await stripeRes.json();
    if (session.error) {
      return json({ error: session.error.message }, 400);
    }
    return json({ url: session.url });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}