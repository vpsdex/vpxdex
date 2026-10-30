/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  VPSDIR_KV: KVNamespace;
  R2: R2Bucket;
  ADMIN_SESSION_SECRET: string;
  API_BEARER_TOKEN: string;
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}

declare namespace App {
  interface Locals {
    userId?: number;
  }
}
