// IndexNow auto-submission for vpsdex.com
// Runs AFTER `wrangler deploy` so the live sitemap already contains new URLs.
// Fetches https://vpsdex.com/sitemap.xml, diffs against .indexnow-cache.json,
// submits changed URLs to both IndexNow endpoints.
// Key file: public/b0027d4356990d2f1301351d751f0b00.txt (live at /<key>.txt)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOST = 'vpsdex.com';
const KEY = 'b0027d4356990d2f1301351d751f0b00';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINTS = ['https://www.bing.com/indexnow', 'https://api.indexnow.org/indexnow'];
// Windows 上 URL.pathname 会得到 /C:/...，直接交给 fs 会变成 C:\C:\... 而写入失败
const CACHE_FILE = fileURLToPath(new URL('../.indexnow-cache.json', import.meta.url));

// Sitemap <loc> values may contain raw CJK characters. IndexNow expects
// percent-encoded URLs, and normalizing both sides keeps the cache diff stable.
function normalizeUrl(value) {
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
}

async function main() {
  const res = await fetch(SITEMAP, { headers: { 'User-Agent': 'vpsdex-indexnow/1.0' } });
  if (!res.ok) {
    console.log(`[indexnow] sitemap fetch failed: ${res.status}, skipping`);
    return;
  }
  const xml = await res.text();
  const urls = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => normalizeUrl(m[1])))];

  if (urls.length === 0) {
    console.log('[indexnow] no sitemap URLs found, skipping');
    return;
  }

  const prev = existsSync(CACHE_FILE)
    ? new Set(JSON.parse(readFileSync(CACHE_FILE, 'utf8')).map(normalizeUrl))
    : new Set();
  const changed = urls.filter((u) => !prev.has(u));

  if (changed.length === 0) {
    console.log(`[indexnow] ${urls.length} URLs, 0 changed — skipping submission`);
    return;
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
      } catch (error) {
        console.log(`[indexnow] ${ep} ERROR ${error.message}`);
        ok = false;
      }
    }
  }

  if (!ok) {
    console.log('[indexnow] some submissions failed; cache NOT updated (will retry next deploy)');
    return;
  }

  try {
    writeFileSync(CACHE_FILE, JSON.stringify(urls));
    console.log(`[indexnow] cache updated: ${urls.length} urls`);
  } catch (error) {
    // 部署已经完成，缓存写入失败不应让整个 deploy 命令报错
    console.log(`[indexnow] cache write failed: ${error.message}`);
  }
}

// 不使用 process.exit()：Node 24 + Windows 在 fetch 后进行强制退出会触发 libuv 断言
try {
  await main();
} catch (error) {
  console.log(`[indexnow] skipped due to error: ${error.message}`);
}
