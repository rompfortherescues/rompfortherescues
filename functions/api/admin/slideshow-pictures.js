import { isSameOrigin, jsonResponse, requireAdminAccess } from '../../lib/admin-auth.js';

const MAX_FILE_SIZE = 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Requests must come from this site.' }, 403);

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) {
    return jsonResponse({ error: 'Picture must be smaller than 1 MB.' }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'Upload must use multipart form data.' }, 400);
  }

  const file = form.get('file');
  if (!file || typeof file.stream !== 'function') {
    return jsonResponse({ error: 'Choose a picture to upload.' }, 400);
  }
  if (file.size < 1 || file.size >= MAX_FILE_SIZE) {
    return jsonResponse({ error: 'Converted WebP pictures must be smaller than 1 MB.' }, 413);
  }
  if (file.type !== 'image/webp') {
    return jsonResponse({ error: 'Only converted WebP pictures can be uploaded.' }, 415);
  }

  const signature = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isWebp = signature.length === 12
    && String.fromCharCode(...signature.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
  if (!isWebp) return jsonResponse({ error: 'The uploaded file is not a valid WebP picture.' }, 415);

  const key = `slideshow-${crypto.randomUUID()}.webp`;
  try {
    const object = await env.SLIDESHOW_BUCKET.put(key, file.stream(), {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=3600' }
    });
    return jsonResponse({
      ok: true,
      picture: {
        key: object.key,
        size: object.size,
        uploaded: object.uploaded?.toISOString() || new Date().toISOString(),
        contentType: 'image/webp'
      }
    }, 200, { ETag: object.httpEtag });
  } catch {
    return jsonResponse({ error: 'Could not store the picture in the slideshowpictures bucket.' }, 500);
  }
}