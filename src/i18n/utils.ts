import { defaultLocale, type Locale, isValidLocale } from './config';
import translations from './translations';

export function t(lang: Locale, key: string): string {
  const keys = key.split('.');
  let result: Record<string, unknown> | string | undefined = translations[lang];
  for (const k of keys) {
    if (result && typeof result === 'object') {
      result = (result as Record<string, unknown>)[k] as typeof result;
    } else {
      return key;
    }
  }
  return typeof result === 'string' ? result : key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  const lang = segments[0];
  return isValidLocale(lang) ? lang : defaultLocale;
}

export function getAlternateUrl(url: URL, targetLocale: Locale): string {
  const segments = url.pathname.split('/').filter(Boolean);
  const currentLocale = segments[0];
  if (isValidLocale(currentLocale)) {
    segments[0] = targetLocale;
  } else {
    segments.unshift(targetLocale);
  }
  return `/${segments.join('/')}/`;
}

export function getProviderAlternateUrl(
  targetLocale: Locale,
  slugZh: string,
  slugEn: string,
): string {
  const slug = targetLocale === 'zh' ? slugZh : slugEn;
  return `/${targetLocale}/provider/${slug}/`;
}
