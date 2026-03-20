/**
 * @wapixia/api — Validation exhaustive des variables d'environnement
 *
 * Valide toutes les variables requises pour chaque service.
 * Fail-fast au démarrage avec des messages d'erreur clairs.
 *
 * Usage CLI : tsx packages/api/src/validate-env.ts
 * Usage import : import { validateAllEnv } from './validate-env.js'
 */

import 'dotenv/config'
import { z } from 'zod'

// ── Schemas par groupe ──

const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url('URL Supabase invalide'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Clé anon Supabase manquante'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Clé service_role Supabase manquante'),
  SUPABASE_JWT_SECRET: z.string().min(1, 'Secret JWT Supabase manquant'),
})

const anthropicSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'Clé API Anthropic manquante'),
})

const mollieSchema = z.object({
  MOLLIE_API_KEY: z.string().min(1, 'Clé API Mollie manquante'),
  MOLLIE_PARTNER_ID: z.string().optional(),
})

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, 'Clé secrète Stripe manquante'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'Secret webhook Stripe manquant'),
})

const cloudflareSchema = z.object({
  CLOUDFLARE_API_TOKEN: z.string().min(1, 'Token API Cloudflare manquant'),
  CLOUDFLARE_ZONE_ID: z.string().min(1, 'Zone ID Cloudflare manquant'),
})

const redisSchema = z.object({
  REDIS_URL: z.string().min(1, 'URL Redis manquante'),
})

const brevoSchema = z.object({
  BREVO_API_KEY: z.string().min(1, 'Clé API Brevo manquante'),
  BREVO_SENDER_EMAIL: z.string().email('Email expéditeur Brevo invalide').optional(),
  BREVO_SENDER_NAME: z.string().optional(),
})

// ── Groupes de validation ──

interface EnvGroup {
  name: string
  schema: z.ZodTypeAny
  required: boolean // true = obligatoire en prod, false = optionnel en dev
}

const ENV_GROUPS: EnvGroup[] = [
  { name: 'Supabase', schema: supabaseSchema, required: true },
  { name: 'Anthropic', schema: anthropicSchema, required: true },
  { name: 'Mollie', schema: mollieSchema, required: false },
  { name: 'Stripe', schema: stripeSchema, required: false },
  { name: 'Cloudflare', schema: cloudflareSchema, required: false },
  { name: 'Redis', schema: redisSchema, required: true },
  { name: 'Brevo', schema: brevoSchema, required: false },
]

// ── Validation ──

interface ValidationResult {
  group: string
  status: 'pass' | 'fail' | 'warn'
  errors: string[]
}

export function validateAllEnv(): { results: ValidationResult[]; hasErrors: boolean } {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const isProd = nodeEnv === 'production'
  const results: ValidationResult[] = []
  let hasErrors = false

  for (const group of ENV_GROUPS) {
    const result = group.schema.safeParse(process.env)

    if (result.success) {
      results.push({ group: group.name, status: 'pass', errors: [] })
    } else {
      const errors = result.error.issues.map(
        (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
      )

      if (group.required || isProd) {
        results.push({ group: group.name, status: 'fail', errors })
        hasErrors = true
      } else {
        results.push({ group: group.name, status: 'warn', errors })
      }
    }
  }

  return { results, hasErrors }
}

function printResults(results: ValidationResult[], hasErrors: boolean): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development'

  console.log('=== WapixIA — Validation des variables d\'environnement ===')
  console.log(`Environnement : ${nodeEnv}\n`)

  for (const r of results) {
    const icon = r.status === 'pass' ? '\u2705' : r.status === 'warn' ? '\u26a0\ufe0f ' : '\u274c'
    const label = r.status === 'pass' ? 'OK' : r.status === 'warn' ? 'OPTIONNEL (manquant)' : 'MANQUANT'

    console.log(`${icon} ${r.group}: ${label}`)
    for (const err of r.errors) {
      console.log(err)
    }
  }

  console.log('')

  if (hasErrors) {
    console.error('\u274c Des variables obligatoires sont manquantes. Corrigez votre fichier .env.')
    process.exit(1)
  } else {
    console.log('\u2705 Toutes les variables obligatoires sont configurées.')
  }
}

// ── CLI entry point ──

const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('validate-env.ts') || process.argv[1].endsWith('validate-env.js'))

if (isMainModule) {
  const { results, hasErrors } = validateAllEnv()
  printResults(results, hasErrors)
}
