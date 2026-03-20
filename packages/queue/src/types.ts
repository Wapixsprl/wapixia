// @wapixia/queue — Job data types for all queues

// ── Content generation jobs ──

export interface SocialPostJobData {
  siteId: string
  postType?: 'facebook' | 'instagram' | 'linkedin'
}

export interface BlogArticleJobData {
  siteId: string
  topic?: string
}

export interface GmbPostJobData {
  siteId: string
}

// ── Reputation jobs ──

export interface ReviewReplyJobData {
  siteId: string
  reviewId: string
}

// ── Publishing jobs ──

export interface PublishJobData {
  contentId: string
}

// ── Notification jobs ──

export interface EmailJobData {
  templateId: number
  to: string
  toName?: string
  params: Record<string, string>
}

export interface AlertJobData {
  reviewId?: string
  type?: 'negative_review' | 'content_ready' | 'publish_failed' | 'custom'
  siteId?: string
  message?: string
}

export interface SiteGenerateJobData {
  siteId: string
  sessionId: string
}

// ── Billing jobs ──

export interface InvoiceJobData {
  paymentId: string
}

export interface CommissionJobData {
  paymentId: string
}

export interface DunningJobData {
  subscriptionId: string
}

export interface BillingRecurringJobData {
  /** Optional: limit to a specific organization. If omitted, processes all. */
  organizationId?: string
}

// ── Billing result types ──

export interface InvoiceResult {
  paymentId: string
  invoicePdfUrl: string
}

export interface CommissionResult {
  paymentId: string
  commissionId?: string
  skipped: boolean
  reason?: string
}

export interface DunningResult {
  subscriptionId: string
  action: 'retried' | 'cancelled' | 'skipped'
  attempt?: number
}

export interface BillingRecurringResult {
  processed: number
  failed: number
}

// ── Worker result types ──

export interface ContentGenerationResult {
  contentId: string
  tokensUsed: number
  status: 'pending_validation' | 'auto_approved'
}

export interface PublishResult {
  contentId: string
  externalId?: string
  externalUrl?: string
  status: 'published' | 'publish_failed'
}

export interface AlertResult {
  alertSent: boolean
  messageId?: string
}
