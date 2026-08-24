import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const portfolioConfig = pgTable('portfolio_config', {
  id: serial('id').primaryKey(),
  managerName: text('manager_name').notNull().default('أحمد زقافي العبدلي'),
  schoolName: text('school_name').notNull().default('مجمع سعد بن عبادة وسحار والدحلة'),
  year: text('year').notNull().default('1447هـ - 2026م'),
  managerTitle: text('manager_title').notNull().default('مدير المدرسة'),
  logoUrl: text('logo_url').default(''),
  managerPhotoUrl: text('manager_photo_url').default(''),
  biography: text('biography').default(''),
  vision: text('vision').default(''),
  mission: text('mission').default(''),
  values: text('values').default(''),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const portfolioPages = pgTable('portfolio_pages', {
  id: integer('id').primaryKey(),
  code: text('code').notNull(),
  title: text('title').notNull(),
  iconName: text('icon_name').notNull(),
  description: text('description').notNull(),
  criteria: jsonb('criteria').notNull().default([]),
  attachments: jsonb('attachments').notNull().default([]),
  updatedAt: timestamp('updated_at').defaultNow()
});
