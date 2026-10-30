import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { verifySession } from './lib/auth';
import { defaultLocale } from './i18n/config';
import { canonicalLocaleRedirect } from './lib/canonical-redirect';

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // 端点可自带更严格的 CSP(如图片服务接口的 default-src 'none'),此时不覆盖
  if (!headers.has('Content-Security-Policy')) {
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://cloudflareinsights.com; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Bearer-token API is intentionally cross-origin. Handle browser preflight
  // before Astro attempts method dispatch on individual endpoint modules.
  if (pathname.startsWith('/api/v1/') && context.request.method === 'OPTIONS') {
    return withSecurityHeaders(new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    }));
  }

  // Skip static assets
  if (pathname.startsWith('/_') || pathname.startsWith('/favicon')) {
    return withSecurityHeaders(await next());
  }

  // Root redirect to default locale
  if (pathname === '/') {
    return withSecurityHeaders(context.redirect(`/${defaultLocale}/`));
  }

  const canonicalPath = canonicalLocaleRedirect(pathname);
  if (canonicalPath) {
    const destination = new URL(canonicalPath, context.url);
    destination.search = context.url.search;
    return withSecurityHeaders(context.redirect(destination.toString(), 301));
  }

  // Admin route protection (except login page)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const sessionCookie = context.cookies.get('session')?.value;
    if (!sessionCookie) {
      return context.redirect('/admin/login');
    }
    const session = await verifySession(sessionCookie, env.ADMIN_SESSION_SECRET);
    if (!session) {
      context.cookies.delete('session', { path: '/' });
      return context.redirect('/admin/login');
    }
    context.locals.userId = session.sub;
  }

  // Protect admin API endpoints
  if (pathname.startsWith('/api/admin/')) {
    const sessionCookie = context.cookies.get('session')?.value;
    if (!sessionCookie) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const session = await verifySession(sessionCookie, env.ADMIN_SESSION_SECRET);
    if (!session) {
      context.cookies.delete('session', { path: '/' });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    context.locals.userId = session.sub;
  }

  return withSecurityHeaders(await next());
});
