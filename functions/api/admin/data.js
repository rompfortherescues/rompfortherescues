let cachedKeys;
let cachedKeysAt = 0;

const jsonResponse = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }
});

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessKeys(issuer) {
  if (cachedKeys && Date.now() - cachedKeysAt < 5 * 60 * 1000) return cachedKeys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Could not retrieve Cloudflare Access signing keys.');
  const result = await response.json();
  cachedKeys = result.keys || [];
  cachedKeysAt = Date.now();
  return cachedKeys;
}

async function verifyAccessToken(request, env) {
  const configuredDomain = env.CF_ACCESS_TEAM_DOMAIN;
  const audience = env.CF_ACCESS_AUD;
  if (!configuredDomain || !audience) return false;

  const host = configuredDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const issuer = `https://${host}`;
  const token = request.headers.get('CF-Access-Jwt-Assertion');
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const header = decodeJsonPart(parts[0]);
  const claims = decodeJsonPart(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) return false;

  const now = Math.floor(Date.now() / 1000);
  const tokenAudiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== issuer || !tokenAudiences.includes(audience) || !claims.exp || claims.exp <= now) return false;
  if (claims.nbf && claims.nbf > now) return false;

  const jwk = (await getAccessKeys(issuer)).find((key) => key.kid === header.kid);
  if (!jwk) return false;
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(parts[2]), signedContent);
}

export async function onRequestPost({ request, env }) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return jsonResponse({ error: 'Admin saving is not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.' }, 503);
  }

  let authorized = false;
  try {
    authorized = await verifyAccessToken(request, env);
  } catch {
    return jsonResponse({ error: 'Could not verify Cloudflare Access credentials.' }, 401);
  }
  if (!authorized) return jsonResponse({ error: 'Cloudflare Access authorization is required.' }, 401);

  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return jsonResponse({ error: 'Requests must come from this site.' }, 403);
  }

  if (!request.headers.get('If-Match')) return jsonResponse({ error: 'Reload data.xml before saving.' }, 428);
  const requestedLength = Number(request.headers.get('Content-Length') || 0);
  if (requestedLength > 1024 * 1024) return jsonResponse({ error: 'data.xml exceeds the 1 MB limit.' }, 413);

  const xml = await request.text();
  if (new TextEncoder().encode(xml).byteLength > 1024 * 1024) {
    return jsonResponse({ error: 'data.xml exceeds the 1 MB limit.' }, 413);
  }
  if (!/^\s*(?:<\?xml[^?]*\?>\s*)?<Record(?:\s|>)/i.test(xml) || !/<\/Record>\s*$/i.test(xml)) {
    return jsonResponse({ error: 'The submitted XML must have a complete Record root element.' }, 400);
  }

  const current = await env.XML_DATA_BUCKET.get('data.xml');
  if (!current) return jsonResponse({ error: 'data.xml was not found in the XML data bucket.' }, 404);
  if (request.headers.get('If-Match') !== current.httpEtag) {
    return jsonResponse({ error: 'data.xml has changed. Reload before saving.' }, 409);
  }

  const saved = await env.XML_DATA_BUCKET.put('data.xml', xml, {
    onlyIf: { etagMatches: current.httpEtag },
    httpMetadata: { contentType: 'application/xml; charset=utf-8', cacheControl: 'public, max-age=60' }
  });
  if (!saved) return jsonResponse({ error: 'data.xml has changed. Reload before saving.' }, 409);
  return jsonResponse({ ok: true }, 200, { ETag: saved.httpEtag });
}
