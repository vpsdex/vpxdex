/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  VPSDIR_KV: KVNamespace;
  R2: R2Bucket;
  API_BEARER_TOKEN: string;
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}
