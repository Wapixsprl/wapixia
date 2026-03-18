# ENV.md — WapixIA
> Version : 1.0 | Date : Mars 2026
> Ce fichier documente TOUTES les variables d'environnement nécessaires.
> Ne jamais committer de vraies valeurs — ce fichier contient uniquement les clés et leurs descriptions.

---

## Récapitulatif par application

| Application | Fichier .env |
|---|---|
| apps/dashboard | `apps/dashboard/.env.local` |
| apps/admin | `apps/admin/.env.local` |
| apps/reseller | `apps/reseller/.env.local` |
| packages/api | `packages/api/.env` |
| packages/queue | `packages/queue/.env` |

---

## 1. Supabase

```env
# URL du projet Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co

# Clé publique (anon) — côté client, safe à exposer
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Clé service role — JAMAIS côté client, uniquement API backend
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# URL directe PostgreSQL (pour Drizzle ORM)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres

# URL pooler (pour les fonctions edge et workers)
DATABASE_POOLER_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

---

## 2. Anthropic / Claude API

```env
# Clé API Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Modèles utilisés (ne pas changer sans validation)
CLAUDE_MODEL_CONTENT=claude-sonnet-4-6      # Articles, posts RS
CLAUDE_MODEL_REVIEW=claude-haiku-4-5-20251001  # Réponses avis (économique)
CLAUDE_MODEL_ONBOARDING=claude-sonnet-4-6   # Génération onboarding

# Limites par tenant (tokens/mois)
CLAUDE_MAX_TOKENS_PER_TENANT_MONTHLY=500000
```

---

## 3. Paiements

```env
# ── MOLLIE ──
MOLLIE_API_KEY=live_...                      # Production
MOLLIE_API_KEY_TEST=test_...                 # Test
MOLLIE_WEBHOOK_URL=https://api.wapixia.com/webhooks/mollie

# ── STRIPE ──
STRIPE_SECRET_KEY=sk_live_...               # Production
STRIPE_SECRET_KEY_TEST=sk_test_...          # Test
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...             # Signature webhook
STRIPE_CONNECT_CLIENT_ID=ca_...             # Pour Stripe Connect revendeurs

# ── SUMUP ──
SUMUP_API_KEY=...
SUMUP_MERCHANT_CODE=...

# ── PAYPAL ──
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENVIRONMENT=production               # 'sandbox' ou 'production'
```

---

## 4. Google APIs

```env
# Clé API générique (Maps, Places)
GOOGLE_API_KEY=AIza...

# OAuth2 (Analytics, Search Console, GMB, Tag Manager)
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://app.wapixia.com/auth/google/callback

# Service Account (pour les jobs automatiques sans OAuth user)
GOOGLE_SERVICE_ACCOUNT_EMAIL=wapixia@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON encodé base64
```

---

## 5. Meta (Facebook / Instagram)

```env
# App Meta
META_APP_ID=...
META_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...  # Token de vérification webhook (chaîne random)

# Version API Graph
META_API_VERSION=v21.0
```

---

## 6. Email — Brevo (ex-Sendinblue)

```env
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@wapixia.com
BREVO_SENDER_NAME=WapixIA

# Templates Brevo (IDs des templates créés dans Brevo)
BREVO_TEMPLATE_WELCOME=1
BREVO_TEMPLATE_MONTHLY_REPORT=2
BREVO_TEMPLATE_MODULE_ACTIVATED=3
BREVO_TEMPLATE_NEGATIVE_REVIEW_ALERT=4
BREVO_TEMPLATE_LEAD_NOTIFICATION=5
BREVO_TEMPLATE_COMMISSION_STATEMENT=6
```

---

## 7. SMS — Twilio

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+32...    # Numéro Twilio belge

# Numéro de tracking appels
TWILIO_TRACKING_POOL=+32...  # Pool de numéros pour call tracking
```

---

## 8. Cloudflare

```env
# API Cloudflare (gestion DNS, sous-domaines)
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...              # Zone wapixia.com
CLOUDFLARE_ACCOUNT_ID=...

# Cloudflare R2 (stockage médias)
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET_NAME=wapixia-media
CLOUDFLARE_R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://media.wapixia.com
```

---

## 9. Redis / BullMQ

```env
# Redis (self-hosted sur Hetzner ou Upstash)
REDIS_URL=redis://default:password@localhost:6379
REDIS_TLS=false                     # true si Upstash

# BullMQ
BULLMQ_QUEUE_PREFIX=wapixia
BULLMQ_MAX_CONCURRENT_JOBS=20
```

---

## 10. Application

```env
# Environnement
NODE_ENV=production                 # 'development', 'staging', 'production'
APP_ENV=production

# URLs
NEXT_PUBLIC_APP_URL=https://app.wapixia.com
NEXT_PUBLIC_API_URL=https://api.wapixia.com
NEXT_PUBLIC_ADMIN_URL=https://admin.wapixia.com
API_BASE_URL=https://api.wapixia.com

# Sécurité
JWT_SECRET=...                      # Min 64 caractères, random
ENCRYPTION_KEY=...                  # 32 bytes hex, pour chiffrement hosting credentials
WEBHOOK_SECRET=...                  # Pour valider les webhooks internes

# Sessions
SESSION_SECRET=...
SESSION_MAX_AGE=86400               # 24h en secondes

# Rate limiting
RATE_LIMIT_MAX=100                  # Requêtes par fenêtre
RATE_LIMIT_WINDOW_MS=60000          # Fenêtre en ms (1 minute)
```

---

## 11. Monitoring

```env
# UptimeRobot
UPTIMEROBOT_API_KEY=...

# Sentry (error tracking)
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# Analytics internes
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=wapixia.com  # Plausible auto-hébergé ou cloud
```

---

## 12. IA Open Source (chatbot)

```env
# Ollama (self-hosted Hetzner)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct

# Groq (fallback gratuit phase pilote)
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
```

---

## 13. Template .env.example

Copier ce fichier en `.env.local` et remplir les valeurs :

```env
# ─── SUPABASE ───────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# ─── CLAUDE API ─────────────────────────────────────
ANTHROPIC_API_KEY=

# ─── PAIEMENTS ──────────────────────────────────────
MOLLIE_API_KEY=
MOLLIE_API_KEY_TEST=
STRIPE_SECRET_KEY=
STRIPE_SECRET_KEY_TEST=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# ─── GOOGLE ─────────────────────────────────────────
GOOGLE_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ─── META ────────────────────────────────────────────
META_APP_ID=
META_APP_SECRET=

# ─── EMAIL ───────────────────────────────────────────
BREVO_API_KEY=

# ─── SMS ─────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ─── CLOUDFLARE ──────────────────────────────────────
CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ZONE_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=

# ─── REDIS ───────────────────────────────────────────
REDIS_URL=

# ─── APP ─────────────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
JWT_SECRET=
ENCRYPTION_KEY=
```

---

## 14. Script de validation au démarrage

```typescript
// packages/api/src/validate-env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  MOLLIE_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  BREVO_API_KEY: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(64),
  ENCRYPTION_KEY: z.string().length(64),  // 32 bytes hex
})

export function validateEnv() {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    console.error('❌ Variables d environnement invalides :')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }
  console.log('✅ Variables d environnement validées')
  return result.data
}
```
