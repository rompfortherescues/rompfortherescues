const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

// Public endpoint: anyone can view the gallery list.
export async function onRequestGet({ env }) {
  const listed = await env.SLIDESHOW_BUCKET.list();
  const images = listed.objects
    .map(o => o.key)
    .filter(key => IMAGE_EXT.test(key))
    .sort();

  return new Response(JSON.stringify({ images }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
