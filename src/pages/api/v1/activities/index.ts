import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { activities, activitiesContent, activityCategories } from '../../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { sanitizeRichText } from '../../../../lib/rich-text';
import { requireApiAuth, jsonResponse, handleCors } from '../../../../lib/api-auth';
import {
  errorMessage, optionalText, RequestValidationError, requireText, validateDate,
  validateBoolean, validateLocale, validatePositiveInteger, validateSlug,
} from '../../../../lib/validation';

// GET /api/v1/activities - 列出所有活动
export const GET: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const db = getDb(env.DB);
  const rows = await db
    .select({
      id: activities.id,
      slug: activities.slug,
      featured_image_key: activities.featured_image_key,
      category_id: activities.category_id,
      published_at: activities.published_at,
      is_featured: activities.is_featured,
      is_active: activities.is_active,
      view_count: activities.view_count,
      created_at: activities.created_at,
      updated_at: activities.updated_at,
      title_zh: activitiesContent.title,
      category_slug: activityCategories.slug,
    })
    .from(activities)
    .leftJoin(
      activitiesContent,
      and(eq(activitiesContent.activity_id, activities.id), eq(activitiesContent.lang, 'zh')),
    )
    .leftJoin(activityCategories, eq(activities.category_id, activityCategories.id))
    .orderBy(desc(activities.published_at))
    .limit(100);

  return jsonResponse({
    count: rows.length,
    data: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      featured_image_key: row.featured_image_key,
      category_id: row.category_id,
      category_slug: row.category_slug || '',
      published_at: row.published_at,
      is_featured: row.is_featured,
      is_active: row.is_active,
      view_count: row.view_count,
      title_zh: row.title_zh || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
    })),
  });
};

// POST /api/v1/activities - 创建活动
export const POST: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  let insertedId: number | null = null;
  try {
    const body = await request.json() as Record<string, unknown>;
    const { slug, category_id, published_at, is_featured, is_active, featured_image_key, contents } = body;

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return jsonResponse({ error: 'Missing required fields: slug, category_id, contents' }, 400);
    }

    const normalizedSlug = validateSlug(slug);
    if (featured_image_key !== undefined && featured_image_key !== null
      && (typeof featured_image_key !== 'string' || !featured_image_key.startsWith('activity-images/'))) {
      throw new RequestValidationError('featured_image_key must use the activity-images/ prefix');
    }
    const normalizedCategoryId = validatePositiveInteger(category_id, 'category_id');
    const normalizedContents = contents.map((content: Record<string, unknown>) => ({
      lang: validateLocale(content.lang),
      title: requireText(content.title, 'contents.title', 300),
      slug: validateSlug(content.slug || normalizedSlug, 'contents.slug'),
      description: optionalText(content.description, 2000),
      content: sanitizeRichText(optionalText(content.content, 500_000)),
      meta_title: optionalText(content.meta_title, 200),
      meta_desc: optionalText(content.meta_desc, 500),
    }));
    if (new Set(normalizedContents.map((content) => content.lang)).size !== normalizedContents.length) {
      return jsonResponse({ error: 'contents contains duplicate languages' }, 400);
    }

    const db = getDb(env.DB);

    // 验证分类是否存在
    const category = await db
      .select()
      .from(activityCategories)
      .where(eq(activityCategories.id, normalizedCategoryId))
      .get();
    if (!category) {
      return jsonResponse({ error: `Category id ${normalizedCategoryId} not found` }, 400);
    }

    const [newActivity] = await db
      .insert(activities)
      .values({
        slug: normalizedSlug,
        featured_image_key: featured_image_key as string | null | undefined,
        category_id: normalizedCategoryId,
        published_at: validateDate(published_at),
        is_featured: is_featured === undefined ? false : validateBoolean(is_featured, 'is_featured'),
        is_active: is_active === undefined ? true : validateBoolean(is_active, 'is_active'),
      })
      .returning();
    insertedId = newActivity.id;

    for (const c of normalizedContents) {
      await db.insert(activitiesContent).values({
        activity_id: newActivity.id,
        ...c,
      });
    }

    return jsonResponse({ success: true, id: newActivity.id }, 201);
  } catch (error) {
    console.error('API create activity error:', error);
    if (insertedId) {
      try { await getDb(env.DB).delete(activities).where(eq(activities.id, insertedId)); }
      catch (cleanupError) { console.error('API activity cleanup error:', cleanupError); }
    }
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to create activity' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};
