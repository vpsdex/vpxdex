import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../lib/db';
import { providers, activities, activitiesContent } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { locales } from '../i18n/config';
import { providerCategories } from '../lib/provider-categories';

function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const GET: APIRoute = async ({ site }) => {
  const db = getDb(env.DB);
  const baseUrl = site!.href.replace(/\/$/, '');
  const urls: string[] = [];

  // --- 首页 ---
  for (const locale of locales) {
    const hreflangs = locales
      .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l}/" />`)
      .join('\n');
    urls.push(`  <url>
    <loc>${baseUrl}/${locale}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
${hreflangs}
  </url>`);
  }

  // --- 服务商类目列表页 ---
  for (const category of providerCategories) {
    for (const locale of locales) {
      const hreflangs = locales
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l}/category/${category}/" />`)
        .join('\n');
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/category/${category}/</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${hreflangs}
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/zh/category/${category}/" />
  </url>`);
    }
  }

  // --- 活动列表页 ---
  for (const locale of locales) {
    const hreflangs = locales
      .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l}/activities/" />`)
      .join('\n');
    urls.push(`  <url>
    <loc>${baseUrl}/${locale}/activities/</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
${hreflangs}
  </url>`);
  }

  // --- 信任与政策页面 ---
  const staticPages = ['about', 'methodology', 'disclosure', 'contact', 'privacy', 'terms'];
  for (const page of staticPages) {
    for (const locale of locales) {
      const hreflangs = locales
        .map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}/${l}/${page}/" />`)
        .join('\n');
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/${page}/</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
${hreflangs}
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/zh/${page}/" />
  </url>`);
    }
  }

  // --- 服务商详情页 ---
  const allProviders = await db
    .select({
      slug_zh: providers.slug_zh,
      slug_en: providers.slug_en,
      updated_at: providers.updated_at,
    })
    .from(providers)
    .where(eq(providers.is_active, true));

  for (const p of allProviders) {
    for (const locale of locales) {
      const slug = locale === 'zh' ? p.slug_zh : p.slug_en;
      const lastmod = p.updated_at.split(' ')[0];
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/provider/${escapeXml(slug)}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/provider/${escapeXml(p.slug_zh)}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/provider/${escapeXml(p.slug_en)}/" />
  </url>`);
    }
  }

  // --- 活动详情页 ---
  const allActivities = await db
    .select({
      id: activities.id,
      slug: activities.slug,
      is_active: activities.is_active,
      published_at: activities.published_at,
    })
    .from(activities)
    .where(eq(activities.is_active, true));

  for (const a of allActivities) {
    // 获取各语言的 slug
    const zhContent = await db
      .select({ slug: activitiesContent.slug })
      .from(activitiesContent)
      .where(and(eq(activitiesContent.activity_id, a.id), eq(activitiesContent.lang, 'zh')))
      .get();
    const enContent = await db
      .select({ slug: activitiesContent.slug })
      .from(activitiesContent)
      .where(and(eq(activitiesContent.activity_id, a.id), eq(activitiesContent.lang, 'en')))
      .get();

    const zhSlug = zhContent?.slug || a.slug;
    const enSlug = enContent?.slug || a.slug;
    const lastmod = a.published_at.split(' ')[0];

    for (const locale of locales) {
      const slug = locale === 'zh' ? zhSlug : enSlug;
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/activity/${escapeXml(slug)}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="zh" href="${baseUrl}/zh/activity/${escapeXml(zhSlug)}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en/activity/${escapeXml(enSlug)}/" />
  </url>`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
