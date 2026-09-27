import { isSameOrigin, jsonResponse, requireAdminAccess } from '../../lib/admin-auth.js';

export async function onRequestPost({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  if (!isSameOrigin(request)) {
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
