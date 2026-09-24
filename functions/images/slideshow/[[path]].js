const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

// Serves slideshow photos straight from R2 so the URL shape stays images/slideshow/<file>.
export async function onRequestGet({ params, env }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!key) return new Response('Not found', { status: 404 });

  const object = await env.SLIDESHOW_BUCKET.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const ext = key.split('.').pop().toLowerCase();
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || CONTENT_TYPES[ext] || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}
