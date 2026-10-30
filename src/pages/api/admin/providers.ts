import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';
import { providers, providersContent } from '../../../db/schema';
import { invalidateCache } from '../../../lib/cache';
import { getDb } from '../../../lib/db';
import { validateImageFile } from '../../../lib/image-upload';
import { deleteLogo, uploadLogo } from '../../../lib/r2';
import { sanitizeRichText } from '../../../lib/rich-text';
import {
  errorMessage, optionalText, requireText, serializeTags, validateHttpUrl,
  validateRating, validateSlug,
} from '../../../lib/validation';

function parseProviderForm(formData: FormData) {
  return {
    slug_zh: validateSlug(formData.get('slug_zh'), 'slug_zh'),
    slug_en: validateSlug(formData.get('slug_en'), 'slug_en'),
    url: validateHttpUrl(formData.get('url')),
    category: requireText(formData.get('category'), 'category', 60),
    rating: validateRating(formData.get('rating')),
    is_active: formData.has('is_active'),
    tags: serializeTags(formData.get('tags')),
    contents: [
      {
        lang: 'zh' as const,
        name: requireText(formData.get('name_zh'), 'name_zh', 200),
        desc: sanitizeRichText(optionalText(formData.get('desc_zh'), 100_000)),
        meta_title: optionalText(formData.get('meta_title_zh'), 200),
        meta_desc: optionalText(formData.get('meta_desc_zh'), 500),
      },
      {
        lang: 'en' as const,
        name: requireText(formData.get('name_en'), 'name_en', 200),
        desc: sanitizeRichText(optionalText(formData.get('desc_en'), 100_000)),
        meta_title: optionalText(formData.get('meta_title_en'), 200),
        meta_desc: optionalText(formData.get('meta_desc_en'), 500),
      },
    ],
  };
}

async function invalidateHome() {
  await Promise.all([
    invalidateCache(env.VPSDIR_KV, 'home:zh'),
    invalidateCache(env.VPSDIR_KV, 'home:en'),
  ]);
}

function errorRedirect(redirect: (path: string) => Response, error: unknown) {
  return redirect(`/admin/?msg=${encodeURIComponent(`保存失败：${errorMessage(error)}`)}`);
}

export const POST: APIRoute = async ({ request, redirect, url }) => {
  const db = getDb(env.DB);
  const method = url.searchParams.get('_method')?.toUpperCase();
  const id = Number(url.searchParams.get('id'));

  if (method === 'DELETE') {
    if (!Number.isInteger(id) || id <= 0) return errorRedirect(redirect, 'Invalid provider ID');
    try {
      const existing = await db.select({ logo_key: providers.logo_key })
        .from(providers).where(eq(providers.id, id)).get();
      if (!existing) return errorRedirect(redirect, 'Provider not found');
      // Delete the database record first. An R2 failure then leaves only a harmless orphan.
      await db.delete(providers).where(eq(providers.id, id));
      if (existing.logo_key) await deleteLogo(env.R2, existing.logo_key);
      await invalidateHome();
      return redirect('/admin/?msg=deleted');
    } catch (error) {
      console.error('Delete provider error:', error);
      return errorRedirect(redirect, error);
    }
  }

  let newLogoKey: string | null = null;
  let insertedId: number | null = null;
  let providerReferencesNewLogo = false;

  try {
    const formData = await request.formData();
    const input = parseProviderForm(formData);
    const logoFile = formData.get('logo');

    if (logoFile instanceof File && logoFile.size > 0) {
      const logoType = await validateImageFile(logoFile);
      newLogoKey = `logos/${input.slug_en}-${crypto.randomUUID()}.${logoType.extension}`;
      await uploadLogo(env.R2, newLogoKey, await logoFile.arrayBuffer(), logoType.contentType);
    }

    if (method === 'PUT') {
      if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid provider ID');
      const existing = await db.select().from(providers).where(eq(providers.id, id)).get();
      if (!existing) throw new Error('Provider not found');

      await db.update(providers).set({
        slug_zh: input.slug_zh, slug_en: input.slug_en, url: input.url,
        category: input.category, rating: input.rating, is_active: input.is_active,
        tags: input.tags, ...(newLogoKey ? { logo_key: newLogoKey } : {}),
        updated_at: new Date().toISOString(),
      }).where(eq(providers.id, id));
      providerReferencesNewLogo = Boolean(newLogoKey);

      for (const content of input.contents) {
        const row = await db.select({ id: providersContent.id }).from(providersContent)
          .where(and(eq(providersContent.provider_id, id), eq(providersContent.lang, content.lang))).get();
        if (row) {
          await db.update(providersContent).set(content).where(eq(providersContent.id, row.id));
        } else {
          await db.insert(providersContent).values({ provider_id: id, ...content });
        }
      }

      if (newLogoKey && existing.logo_key && existing.logo_key !== newLogoKey) {
        await deleteLogo(env.R2, existing.logo_key);
      }
    } else {
      const inserted = await db.insert(providers).values({
        slug_zh: input.slug_zh, slug_en: input.slug_en, url: input.url,
        category: input.category, rating: input.rating, logo_key: newLogoKey,
        tags: input.tags, is_active: input.is_active,
      }).returning({ id: providers.id }).get();
      insertedId = inserted.id;
      await db.insert(providersContent).values(
        input.contents.map((content) => ({ provider_id: inserted.id, ...content })),
      );
    }

    await invalidateHome();
    return redirect('/admin/?msg=saved');
  } catch (error) {
    console.error('Save provider error:', error);
    // Compensate for partially completed create/upload operations.
    if (insertedId) {
      try { await db.delete(providers).where(eq(providers.id, insertedId)); }
      catch (cleanupError) { console.error('Provider cleanup error:', cleanupError); }
    }
    if (newLogoKey && !providerReferencesNewLogo) {
      try { await deleteLogo(env.R2, newLogoKey); }
      catch (cleanupError) { console.error('Logo cleanup error:', cleanupError); }
    }
    return errorRedirect(redirect, error);
  }
};
