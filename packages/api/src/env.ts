import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().default(3010),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003'),

  // Cloudflare (domain management)
  CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_ZONE_ID: z.string().min(1).optional(),

  // Coolify (deployment)
  COOLIFY_BASE_URL: z.string().url().optional(),
  COOLIFY_API_TOKEN: z.string().min(1).optional(),

  // AI generation
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // Mollie (payment gateway)
  MOLLIE_API_KEY: z.string().min(1).optional(),

  // Stripe (commission transfers)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // API public URL (for webhook callbacks)
  API_PUBLIC_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors
    const missing = Object.entries(formatted)
      .map(([key, errors]) => `  ${key}: ${errors?.join(', ')}`)
      .join('\n')

    throw new Error(`❌ Variables d'environnement manquantes ou invalides:\n${missing}`)
  }

  return result.data
}

export const env = validateEnv()
