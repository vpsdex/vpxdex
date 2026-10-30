import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { providers, providersContent } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { invalidateCache } from '../../../../lib/cache';
import { sanitizeRichText } from '../../../../lib/rich-text';
import { requireApiAuth, jsonResponse, handleCors } from '../../../../lib/api-auth';
import {
  errorMessage, optionalText, parseStoredTags, RequestValidationError, requireText,
  serializeTags, validateBoolean, validateHttpUrl, validateLocale, validateRating, validateSlug,
} from '../../../../lib/validation';

// GET /api/v1/providers/:id - 获取单个服务商详情
export const GET: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const db = getDb(env.DB);
  const provider = await db.select().from(providers).where(eq(providers.id, id)).get();
  if (!provider) return jsonResponse({ error: 'Provider not found' }, 404);

  const contentRows = await db
    .select()
    .from(providersContent)
    .where(eq(providersContent.provider_id, id));

  return jsonResponse({
    data: {
      id: provider.id,
      slug_zh: provider.slug_zh,
      slug_en: provider.slug_en,
      url: provider.url,
      category: provider.category,
      rating: provider.rating,
      logo_key: provider.logo_key,
      tags: parseStoredTags(provider.tags),
      is_active: provider.is_active,
      created_at: provider.created_at,
      updated_at: provider.updated_at,
      contents: contentRows.map((c) => ({
        lang: c.lang,
        name: c.name,
        desc: c.desc,
        meta_title: c.meta_title,
        meta_desc: c.meta_desc,
      })),
    },
  });
};

// PUT /api/v1/providers/:id - 更新服务商
export const PUT: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  try {
    const body = await request.json() as Record<string, unknown>;
    const db = getDb(env.DB);

    const existing = await db.select().from(providers).where(eq(providers.id, id)).get();
    if (!existing) return jsonResponse({ error: 'Provider not found' }, 404);

    const { slug_zh, slug_en, url, category, rating, tags, is_active, logo_key, contents } = body;

    if (logo_key !== undefined && logo_key !== null
      && (typeof logo_key !== 'string' || !logo_key.startsWith('logos/'))) {
      throw new RequestValidationError('logo_key must use the logos/ prefix');
    }

    await db
      .update(providers)
      .set({
        ...(slug_zh !== undefined && { slug_zh: validateSlug(slug_zh, 'slug_zh') }),
        ...(slug_en !== undefined && { slug_en: validateSlug(slug_en, 'slug_en') }),
        ...(url !== undefined && { url: validateHttpUrl(url) }),
        ...(category !== undefined && { category: requireText(category, 'category', 60) }),
        ...(rating !== undefined && { rating: validateRating(rating) }),
        ...(tags !== undefined && { tags: serializeTags(tags) }),
        ...(is_active !== undefined && { is_active: validateBoolean(is_active, 'is_active') }),
        ...(logo_key !== undefined && { logo_key }),
        updated_at: new Date().toISOString(),
      })
      .where(eq(providers.id, id));

    if (Array.isArray(contents)) {
      for (const rawContent of contents) {
        if (!rawContent || typeof rawContent !== 'object') throw new RequestValidationError('contents entries must be objects');
        const c = rawContent as Record<string, any>;
        const lang = validateLocale(c.lang);
        const existingContent = await db
          .select()
          .from(providersContent)
          .where(and(eq(providersContent.provider_id, id), eq(providersContent.lang, lang)))
          .get();

        if (existingContent) {
          await db
            .update(providersContent)
            .set({
              name: requireText(c.name, 'contents.name', 200),
              desc: sanitizeRichText(optionalText(c.desc, 100_000)),
              meta_title: optionalText(c.meta_title, 200),
              meta_desc: optionalText(c.meta_desc, 500),
            })
            .where(eq(providersContent.id, existingContent.id));
        } else {
          await db.insert(providersContent).values({
            provider_id: id,
            lang,
            name: requireText(c.name, 'contents.name', 200),
            desc: sanitizeRichText(optionalText(c.desc, 100_000)),
            meta_title: optionalText(c.meta_title, 200),
            meta_desc: optionalText(c.meta_desc, 500),
          });
        }
      }
    }

    if (logo_key !== undefined && existing.logo_key && existing.logo_key !== logo_key) {
      await env.R2.delete(existing.logo_key);
    }

    await invalidateCache(env.VPSDIR_KV, 'home:zh');
    await invalidateCache(env.VPSDIR_KV, 'home:en');

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('API update provider error:', error);
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to update provider' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};

// DELETE /api/v1/providers/:id - 删除服务商
export const DELETE: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const db = getDb(env.DB);
  const existing = await db.select({ logo_key: providers.logo_key }).from(providers).where(eq(providers.id, id)).get();
  if (!existing) return jsonResponse({ error: 'Provider not found' }, 404);

  await db.delete(providers).where(eq(providers.id, id));
  if (existing.logo_key) await env.R2.delete(existing.logo_key);

  await invalidateCache(env.VPSDIR_KV, 'home:zh');
  await invalidateCache(env.VPSDIR_KV, 'home:en');

  return jsonResponse({ success: true });
};
