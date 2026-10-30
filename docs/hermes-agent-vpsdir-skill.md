---
name: "vpsdir-content-manager"
description: "Manage VPSDEX providers, activities, internal categories, and images via REST API."
version: "1.0.0"
base_url: "https://vpsdex.com"
auth_type: "Bearer Token"
---

# VPS Directory 内容管理技能

本技能用于通过 REST API 管理 vpsdex.com 的服务商、活动、内部兼容分类和图片。活动分类不再显示于公开页面和后台界面，但 v1 API 仍保留 `category_id` 以兼容现有数据结构。

## 认证

所有 API 请求必须在 Header 中携带 Bearer Token：

```
Authorization: Bearer <YOUR_API_BEARER_TOKEN>
```

未携带或携带错误 Token 的请求将返回 `401 Unauthorized`。

> **注意**:真实 Token 通过 `wrangler secret put API_BEARER_TOKEN` 设置(本地开发写在 `.dev.vars` 中)。请勿将真实 Token 写入任何文档、代码或提交到仓库。

## 基础信息

- **Base URL**: `https://vpsdex.com`（生产环境）
- **本地开发**: `http://localhost:4321`
- **数据格式**: JSON（除图片上传使用 multipart/form-data）
- **字符编码**: UTF-8

---

## 一、服务商管理

### 1.1 获取所有服务商

```
GET /api/v1/providers
```

**响应示例**:
```json
{
  "count": 15,
  "data": [
    {
      "id": 1,
      "slug_zh": "bandwagonhost",
      "slug_en": "bandwagonhost",
      "url": "https://bandwagonhost.com",
      "category": "vps",
      "rating": 4.5,
      "logo_key": "logos/bandwagonhost.png",
      "tags": ["便宜", "稳定"],
      "is_active": true,
      "name_zh": "搬瓦工",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-06-01 12:00:00"
    }
  ]
}
```

### 1.2 获取单个服务商详情

```
GET /api/v1/providers/{id}
```

**响应包含**：服务商基础信息 + 所有语言的内容（name、desc、meta_title、meta_desc）。

### 1.3 创建服务商

```
POST /api/v1/providers
Content-Type: application/json
```

**请求体**:
```json
{
  "slug_zh": "new-provider-zh",
  "slug_en": "new-provider-en",
  "url": "https://example.com",
  "category": "vps",
  "rating": 4.0,
  "tags": ["标签1", "标签2"],
  "is_active": true,
  "contents": [
    {
      "lang": "zh",
      "name": "服务商中文名",
      "desc": "<p>中文描述（支持富文本 HTML）</p>",
      "meta_title": "自定义 SEO 标题（可选）",
      "meta_desc": "自定义 SEO 描述（可选）"
    },
    {
      "lang": "en",
      "name": "Provider English Name",
      "desc": "<p>English description</p>",
      "meta_title": "Custom SEO Title (optional)",
      "meta_desc": "Custom SEO Description (optional)"
    }
  ]
}
```

**必填字段**: `slug_zh`, `slug_en`, `url`, `category`, `contents`（至少一个语言）

**响应**: `201 Created` → `{ "success": true, "id": 16 }`

### 1.4 更新服务商

```
PUT /api/v1/providers/{id}
Content-Type: application/json
```

所有字段均为可选，仅更新提供的字段。`contents` 数组中的内容会按 `lang` 自动新增或更新。

### 1.5 删除服务商

```
DELETE /api/v1/providers/{id}
```

删除服务商及其所有多语言内容，同时删除 R2 中的 Logo 图片。

**响应**: `{ "success": true }`

---

## 二、活动管理

### 2.1 获取所有活动

```
GET /api/v1/activities
```

**响应示例**:
```json
{
  "count": 10,
  "data": [
    {
      "id": 1,
      "slug": "summer-sale-2024",
      "featured_image_key": "activity-images/1717200000000-a1b2c3d4.jpg",
      "category_id": 2,
      "category_slug": "promotions",
      "published_at": "2024-06-01T00:00:00.000Z",
      "is_featured": true,
      "is_active": true,
      "view_count": 152,
      "title_zh": "2024夏季促销",
      "created_at": "2024-05-30 10:00:00",
      "updated_at": "2024-06-01 12:00:00"
    }
  ]
}
```

