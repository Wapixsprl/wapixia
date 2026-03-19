// @wapixia/ai — Claude API wrappers et prompts

// Types
export type {
  Feature,
  Testimonial,
  FAQItem,
  Service,
  SEOMeta,
  LegalSection,
  WhyReason,
  LocalBusinessSchema,
  HomePage,
  ServicesPage,
  AboutPage,
  ContactPage,
  FAQCategory,
  FAQPage,
  LegalPage,
  GeneratedSiteContent,
  GenerationResult,
  SiteGenerationResult,
} from './types/generated-content.js'

// Prompts
export { buildSystemPrompt } from './prompts/system.js'
export { buildHomePrompt } from './prompts/home.js'
export { buildServicesPrompt } from './prompts/services.js'
export { buildAboutPrompt } from './prompts/about.js'
export { buildContactPrompt } from './prompts/contact.js'
export { buildFAQPrompt } from './prompts/faq.js'
export { buildLegalPrompt } from './prompts/legal.js'

// Sprint 3 — Module types
export type {
  PromptTemplate,
  SiteContext,
  SocialPost,
  SocialPostResult,
  BlogArticleResult,
  GMBPostResult,
  ReviewData,
  ReviewReplyResult,
} from './types/prompt.js'

// Sprint 3 — Module prompts
export {
  socialPostSystemPrompt,
  socialPostTemplate,
  buildSocialPostPrompt,
} from './prompts/modules/social-post.js'

export {
  blogArticleSystemPrompt,
  blogArticleTemplate,
  buildBlogArticlePrompt,
} from './prompts/modules/blog-article.js'

export {
  gmbPostSystemPrompt,
  gmbPostTemplate,
  buildGMBPostPrompt,
} from './prompts/modules/gmb-post.js'

export {
  reviewReplySystemPrompt,
  reviewReplyTemplate,
  buildReviewReplyPrompt,
} from './prompts/modules/review-reply.js'

// Generators
export { SiteGenerator } from './generators/site-generator.js'
export { ContentGenerator } from './generators/content-generator.js'

// Token tracking
export {
  CLAUDE_PRICING,
  calculateCost,
  trackTokenUsage,
  checkCostThreshold,
} from './tracking.js'
