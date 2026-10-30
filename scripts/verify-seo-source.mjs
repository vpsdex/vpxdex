import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// pathname 在 Windows 上是 /C:/... 形式,必须用 fileURLToPath 转成原生路径
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const [seo, activity, activityList, provider, home, category, pagination, card, utils, middleware, trust, sitemap] = await Promise.all([
  read('src/components/SEO.astro'),
  read('src/pages/[lang]/activity/[slug].astro'),
  read('src/pages/[lang]/activities/index.astro'),
  read('src/pages/[lang]/provider/[slug].astro'),
  read('src/pages/[lang]/index.astro'),
  read('src/pages/[lang]/category/[category].astro'),
  read('src/components/Pagination.astro'),
  read('src/components/ProviderCard.astro'),
  read('src/i18n/utils.ts'),
  read('src/middleware.ts'),
  read('src/pages/[lang]/[page].astro'),
  read('src/pages/sitemap.xml.ts'),
]);

for (const source of [seo, activity, provider, home, category, sitemap]) {
  assert(!source.includes('Astro.url.origin'), 'Production SEO URL must not depend on request origin');
  assert(!source.includes('Astro.url.href'), 'Canonical must not include query parameters');
}
assert(activity.includes('localizedSlugs.get(l)'), 'Activity hreflang must use each locale content slug');
assert(activity.includes('xDefaultUrl'), 'Activity pages need a localized x-default URL');
assert(provider.includes("getProviderAlternateUrl('zh'"), 'Provider x-default must point to its Chinese detail page');
assert(utils.includes('provider/${slug}/`'), 'Provider alternate helper must emit a trailing slash');
assert(card.includes('provider/${slug}/`'), 'Provider cards must link directly to canonical slash URLs');
assert(home.includes('provider/${escapeHtml(slug)}/'), 'Client-rendered provider cards must keep canonical slashes');
assert(!home.includes('searchTags.innerHTML'), 'Homepage tags must be server-rendered to prevent CLS');
assert(home.includes('homepageTags.map'), 'Homepage must render tags during SSR');
assert(home.includes('items.slice(0, 6)'), 'Homepage must limit each category to six providers');
assert(category.includes("'@type': 'CollectionPage'"), 'Category pages need CollectionPage schema');
assert(category.includes('xDefault'), 'Category pages need an x-default URL');
assert(category.includes('.limit(pageSize)') && category.includes('.offset((currentPage - 1) * pageSize)'), 'Category pages need database pagination');
assert(activityList.includes('.limit(pageSize)') && activityList.includes('.offset((currentPage - 1) * pageSize)'), 'Activity pages need database pagination');
assert(activityList.includes('featured_image_key') && activity.includes('featuredImageUrl'), 'Activity featured images must reach lists and article SEO');
assert(pagination.includes('rel="prev"') && pagination.includes('rel="next"'), 'Pagination links need prev/next relationships');
assert(sitemap.includes('category/${category}/'), 'Sitemap must include provider category pages');
for (const header of ['Strict-Transport-Security', 'Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
  assert(middleware.includes(header), `Missing security header: ${header}`);
}
for (const page of ['about', 'methodology', 'disclosure', 'contact', 'privacy', 'terms']) {
  assert(trust.includes(`${page}:`), `Missing trust page content: ${page}`);
  assert(sitemap.includes(`'${page}'`), `Missing trust page in sitemap: ${page}`);
}
assert(provider.includes("'@type': 'FAQPage'"), 'Provider FAQ schema must be retained');
console.log('VPSDex SEO source verification passed');
