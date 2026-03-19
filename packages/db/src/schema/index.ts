import { pgTable, pgEnum, uuid, text, numeric, boolean, timestamp, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'

// ── Enums PostgreSQL ──

export const orgTypeEnum = pgEnum('org_type', ['wapixia', 'reseller', 'direct'])
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'cancelled', 'trial'])
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'reseller_admin', 'reseller_user', 'client_admin', 'client_user'])
export const businessSectorEnum = pgEnum('business_sector', ['btp', 'beaute', 'horeca', 'immobilier', 'medical', 'automobile', 'commerce', 'b2b', 'fitness', 'asbl', 'autre'])
export const siteStatusEnum = pgEnum('site_status', ['setup', 'staging', 'live', 'suspended', 'cancelled'])
export const sitePlanEnum = pgEnum('site_plan', ['purchase', 'subscription'])
export const sslStatusEnum = pgEnum('ssl_status', ['pending', 'active', 'error'])
export const hostingTypeEnum = pgEnum('hosting_type', ['wapixia', 'client_ftp', 'client_vps'])

// ── Organizations (tenants) ──

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  type: orgTypeEnum('type').notNull(),
  parentId: uuid('parent_id').references((): any => organizations.id),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }).default('20.00'),
  stripeAccountId: text('stripe_account_id'),
  mollieProfileId: text('mollie_profile_id'),

  // White-label
  whiteLabelDomain: text('white_label_domain'),
  whiteLabelLogoUrl: text('white_label_logo_url'),
  whiteLabelPrimary: text('white_label_primary').default('#00D4B1'),
  whiteLabelName: text('white_label_name'),

  // Affiliation
  affiliateCode: text('affiliate_code').unique(),
  referredBy: uuid('referred_by').references((): any => organizations.id),

  // Status
  status: orgStatusEnum('status').notNull().default('active'),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// ── Users ──

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // references auth.users(id) — FK gérée par Supabase
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  role: userRoleEnum('role').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  language: text('language').default('fr'),
  timezone: text('timezone').default('Europe/Brussels'),

  // Notifications
  notifEmail: boolean('notif_email').default(true),
  notifSms: boolean('notif_sms').default(false),
  notifPush: boolean('notif_push').default(true),

  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Sites clients ──

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),

  // Identification
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  sector: businessSectorEnum('sector').notNull(),

  // Domaines
  tempDomain: text('temp_domain').unique(),
  customDomain: text('custom_domain').unique(),
  domainVerified: boolean('domain_verified').default(false),
  sslStatus: sslStatusEnum('ssl_status').default('pending'),

  // Hébergement
  hostingType: hostingTypeEnum('hosting_type').notNull(),
  hostingConfig: jsonb('hosting_config'),

  // Offre
  plan: sitePlanEnum('plan').notNull(),
  planPrice: numeric('plan_price', { precision: 10, scale: 2 }).notNull(),

  // Onboarding
  onboardingData: jsonb('onboarding_data'),
  onboardingDone: boolean('onboarding_done').default(false),
  launchedAt: timestamp('launched_at', { withTimezone: true }),

  // SEO & Analytics
  googleAnalyticsId: text('google_analytics_id'),
  googleTagManagerId: text('google_tag_manager_id'),
  googleSearchConsole: text('google_search_console'),
  facebookPixelId: text('facebook_pixel_id'),
  gmbLocationId: text('gmb_location_id'),

  // Status
  status: siteStatusEnum('status').notNull().default('setup'),

  // Scores
  visibilityScore: integer('visibility_score').default(0),
  seoScore: integer('seo_score').default(0),
  aiPresenceScore: integer('ai_presence_score').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// ── Type exports ──

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Site = typeof sites.$inferSelect
export type NewSite = typeof sites.$inferInsert
