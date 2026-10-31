export const defaultLocale = 'zh' as const;
export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export const localeMeta: Record<Locale, {
  htmlLang: string;
  ogLocale: string;
  label: string;
  switchLabel: string;
  languageName: string;
}> = {
  zh: {
    htmlLang: 'zh-CN',
    ogLocale: 'zh_CN',
    label: '中文',
    switchLabel: '切换到中文',
    languageName: '中文',
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    label: 'EN',
    switchLabel: 'Switch to English',
    languageName: 'English',
  },
};

export function isValidLocale(lang: string): lang is Locale {
  return locales.includes(lang as Locale);
}
