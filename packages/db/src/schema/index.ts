import { pgTable, pgEnum, uuid, text, numeric, boolean, timestamp, integer, jsonb, uniqueIndex, bigint, decimal } from 'drizzle-orm/pg-core'

// ── Enums PostgreSQL ──

export const orgTypeEnum = pgEnum('org_type', ['wapixia', 'reseller', 'direct'])
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended', 'cancelled', 'trial'])
export const userRoleEnum = pgEnum('user_role', ['superadmin', 'reseller_admin', 'reseller_user', 'client_admin', 'client_user'])
export const businessSectorEnum = pgEnum('business_sector', ['btp', 'beaute', 'horeca', 'immobilier', 'medical', 'automobile', 'commerce', 'b2b', 'fitness', 'asbl', 'autre'])
export const siteStatusEnum = pgEnum('site_status', ['setup', 'staging', 'live', 'suspended', 'cancelled'])
export const sitePlanEnum = pgEnum('site_plan', ['purchase', 'subscription'])
export const sslStatusEnum = pgEnum('ssl_status', ['pending', 'active', 'error'])
export const hostingTypeEnum = pgEnum('hosting_type', ['wapixia', 'client_ftp', 'client_vps'])
export const generationStatusEnum = pgEnum('generation_status_enum', ['pending', 'generating', 'done', 'failed'])

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

  // Theming
  theme: text('theme').default('default'),
  primaryColor: text('primary_color').default('#00D4B1'),
  secondaryColor: text('secondary_color').default('#050D1A'),

  // Infrastructure
  coolifyAppId: text('coolify_app_id'),
  cloudflareRecordId: text('cloudflare_record_id'),

  // Google OAuth
  googleOauthToken: jsonb('google_oauth_token'),

  // Scores
  visibilityScore: integer('visibility_score').default(0),
  seoScore: integer('seo_score').default(0),
  aiPresenceScore: integer('ai_presence_score').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

// ── Onboarding Sessions ──

