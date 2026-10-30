import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const providers = sqliteTable('providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug_zh: text('slug_zh').notNull().unique(),
  slug_en: text('slug_en').notNull().unique(),
  url: text('url').notNull(),
  category: text('category').notNull(),
  rating: real('rating').default(0),
  logo_key: text('logo_key'),
  tags: text('tags'), // JSON array of custom tags
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const providersContent = sqliteTable(
  'providers_content',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    provider_id: integer('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    lang: text('lang').notNull(),
    name: text('name').notNull(),
    desc: text('desc'),
    meta_title: text('meta_title'),
    meta_desc: text('meta_desc'),
  },
  (table) => [uniqueIndex('provider_lang_idx').on(table.provider_id, table.lang)],
);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// Activity categories (活动分类)
export const activityCategories = sqliteTable('activity_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Activity content by language (活动内容)
export const activitiesContent = sqliteTable(
  'activities_content',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    activity_id: integer('activity_id')
      .notNull()
      .references(() => activities.id, { onDelete: 'cascade' }),
    lang: text('lang').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    content: text('content'),
    meta_title: text('meta_title'),
    meta_desc: text('meta_desc'),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex('activity_lang_idx').on(table.activity_id, table.lang),
    uniqueIndex('activity_content_lang_slug_idx').on(table.lang, table.slug),
  ],
);

// Activities (活动主表)
export const activities = sqliteTable('activities', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category_id: integer('category_id')
    .notNull()
    .references(() => activityCategories.id),
  slug: text('slug').notNull().unique(),
  featured_image_key: text('featured_image_key'),
  published_at: text('published_at').notNull().default(sql`(datetime('now'))`),
  is_featured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  view_count: integer('view_count').notNull().default(0),
  created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
