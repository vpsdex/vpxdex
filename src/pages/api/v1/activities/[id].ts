import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { activities, activitiesContent, activityCategories } from '../../../../db/schema';
import { eq, and } from 'drizzle-orm';
import { sanitizeRichText } from '../../../../lib/rich-text';
import { requireApiAuth, jsonResponse, handleCors } from '../../../../lib/api-auth';
import {
  errorMessage, optionalText, RequestValidationError, requireText, validateDate,
  validateBoolean, validateLocale, validatePositiveInteger, validateSlug,
} from '../../../../lib/validation';

// GET /api/v1/activities/:id - 获取单个活动详情
export const GET: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const db = getDb(env.DB);
  const activity = await db.select().from(activities).where(eq(activities.id, id)).get();
  if (!activity) return jsonResponse({ error: 'Activity not found' }, 404);

  const contentRows = await db
    .select()
    .from(activitiesContent)
    .where(eq(activitiesContent.activity_id, id));

  const category = await db
    .select()
    .from(activityCategories)
    .where(eq(activityCategories.id, activity.category_id))
    .get();

  return jsonResponse({
    data: {
      id: activity.id,
      slug: activity.slug,
      featured_image_key: activity.featured_image_key,
      category_id: activity.category_id,
      category_slug: category?.slug || '',
      published_at: activity.published_at,
      is_featured: activity.is_featured,
      is_active: activity.is_active,
      view_count: activity.view_count,
      created_at: activity.created_at,
      updated_at: activity.updated_at,
      contents: contentRows.map((c) => ({
        lang: c.lang,
        title: c.title,
        slug: c.slug,
        description: c.description,
        content: c.content,
        meta_title: c.meta_title,
        meta_desc: c.meta_desc,
      })),
    },
  });
};

// PUT /api/v1/activities/:id - 更新活动
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

    const existing = await db.select().from(activities).where(eq(activities.id, id)).get();
    if (!existing) return jsonResponse({ error: 'Activity not found' }, 404);

    const { slug, category_id, published_at, is_featured, is_active, featured_image_key, contents } = body;

    if (featured_image_key !== undefined && featured_image_key !== null
      && (typeof featured_image_key !== 'string' || !featured_image_key.startsWith('activity-images/'))) {
      throw new RequestValidationError('featured_image_key must use the activity-images/ prefix');
    }

    const normalizedCategoryId = category_id === undefined
      ? undefined
      : validatePositiveInteger(category_id, 'category_id');
    if (normalizedCategoryId !== undefined) {
      const cat = await db.select().from(activityCategories).where(eq(activityCategories.id, normalizedCategoryId)).get();
      if (!cat) return jsonResponse({ error: `Category id ${normalizedCategoryId} not found` }, 400);
    }

    await db
      .update(activities)
      .set({
        ...(slug !== undefined && { slug: validateSlug(slug) }),
        ...(featured_image_key !== undefined && { featured_image_key: featured_image_key as string | null }),
        ...(normalizedCategoryId !== undefined && { category_id: normalizedCategoryId }),
        ...(published_at !== undefined && { published_at: validateDate(published_at) }),
        ...(is_featured !== undefined && { is_featured: validateBoolean(is_featured, 'is_featured') }),
        ...(is_active !== undefined && { is_active: validateBoolean(is_active, 'is_active') }),
        updated_at: new Date().toISOString(),
      })
      .where(eq(activities.id, id));

    if (featured_image_key !== undefined && existing.featured_image_key && existing.featured_image_key !== featured_image_key) {
      await env.R2.delete(existing.featured_image_key);
    }

    if (Array.isArray(contents)) {
      for (const rawContent of contents) {
        if (!rawContent || typeof rawContent !== 'object') throw new RequestValidationError('contents entries must be objects');
        const c = rawContent as Record<string, any>;
        const lang = validateLocale(c.lang);
        const existingContent = await db
          .select()
          .from(activitiesContent)
          .where(and(eq(activitiesContent.activity_id, id), eq(activitiesContent.lang, lang)))
          .get();

        if (existingContent) {
          await db
            .update(activitiesContent)
            .set({
              title: requireText(c.title ?? existingContent.title, 'contents.title', 300),
              slug: validateSlug(c.slug ?? existingContent.slug, 'contents.slug'),
              description: optionalText(c.description, 2000),
              content: sanitizeRichText(optionalText(c.content, 500_000)),
              meta_title: optionalText(c.meta_title, 200),
              meta_desc: optionalText(c.meta_desc, 500),
              updated_at: new Date().toISOString(),
            })
            .where(eq(activitiesContent.id, existingContent.id));
        } else {
          await db.insert(activitiesContent).values({
            activity_id: id,
            lang,
            title: requireText(c.title, 'contents.title', 300),
            slug: validateSlug(c.slug ?? slug ?? existing.slug, 'contents.slug'),
            description: optionalText(c.description, 2000),
            content: sanitizeRichText(optionalText(c.content, 500_000)),
            meta_title: optionalText(c.meta_title, 200),
            meta_desc: optionalText(c.meta_desc, 500),
          });
        }
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('API update activity error:', error);
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to update activity' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};

// DELETE /api/v1/activities/:id - 删除活动
export const DELETE: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const db = getDb(env.DB);
  const existing = await db.select().from(activities).where(eq(activities.id, id)).get();
  if (!existing) return jsonResponse({ error: 'Activity not found' }, 404);

  await db.delete(activities).where(eq(activities.id, id));
  if (existing.featured_image_key) await env.R2.delete(existing.featured_image_key);

  return jsonResponse({ success: true });
};
