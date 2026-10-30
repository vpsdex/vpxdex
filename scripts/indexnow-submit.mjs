// IndexNow auto-submission for vpsdex.com
// Runs AFTER `wrangler deploy` so the live sitemap already contains new URLs.
// Fetches https://vpsdex.com/sitemap.xml, diffs against .indexnow-cache.json,
// submits changed URLs to both IndexNow endpoints.
// Key file: public/b0027d4356990d2f1301351d751f0b00.txt (live at /<key>.txt)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const HOST = 'vpsdex.com';
const KEY = 'b0027d4356990d2f1301351d751f0b00';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINTS = ['https://www.bing.com/indexnow', 'https://api.indexnow.org/indexnow'];
const CACHE_FILE = new URL('../.indexnow-cache.json', import.meta.url).pathname;

const res = await fetch(SITEMAP, { headers: { 'User-Agent': 'vpsdex-indexnow/1.0' } });
if (!res.ok) {
  console.log(`[indexnow] sitemap fetch failed: ${res.status}, skipping`);
  process.exit(0);
}
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => !/[^\x00-\x7F]/.test(u)); // skip non-ASCII paths

if (urls.length === 0) {
  console.log('[indexnow] no sitemap URLs found, skipping');
  process.exit(0);
}

const prev = existsSync(CACHE_FILE)
  ? new Set(JSON.parse(readFileSync(CACHE_FILE, 'utf8')))
  : new Set();
const changed = urls.filter((u) => !prev.has(u));

if (changed.length === 0) {
  console.log(`[indexnow] ${urls.length} URLs, 0 changed — skipping submission`);
  process.exit(0);
}

// IndexNow batch limit is 10k per request; chunk for safety
const chunks = [];
for (let i = 0; i < changed.length; i += 5000) chunks.push(changed.slice(i, i + 5000));

let ok = true;
for (const chunk of chunks) {
  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: chunk });
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'vpsdex-indexnow/1.0' },
        body,
      });
      console.log(`[indexnow] ${ep} -> ${r.status} (${chunk.length} urls)`);
      if (r.status >= 400) ok = false;
    } catch (e) {
      console.log(`[indexnow] ${ep} ERROR ${e.message}`);
      ok = false;
    }
  }
}

if (ok) {
  writeFileSync(CACHE_FILE, JSON.stringify(urls));
  console.log(`[indexnow] cache updated: ${urls.length} urls`);
} else {
  console.log('[indexnow] some submissions failed; cache NOT updated (will retry next deploy)');
}
