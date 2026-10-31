import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDb } from '../lib/db';
import { providers, providersContent, activities, activitiesContent } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
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
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/zh/" />
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
    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/zh/activities/" />
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
      id: providers.id,
      slug_zh: providers.slug_zh,
      slug_en: providers.slug_en,
      updated_at: providers.updated_at,
    })
    .from(providers)
    .where(eq(providers.is_active, true));

  // D1 单条语句最多绑定 100 个参数，不能把全部 provider id 塞进 inArray
  const providerContentRows = await db
    .select({
      provider_id: providersContent.provider_id,
      lang: providersContent.lang,
    })
    .from(providersContent);
  const providerLanguages = new Map<number, Set<string>>();
  for (const row of providerContentRows) {
    if (!providerLanguages.has(row.provider_id)) {
      providerLanguages.set(row.provider_id, new Set());
    }
    providerLanguages.get(row.provider_id)!.add(row.lang);
  }

  for (const p of allProviders) {
    const languages = providerLanguages.get(p.id);
    const availableLocales = locales.filter((locale) => languages?.has(locale));
    if (availableLocales.length === 0) continue;

    const slugFor = (locale: (typeof locales)[number]) => (
      locale === 'zh' ? p.slug_zh : p.slug_en
    );
    const xDefaultLocale = availableLocales.includes('zh') ? 'zh' : availableLocales[0];
    const hreflangs = [
      ...availableLocales.map((locale) => (
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}/provider/${escapeXml(slugFor(locale))}/" />`
      )),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/${xDefaultLocale}/provider/${escapeXml(slugFor(xDefaultLocale))}/" />`,
    ].join('\n');

    for (const locale of availableLocales) {
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/provider/${escapeXml(slugFor(locale))}/</loc>
    <lastmod>${p.updated_at.split(' ')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
${hreflangs}
  </url>`);
    }
  }

  // --- 活动详情页 ---
  const allActivities = await db
    .select({
      id: activities.id,
      is_active: activities.is_active,
      published_at: activities.published_at,
    })
    .from(activities)
    .where(eq(activities.is_active, true));

  // 一次性取回所有语言 slug，避免为每个活动执行两次查询
  const activityContentRows = await db
    .select({
      activity_id: activitiesContent.activity_id,
      lang: activitiesContent.lang,
      slug: activitiesContent.slug,
    })
    .from(activitiesContent)
    .where(inArray(activitiesContent.lang, [...locales]));
  const localizedActivitySlugs = new Map<number, Map<string, string>>();
  for (const row of activityContentRows) {
    if (!localizedActivitySlugs.has(row.activity_id)) {
      localizedActivitySlugs.set(row.activity_id, new Map());
    }
    localizedActivitySlugs.get(row.activity_id)!.set(row.lang, row.slug);
  }

  for (const a of allActivities) {
    const slugs = localizedActivitySlugs.get(a.id);
    const availableLocales = locales.filter((locale) => slugs?.has(locale));
    if (availableLocales.length === 0 || !slugs) continue;

    const xDefaultLocale = availableLocales.includes('zh') ? 'zh' : availableLocales[0];
    const hreflangs = [
      ...availableLocales.map((locale) => (
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${baseUrl}/${locale}/activity/${escapeXml(slugs.get(locale)!)}/" />`
      )),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}/${xDefaultLocale}/activity/${escapeXml(slugs.get(xDefaultLocale)!)}/" />`,
    ].join('\n');

    for (const locale of availableLocales) {
      urls.push(`  <url>
    <loc>${baseUrl}/${locale}/activity/${escapeXml(slugs.get(locale)!)}/</loc>
    <lastmod>${a.published_at.split(' ')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
${hreflangs}
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
