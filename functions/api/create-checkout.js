export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { name, email, phone = '', quantity = 1, event } = data;

    if (!name || !email || !event || !event.fee || !event.name) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const feeNum = parseFloat(String(event.fee).replace(/[^0-9.]/g, ''));
    if (isNaN(feeNum) || feeNum <= 0) {
      return json({ error: 'Invalid fee' }, 400);
    }

    const unitAmount = Math.round(feeNum * 100); // cents
    const origin = request.headers.get('Origin') || 'https://rompfortherescues.org';

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/?success=true`);
    params.append('cancel_url', `${origin}/?canceled=true`);
    params.append('customer_email', email);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.append('line_items[0][price_data][product_data][name]', `Registration: ${event.name}`);
    params.append('line_items[0][price_data][product_data][description]', `${event.date || ''} ${event.time || ''}`.trim());
    params.append('line_items[0][quantity]', String(Math.max(1, quantity)));

    // Metadata (kept under limits)
    params.append('metadata[name]', name.substring(0, 400));
    params.append('metadata[email]', email.substring(0, 400));
    params.append('metadata[phone]', (phone || '').substring(0, 100));
    params.append('metadata[event_name]', event.name.substring(0, 200));
    params.append('metadata[event_date]', (event.date || '').substring(0, 100));
    params.append('metadata[event_time]', (event.time || '').substring(0, 50));
    params.append('metadata[event_fee]', event.fee.substring(0, 50));
    params.append('metadata[quantity]', String(quantity));
    params.append('metadata[type]', 'registration');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const session = await stripeRes.json();
    if (session.error) {
      return json({ error: session.error.message }, 400);
    }

    return json({ url: session.url });
  } catch (err) {
    return json({ error: err.message || 'Server error' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}