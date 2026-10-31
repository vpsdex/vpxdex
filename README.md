# VPS Provider Directory

[中文文档](README.zh-CN.md)

A bilingual provider directory and activity publishing site built with Astro and Cloudflare. The public site is read-only; all provider and activity content is published through the Bearer-token v1 API by the Hermes agent. There is no admin panel or user login.

## Highlights

- Public bilingual site for provider listings, provider detail pages, and activity content
- Content published exclusively through the `/api/v1/*` JSON API (Bearer token) and image upload endpoint
- Cloudflare-native stack with D1, KV, R2, and Workers
- Custom theme with dark navigation, warm card surfaces, and bilingual UI copy
- Sanitized rich text, signature-checked image uploads, and strict security headers

## Tech Stack

- **Framework**: [Astro](https://astro.build/) v6 (`output: 'server'`, rendered on Cloudflare Workers)
- **Adapter**: [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) v13 (Workers deployment)
- **Database**: Cloudflare D1 + [Drizzle ORM](https://orm.drizzle.team/)
- **Storage**: Cloudflare R2 (provider logos, activity featured images, and rich-text images)
- **Cache**: Cloudflare KV (data cache)
- **Styling**: Tailwind CSS v4 + custom CSS variable theme
- **Publishing**: Bearer-token REST API consumed by Hermes

## UI Theme

- **Accent**: `#f10c00`
- **Primary**: `#0f325b`
- **Dark Navigation**: `#0b2340`
- **Page Background**: `#fffdf8`
- **Card Background**: `#fcf5e2`

## Project Structure

```
├── scripts/
│   ├── clean.mjs          # Pre-build cleanup (kills zombie workerd, removes dist/)
│   ├── indexnow-submit.mjs # Submits changed sitemap URLs to IndexNow after deploy
│   └── seed.mjs           # Seeds sample providers into local D1
├── src/
│   ├── components/        # Astro components (Header, Footer, SEO, ProviderCard, etc.)
│   ├── db/schema.ts       # Drizzle ORM schema (providers, activities, bilingual content tables)
│   ├── i18n/              # i18n config, translations, and utilities
│   ├── layouts/           # BaseLayout with SEO, hreflang, JSON-LD
│   ├── lib/               # Core libraries (api-auth, cache, db, r2, rich-text, validation)
│   ├── middleware.ts      # Locale redirects, canonicalization, CORS, security headers
│   ├── pages/
│   │   ├── [lang]/        # Public pages (home, provider detail, activities) -- bilingual
│   │   ├── api/           # Asset serving + Bearer-token v1 API
│   │   └── sitemap.xml.ts # Dynamic sitemap with hreflang alternates
│   └── styles/global.css  # Tailwind CSS entry
├── drizzle/migrations/    # Generated D1 migration SQL files
├── wrangler.jsonc         # Cloudflare Workers config (D1, KV, R2 bindings)
├── drizzle.config.ts      # Drizzle Kit config
└── astro.config.mjs       # Astro config (server output, Cloudflare adapter, Tailwind)
```

## Prerequisites

- Node.js >= 22.12.0
- A Cloudflare account

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create Cloudflare resources

```bash
# Create D1 database
wrangler d1 create vpsdir-db

# Create KV namespace
wrangler kv namespace create VPSDIR_KV

# Create R2 bucket
wrangler r2 bucket create vpsdir-assets
```

After creating these resources, update `wrangler.jsonc` with the actual IDs returned by each command:

- `d1_databases[0].database_id` -- your D1 database ID
- `kv_namespaces[0].id` -- your KV namespace ID

### 3. Set up the database

```bash
# Generate migration SQL from Drizzle schema
npm run db:generate

# Apply migrations to local D1
npm run db:migrate

# Seed sample providers
npm run db:seed
```

Or run all three in one command:

```bash
npm run db:setup
```

The activity migration creates the following internal compatibility categories. They satisfy the existing database/API relationship but are not shown on public pages:

- `news`
- `events`
- `updates`
- `announcements`

### 4. Configure secrets for local dev

Create a `.dev.vars` file in the project root (copy from `.dev.vars.example`; the file is gitignored, never commit real secrets):

```
API_BEARER_TOKEN=your-local-bearer-token
```

### 5. Start the dev server

```bash
npm run dev
```

The site will be available at `http://localhost:4321`. For testing the built Worker locally:

```bash
npm run build
npx wrangler dev
```

This starts the Worker at `http://localhost:8787`.

### 6. Run checks and tests

```bash
npm run check
npm test
```

`check` validates Astro templates and TypeScript. `test` runs input/image security regressions and the SEO source verification.

## Publishing via Hermes API

All content changes go through `https://vpsdex.com/api/v1/*` with an `Authorization: Bearer <token>` header. The full request/response contract, upload flows, and worked examples are in [`docs/hermes-agent-vpsdir-skill.md`](docs/hermes-agent-vpsdir-skill.md).

Typical flow:

1. `POST /api/v1/upload` with `type=logo` or `type=activity` to store an image in R2.
2. `POST /api/v1/providers` (or `PUT /api/v1/providers/{id}`) with bilingual `contents` and the returned `logo_key`.
3. `POST /api/v1/activities` (or `PUT /api/v1/activities/{id}`) with bilingual `contents` and the returned `featured_image_key`.

Successful writes invalidate the `home:zh` and `home:en` KV cache entries automatically.

## Production Deployment

### 1. Apply migrations to remote D1

```bash
wrangler d1 migrations apply vpsdir-db --remote
```

### 2. Set the production API token

```bash
wrangler secret put API_BEARER_TOKEN
```

Use a strong random string and store it wherever Hermes reads its credentials.

### 3. Deploy

```bash
npm run deploy
```

This runs `clean` -> `astro build` -> `wrangler deploy` -> IndexNow submission.

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Astro dev server |
| `npm run build` | Clean + production build |
| `npm run check` | Validate Astro templates and TypeScript |
| `npm test` | Run security regressions and SEO verification |
| `npm run preview` | Preview built site locally |
| `npm run clean` | Kill zombie workerd processes and remove dist/ |
| `npm run deploy` | Build, deploy to Cloudflare Workers, submit IndexNow |
| `npm run db:generate` | Generate Drizzle migration SQL |
| `npm run db:migrate` | Apply migrations to local D1 |
| `npm run db:seed` | Seed sample provider data |
| `npm run db:setup` | Generate + migrate + seed (all-in-one) |

## Routes

### Public

| Route | Mode | Description |
|---|---|---|
| `/` | SSR | Redirects to `/zh/` |
| `/zh/` `/en/` | SSR | Home page with provider listing (KV cached) |
| `/zh/category/[category]/` `/en/category/[category]/` | SSR | Paginated provider category listing (12 per page) |
| `/zh/provider/[slug]` `/en/provider/[slug]` | SSR | Provider detail with JSON-LD + hreflang |
| `/zh/activities/` `/en/activities/` | SSR | Paginated activity listing (12 per page); featured images appear above card content |
| `/zh/activity/[slug]` `/en/activity/[slug]` | SSR | Bilingual activity detail with featured header image |
| `/sitemap.xml` | SSR | Dynamic sitemap with bilingual alternates |
| `/api/logo/[key]` | SSR | Serves logos from R2 with CDN cache headers |
| `/api/image/[path]` | SSR | Serves public activity and rich-text images from R2 |

### API (Bearer token required)

| Endpoint | Methods | Description |
|---|---|---|
| `/api/v1/providers` | GET, POST | List / create providers |
| `/api/v1/providers/{id}` | GET, PUT, DELETE | Read / update / delete a provider |
| `/api/v1/activities` | GET, POST | List / create activities |
| `/api/v1/activities/{id}` | GET, PUT, DELETE | Read / update / delete an activity |
| `/api/v1/categories` | GET, POST | List / create internal compatibility categories |
| `/api/v1/categories/{id}` | PUT, DELETE | Update / delete a category |
| `/api/v1/upload` | POST | Upload logos, featured images, or rich-text images to R2 |

`GET /api/v1/*` requires the same Bearer token as writes. CORS preflight (`OPTIONS`) is handled by middleware.

### Activity pagination and featured images

- Public provider category pages and the activity list use server-side pagination with 12 records per page.
- Page 1 uses the clean route; later pages use `?page=N`. Invalid or stale overflow pages redirect to the last valid page.
- Legacy activity URLs containing `?category=` redirect to the equivalent unfiltered activity URL.
- Accepted image formats are JPG, PNG, GIF, WebP, and SVG, up to 5 MB. Files are signature-checked before being stored under `activity-images/` in R2.
- A configured featured image is rendered as the first, full-width 16:9 region above the activity card body and as the article header image. Activities without one do not render an empty media region.
- Activity featured images are also included in Open Graph, Twitter Card, and Article JSON-LD metadata.

## Database Schema

### providers

Core provider information with unique bilingual slugs (`slug_zh`, `slug_en`), URL, category, rating, logo key, and active status.

### providers_content

Bilingual content (name, description, meta title, meta description) with a unique composite index on `(provider_id, lang)`.

### activity_categories

Internal compatibility taxonomy retained for the non-null `activities.category_id` relationship and v1 API compatibility. It is not displayed on public cards or article pages.

### activities

Activity base records with an internal category reference, publish time, `featured_image_key`, featured flag, active flag, and view count. Featured image objects use the `activity-images/` R2 prefix and are rendered above activity-card content.

### activities_content

Bilingual activity content (title, slug, description, rich text body, SEO fields) with a unique composite index on `(activity_id, lang)`.

## Security

- **API access**: fixed-time Bearer token comparison against `API_BEARER_TOKEN`; no browser sessions or login endpoints
- **Rich text**: whitelist-based sanitization via `sanitize-html`
- **Uploads**: MIME/signature validation, 5 MB limit, SVG script checks, and R2 key prefixes enforced by type
- **Headers**: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`, referrer and permissions policies applied by middleware

## Cloudflare Free Tier Compliance

| Service | Free Tier Limit |
|---|---|
| D1 | 5M rows read, 100K rows written per day |
| KV | 100K reads, 1K writes per day |
| R2 | 10M Class A ops, 10M Class B ops per month |
| Workers | 100K requests per day |

The architecture minimizes D1 reads and writes with KV caching and lightweight SSR pages to stay within free-tier limits.
