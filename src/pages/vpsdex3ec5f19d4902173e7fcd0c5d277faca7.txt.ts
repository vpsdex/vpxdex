import type { APIRoute } from 'astro';

const KEY = 'vpsdex3ec5f19d4902173e7fcd0c5d277faca7';

export const GET: APIRoute = async () =>
  new Response(KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
