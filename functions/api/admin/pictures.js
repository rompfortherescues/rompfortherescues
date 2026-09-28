import { isSameOrigin, jsonResponse, requireAdminAccess } from '../../lib/admin-auth.js';

const CONTENT_TYPES = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp'
};
const UPLOAD_TYPES = {
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};
const MAX_FILE_SIZE = 1024 * 1024;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

function isSupportedKey(key) {
  const extension = key.split('.').pop().toLowerCase();
  return KEY_PATTERN.test(key) && Boolean(CONTENT_TYPES[extension]);
}

function decodeXmlText(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function isPictureReferenced(xml, key) {
  const pictureTags = xml.matchAll(/<Picture\b[^>]*>([\s\S]*?)<\/Picture\s*>/gi);
  for (const [, text] of pictureTags) {
    const value = decodeXmlText(text).trim().split(/[?#]/, 1)[0];
    const basename = value.replace(/\\/g, '/').split('/').pop();
    let decodedName = basename;
    try {
      decodedName = decodeURIComponent(basename);
    } catch {
      // Keep the literal basename if the old XML contains malformed URL escaping.
    }
    if (decodedName === key) return true;
  }
  return false;
}

function replacePictureReferences(xml, oldKey, replacementUrl) {
  let count = 0;
  const updatedXml = xml.replace(/(<Picture\b[^>]*>)([\s\S]*?)(<\/Picture\s*>)/gi, (match, openTag, text, closeTag) => {
    const value = decodeXmlText(text).trim().split(/[?#]/, 1)[0];
    const basename = value.replace(/\\/g, '/').split('/').pop();
    let decodedName = basename;
    try {
      decodedName = decodeURIComponent(basename);
    } catch {
      // Keep the literal basename if the old XML contains malformed URL escaping.
    }
    if (decodedName !== oldKey) return match;
    count += 1;
    return `${openTag}${replacementUrl}${closeTag}`;
  });
  return { xml: updatedXml, count };
}

async function getPictureList(bucket) {
  const pictures = [];
  let cursor;
  let page;
  do {
    page = await bucket.list({ cursor, limit: 1000, include: ['httpMetadata'] });
    page.objects.forEach((object) => {
      if (!isSupportedKey(object.key)) return;
      pictures.push({
        key: object.key,
        size: object.size,
        uploaded: object.uploaded?.toISOString() || null,
        contentType: object.httpMetadata?.contentType || CONTENT_TYPES[object.key.split('.').pop().toLowerCase()]
      });
    });
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return pictures.sort((left, right) => left.key.localeCompare(right.key));
}

export async function onRequestGet({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  try {
    return jsonResponse({ pictures: await getPictureList(env.EVENT_PICTURES_BUCKET) });
  } catch {
    return jsonResponse({ error: 'Could not list event pictures.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Requests must come from this site.' }, 403);

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_FILE_SIZE + 64 * 1024) return jsonResponse({ error: 'Picture exceeds the 1 MB upload limit.' }, 413);

  let form;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'Upload must use multipart form data.' }, 400);
  }
  const file = form.get('file');
  if (!file || typeof file.name !== 'string' || typeof file.stream !== 'function') {
    return jsonResponse({ error: 'Choose an image file to upload.' }, 400);
  }
  if (file.size < 1 || file.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: 'Picture must be between 1 byte and 1 MB.' }, 413);
  }
  if (!KEY_PATTERN.test(file.name)) {
    return jsonResponse({ error: 'Use a filename containing only letters, numbers, dots, underscores, or hyphens.' }, 400);
  }

  const extension = file.name.split('.').pop().toLowerCase();
  const contentType = UPLOAD_TYPES[extension];
  if (!contentType || file.type !== contentType) {
    return jsonResponse({ error: 'Upload a JPG, JPEG, PNG, WebP, or GIF image with a matching filename extension.' }, 415);
  }

  try {
    const object = await env.EVENT_PICTURES_BUCKET.put(file.name, file.stream(), {
      httpMetadata: { contentType, cacheControl: 'public, max-age=0, must-revalidate' }
    });
    return jsonResponse({
      ok: true,
      picture: {
        key: object.key,
        size: object.size,
        uploaded: object.uploaded?.toISOString() || new Date().toISOString(),
        contentType
      }
    }, 200, { ETag: object.httpEtag });
  } catch {
    return jsonResponse({ error: 'Could not store the picture in the eventpictures bucket.' }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const accessError = await requireAdminAccess(request, env);
  if (accessError) return accessError;
  if (!isSameOrigin(request)) return jsonResponse({ error: 'Requests must come from this site.' }, 403);

  const key = new URL(request.url).searchParams.get('name') || '';
  const replacementKey = new URL(request.url).searchParams.get('replacement') || '';
  if (!isSupportedKey(key)) return jsonResponse({ error: 'Choose a valid picture filename.' }, 400);

  try {
    const existing = await env.EVENT_PICTURES_BUCKET.head(key);
    if (!existing) return jsonResponse({ error: 'Picture not found.' }, 404);

    if (replacementKey) {
      if (!isSupportedKey(replacementKey) || !replacementKey.toLowerCase().endsWith('.webp') || replacementKey === key) {
        return jsonResponse({ error: 'Choose a different WebP picture as the replacement.' }, 400);
      }
      if (!await env.EVENT_PICTURES_BUCKET.head(replacementKey)) {
        return jsonResponse({ error: 'The replacement picture must be uploaded before replacing the old picture.' }, 409);
      }

      const data = await env.XML_DATA_BUCKET.get('data.xml');
      const xml = data ? await data.text() : null;
      const replacementUrl = `/r2-images/${encodeURIComponent(replacementKey)}`;
      const updated = xml === null ? { xml: null, count: 0 } : replacePictureReferences(xml, key, replacementUrl);
      const backup = await env.EVENT_PICTURES_BUCKET.get(key);
      if (!backup) return jsonResponse({ error: 'Picture not found.' }, 404);
      const backupBytes = await backup.arrayBuffer();

      await env.EVENT_PICTURES_BUCKET.delete(key);
      try {
        let saved = null;
        if (updated.count) {
          saved = await env.XML_DATA_BUCKET.put('data.xml', updated.xml, {
            onlyIf: { etagMatches: data.httpEtag },
            httpMetadata: {
              contentType: data.httpMetadata?.contentType || 'application/xml; charset=utf-8',
              cacheControl: data.httpMetadata?.cacheControl || 'public, max-age=60'
            }
          });
          if (!saved) throw new Error('data.xml changed during picture replacement.');
        }
        return jsonResponse({
          ok: true,
          key,
          replacement: replacementKey,
          referencesUpdated: updated.count
        }, 200, saved ? { ETag: saved.httpEtag } : {});
      } catch {
        await env.EVENT_PICTURES_BUCKET.put(key, backupBytes, {
          httpMetadata: backup.httpMetadata,
          customMetadata: backup.customMetadata
        });
        return jsonResponse({ error: 'Could not update data.xml after deleting the old picture. The old picture was restored.' }, 409);
      }
    }

    const data = await env.XML_DATA_BUCKET.get('data.xml');
    if (data && isPictureReferenced(await data.text(), key)) {
      return jsonResponse({ error: 'This picture is still used in data.xml. Change or remove its event reference and save before deleting it.' }, 409);
    }

    await env.EVENT_PICTURES_BUCKET.delete(key);
    return jsonResponse({ ok: true, key });
  } catch {
    return jsonResponse({ error: 'Could not delete the picture.' }, 500);
  }
}
