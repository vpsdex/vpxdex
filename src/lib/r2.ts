export async function uploadLogo(
  r2: R2Bucket,
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await r2.put(key, data, {
    httpMetadata: { contentType },
  });
}

export async function deleteLogo(r2: R2Bucket, key: string): Promise<void> {
  await r2.delete(key);
}

export function getLogoUrl(key: string | null, updatedAt?: string | null): string {
  if (!key) return '/images/placeholder.svg';
  // Add timestamp to bust cache when logo is updated
  const timestamp = updatedAt ? `?v=${new Date(updatedAt).getTime()}` : '';
  return `/api/logo/${key}${timestamp}`;
}

export function getActivityImageUrl(key: string | null): string | null {
  return key ? `/api/image/${key}` : null;
}
