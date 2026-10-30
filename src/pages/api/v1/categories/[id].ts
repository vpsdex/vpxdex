import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { activityCategories, activities } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { requireApiAuth, jsonResponse, handleCors } from '../../../../lib/api-auth';
import { errorMessage, optionalText, RequestValidationError, validateSlug } from '../../../../lib/validation';

// PUT /api/v1/categories/:id - 更新分类
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

    const existing = await db.select().from(activityCategories).where(eq(activityCategories.id, id)).get();
    if (!existing) return jsonResponse({ error: 'Category not found' }, 404);

    const { slug, icon, sort_order } = body;
    const normalizedSortOrder = sort_order === undefined ? undefined : Number(sort_order);
    if (normalizedSortOrder !== undefined && !Number.isInteger(normalizedSortOrder)) {
      throw new RequestValidationError('sort_order must be an integer');
    }

    await db
      .update(activityCategories)
      .set({
        ...(slug !== undefined && { slug: validateSlug(slug) }),
        ...(icon !== undefined && { icon: optionalText(icon, 20) }),
        ...(normalizedSortOrder !== undefined && { sort_order: normalizedSortOrder }),
        updated_at: new Date().toISOString(),
      })
      .where(eq(activityCategories.id, id));

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('API update category error:', error);
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to update category' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};

// DELETE /api/v1/categories/:id - 删除分类（有关联活动时拒绝）
export const DELETE: APIRoute = async ({ request, params }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const id = Number(params.id);
  if (!id || isNaN(id)) return jsonResponse({ error: 'Invalid id' }, 400);

  const db = getDb(env.DB);

  const linked = await db
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.category_id, id))
    .limit(1)
    .get();

  if (linked) {
    return jsonResponse({ error: 'Category has associated activities. Delete or move them first.' }, 409);
  }

  await db.delete(activityCategories).where(eq(activityCategories.id, id));

  return jsonResponse({ success: true });
};
