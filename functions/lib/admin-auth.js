let cachedKeys;
let cachedKeysAt = 0;

export const jsonResponse = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
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
  const audiences = (env.CF_ACCESS_AUD || '').split(',').map((audience) => audience.trim()).filter(Boolean);
  if (!configuredDomain || !audiences.length) return false;

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
  if (claims.iss !== issuer || !audiences.some((audience) => tokenAudiences.includes(audience)) || !claims.exp || claims.exp <= now) return false;
  if (claims.nbf && claims.nbf > now) return false;

  const jwk = (await getAccessKeys(issuer)).find((key) => key.kid === header.kid);
  if (!jwk) return false;
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const signedContent = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(parts[2]), signedContent);
}

export async function requireAdminAccess(request, env) {
  const previewBranch = env.CF_PAGES_BRANCH;
  const productionBranch = env.PRODUCTION_BRANCH;
  if (
    env.ADMIN_ACCESS_PREVIEW_BYPASS === 'true'
    && previewBranch
    && productionBranch
    && previewBranch !== productionBranch
  ) return null;

  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return jsonResponse({ error: 'Admin saving is not configured. Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD.' }, 503);
  }

  try {
    if (await verifyAccessToken(request, env)) return null;
  } catch {
    return jsonResponse({ error: 'Could not verify Cloudflare Access credentials.' }, 401);
  }
  return jsonResponse({ error: 'Cloudflare Access authorization is required.' }, 401);
}

export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}
