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

// GET /api/v1/providers - 列出所有服务商
export const GET: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(providers)
    .leftJoin(
      providersContent,
      and(eq(providers.id, providersContent.provider_id), eq(providersContent.lang, 'zh')),
    )
    .orderBy(providers.id);

  return jsonResponse({
    count: rows.length,
    data: rows.map((row) => ({
      id: row.providers.id,
      slug_zh: row.providers.slug_zh,
      slug_en: row.providers.slug_en,
      url: row.providers.url,
      category: row.providers.category,
      rating: row.providers.rating,
      logo_key: row.providers.logo_key,
      tags: parseStoredTags(row.providers.tags),
      is_active: row.providers.is_active,
      name_zh: row.providers_content?.name || '',
      created_at: row.providers.created_at,
      updated_at: row.providers.updated_at,
    })),
  });
};

// POST /api/v1/providers - 创建服务商
export const POST: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  let insertedId: number | null = null;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { slug_zh, slug_en, url, category, rating, tags, is_active, contents } = body;
    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return jsonResponse({ error: 'contents array is required (at least one language)' }, 400);
    }

    const normalizedContents = contents.map((content: Record<string, unknown>) => ({
      lang: validateLocale(content.lang),
      name: requireText(content.name, 'contents.name', 200),
      desc: sanitizeRichText(optionalText(content.desc, 100_000)),
      meta_title: optionalText(content.meta_title, 200),
      meta_desc: optionalText(content.meta_desc, 500),
    }));
    if (new Set(normalizedContents.map((content) => content.lang)).size !== normalizedContents.length) {
      return jsonResponse({ error: 'contents contains duplicate languages' }, 400);
    }

    const input = {
      slug_zh: validateSlug(slug_zh, 'slug_zh'),
      slug_en: validateSlug(slug_en, 'slug_en'),
      url: validateHttpUrl(url),
      category: requireText(category, 'category', 60),
      rating: validateRating(rating),
      tags: serializeTags(tags),
    };

    const db = getDb(env.DB);

    const inserted = await db
      .insert(providers)
      .values({
        ...input,
        is_active: is_active === undefined ? true : validateBoolean(is_active, 'is_active'),
      })
      .returning({ id: providers.id })
      .get();

    insertedId = inserted.id;
    for (const c of normalizedContents) {
      await db.insert(providersContent).values({
        provider_id: inserted.id,
        ...c,
      });
    }

    await invalidateCache(env.VPSDIR_KV, 'home:zh');
    await invalidateCache(env.VPSDIR_KV, 'home:en');

    return jsonResponse({ success: true, id: inserted.id }, 201);
  } catch (error) {
    console.error('API create provider error:', error);
    if (insertedId) {
      try { await getDb(env.DB).delete(providers).where(eq(providers.id, insertedId)); }
      catch (cleanupError) { console.error('API provider cleanup error:', cleanupError); }
    }
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to create provider' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};
