import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  // Only allow access to logos prefix
  if (!key.startsWith('logos/')) {
    return new Response('Forbidden', { status: 403 });
  }

  const object = await env.R2.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

    const headers = new Headers({
      'Content-Type': object.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    // 图片资源不需要执行任何脚本;禁止 SVG 内嵌脚本在直接访问时执行(存储型 XSS 防护)
    headers.set('Content-Security-Policy', "default-src 'none'");

    return new Response(object.body, { headers });
};