### 2.2 获取单个活动详情

```
GET /api/v1/activities/{id}
```

**响应包含**：活动基础信息、`featured_image_key`、内部分类兼容信息，以及所有语言内容（title、slug、description、content、meta 信息）。

### 2.3 创建活动

```
POST /api/v1/activities
Content-Type: application/json
```

**请求体**:
```json
{
  "slug": "summer-sale-2024",
  "featured_image_key": "activity-images/1717200000000-a1b2c3d4.jpg",
  "category_id": 2,
  "published_at": "2024-06-01T00:00:00Z",
  "is_featured": true,
  "is_active": true,
  "contents": [
    {
      "lang": "zh",
      "title": "2024夏季促销",
      "slug": "summer-sale-2024-zh",
      "description": "限时折扣，最低3折起",
      "content": "<h2>夏季大促</h2><p>详细内容...</p>",
      "meta_title": "2024夏季VPS促销（可选）",
      "meta_desc": "限时折扣信息（可选）"
    },
    {
      "lang": "en",
      "title": "Summer Sale 2024",
      "slug": "summer-sale-2024",
      "description": "Limited time discount, up to 70% off",
      "content": "<h2>Summer Sale</h2><p>Details...</p>"
    }
  ]
}
```

**必填字段**: `slug`, `category_id`, `contents`（至少一个语言）

> **注意**: `category_id` 必须是已存在的分类 ID。可通过 `GET /api/v1/categories` 查询。

`featured_image_key` 可选，必须使用 `activity-images/` 前缀。特色图片固定显示在公开活动卡片内容上方，同时用于文章头图、Open Graph、Twitter Card 和 Article JSON-LD。

### 2.4 更新活动

```
PUT /api/v1/activities/{id}
```

所有字段可选。更新 `contents` 时按 `lang` 自动新增或更新。将 `featured_image_key` 设置为新的 `activity-images/` 键可更换特色图，设置为 `null` 可移除特色图；更换或移除后会清理旧 R2 对象。

### 2.5 删除活动

```
DELETE /api/v1/activities/{id}
```

删除活动及其所有多语言内容，同时清理关联的特色图片。

---

## 三、内部分类兼容 API

> 分类仅为兼容 `activities.category_id` 非空关系而保留，不再用于公开筛选、卡片标签或后台表单。除非维护旧 API 数据，不应新建或调整分类。

### 3.1 获取所有分类

```
GET /api/v1/categories
```

**响应示例**:
```json
{
  "count": 5,
  "data": [
    {
      "id": 1,
      "slug": "promotions",
      "icon": "tag",
      "sort_order": 0,
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    }
  ]
}
```

### 3.2 创建分类

```
POST /api/v1/categories
Content-Type: application/json
```

**请求体**:
```json
{
  "slug": "tutorials",
  "icon": "book",
  "sort_order": 5
}
```

**必填字段**: `slug`（唯一，不可重复）

### 3.3 更新分类

```
PUT /api/v1/categories/{id}
```

字段可选：`slug`、`icon`、`sort_order`。

### 3.4 删除分类

```
DELETE /api/v1/categories/{id}
```

如果该分类下仍有活动关联，将返回 `409 Conflict`。需先删除或移动相关活动。

---

## 四、图片上传

### 4.1 上传图片

```
POST /api/v1/upload
Content-Type: multipart/form-data
```

**表单字段**:

| 字段 | 必填 | 说明 |
|------|------|------|
| `image` | 是 | 图片文件（支持 jpg/png/gif/webp/svg，最大 5MB） |
| `type` | 否 | 图片类型：`logo`（服务商 Logo）、`activity`（活动特色图）或 `editor`（富文本插图），默认 `editor` |

#### type=editor（富文本插图）

上传后图片存储到 `editor-images/` 目录，通过 `/api/image/` 端点访问。

**响应**:
```json
{
  "url": "/api/image/editor-images/1717200000000-a1b2c3d4.jpg",
  "filename": "editor-images/1717200000000-a1b2c3d4.jpg"
}
```

