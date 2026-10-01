import { isSameOrigin, jsonResponse, requireAdminAccess } from '../../lib/admin-auth.js';

const MAX_FILE_SIZE = 1024 * 1024;
const CONTENT_TYPES = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

function isImageKey(key) {
  if (typeof key !== 'string' || !key || key.length > 1024) return false;
  const segments = key.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || /[\u0000-\u001f\u007f\\]/.test(segment))) return false;
  return Boolean(CONTENT_TYPES[key.split('.').pop().toLowerCase()]);
}

export async function onRequestGet({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;

  try {
    const pictures = [];
    let cursor;
    let page;
    do {
      page = await env.SLIDESHOW_BUCKET.list({ cursor, limit: 1000, include: ['httpMetadata'] });
      page.objects.forEach((object) => {
        if (!isImageKey(object.key)) return;
        const extension = object.key.split('.').pop().toLowerCase();
        pictures.push({
          key: object.key,
          size: object.size,
          uploaded: object.uploaded?.toISOString() || null,
          contentType: object.httpMetadata?.contentType || CONTENT_TYPES[extension]
        });
      });
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    pictures.sort((left, right) => left.key.localeCompare(right.key));
    return jsonResponse({ pictures });
  } catch {
    return jsonResponse({ error: 'Could not list slideshow pictures.' }, 500);
  }
}

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

export async function onRequestDelete({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Requests must come from this site.' }, 403);

  const key = new URL(request.url).searchParams.get('name') || '';
  if (!isImageKey(key)) return jsonResponse({ error: 'Choose a valid gallery picture.' }, 400);

  try {
    if (!await env.SLIDESHOW_BUCKET.head(key)) return jsonResponse({ error: 'Picture not found.' }, 404);
    await env.SLIDESHOW_BUCKET.delete(key);
    return jsonResponse({ ok: true, key });
  } catch {
    return jsonResponse({ error: 'Could not delete the slideshow picture.' }, 500);
  }
}