export const onboardingSessions = pgTable('onboarding_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  currentStep: integer('current_step').default(1),
  totalSteps: integer('total_steps').default(20),
  answers: jsonb('answers').default({}),
  generationStatus: text('generation_status').default('pending'),
  generatedContent: jsonb('generated_content'),
  generationStartedAt: timestamp('generation_started_at', { withTimezone: true }),
  generationDoneAt: timestamp('generation_done_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  tokensUsed: integer('tokens_used').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Enums Sprint 3 ──

export const moduleCategoryEnum = pgEnum('module_category', ['content', 'reputation', 'acquisition', 'conversion', 'analytics', 'technical'])
export const siteModuleStatusEnum = pgEnum('site_module_status', ['active', 'paused', 'cancelled'])
export const aiContentTypeEnum = pgEnum('ai_content_type', ['blog_article', 'social_post', 'gmb_post', 'review_reply', 'seo_meta', 'faq'])
export const aiContentPlatformEnum = pgEnum('ai_content_platform', ['facebook', 'instagram', 'gmb', 'blog', 'linkedin', 'tiktok'])
export const aiContentStatusEnum = pgEnum('ai_content_status', ['pending_validation', 'approved', 'auto_approved', 'rejected', 'published', 'publish_failed', 'archived'])
export const replyStatusEnum = pgEnum('reply_status', ['no_comment', 'pending', 'generated', 'validated', 'published', 'skipped'])
export const socialPlatformEnum = pgEnum('social_platform', ['facebook', 'instagram', 'linkedin', 'youtube', 'tiktok', 'gmb'])
export const socialAccountStatusEnum = pgEnum('social_account_status', ['active', 'expired', 'revoked', 'error'])

// ── Module Catalog ──

export const moduleCatalog = pgTable('module_catalog', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  priceMonthly: numeric('price_monthly', { precision: 10, scale: 2 }).notNull(),
  category: text('category').notNull(),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
})

// ── Site Modules ──

export const siteModules = pgTable('site_modules', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  moduleId: text('module_id').notNull().references(() => moduleCatalog.id),
  status: text('status').notNull().default('active'),
  config: jsonb('config').default({}),
  activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── AI Contents ──

export const aiContents = pgTable('ai_contents', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  moduleId: text('module_id').notNull().references(() => moduleCatalog.id),
  type: text('type').notNull(),
  platform: text('platform'),
  title: text('title'),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  visualUrl: text('visual_url'),
  visualAlt: text('visual_alt'),
  hashtags: text('hashtags').array(),
  metadata: jsonb('metadata').default({}),
  promptVersion: text('prompt_version').notNull().default('1.0'),
  modelUsed: text('model_used').notNull(),
  tokensInput: integer('tokens_input').default(0),
  tokensOutput: integer('tokens_output').default(0),
  generationCost: numeric('generation_cost', { precision: 8, scale: 4 }).default('0'),
  status: text('status').notNull().default('pending_validation'),
  autoPublish: boolean('auto_publish').default(false),
  rejectionNote: text('rejection_note'),
  validatedBy: uuid('validated_by').references(() => users.id),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  publishError: text('publish_error'),
  externalId: text('external_id'),
  externalUrl: text('external_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Google Reviews ──

export const googleReviews = pgTable('google_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  gmbReviewId: text('gmb_review_id').unique().notNull(),
  authorName: text('author_name').notNull(),
  authorPhoto: text('author_photo'),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  reviewDate: timestamp('review_date', { withTimezone: true }).notNull(),
  replyContent: text('reply_content'),
  replyStatus: text('reply_status').default('pending'),
  aiContentId: uuid('ai_content_id').references(() => aiContents.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  // is_negative is a GENERATED ALWAYS AS column — not mapped in Drizzle (read-only computed)
  alertSent: boolean('alert_sent').default(false),
  alertSentAt: timestamp('alert_sent_at', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Social Accounts ──

export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  platformUserId: text('platform_user_id'),
  platformPageId: text('platform_page_id'),
  platformUsername: text('platform_username'),
  platformName: text('platform_name'),
  status: text('status').default('active'),
  lastError: text('last_error'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Token Usage ──

export const tokenUsage = pgTable('token_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  moduleId: text('module_id').notNull().references(() => moduleCatalog.id),
  periodYear: integer('period_year').notNull(),
  periodMonth: integer('period_month').notNull(),
  tokensInput: bigint('tokens_input', { mode: 'number' }).default(0),
  tokensOutput: bigint('tokens_output', { mode: 'number' }).default(0),
  apiCalls: integer('api_calls').default(0),
  totalCostEur: numeric('total_cost_eur', { precision: 8, scale: 4 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Subscriptions ──

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  type: text('type').notNull(), // 'site_subscription' | 'hosting' | 'module'
  moduleId: text('module_id').references(() => moduleCatalog.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('EUR'),
  billingCycle: text('billing_cycle').notNull().default('monthly'), // 'monthly' | 'yearly'
  paymentProvider: text('payment_provider'), // 'mollie' | 'stripe'
  externalSubId: text('external_sub_id'),
  mollieMandateId: text('mollie_mandate_id'),
  status: text('status').notNull().default('trialing'), // 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused' | 'unpaid'
  trialEnd: timestamp('trial_end', { withTimezone: true }),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  nextBillingDate: timestamp('next_billing_date', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  pausedAt: timestamp('paused_at', { withTimezone: true }),
  dunningAttempts: integer('dunning_attempts').default(0),
  lastDunningAt: timestamp('last_dunning_at', { withTimezone: true }),
  dunningResolvedAt: timestamp('dunning_resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Payments ──

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  subscriptionId: uuid('subscription_id').notNull().references(() => subscriptions.id),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('EUR'),
  status: text('status').notNull(), // 'pending' | 'paid' | 'failed' | 'refunded' | 'chargeback' | 'expired'
  paymentProvider: text('payment_provider'), // 'mollie' | 'stripe'
  externalPaymentId: text('external_payment_id').unique(),
  paymentMethod: text('payment_method'),
  failureReason: text('failure_reason'),
  invoicePdfUrl: text('invoice_pdf_url'),
  invoiceNumber: text('invoice_number').unique(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  refundReason: text('refund_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Commissions ──

export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  resellerId: uuid('reseller_id').notNull().references(() => organizations.id),
  paymentId: uuid('payment_id').notNull().references(() => payments.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  baseAmount: numeric('base_amount', { precision: 10, scale: 2 }).notNull(),
  commissionRate: numeric('commission_rate', { precision: 5, scale: 2 }).notNull(),
  commissionAmount: numeric('commission_amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'paid' | 'cancelled'
  stripeTransferId: text('stripe_transfer_id'),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Type exports ──

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Site = typeof sites.$inferSelect
export type NewSite = typeof sites.$inferInsert
export type OnboardingSession = typeof onboardingSessions.$inferSelect
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert

export type ModuleCatalog = typeof moduleCatalog.$inferSelect
export type NewModuleCatalog = typeof moduleCatalog.$inferInsert
export type SiteModule = typeof siteModules.$inferSelect
export type NewSiteModule = typeof siteModules.$inferInsert
export type AiContent = typeof aiContents.$inferSelect
export type NewAiContent = typeof aiContents.$inferInsert
export type GoogleReview = typeof googleReviews.$inferSelect
export type NewGoogleReview = typeof googleReviews.$inferInsert
export type SocialAccount = typeof socialAccounts.$inferSelect
export type NewSocialAccount = typeof socialAccounts.$inferInsert
export type TokenUsage = typeof tokenUsage.$inferSelect
export type NewTokenUsage = typeof tokenUsage.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type Commission = typeof commissions.$inferSelect
export type NewCommission = typeof commissions.$inferInsert
