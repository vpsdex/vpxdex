export interface ActivityLinkCandidate {
  id: number;
  slug: string;
  title: string;
  publishedAt: string;
}

const STOP_WORDS = new Set([
  '2025', '2026', 'activity', 'best', 'budget', 'buying', 'cheap', 'cloud',
  'complete', 'deal', 'deals', 'deep', 'full', 'guide', 'hosting', 'launch',
  'news', 'offer', 'promotion', 'provider', 'review', 'sale', 'server', 'servers',
  'service', 'services', 'the', 'update', 'vps', 'with',
]);

export function activityTerms(...values: Array<string | null | undefined>): Set<string> {
  const terms = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
  return new Set(terms);
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const term of left) if (right.has(term)) count += 1;
  return count;
}

export function rankRelatedActivities(
  candidates: ActivityLinkCandidate[],
  seed: { id?: number; slug: string; title?: string },
  limit = 4,
): ActivityLinkCandidate[] {
  const seedSlugTerms = activityTerms(seed.slug);
  const seedTitleTerms = activityTerms(seed.title);
  const ranked = candidates
    .filter((candidate) => candidate.id !== seed.id)
    .map((candidate) => {
      const slugTerms = activityTerms(candidate.slug);
      const titleTerms = activityTerms(candidate.title);
      const score = overlap(seedSlugTerms, slugTerms) * 8
        + overlap(seedSlugTerms, titleTerms) * 5
        + overlap(seedTitleTerms, titleTerms) * 2;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score
      || Date.parse(b.candidate.publishedAt) - Date.parse(a.candidate.publishedAt));

  const relevant = ranked.filter((entry) => entry.score > 0);
  const fallback = ranked.filter((entry) => entry.score === 0);
  return [...relevant, ...fallback].slice(0, limit).map((entry) => entry.candidate);
}
