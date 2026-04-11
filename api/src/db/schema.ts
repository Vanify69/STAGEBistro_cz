import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  date,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('user_role', ['admin', 'provoz', 'ucetni']);
export const receiptCategoryEnum = pgEnum('receipt_category', ['nafta', 'suroviny', 'ostatni']);
export const receiptStatusEnum = pgEnum('receipt_status', ['pending', 'booked']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('provoz'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable('site_setting', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const menuCategories = pgTable('menu_category', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  nameCz: text('name_cz').notNull(),
  nameEn: text('name_en').notNull(),
  active: boolean('active').notNull().default(true),
});

export const menuItems = pgTable('menu_item', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => menuCategories.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  nameCz: text('name_cz').notNull(),
  nameEn: text('name_en').notNull(),
  descCz: text('desc_cz'),
  descEn: text('desc_en'),
  priceCents: integer('price_cents').notNull(),
  allergenCodes: text('allergen_codes'),
  imageUrl: text('image_url'),
  active: boolean('active').notNull().default(true),
});

export const galleryImages = pgTable('gallery_image', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  altCz: text('alt_cz'),
  altEn: text('alt_en'),
  active: boolean('active').notNull().default(true),
});

export const headerEvents = pgTable('header_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventDate: date('event_date', { mode: 'string' }).notNull(),
  timeText: text('time_text'),
  titleCz: text('title_cz').notNull(),
  titleEn: text('title_en').notNull(),
  subtitleCz: text('subtitle_cz').notNull(),
  subtitleEn: text('subtitle_en').notNull(),
  linkUrl: text('link_url'),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const dailySales = pgTable(
  'daily_sales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    businessDate: date('business_date', { mode: 'string' }).notNull(),
    cashCents: integer('cash_cents').notNull().default(0),
    cardCents: integer('card_cents').notNull().default(0),
    depositCents: integer('deposit_cents').notNull().default(0),
    bankCents: integer('bank_cents').notNull().default(0),
    staffCents: integer('staff_cents').notNull().default(0),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('daily_sales_business_date').on(t.businessDate)]
);

export const expenseReceipts = pgTable('expense_receipt', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessDate: date('business_date', { mode: 'string' }),
  category: receiptCategoryEnum('category').notNull(),
  amountCents: integer('amount_cents'),
  vatRate: integer('vat_rate'),
  note: text('note'),
  storageKey: text('storage_key'),
  mime: text('mime'),
  status: receiptStatusEnum('status').notNull().default('pending'),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  bookedAt: timestamp('booked_at', { withTimezone: true }),
  bookedBy: uuid('booked_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const menuCategoriesRelations = relations(menuCategories, ({ many }) => ({
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  category: one(menuCategories, { fields: [menuItems.categoryId], references: [menuCategories.id] }),
}));
