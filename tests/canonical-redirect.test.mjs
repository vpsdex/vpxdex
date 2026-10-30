import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalLocaleRedirect } from '../src/lib/canonical-redirect.ts';

test('normalizes known bilingual list, category and trust routes', () => {
  assert.equal(canonicalLocaleRedirect('/en/activities'), '/en/activities/');
  assert.equal(canonicalLocaleRedirect('/zh/category/vps'), '/zh/category/vps/');
  assert.equal(canonicalLocaleRedirect('/en/methodology'), '/en/methodology/');
  assert.equal(canonicalLocaleRedirect('/en/provider/racknerd'), null);
  assert.equal(canonicalLocaleRedirect('/api/v1/providers'), null);
});

test('redirects both legacy NovixLink locale slugs to the complete review', () => {
  assert.equal(
    canonicalLocaleRedirect('/en/activity/novixlink-review-2026/'),
    '/en/activity/novixlink-dual-isp-residential-ip-vps-review-2026/',
  );
  assert.equal(
    canonicalLocaleRedirect('/zh/activity/novixlink-review-2026-zh'),
    '/zh/activity/novixlink-dual-isp-residential-ip-vps-review-2026-zh/',
  );
});
