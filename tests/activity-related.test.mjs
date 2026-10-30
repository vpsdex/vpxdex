import assert from 'node:assert/strict';
import test from 'node:test';
import { rankRelatedActivities } from '../src/lib/activity-related.ts';

test('related activities prioritize the same provider instead of global latest posts', () => {
  const rows = [
    { id: 2, slug: 'racknerd-review-2026', title: 'RackNerd Review', publishedAt: '2026-08-30T00:00:00Z' },
    { id: 3, slug: 'novixlink-review-2026', title: 'NovixLink VPS Review', publishedAt: '2026-07-01T00:00:00Z' },
    { id: 4, slug: 'novixlink-cox-residential-ip-guide', title: 'NovixLink Cox Residential IP', publishedAt: '2026-06-01T00:00:00Z' },
    { id: 5, slug: 'serverly-promotion-2026', title: 'Serverly Promotion', publishedAt: '2026-08-31T00:00:00Z' },
  ];
  const ranked = rankRelatedActivities(rows, {
    id: 1,
    slug: 'novixlink-dual-isp-residential-ip-vps-review-2026',
    title: 'NovixLink Dual ISP Residential IP VPS Review',
  });
  assert.deepEqual(ranked.slice(0, 2).map((row) => row.id), [4, 3]);
});

test('related activities exclude the current activity and backfill to the limit', () => {
  const rows = [
    { id: 1, slug: 'vps-security-guide-2026', title: 'VPS Security Guide', publishedAt: '2026-08-01T00:00:00Z' },
    { id: 2, slug: 'januscape-kvm-security', title: 'KVM Security', publishedAt: '2026-08-02T00:00:00Z' },
    { id: 3, slug: 'racknerd-review', title: 'RackNerd Review', publishedAt: '2026-08-03T00:00:00Z' },
  ];
  const ranked = rankRelatedActivities(rows, { id: 1, slug: rows[0].slug, title: rows[0].title }, 2);
  assert.deepEqual(ranked.map((row) => row.id), [2, 3]);
});
