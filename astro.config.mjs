// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // 生产域名，用于生成 canonical、og:url、JSON-LD 等绝对 URL
  // robots.txt 与 sitemap.xml 中的域名需与此保持一致
  site: 'https://vpsdex.com',
  output: 'server',
  adapter: cloudflare({ sessionKVBindingName: 'VPSDIR_KV' }),
  vite: {
    plugins: [tailwindcss()],
  },
  // API 端点通过 Bearer Token 鉴权，需要允许跨站 POST 请求（JSON / multipart）
  security: {
    checkOrigin: false,
  },
});
