import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db';
import {
  activities,
  activitiesContent,
  activityCategories,
} from '../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { sanitizeRichText } from '../../../lib/rich-text';
import { validateImageFile } from '../../../lib/image-upload';
import { deleteLogo, uploadLogo } from '../../../lib/r2';
import { env } from 'cloudflare:workers';
import {
  errorMessage, optionalText, RequestValidationError, requireText, validateDate,
  validatePositiveInteger, validateSlug,
} from '../../../lib/validation';

// GET all activities
export const GET: APIRoute = async ({ url }) => {
  try {
    const db = getDb(env.DB);
    const activityList = await db
      .select({
        id: activities.id,
        slug: activities.slug,
        featuredImageKey: activities.featured_image_key,
        categoryId: activities.category_id,
        publishedAt: activities.published_at,
        isFeatured: activities.is_featured,
        isActive: activities.is_active,
        viewCount: activities.view_count,
        createdAt: activities.created_at,
        updatedAt: activities.updated_at,
        // Get Chinese content
        titleZh: sql<string>`(SELECT title FROM ${activitiesContent} WHERE ${activitiesContent.activity_id} = ${activities.id} AND ${activitiesContent.lang} = 'zh' LIMIT 1)`.as('title_zh'),
        // Get category info
        categorySlug: activityCategories.slug,
        categoryIcon: activityCategories.icon,
      })
      .from(activities)
      .leftJoin(activityCategories, eq(activities.category_id, activityCategories.id))
      .orderBy(desc(activities.published_at))
      .limit(50);

    return new Response(JSON.stringify(activityList), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch activities' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST create new activity (and handle method override for PUT/DELETE)
export const POST: APIRoute = async ({ request, url }) => {
  let createdActivityId: number | null = null;
  let uploadedFeaturedImageKey: string | null = null;
  let featuredImageAttached = false;
  try {
    const db = getDb(env.DB);
    const methodFromQuery = url.searchParams.get('_method');
    const id = parseInt(url.searchParams.get('id') || '');

    const handleDelete = async () => {
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing activity ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const existing = await db.select({ featuredImageKey: activities.featured_image_key })
        .from(activities).where(eq(activities.id, id)).get();
      await db.delete(activities).where(eq(activities.id, id));
      if (existing?.featuredImageKey) await deleteLogo(env.R2, existing.featuredImageKey);

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    // Handle DELETE requests that use query-string method override.
    if (methodFromQuery === 'DELETE') {
      return handleDelete();
    }

    const formData = await request.formData();

    // Check for method override from either the query string or form body.
    const method = methodFromQuery || (formData.get('_method') as string | null);
    if (method === 'DELETE') {
      return handleDelete();
    }

    if (method === 'PUT') {
      // Handle PUT request
      const id = validatePositiveInteger(url.searchParams.get('id'), 'id');

      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing activity ID' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Get basic fields
      const slug = validateSlug(formData.get('slug'));
      const categoryIdRaw = formData.get('category_id');
      const publishedAt = validateDate(formData.get('published_at'));
      const isFeatured = formData.get('is_featured') === '1';
      const isActive = formData.get('is_active') === '1';
      const existingActivity = await db.select().from(activities).where(eq(activities.id, id)).get();
      if (!existingActivity) {
        return new Response(JSON.stringify({ error: 'Activity not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const featuredImageFile = formData.get('featured_image');
      let featuredImageKey = existingActivity.featured_image_key;
      if (featuredImageFile instanceof File && featuredImageFile.size > 0) {
        const imageType = await validateImageFile(featuredImageFile);
        uploadedFeaturedImageKey = `activity-images/${slug}-${crypto.randomUUID()}.${imageType.extension}`;
        await uploadLogo(env.R2, uploadedFeaturedImageKey, await featuredImageFile.arrayBuffer(), imageType.contentType);
        featuredImageKey = uploadedFeaturedImageKey;
      } else if (formData.get('remove_featured_image') === '1') {
        featuredImageKey = null;
      }

      // Parse and validate category_id
      const categoryId = categoryIdRaw
        ? validatePositiveInteger(categoryIdRaw, 'category_id')
        : existingActivity.category_id;
      if (categoryIdRaw) {
        const category = await db.select({ id: activityCategories.id })
          .from(activityCategories).where(eq(activityCategories.id, categoryId)).get();
        if (!category) throw new RequestValidationError(`Invalid category_id: ${categoryId}`);
      }

      // Chinese content
      const titleZh = requireText(formData.get('title_zh'), 'title_zh', 300);
      const slugZh = validateSlug(formData.get('slug_zh'), 'slug_zh');
      const descriptionZh = optionalText(formData.get('description_zh'), 2000);
      const contentZh = sanitizeRichText(optionalText(formData.get('content_zh'), 500_000));
      const metaTitleZh = optionalText(formData.get('meta_title_zh'), 200);
      const metaDescZh = optionalText(formData.get('meta_desc_zh'), 500);

      // English content
      const titleEn = requireText(formData.get('title_en'), 'title_en', 300);
      const slugEn = validateSlug(formData.get('slug_en'), 'slug_en');
      const descriptionEn = optionalText(formData.get('description_en'), 2000);
      const contentEn = sanitizeRichText(optionalText(formData.get('content_en'), 500_000));
      const metaTitleEn = optionalText(formData.get('meta_title_en'), 200);
      const metaDescEn = optionalText(formData.get('meta_desc_en'), 500);

      // Update activity
      await db
        .update(activities)
        .set({
          slug,
          featured_image_key: featuredImageKey,
          category_id: categoryId,
          published_at: publishedAt,
          is_featured: isFeatured,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .where(eq(activities.id, id));
      featuredImageAttached = true;
      if (existingActivity.featured_image_key && existingActivity.featured_image_key !== featuredImageKey) {
        try { await deleteLogo(env.R2, existingActivity.featured_image_key); }
        catch (cleanupError) { console.error('Old activity image cleanup error:', cleanupError); }
      }

      // Update Chinese content
      await db
        .update(activitiesContent)
        .set({
          title: titleZh,
          slug: slugZh,
          description: descriptionZh,
          content: contentZh,
          meta_title: metaTitleZh,
          meta_desc: metaDescZh,
          updated_at: new Date().toISOString(),
        })
        .where(and(eq(activitiesContent.activity_id, id), eq(activitiesContent.lang, 'zh')));

      // Update English content
      await db
        .update(activitiesContent)
        .set({
          title: titleEn,
          slug: slugEn,
          description: descriptionEn,
          content: contentEn,
          meta_title: metaTitleEn,
          meta_desc: metaDescEn,
          updated_at: new Date().toISOString(),
        })
        .where(and(eq(activitiesContent.activity_id, id), eq(activitiesContent.lang, 'en')));

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Normal POST request for creating new activity
    // Get basic fields
    const slug = validateSlug(formData.get('slug'));
    const categoryIdRaw = formData.get('category_id');
    const publishedAt = validateDate(formData.get('published_at'));
    const isFeatured = formData.get('is_featured') === '1';
    const isActive = formData.get('is_active') === '1';
    const featuredImageFile = formData.get('featured_image');
    if (featuredImageFile instanceof File && featuredImageFile.size > 0) {
      const imageType = await validateImageFile(featuredImageFile);
      uploadedFeaturedImageKey = `activity-images/${slug}-${crypto.randomUUID()}.${imageType.extension}`;
      await uploadLogo(env.R2, uploadedFeaturedImageKey, await featuredImageFile.arrayBuffer(), imageType.contentType);
    }

    // Parse and validate category_id
    const suppliedCategoryId = categoryIdRaw ? validatePositiveInteger(categoryIdRaw, 'category_id') : null;

    // Chinese content
    const titleZh = requireText(formData.get('title_zh'), 'title_zh', 300);
    const slugZh = validateSlug(formData.get('slug_zh'), 'slug_zh');
    const descriptionZh = optionalText(formData.get('description_zh'), 2000);
    const contentZh = sanitizeRichText(optionalText(formData.get('content_zh'), 500_000));
    const metaTitleZh = optionalText(formData.get('meta_title_zh'), 200);
    const metaDescZh = optionalText(formData.get('meta_desc_zh'), 500);

    // English content
    const titleEn = requireText(formData.get('title_en'), 'title_en', 300);
    const slugEn = validateSlug(formData.get('slug_en'), 'slug_en');
    const descriptionEn = optionalText(formData.get('description_en'), 2000);
    const contentEn = sanitizeRichText(optionalText(formData.get('content_en'), 500_000));
    const metaTitleEn = optionalText(formData.get('meta_title_en'), 200);
    const metaDescEn = optionalText(formData.get('meta_desc_en'), 500);

    const internalCategory = suppliedCategoryId
      ? await db.select({ id: activityCategories.id }).from(activityCategories)
        .where(eq(activityCategories.id, suppliedCategoryId)).get()
      : await db.select({ id: activityCategories.id }).from(activityCategories)
        .orderBy(activityCategories.sort_order).get();
    if (!internalCategory) throw new RequestValidationError('No internal activity category is available');
    const categoryId = internalCategory.id;

    // Create activity
    const [newActivity] = await db
      .insert(activities)
      .values({
        slug,
        featured_image_key: uploadedFeaturedImageKey,
        category_id: categoryId,
        published_at: publishedAt,
        is_featured: isFeatured,
        is_active: isActive,
        view_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning();
    createdActivityId = newActivity.id;
    featuredImageAttached = true;

    // Create Chinese content
    await db.insert(activitiesContent).values({
      activity_id: newActivity.id,
      lang: 'zh',
      title: titleZh,
      slug: slugZh,
      description: descriptionZh,
      content: contentZh,
      meta_title: metaTitleZh,
      meta_desc: metaDescZh,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create English content
    await db.insert(activitiesContent).values({
      activity_id: newActivity.id,
      lang: 'en',
      title: titleEn,
      slug: slugEn,
      description: descriptionEn,
      content: contentEn,
      meta_title: metaTitleEn,
      meta_desc: metaDescEn,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true, id: newActivity.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating activity:', error);
    if (createdActivityId) {
      try { await getDb(env.DB).delete(activities).where(eq(activities.id, createdActivityId)); }
      catch (cleanupError) { console.error('Activity cleanup error:', cleanupError); }
    }
    if (uploadedFeaturedImageKey && (createdActivityId || !featuredImageAttached)) {
      try { await deleteLogo(env.R2, uploadedFeaturedImageKey); }
      catch (cleanupError) { console.error('Activity image cleanup error:', cleanupError); }
    }
    const badRequest = error instanceof RequestValidationError || error instanceof SyntaxError;
    return new Response(JSON.stringify({ error: badRequest ? errorMessage(error) : 'Failed to save activity' }), {
      status: badRequest ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
