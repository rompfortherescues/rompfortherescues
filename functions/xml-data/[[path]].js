export async function onRequestGet({ params, env }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.XML_DATA_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/xml');
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}
