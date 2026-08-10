export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { name, email, quantity, eventName, eventDate, eventTime, eventLocation, eventFee, eventType } = data;

    if (!name || !email || !eventName || !eventFee) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    // Parse "$10.00" → 1000 cents
    const feeMatch = String(eventFee).replace(/[^0-9.]/g, '');
    const unitAmount = Math.round(parseFloat(feeMatch) * 100);
    if (isNaN(unitAmount) || unitAmount < 50) {
      return Response.json({ error: 'Invalid fee' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/cancel.html`);
    params.append('customer_email', email);
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', `${eventName} registration`);
    params.append('line_items[0][price_data][product_data][description]', `${eventDate} ${eventTime} · ${eventLocation}`);
    params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.append('line_items[0][quantity]', String(qty));
    // Metadata (all strings)
    params.append('metadata[registrant_name]', name);
    params.append('metadata[event_name]', eventName);
    params.append('metadata[event_date]', eventDate || '');
    params.append('metadata[event_time]', eventTime || '');
    params.append('metadata[event_location]', eventLocation || '');
    params.append('metadata[event_fee]', eventFee);
    params.append('metadata[event_type]', eventType || '');
    params.append('metadata[quantity]', String(qty));
    params.append('metadata[total]', `$${(unitAmount * qty / 100).toFixed(2)}`);

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      return Response.json({ error: session.error?.message || 'Stripe error' }, { status: 500 });
    }

    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}