const SLASH_ROUTES = new Set([
  'activities', 'about', 'methodology', 'disclosure', 'contact', 'privacy', 'terms',
]);
const CATEGORY_ROUTES = new Set(['vps', 'cdn', 'domain', 'email', 'hosting']);

export function canonicalLocaleRedirect(pathname: string): string | null {
  const legacyNovix = pathname.match(/^\/(zh|en)\/activity\/novixlink-review-2026(?:-zh)?\/?$/);
  if (legacyNovix) {
    return `/${legacyNovix[1]}/activity/novixlink-dual-isp-residential-ip-vps-review-2026${legacyNovix[1] === 'zh' ? '-zh' : ''}/`;
  }

  const direct = pathname.match(/^\/(zh|en)\/([^/]+)$/);
  if (direct && SLASH_ROUTES.has(direct[2])) return `${pathname}/`;

  const category = pathname.match(/^\/(zh|en)\/category\/([^/]+)$/);
  if (category && CATEGORY_ROUTES.has(category[2])) return `${pathname}/`;

  return null;
}
