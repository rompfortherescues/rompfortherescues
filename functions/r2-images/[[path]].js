const CONTENT_TYPES = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp'
};

export async function onRequestGet({ params, env }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.EVENT_PICTURES_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop().toLowerCase();
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || CONTENT_TYPES[ext] || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}