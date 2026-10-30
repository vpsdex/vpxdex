import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../../../../lib/db';
import { activityCategories, activities } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { requireApiAuth, jsonResponse, handleCors } from '../../../../lib/api-auth';
import { errorMessage, optionalText, RequestValidationError, validateSlug } from '../../../../lib/validation';

// GET /api/v1/categories - 列出所有分类
export const GET: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  const db = getDb(env.DB);
  const categories = await db
    .select()
    .from(activityCategories)
    .orderBy(activityCategories.sort_order);

  return jsonResponse({
    count: categories.length,
    data: categories.map((c) => ({
      id: c.id,
      slug: c.slug,
      icon: c.icon,
      sort_order: c.sort_order,
      created_at: c.created_at,
      updated_at: c.updated_at,
    })),
  });
};

// POST /api/v1/categories - 创建分类
export const POST: APIRoute = async ({ request }) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const auth = requireApiAuth(request);
  if (auth) return auth;

  try {
    const body = await request.json() as Record<string, unknown>;
    const { slug, icon, sort_order } = body;

    const normalizedSlug = validateSlug(slug);
    const normalizedSortOrder = sort_order == null ? 0 : Number(sort_order);
    if (!Number.isInteger(normalizedSortOrder)) {
      throw new RequestValidationError('sort_order must be an integer');
    }

    const db = getDb(env.DB);

    // 检查重复
    const existing = await db
      .select({ id: activityCategories.id })
      .from(activityCategories)
      .where(eq(activityCategories.slug, normalizedSlug))
      .get();
    if (existing) {
      return jsonResponse({ error: `Category slug "${normalizedSlug}" already exists` }, 409);
    }

    const [newCategory] = await db
      .insert(activityCategories)
      .values({
        slug: normalizedSlug,
        icon: optionalText(icon, 20),
        sort_order: normalizedSortOrder,
      })
      .returning();

    return jsonResponse({ success: true, id: newCategory.id }, 201);
  } catch (error) {
    console.error('API create category error:', error);
    return jsonResponse(
      { error: error instanceof RequestValidationError || error instanceof SyntaxError ? errorMessage(error) : 'Failed to create category' },
      error instanceof RequestValidationError || error instanceof SyntaxError ? 400 : 500,
    );
  }
};
