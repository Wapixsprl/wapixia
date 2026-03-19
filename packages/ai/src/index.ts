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

// Generator
export { SiteGenerator } from './generators/site-generator.js'
