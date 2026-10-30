export const SUPPORTED_LOCALES = ['zh', 'en'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type ProviderTag = string | { zh?: string; en?: string };

export class RequestValidationError extends Error {
  override name = 'RequestValidationError';
}

const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u;

export function requireText(value: unknown, field: string, maxLength = 255): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RequestValidationError(`${field} is required`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new RequestValidationError(`${field} must be at most ${maxLength} characters`);
  }
  return normalized;
}

export function optionalText(value: unknown, maxLength = 1000): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new RequestValidationError('Expected text value');
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new RequestValidationError(`Text must be at most ${maxLength} characters`);
  }
  return normalized;
}

export function validateSlug(value: unknown, field = 'slug'): string {
  const slug = requireText(value, field, 160);
  if (!SLUG_PATTERN.test(slug)) {
    throw new RequestValidationError(`${field} may only contain letters, numbers, hyphens and underscores`);
  }
  return slug;
}

export function validateHttpUrl(value: unknown, field = 'url'): string {
  const raw = requireText(value, field, 2048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RequestValidationError(`${field} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new RequestValidationError(`${field} must use http or https`);
  }
  return parsed.toString();
}

export function validateRating(value: unknown): number {
  if (value == null || value === '') return 0;
  const rating = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new RequestValidationError('rating must be a number between 0 and 5');
  }
  return rating;
}

export function validatePositiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RequestValidationError(`${field} must be a positive integer`);
  }
  return parsed;
}

export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new RequestValidationError(`${field} must be a boolean`);
  return value;
}

export function validateDate(value: unknown, field = 'published_at'): string {
  if (typeof value !== 'string' || !value.trim()) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new RequestValidationError(`${field} must be a valid date`);
  return date.toISOString();
}

function normalizeTag(tag: unknown): ProviderTag {
  if (typeof tag === 'string') return requireText(tag, 'tag', 60);
  if (!tag || typeof tag !== 'object' || Array.isArray(tag)) {
    throw new RequestValidationError('Each tag must be a string or a bilingual object');
  }
  const record = tag as Record<string, unknown>;
  const zh = optionalText(record.zh, 60) || undefined;
  const en = optionalText(record.en, 60) || undefined;
  if (!zh && !en) throw new RequestValidationError('A bilingual tag must contain zh or en');
  return { ...(zh && { zh }), ...(en && { en }) };
}

export function parseTags(value: unknown): ProviderTag[] {
  if (value == null || value === '') return [];
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new RequestValidationError('tags must be valid JSON');
    }
  }
  if (!Array.isArray(parsed)) throw new RequestValidationError('tags must be an array');
  if (parsed.length > 30) throw new RequestValidationError('tags may contain at most 30 items');
  return parsed.map(normalizeTag);
}

export function serializeTags(value: unknown): string | null {
  const tags = parseTags(value);
  return tags.length ? JSON.stringify(tags) : null;
}

export function parseStoredTags(value: string | null | undefined): ProviderTag[] {
  try {
    return parseTags(value);
  } catch {
    return [];
  }
}

export function validateLocale(value: unknown): SupportedLocale {
  if (value !== 'zh' && value !== 'en') throw new RequestValidationError('lang must be zh or en');
  return value;
}

export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  return error instanceof Error ? error.message : 'Invalid request';
}
