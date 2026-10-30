import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import { activityCategories, activities } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { errorMessage, RequestValidationError, validatePositiveInteger, validateSlug } from '../../../lib/validation';

// GET all activity categories
export const GET: APIRoute = async () => {
  try {
    const db = getDb(env.DB);
    const categories = await db
      .select()
      .from(activityCategories)
      .orderBy(activityCategories.sort_order);

    return new Response(JSON.stringify(categories), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch categories' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST create new category (and handle DELETE override)
export const POST: APIRoute = async ({ request, url }) => {
  try {
    const db = getDb(env.DB);
    const methodFromQuery = url.searchParams.get('_method');
    const rawId = url.searchParams.get('id');

    // Handle DELETE
    if (methodFromQuery === 'DELETE') {
      const id = validatePositiveInteger(rawId, 'id');

      // Check if any activities use this category
      const linkedActivities = await db
        .select({ id: activities.id })
        .from(activities)
        .where(eq(activities.category_id, id))
        .limit(1);

      if (linkedActivities.length > 0) {
        return new Response(JSON.stringify({ error: '该分类下还有活动，无法删除。请先删除或移动相关活动。' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await db.delete(activityCategories).where(eq(activityCategories.id, id));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle CREATE
    const formData = await request.formData();
    const slug = validateSlug(formData.get('slug'));
    const sortOrder = Number(formData.get('sort_order') || 0);
    if (!Number.isInteger(sortOrder)) throw new RequestValidationError('sort_order must be an integer');

    // Check for duplicate slug
    const existing = await db
      .select({ id: activityCategories.id })
      .from(activityCategories)
      .where(eq(activityCategories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return new Response(JSON.stringify({ error: '分类标识已存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [newCategory] = await db
      .insert(activityCategories)
      .values({
        slug,
        sort_order: sortOrder,
      })
      .returning();

    return new Response(JSON.stringify({ success: true, id: newCategory.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error managing category:', error);
    const badRequest = error instanceof RequestValidationError;
    return new Response(JSON.stringify({ error: badRequest ? errorMessage(error) : 'Failed to manage category' }), {
      status: badRequest ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
