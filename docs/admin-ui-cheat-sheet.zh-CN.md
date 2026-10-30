# 后台 UI 速查表

这份速查表用于后台页面开发时快速查找通用样式类。优先复用 `src/styles/global.css` 中已沉淀的类，避免在页面里重复堆叠零散的 Tailwind 工具类。

## 基本原则

- 后台新页面优先从已有后台页面复制结构，再替换字段和逻辑
- 先扩展 `global.css` 中的通用类，再回到页面模板里复用
- 小范围视觉调整优先修改通用类，不逐页手改
- 能复用到服务商管理、活动管理、登录页、用户设置页的写法，尽量不要只写一次

## 共享组件

| 组件 | 用途 |
| --- | --- |
| `AdminAlert` | 统一成功 / 错误提示块 |
| `AdminSectionCard` | 通用后台卡片区块 |
| `AdminDataTable` | 通用后台表格外层与滚动容器 |
| `AdminHeaderActions` | 后台头部右侧操作区 |
| `AdminFormPage` | 统一表单页的 `main + card + form` 外层结构 |

## 布局与区块

| 类名 | 用途 |
| --- | --- |
| `admin-card` | 后台常规卡片容器 |
| `admin-section-header` | 卡片顶部标题区容器 |
| `admin-section-title` | 卡片标题 |
| `admin-section-desc` | 卡片标题下说明文字 |
| `admin-group-title` | 分组小标题 |

## 提示与空状态

| 类名 | 用途 |
| --- | --- |
| `admin-alert` | 提示框基础样式 |
| `admin-alert-success` | 成功提示 |
| `admin-alert-error` | 错误提示 |
| `admin-help-text` | 输入项或编辑器下方说明 |
| `admin-note-danger` | 红色警示说明 |
| `admin-empty-state` | 普通空状态提示 |
| `admin-empty-state-table` | 表格空状态提示 |
| `admin-meta-text` | 辅助元信息小字 |

## 表单控件

| 类名 | 用途 |
| --- | --- |
| `admin-label` | 标准表单标签 |
| `admin-input` | 输入框 / 下拉框通用样式 |
| `admin-checkbox-row` | 复选框与文字的横向布局 |
| `admin-checkbox` | 复选框样式 |
| `admin-checkbox-label` | 复选框文字 |

## 按钮与链接

| 类名 | 用途 |
| --- | --- |
| `admin-btn` | 按钮基础样式 |
| `admin-btn-sm` | 小按钮尺寸 |
| `admin-btn-primary` | 主按钮 |
| `admin-btn-accent` | 强调按钮 |
| `admin-btn-secondary` | 次级按钮 |
| `admin-btn-link` | 文字型按钮 |
| `admin-btn-danger` | 危险操作按钮 |
| `admin-action-link` | 列表中的操作链接 |

## 表格与状态

| 类名 | 用途 |
| --- | --- |
| `admin-table-card` | 表格外层卡片 |
| `admin-table-wrap` | 横向滚动容器 |
| `admin-table` | 表格基础样式 |
| `admin-table-head` | 表头单元格 |
| `admin-cell` | 普通表格单元格 |
| `admin-cell-muted` | 次级文字单元格 |
| `admin-cell-strong` | 强调文字单元格 |
| `admin-badge` | 徽章基础样式 |
| `admin-badge-muted` | 中性徽章 |
| `admin-badge-success` | 成功状态徽章 |
| `admin-badge-danger` | 危险状态徽章 |

## 上传与标签

| 类名 | 用途 |
| --- | --- |
| `admin-upload-area` | 上传拖拽区域 |
| `admin-upload-text` | 上传主提示 |
| `admin-upload-subtext` | 上传副提示 |
| `admin-tag-pill` | 标签胶囊 |
| `admin-tag-pill-remove` | 标签删除按钮 |

## 文本辅助类

| 类名 | 用途 |
| --- | --- |
| `admin-text-strong` | 重点文本 |
| `admin-text-muted` | 次级文本 |
| `admin-text-accent` | 强调色文本 |

## 推荐组合

### 标准后台表单卡片

```html
<section class="admin-card">
  <div class="admin-section-header">
    <h2 class="admin-section-title">区块标题</h2>
    <p class="admin-section-desc">补充说明</p>
  </div>

  <label class="admin-label">字段名</label>
  <input class="admin-input" />

  <p class="admin-help-text">辅助说明</p>

  <button class="admin-btn admin-btn-primary">保存</button>
</section>
```

### 使用 AdminFormPage 的后台表单页

```astro
<AdminFormPage
  title="页面标题"
  description="补充说明"
  action="/api/example"
  formClass="space-y-4"
>
  <div>
    <label class="admin-label">字段名</label>
    <input class="admin-input" />
  </div>

  <button class="admin-btn admin-btn-primary">保存</button>
</AdminFormPage>
```

如果当前页面本身已经有 `main.container`，并且表单下方还有列表或其他管理区块，可改用：

```astro
<AdminFormPage title="区块标题" wrapMain={false}>
  ...
</AdminFormPage>
```

### 使用 AdminDataTable 的后台列表表格

```astro
<AdminDataTable
  headClass="bg-gray-50 border-b border-gray-200"
  bodyClass="divide-y divide-gray-100"
>
  <Fragment slot="head">
    <tr>
      <th class="admin-table-head">标题</th>
    </tr>
  </Fragment>

  <tr>
    <td class="admin-cell">内容</td>
  </tr>
</AdminDataTable>
```

## 维护建议

- 如果页面里开始反复出现同一组 `class`，优先抽到 `global.css`
- 如果新增 UI 模式已经在两个后台页面出现，就值得抽成通用类
- 修改主题色、圆角、边框、间距时，优先从通用类和 CSS 变量入手
