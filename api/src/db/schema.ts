import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  date,
  time,
  uniqueIndex,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('user_role', ['admin', 'provoz', 'ucetni']);
export const receiptCategoryEnum = pgEnum('receipt_category', ['nafta', 'suroviny', 'ostatni']);
export const receiptStatusEnum = pgEnum('receipt_status', ['pending', 'booked']);
export const workerStatusEnum = pgEnum('worker_status', [
  'draft',
  'contract_pending',
  'active',
  'inactive',
]);
export const attendanceStatusEnum = pgEnum('attendance_status', ['open', 'confirmed']);
export const documentSequenceKindEnum = pgEnum('document_sequence_kind', ['vpp']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('provoz'),
  displayName: text('display_name'),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  /** JSON pole permission stringů; null = výchozí podle role */
  permissions: text('permissions'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userEmail: text('user_email').notNull(),
  userDisplayName: text('user_display_name'),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  summary: text('summary').notNull(),
  metadata: text('metadata'),
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
  iconKey: text('icon_key').notNull().default('star'),
  imageUrl: text('image_url'),
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

export const workers = pgTable('worker', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  birthDate: date('birth_date', { mode: 'string' }),
  address: text('address'),
  phone: text('phone'),
  bankAccountNumber: text('bank_account_number'),
  maidenName: text('maiden_name'),
  healthInsurance: text('health_insurance'),
  position: text('position').notNull().default('Barista'),
  workPlace: text('work_place').notNull().default('PRAHA'),
  hourlyRateCents: integer('hourly_rate_cents').notNull(),
  contractStart: date('contract_start', { mode: 'string' }),
  contractEnd: date('contract_end', { mode: 'string' }),
  status: workerStatusEnum('status').notNull().default('draft'),
  contractPdfKey: text('contract_pdf_key'),
  contractSource: text('contract_source'),
  contractSignedAt: timestamp('contract_signed_at', { withTimezone: true }),
  contractAccountingSeenAt: timestamp('contract_accounting_seen_at', { withTimezone: true }),
  contractAccountingEmailedAt: timestamp('contract_accounting_emailed_at', { withTimezone: true }),
  contractSignatureWorkerKey: text('contract_signature_worker_key'),
  contractSignatureEmployerKey: text('contract_signature_employer_key'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shiftAssignments = pgTable('shift_assignment', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id')
    .notNull()
    .references(() => workers.id, { onDelete: 'cascade' }),
  businessDate: date('business_date', { mode: 'string' }).notNull(),
  plannedStart: time('planned_start').notNull(),
  plannedEnd: time('planned_end').notNull(),
  note: text('note'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceRecords = pgTable(
  'attendance_record',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shiftAssignmentId: uuid('shift_assignment_id')
      .notNull()
      .references(() => shiftAssignments.id, { onDelete: 'cascade' }),
    actualStart: timestamp('actual_start', { withTimezone: true }),
    actualEnd: timestamp('actual_end', { withTimezone: true }),
    workedMinutes: integer('worked_minutes'),
    status: attendanceStatusEnum('status').notNull().default('open'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
    signatureStorageKey: text('signature_storage_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('attendance_record_shift_assignment_id').on(t.shiftAssignmentId)]
);

export const wagePayments = pgTable('wage_payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  workerId: uuid('worker_id')
    .notNull()
    .references(() => workers.id, { onDelete: 'restrict' }),
  vppNumber: text('vpp_number').notNull().unique(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  amountCents: integer('amount_cents').notNull(),
  hourlyRateCentsSnapshot: integer('hourly_rate_cents_snapshot').notNull(),
  workedMinutesTotal: integer('worked_minutes_total').notNull(),
  reason: text('reason').notNull().default('Výplata odměny DPC'),
  recipientSignatureKey: text('recipient_signature_key'),
  issuerSignatureKey: text('issuer_signature_key'),
  pdfStorageKey: text('pdf_storage_key'),
  note: text('note'),
  paidBy: uuid('paid_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const wagePaymentLines = pgTable(
  'wage_payment_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    wagePaymentId: uuid('wage_payment_id')
      .notNull()
      .references(() => wagePayments.id, { onDelete: 'cascade' }),
    attendanceRecordId: uuid('attendance_record_id')
      .notNull()
      .references(() => attendanceRecords.id, { onDelete: 'restrict' }),
  },
  (t) => [uniqueIndex('wage_payment_line_attendance_record_id').on(t.attendanceRecordId)]
);

export const documentSequences = pgTable(
  'document_sequence',
  {
    kind: documentSequenceKindEnum('kind').notNull(),
    year: integer('year').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.kind, t.year] })]
);

export const workersRelations = relations(workers, ({ many }) => ({
  shiftAssignments: many(shiftAssignments),
  wagePayments: many(wagePayments),
}));

export const shiftAssignmentsRelations = relations(shiftAssignments, ({ one }) => ({
  worker: one(workers, { fields: [shiftAssignments.workerId], references: [workers.id] }),
  attendance: one(attendanceRecords, {
    fields: [shiftAssignments.id],
    references: [attendanceRecords.shiftAssignmentId],
  }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  shiftAssignment: one(shiftAssignments, {
    fields: [attendanceRecords.shiftAssignmentId],
    references: [shiftAssignments.id],
  }),
}));

export const wagePaymentsRelations = relations(wagePayments, ({ one, many }) => ({
  worker: one(workers, { fields: [wagePayments.workerId], references: [workers.id] }),
  lines: many(wagePaymentLines),
}));