> `url` 可直接用于活动富文本内容中的 `<img src="...">` 标签。

#### type=logo（服务商 Logo）

上传后图片存储到 `logos/` 目录，通过 `/api/logo/` 端点访问。

**响应**:
```json
{
  "logo_key": "logos/1717200000000-a1b2c3d4.png",
  "logo_url": "/api/logo/logos/1717200000000-a1b2c3d4.png",
  "filename": "logos/1717200000000-a1b2c3d4.png"
}
```

> 将返回的 `logo_key` 设置到服务商的 `logo_key` 字段即可正常显示 Logo。

#### type=activity（活动特色图）

上传后图片存储到 `activity-images/` 目录，通过 `/api/image/` 端点访问。

**响应**:
```json
{
  "featured_image_key": "activity-images/1717200000000-a1b2c3d4.jpg",
  "url": "/api/image/activity-images/1717200000000-a1b2c3d4.jpg",
  "filename": "activity-images/1717200000000-a1b2c3d4.jpg"
}
```

将 `featured_image_key` 写入活动即可在卡片上方显示特色图片。

---

## 五、典型工作流示例

### 5.1 发布一篇带图活动

1. **上传特色图片**:
   ```
   POST /api/v1/upload
   Content-Type: multipart/form-data
   image=@cover.jpg, type=activity

   → { "featured_image_key": "activity-images/xxx.jpg", "url": "/api/image/activity-images/xxx.jpg" }
   ```

2. **创建活动并关联特色图片**:
   ```
   POST /api/v1/activities
   {
     "slug": "new-promo",
     "category_id": 1,
     "featured_image_key": "activity-images/xxx.jpg",
     "contents": [{
       "lang": "zh",
       "title": "新促销活动",
       "content": "<p>活动详情</p>"
     }]
   }
   ```

### 5.2 添加新服务商并设置 Logo

1. **上传 Logo**:
   ```
   POST /api/v1/upload
   Content-Type: multipart/form-data
   image=@logo.png, type=logo

   → { "logo_key": "logos/xxx.png", "logo_url": "/api/logo/logos/xxx.png" }
   ```

2. **创建服务商**（使用返回的 `logo_key`）:
   ```
   POST /api/v1/providers
   {
     "slug_zh": "new-vps",
     "slug_en": "new-vps",
     "url": "https://newvps.com",
     "category": "vps",
     "logo_key": "logos/xxx.png",
     "contents": [{ "lang": "zh", "name": "新VPS", "desc": "描述" }]
   }
   ```

### 5.3 更新服务商 Logo

1. **上传新 Logo**:
   ```
   POST /api/v1/upload
   image=@new-logo.png, type=logo
   → { "logo_key": "logos/new-xxx.png" }
   ```

2. **更新服务商**:
   ```
   PUT /api/v1/providers/5
   { "logo_key": "logos/new-xxx.png" }
   ```

### 5.4 更新已有内容

1. **查询现有数据**:
   ```
   GET /api/v1/providers/5
   ```

2. **修改字段**:
   ```
   PUT /api/v1/providers/5
   { "rating": 4.8, "contents": [{ "lang": "zh", "name": "更新后的名称", "desc": "新描述" }] }
   ```

---

## 六、错误处理

| HTTP 状态码 | 含义 |
|------------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误（缺少必填字段） |
| 401 | 未认证（Bearer Token 无效或缺失） |
| 404 | 资源不存在 |
| 409 | 冲突（如 slug 重复、删除有关联数据的分类） |
| 500 | 服务器内部错误 |

所有错误响应格式：
```json
{ "error": "错误描述信息" }
```

---

## 七、CORS 支持

API 已配置 CORS，支持从浏览器端直接调用。支持 `OPTIONS` 预检请求。

---

## 安全须知

- Bearer Token 等同于管理员权限，请妥善保管
- 生产环境请通过 `wrangler secret put API_BEARER_TOKEN` 设置密钥
- 如需更换密钥，更新 Cloudflare 环境变量后即可生效，无需重新部署
