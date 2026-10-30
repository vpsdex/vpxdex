# VPS 服务商目录

[English](README.md)

这是一个基于 Astro 和 Cloudflare 构建的中英双语服务商目录与活动发布网站。它同时包含面向访客的公开站点、用于管理服务商与活动内容的后台，以及围绕 Cloudflare 免费套餐设计的轻量部署方案。

## 项目亮点

- 提供中英双语的服务商列表、服务商详情页和活动内容页面
- 后台支持服务商管理、活动管理、特色图片上传与当前用户密码修改
- 原生使用 Cloudflare D1、KV、R2 与 Workers 组成完整站点能力
- 使用 PBKDF2 密码哈希与 HMAC 签名会话实现轻量认证
- 采用深色导航、暖色卡片和双语界面的自定义主题风格

## 技术栈

- **框架**: [Astro](https://astro.build/) v6 (`output: 'server'`，运行在 Cloudflare Workers 上)
- **适配器**: [@astrojs/cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) v13 (Workers 部署)
- **数据库**: Cloudflare D1 + [Drizzle ORM](https://orm.drizzle.team/)
- **存储**: Cloudflare R2（服务商 Logo、活动特色图片与富文本图片）
- **缓存**: Cloudflare KV (数据缓存)
- **样式**: Tailwind CSS v4 + 基于 CSS 变量的自定义主题
- **编辑器**: TipTap 富文本编辑器，用于后台活动内容编辑
- **安全**: Web Crypto API (PBKDF2 密码哈希, HMAC 会话签名)

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
│   └── seed.mjs           # 向本地 D1 写入管理员用户和示例服务商数据
├── src/
│   ├── components/        # Astro 组件 (Header, Footer, SEO, ProviderCard, AdminHeader 等)
│   ├── db/schema.ts       # Drizzle ORM 数据库模型 (providers, activities, users 及双语内容表)
│   ├── i18n/              # 国际化配置、翻译文件和工具函数
│   ├── layouts/           # BaseLayout, 含 SEO、hreflang、JSON-LD
│   ├── lib/               # 核心库 (auth, cache, db, r2, rich-text)
│   ├── middleware.ts       # 路由保护 + 语言重定向
│   ├── pages/
│   │   ├── [lang]/        # 公开页面 (首页, 服务商详情, 活动) -- 双语
│   │   ├── admin/         # 管理后台 (登录, 服务商管理, 活动管理, 用户设置, 编辑页)
│   │   ├── api/           # API 路由 (认证, CRUD, 缓存刷新, 上传, 资源服务)
│   │   └── sitemap.xml.ts # 动态站点地图, 含 hreflang 备用链接
│   ├── scripts/           # 后台前端脚本 (富文本编辑器等)
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

# 写入管理员用户 (admin/admin123) 和示例服务商数据
npm run db:seed
```

或一键执行：

```bash
npm run db:setup
```

活动模块迁移会创建以下内部兼容分类。它们仅用于满足现有数据库/API 关联，不再显示于公开活动页和后台活动界面：

- `news`
- `events`
- `updates`
- `announcements`

### 4. 配置本地开发密钥

复制模板 `.dev.vars.example` 为 `.dev.vars`,填入随机值(`.dev.vars` 已被 gitignore,真实密钥严禁提交):

```
ADMIN_SESSION_SECRET=any-random-string-for-local-dev
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

## 生产部署

### 1. 将迁移应用到远程 D1

```bash
wrangler d1 migrations apply vpsdir-db --remote
```

### 2. 设置生产环境密钥

```bash
wrangler secret put ADMIN_SESSION_SECRET
```

`ADMIN_SESSION_SECRET` 请使用强随机字符串 (32 字符以上)。

### 3. 部署

```bash
npm run deploy
```

执行流程：`clean` -> `astro build` -> `wrangler deploy`。

### 4. 初始化远程数据库 (仅首次部署)

首次部署后，向远程 D1 写入管理员用户：

```bash
wrangler d1 execute vpsdir-db --remote --command="INSERT INTO users (username, password_hash) VALUES ('admin', '<your-hash>')"
```

生成密码哈希的方法：先在本地执行 seed 脚本，再从本地数据库复制哈希值：

```bash
npm run db:seed
wrangler d1 execute vpsdir-db --local --command="SELECT password_hash FROM users WHERE username='admin'"
```

## NPM 脚本

| 脚本                    | 说明                        |
| --------------------- | ------------------------- |
| `npm run dev`         | 启动 Astro 开发服务器            |
| `npm run build`       | 清理 + 生产构建                 |
| `npm run check`       | Astro 模板与 TypeScript 检查    |
| `npm test`            | 安全回归测试 + SEO 源码检查      |
| `npm run preview`     | 本地预览构建产物                  |
| `npm run clean`       | 终止残留 workerd 进程并删除 dist/  |
| `npm run deploy`      | 构建并部署到 Cloudflare Workers |
| `npm run db:generate` | 生成 Drizzle 迁移 SQL         |
| `npm run db:migrate`  | 将迁移应用到本地 D1               |
| `npm run db:seed`     | 写入管理员用户和示例数据              |
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

### 管理后台

| 路由                            | 说明                     |
| ----------------------------- | ---------------------- |
| `/admin/login`                | 管理员登录                  |
| `/admin/`                     | 服务商管理 -- 服务商列表、添加表单、缓存刷新 |
| `/admin/activities/`          | 活动管理 -- 列表、新建、删除、上传特色图 |
| `/admin/activities/edit/[id]` | 编辑双语内容，更换或移除特色图片       |
| `/admin/edit/[id]`            | 编辑服务商 (双语字段, Logo 上传)  |
| `/admin/settings`             | 用户设置 -- 修改当前用户密码       |

## 后台功能

- **服务商管理**: 新增、编辑、删除服务商，上传 Logo，刷新 KV 缓存
- **活动管理**: 新增、编辑、删除活动，上传、预览、更换或移除特色图片；活动界面不再暴露分类
- **用户设置**: 修改当前已登录管理员用户的密码

### 活动分页与特色图片

- 服务商类目列表和最新活动列表均使用服务端分页，每页 12 条。
- 第 1 页使用无参数规范地址，后续页面使用 `?page=N`；无效或过期的越界页会跳转至最后一个有效页。
- 带有旧 `?category=` 参数的活动地址会跳转至对应的无分类活动地址。
- 后台活动新增/编辑请求使用 `multipart/form-data`：`featured_image` 用于上传特色图，编辑时传 `remove_featured_image=1` 可移除。
- 支持 JPG、PNG、GIF、WebP、SVG，最大 5MB；上传前校验文件签名，随后存入 R2 的 `activity-images/` 目录。
- 已设置的特色图固定作为卡片第一个区域，以全宽 16:9 显示在卡片正文上方，并作为文章头图；未设置时不渲染空白图片区。
- 特色图片同时写入 Open Graph、Twitter Card 和 Article JSON-LD 元数据。

## 后台样式约定

- 后台页面已经在 `src/styles/global.css` 中沉淀了一组通用样式类，并在 `src/components/` 中抽出了一批共享 Astro 组件。新增或调整后台页面时，优先复用这些类和组件，而不是继续堆叠零散的 Tailwind 工具类或重复写页面骨架。

单独速查文档：[`docs/admin-ui-cheat-sheet.zh-CN.md`](docs/admin-ui-cheat-sheet.zh-CN.md)

- **卡片与区块**: 使用 `admin-card`、`admin-section-header`、`admin-section-title`、`admin-section-desc`
- **提示与空状态**: 使用 `admin-alert-*`、`admin-help-text`、`admin-empty-state`、`admin-empty-state-table`
- **表单控件**: 使用 `admin-label`、`admin-input`、`admin-checkbox-row`、`admin-checkbox`、`admin-checkbox-label`
- **按钮与链接**: 使用 `admin-btn-*`、`admin-action-link`、`admin-btn-danger`
- **表格与状态**: 使用 `admin-table-card`、`admin-table-wrap`、`admin-table-head`、`admin-cell*`、`admin-badge*`
- **上传与标签**: 使用 `admin-upload-*`、`admin-tag-pill`、`admin-tag-pill-remove`
- **共享组件**: 优先复用 `AdminAlert`、`AdminSectionCard`、`AdminDataTable`、`AdminHeaderActions`、`AdminFormPage`

推荐做法：

- 后台新增页面时，先从现有后台页复制结构，再替换字段和业务逻辑
- 优先在 `global.css` 扩展通用类，再回到页面里复用，避免每个页面重新写一套样式
- 如果只是颜色、圆角、间距微调，优先改通用类，不要逐页手改
- 新增后台组件后，顺手检查是否还能被服务商管理页、活动管理页、登录页、用户设置页复用
- 独立后台表单页优先用 `AdminFormPage` 统一 `main + card + form` 外层；如果页面下方还有列表或其它区块，可使用 `wrapMain={false}` 嵌入当前页面

### API

| 端点                                          | 方法   | 说明             |
| ------------------------------------------- | ---- | -------------- |
| `/api/auth/login`                           | POST | 管理员认证 (PBKDF2) |
| `/api/auth/logout`                          | POST | 清除会话 Cookie    |
| `/api/auth/password`                        | POST | 修改当前用户密码       |
| `/api/admin/activity-categories`            | GET/POST | 旧版内部分类兼容端点（界面不再使用） |
| `/api/admin/providers`                      | POST | 创建服务商          |
| `/api/admin/providers?id=X&_method=PUT`     | POST | 更新服务商          |
| `/api/admin/providers?id=X&_method=DELETE`  | POST | 删除服务商          |
| `/api/admin/activities`                     | GET  | 后台读取活动列表       |
| `/api/admin/activities`                     | POST | 创建活动           |
| `/api/admin/activities?id=X&_method=PUT`    | POST | 更新活动           |
| `/api/admin/activities?id=X&_method=DELETE` | POST | 删除活动           |
| `/api/admin/upload-image`                   | POST | 上传富文本图片到 R2    |
| `/api/admin/cache-refresh`                  | POST | 清除 KV 缓存       |

后台活动表单不再提交 `category_id`。新建时由服务端自动选择内部兼容分类，编辑时沿用原内部分类。为保持向后兼容，v1 JSON API 仍接受并要求 `category_id`。通过 `POST /api/v1/upload` 并设置 `type=activity`，可获得用于 v1 活动新增/更新的 `featured_image_key`。

## 数据库模型

### providers

服务商核心信息，包含唯一的双语 slug (`slug_zh`, `slug_en`)、URL、分类、评分、Logo 键名和启用状态。

### providers\_content

双语内容 (名称、描述、SEO 标题、SEO 描述)，`(provider_id, lang)` 有唯一复合索引。

### users

管理员账户，密码使用 PBKDF2 哈希存储。

### activity\_categories

为兼容非空的 `activities.category_id` 关系及 v1 API 而保留的内部分类表。公开卡片、文章页和后台表单均不再显示分类。

### activities

活动主表，包含内部分类引用、发布时间、`featured_image_key`、推荐状态、启用状态和浏览量等字段。特色图片使用 R2 的 `activity-images/` 前缀，并固定显示在活动卡片内容上方。

### activities\_content

活动双语内容表，包含标题、slug、摘要、富文本正文和 SEO 字段，`(activity_id, lang)` 上有唯一复合索引。

## 安全机制

- **认证**: 通过 Web Crypto API 实现 PBKDF2 (100k 迭代, SHA-256) -- 不依赖 Node.js crypto 模块
- **会话**: HMAC 签名 Cookie (SHA-256), 24 小时过期, httpOnly + secure + sameSite=strict
- **后台路由**: 中间件强制校验所有 `/admin/*` 路由的会话 (登录页除外)
- **SEO 防护**: 管理后台页面设置 `noindex, nofollow` meta 标签

## Cloudflare 免费套餐合规

| 服务      | 免费套餐限制                          |
| ------- | ------------------------------- |
| D1      | 每天 500 万行读取, 10 万行写入            |
| KV      | 每天 10 万次读取, 1000 次写入            |
| R2      | 每月 1000 万次 A 类操作, 1000 万次 B 类操作 |
| Workers | 每天 10 万次请求                      |

架构设计通过 KV 缓存减少 D1 读写压力、轻量 SSR 页面和后台批量操作来控制资源消耗，以充分利用免费套餐额度。
