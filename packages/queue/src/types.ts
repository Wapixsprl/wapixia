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

// ── Infrastructure jobs ──

export interface SiteProvisionJobData {
  siteId: string
}

export interface DomainVerifyJobData {
  siteId: string
  domain: string
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
