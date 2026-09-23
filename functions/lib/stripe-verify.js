function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function constructEvent(payload, signatureHeader, secret) {
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');

  const elements = signatureHeader.split(',').map(part => part.split('='));
  const timestamp = elements.find(([k]) => k === 't')?.[1];
  const signatures = elements.filter(([k]) => k === 'v1').map(([, v]) => v);

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid Stripe-Signature header');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    throw new Error('Timestamp outside the tolerance zone');
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedPayload = encoder.encode(`${timestamp}.${payload}`);

  let valid = false;
  for (const sig of signatures) {
    try {
      const sigBytes = hexToBytes(sig);
      if (await crypto.subtle.verify('HMAC', key, sigBytes, signedPayload)) {
        valid = true;
        break;
      }
    } catch (_) { /* continue */ }
  }

  if (!valid) throw new Error('Invalid signature');

  return JSON.parse(payload);
}