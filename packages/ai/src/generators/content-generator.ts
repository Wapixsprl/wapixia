// @wapixia/ai — Content generation service for AI modules (social, blog, GMB, reviews)

import Anthropic from '@anthropic-ai/sdk'
import type {
  BlogArticleResult,
  GMBPostResult,
  ReviewData,
  ReviewReplyResult,
  SiteContext,
  SocialPostResult,
} from '../types/prompt.js'
import { socialPostSystemPrompt, buildSocialPostPrompt } from '../prompts/modules/social-post.js'
import { blogArticleSystemPrompt, buildBlogArticlePrompt } from '../prompts/modules/blog-article.js'
import { gmbPostSystemPrompt, buildGMBPostPrompt } from '../prompts/modules/gmb-post.js'
import { reviewReplySystemPrompt, buildReviewReplyPrompt } from '../prompts/modules/review-reply.js'

/** Model used for main content generation */
const MODEL_SONNET = 'claude-sonnet-4-6' as const

/** Model used for fast/cheap operations (review replies) */
const MODEL_HAIKU = 'claude-haiku-4-5-20251001' as const

export class ContentGenerator {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  /**
   * Generate social media posts for Facebook, Instagram, and LinkedIn.
   * @param context - Business context from onboarding
   * @param postType - One of: educational, promotional, engagement, seasonal
   */
  async generateSocialPost(
    context: SiteContext,
    postType: string,
  ): Promise<SocialPostResult> {
    const userPrompt = buildSocialPostPrompt(context, postType)
    return this.generate<SocialPostResult>(
      MODEL_SONNET,
      2048,
      socialPostSystemPrompt,
      userPrompt,
    )
  }

  /**
   * Generate a full SEO blog article.
   * @param context - Business context from onboarding
   * @param topic - Optional topic; if omitted the AI will choose one
   */
  async generateBlogArticle(
    context: SiteContext,
    topic?: string,
  ): Promise<BlogArticleResult> {
    const userPrompt = buildBlogArticlePrompt(context, topic)
    return this.generate<BlogArticleResult>(
      MODEL_SONNET,
      4096,
      blogArticleSystemPrompt,
      userPrompt,
    )
  }

  /**
   * Generate a Google My Business post.
   * @param context - Business context from onboarding
   * @param postType - One of: update, offer, event
   */
  async generateGMBPost(
    context: SiteContext,
    postType: string,
  ): Promise<GMBPostResult> {
    const userPrompt = buildGMBPostPrompt(context, postType)
    return this.generate<GMBPostResult>(
      MODEL_SONNET,
      1024,
      gmbPostSystemPrompt,
      userPrompt,
    )
  }

  /**
   * Generate a reply to a Google review.
   * Uses Haiku for speed and cost efficiency.
   * @param context - Business context from onboarding
   * @param review - The review data to reply to
   */
  async generateReviewReply(
    context: SiteContext,
    review: ReviewData,
  ): Promise<ReviewReplyResult> {
    const userPrompt = buildReviewReplyPrompt(context, review)
    return this.generate<ReviewReplyResult>(
      MODEL_HAIKU,
      512,
      reviewReplySystemPrompt,
      userPrompt,
    )
  }

  /**
   * Call Claude with a system prompt and user prompt, parse the JSON response.
   */
  private async generate<T>(
    model: string,
    maxTokens: number,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<T> {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude response did not contain a text block')
    }

    return this.parseJSON<T>(textBlock.text)
  }

  /**
   * Parse JSON from Claude response text.
   * Handles cases where JSON may be wrapped in markdown code blocks.
   */
  private parseJSON<T>(text: string): T {
    let cleaned = text.trim()

    // Strip markdown code blocks if present
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n')
      if (firstNewline !== -1) {
        cleaned = cleaned.slice(firstNewline + 1)
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3).trim()
      }
    }

    try {
      return JSON.parse(cleaned) as T
    } catch (error) {
      throw new Error(
        `Failed to parse Claude JSON response: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
}
