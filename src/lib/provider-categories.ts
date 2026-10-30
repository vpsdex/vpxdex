export const primaryProviderCategories = ['vps', 'cdn', 'domain', 'email'] as const;
export const providerCategories = [...primaryProviderCategories, 'hosting'] as const;

export type ProviderCategory = (typeof providerCategories)[number];

export function isProviderCategory(value: string): value is ProviderCategory {
  return providerCategories.includes(value as ProviderCategory);
}
