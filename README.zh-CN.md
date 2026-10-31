# VPS 服务商目录

[English](README.md)

这是一个基于 Astro 和 Cloudflare 构建的中英双语服务商目录与活动发布网站。公开站点只读展示内容；所有服务商与活动内容统一由 Hermes 通过 Bearer Token 的 v1 API 发布，不再提供后台界面或用户登录。

## 项目亮点

- 提供中英双语的服务商列表、服务商详情页和活动内容页面
- 内容仅通过 `/api/v1/*` JSON API（Bearer Token）与图片上传接口发布
- 原生使用 Cloudflare D1、KV、R2 与 Workers 组成完整站点能力
- 采用深色导航、暖色卡片和双语界面的自定义主题风格
- 富文本白名单过滤、图片签名校验与严格安全响应头

## 技术栈

- **框架**: [Astro](https://astro.build/) v6 (`output: 'server'`，运行在 Cloudflare Workers 上)
- **适配器**: [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) v13 (Workers 部署)
- **数据库**: Cloudflare D1 + [Drizzle ORM](https://orm.drizzle.team/)
- **存储**: Cloudflare R2（服务商 Logo、活动特色图片与富文本图片）
- **缓存**: Cloudflare KV (数据缓存)
- **样式**: Tailwind CSS v4 + 基于 CSS 变量的自定义主题
- **发布方式**: 供 Hermes 调用的 Bearer Token REST API

## 当前主题

- **强调色**: `#f10c00`
- **主色**: `#0f325b`
- **深色导航**: `#0b2340`
- **页面背景**: `#fffdf8`
- **卡片背景**: `#fcf5e2`

## 项目结构

```
├── scripts/
│   ├── clean.mjs          # 构建前清理 (终止残留 workerd 进程, 删除 dist/)
│   ├── indexnow-submit.mjs # 部署后向 IndexNow 提交变更 URL
│   └── seed.mjs           # 向本地 D1 写入示例服务商数据
├── src/
│   ├── components/        # Astro 组件 (Header, Footer, SEO, ProviderCard 等)
│   ├── db/schema.ts       # Drizzle ORM 数据库模型 (providers, activities 及双语内容表)
│   ├── i18n/              # 国际化配置、翻译文件和工具函数
│   ├── layouts/           # BaseLayout, 含 SEO、hreflang、JSON-LD
│   ├── lib/               # 核心库 (api-auth, cache, db, r2, rich-text, validation)
│   ├── middleware.ts      # 语言重定向、规范化、CORS 与安全响应头
│   ├── pages/
│   │   ├── [lang]/        # 公开页面 (首页, 服务商详情, 活动) -- 双语
│   │   ├── api/           # 图片资源服务 + Bearer Token v1 API
│   │   └── sitemap.xml.ts # 动态站点地图, 含 hreflang 备用链接
│   └── styles/global.css  # Tailwind CSS 入口
├── drizzle/migrations/    # 生成的 D1 迁移 SQL 文件
├── wrangler.jsonc         # Cloudflare Workers 配置 (D1, KV, R2 绑定)
├── drizzle.config.ts      # Drizzle Kit 配置
└── astro.config.mjs       # Astro 配置 (server 输出, Cloudflare 适配器, Tailwind)
```

## 前置要求

- Node.js >= 22.12.0
- Cloudflare 账户

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 Cloudflare 资源

```bash
# 创建 D1 数据库
wrangler d1 create vpsdir-db

# 创建 KV 命名空间
wrangler kv namespace create VPSDIR_KV

# 创建 R2 存储桶
wrangler r2 bucket create vpsdir-assets
```

创建完成后，将各命令返回的实际 ID 填入 `wrangler.jsonc`：

- `d1_databases[0].database_id` -- 你的 D1 数据库 ID
- `kv_namespaces[0].id` -- 你的 KV 命名空间 ID

### 3. 初始化数据库

```bash
# 根据 Drizzle schema 生成迁移 SQL
npm run db:generate

# 将迁移应用到本地 D1
npm run db:migrate

# 写入示例服务商数据
npm run db:seed
```

或一键执行：

```bash
npm run db:setup
```

活动模块迁移会创建以下内部兼容分类。它们仅用于满足现有数据库/API 关联，不再显示于公开页面：

- `news`
- `events`
- `updates`
- `announcements`

### 4. 配置本地开发密钥

复制模板 `.dev.vars.example` 为 `.dev.vars`,填入随机值(`.dev.vars` 已被 gitignore,真实密钥严禁提交):

```
API_BEARER_TOKEN=your-local-bearer-token
```

### 5. 启动开发服务器

```bash
npm run dev
```

站点地址：`http://localhost:4321`。如需测试构建后的 Worker：

```bash
npm run build
npx wrangler dev
```

Worker 地址：`http://localhost:8787`。

### 6. 执行检查与测试

```bash
npm run check
npm test
```

`check` 执行 Astro 模板与 TypeScript 检查；`test` 执行输入/图片安全回归测试与 SEO 源码检查。

## 通过 Hermes API 发布内容

所有内容变更均通过 `https://vpsdex.com/api/v1/*` 完成，并在请求头携带 `Authorization: Bearer <token>`。完整的请求/响应格式、上传流程与示例见 [`docs/hermes-agent-vpsdir-skill.md`](docs/hermes-agent-vpsdir-skill.md)。

典型流程：

1. `POST /api/v1/upload`，使用 `type=logo` 或 `type=activity` 将图片存入 R2。
2. `POST /api/v1/providers`（或 `PUT /api/v1/providers/{id}`）提交双语 `contents` 与返回的 `logo_key`。
3. `POST /api/v1/activities`（或 `PUT /api/v1/activities/{id}`）提交双语 `contents` 与返回的 `featured_image_key`。

写入成功后会自动清除 `home:zh` 与 `home:en` 的 KV 缓存。

## 生产部署

### 1. 将迁移应用到远程 D1

```bash
wrangler d1 migrations apply vpsdir-db --remote
```

### 2. 设置生产环境 API Token

```bash
wrangler secret put API_BEARER_TOKEN
```

请使用强随机字符串，并保存在 Hermes 读取凭据的位置。

### 3. 部署

```bash
npm run deploy
```

执行流程：`clean` -> `astro build` -> `wrangler deploy` -> IndexNow 提交。

## NPM 脚本

| 脚本                    | 说明                        |
| --------------------- | ------------------------- |
| `npm run dev`         | 启动 Astro 开发服务器            |
| `npm run build`       | 清理 + 生产构建                 |
| `npm run check`       | Astro 模板与 TypeScript 检查    |
| `npm test`            | 安全回归测试 + SEO 源码检查      |
| `npm run preview`     | 本地预览构建产物                  |
| `npm run clean`       | 终止残留 workerd 进程并删除 dist/  |
| `npm run deploy`      | 构建、部署到 Cloudflare Workers 并提交 IndexNow |
| `npm run db:generate` | 生成 Drizzle 迁移 SQL         |
| `npm run db:migrate`  | 将迁移应用到本地 D1               |
| `npm run db:seed`     | 写入示例服务商数据                 |
| `npm run db:setup`    | 生成 + 迁移 + 写入数据 (一键执行)     |

## 路由

### 公开页面

| 路由                                          | 模式  | 说明                          |
| ------------------------------------------- | --- | --------------------------- |
| `/`                                         | SSR | 重定向到 `/zh/`                 |
| `/zh/` `/en/`                               | SSR | 首页, 服务商列表 (KV 缓存)           |
| `/zh/category/[category]/` `/en/category/[category]/` | SSR | 服务商类目分页列表（每页 12 条） |
| `/zh/provider/[slug]` `/en/provider/[slug]` | SSR | 服务商详情, 含 JSON-LD + hreflang |
| `/zh/activities/` `/en/activities/`         | SSR | 活动分页列表（每页 12 条），特色图片位于卡片内容上方 |
| `/zh/activity/[slug]` `/en/activity/[slug]` | SSR | 双语活动详情，支持特色头图               |
| `/sitemap.xml`                              | SSR | 动态站点地图, 含双语备用链接             |
| `/api/logo/[key]`                           | SSR | 从 R2 提供 Logo, 带 CDN 缓存头     |
| `/api/image/[path]`                         | SSR | 从 R2 提供活动特色图和富文本图片           |

### API（需 Bearer Token）

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/v1/providers` | GET, POST | 查询 / 创建服务商 |
| `/api/v1/providers/{id}` | GET, PUT, DELETE | 查询 / 更新 / 删除服务商 |
| `/api/v1/activities` | GET, POST | 查询 / 创建活动 |
| `/api/v1/activities/{id}` | GET, PUT, DELETE | 查询 / 更新 / 删除活动 |
| `/api/v1/categories` | GET, POST | 查询 / 创建内部兼容分类 |
| `/api/v1/categories/{id}` | PUT, DELETE | 更新 / 删除分类 |
| `/api/v1/upload` | POST | 上传 Logo、活动特色图或富文本图片到 R2 |

`GET /api/v1/*` 与写入请求一样要求 Bearer Token。CORS 预检（`OPTIONS`）由中间件统一处理。

### 活动分页与特色图片

- 服务商类目列表和最新活动列表均使用服务端分页，每页 12 条。
- 第 1 页使用无参数规范地址，后续页面使用 `?page=N`；无效或过期的越界页会跳转至最后一个有效页。
- 带有旧 `?category=` 参数的活动地址会跳转至对应的无分类活动地址。
- 支持 JPG、PNG、GIF、WebP、SVG，最大 5MB；上传前校验文件签名，随后存入 R2 的 `activity-images/` 目录。
- 已设置的特色图固定作为卡片第一个区域，以全宽 16:9 显示在卡片正文上方，并作为文章头图；未设置时不渲染空白图片区。
- 特色图片同时写入 Open Graph、Twitter Card 和 Article JSON-LD 元数据。

## 数据库模型

### providers

服务商核心信息，包含唯一的双语 slug (`slug_zh`, `slug_en`)、URL、分类、评分、Logo 键名和启用状态。

### providers\_content

双语内容 (名称、描述、SEO 标题、SEO 描述)，`(provider_id, lang)` 有唯一复合索引。

### activity\_categories

为兼容非空的 `activities.category_id` 关系及 v1 API 而保留的内部分类表。公开卡片和文章页均不显示分类。

### activities

活动主表，包含内部分类引用、发布时间、`featured_image_key`、推荐状态、启用状态和浏览量等字段。特色图片使用 R2 的 `activity-images/` 前缀，并固定显示在活动卡片内容上方。

### activities\_content

活动双语内容表，包含标题、slug、摘要、富文本正文和 SEO 字段，`(activity_id, lang)` 上有唯一复合索引。

## 安全机制

- **API 访问**: 使用固定时间比较校验 `API_BEARER_TOKEN`；不提供浏览器会话或登录端点
- **富文本**: 通过 `sanitize-html` 白名单过滤
- **上传**: 校验 MIME/文件签名、限制 5MB、检查 SVG 脚本，并按类型强制 R2 键前缀
- **响应头**: 中间件统一设置 CSP、HSTS、`X-Frame-Options`、`X-Content-Type-Options`、Referrer 与 Permissions Policy

## Cloudflare 免费套餐合规

| 服务      | 免费套餐限制                          |
| ------- | ------------------------------- |
| D1      | 每天 500 万行读取, 10 万行写入            |
| KV      | 每天 10 万次读取, 1000 次写入            |
| R2      | 每月 1000 万次 A 类操作, 1000 万次 B 类操作 |
| Workers | 每天 10 万次请求                      |

架构设计通过 KV 缓存减少 D1 读写压力，并使用轻量 SSR 页面控制资源消耗，以充分利用免费套餐额度。
