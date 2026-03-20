/**
 * @wapixia/db — Script de seed production
 *
 * Crée les données initiales nécessaires au fonctionnement de WapixIA :
 * - Organisation WapixIA (tenant root)
 * - Utilisateur SuperAdmin
 * - Catalogue de modules V1
 *
 * Idempotent : utilise ON CONFLICT / UPSERT pour chaque insertion.
 * Usage : tsx packages/db/src/seed.ts
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// ── Fixed UUIDs (deterministic for idempotency) ──

const WAPIXIA_ORG_ID = '00000000-0000-4000-a000-000000000001'
const SUPERADMIN_USER_ID = '00000000-0000-4000-a000-000000000002'

// ── Supabase client (service_role) ──

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Seed functions ──

async function seedOrganization() {
  console.log('  Seeding organization WapixIA...')

  const { error } = await supabase.from('organizations').upsert(
    {
      id: WAPIXIA_ORG_ID,
      name: 'Wapix SPRL',
      slug: 'wapixia',
      type: 'wapixia',
      status: 'active',
      commission_rate: '0.00',
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(`Organization seed failed: ${error.message}`)
  console.log('  Organization WapixIA OK')
}

async function seedSuperAdmin() {
  console.log('  Seeding SuperAdmin user...')

  // Create auth user via admin API (idempotent — will skip if exists)
  const { data: existingUser } = await supabase.auth.admin.getUserById(SUPERADMIN_USER_ID)

  if (!existingUser?.user) {
    const email = process.env.SUPERADMIN_EMAIL ?? 'admin@wapixia.com'
    const password = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe!2024'

    const { error: authError } = await supabase.auth.admin.createUser({
      id: SUPERADMIN_USER_ID,
      email,
      password,
      email_confirm: true,
    })

    if (authError && !authError.message.includes('already registered')) {
      throw new Error(`Auth user creation failed: ${authError.message}`)
    }
    console.log(`  Auth user created: ${email}`)
  } else {
    console.log('  Auth user already exists, skipping...')
  }

  // Upsert public.users row
  const { error } = await supabase.from('users').upsert(
    {
      id: SUPERADMIN_USER_ID,
      organization_id: WAPIXIA_ORG_ID,
      role: 'superadmin',
      first_name: 'Super',
      last_name: 'Admin',
      email: process.env.SUPERADMIN_EMAIL ?? 'admin@wapixia.com',
      language: 'fr',
      timezone: 'Europe/Brussels',
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(`SuperAdmin user seed failed: ${error.message}`)
  console.log('  SuperAdmin user OK')
}

async function seedModuleCatalog() {
  console.log('  Seeding module catalog...')

  const modules = [
    {
      id: 'social_posts',
      name: 'Posts Réseaux Sociaux IA',
      description: 'Génération automatique de posts pour les réseaux sociaux via IA (Facebook, Instagram, LinkedIn).',
      price_monthly: '10.00',
      category: 'content',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 'gmb_reviews',
      name: 'Posts GMB + Gestion Avis',
      description: 'Publication automatique sur Google My Business et gestion intelligente des avis clients.',
      price_monthly: '10.00',
      category: 'reputation',
      is_active: true,
      sort_order: 2,
    },
    {
      id: 'blog_seo',
      name: 'Articles Blog SEO',
      description: 'Rédaction automatique d\'articles de blog optimisés SEO avec mots-clés stratégiques.',
      price_monthly: '10.00',
      category: 'content',
      is_active: true,
      sort_order: 3,
    },
  ]

  for (const mod of modules) {
    const { error } = await supabase
      .from('module_catalog')
      .upsert(mod, { onConflict: 'id' })

    if (error) throw new Error(`Module "${mod.id}" seed failed: ${error.message}`)
  }

  console.log(`  Module catalog OK (${modules.length} modules)`)
}

// ── Main ──

async function main() {
  console.log('=== WapixIA Database Seed ===\n')

  try {
    await seedOrganization()
    await seedSuperAdmin()
    await seedModuleCatalog()

    console.log('\n=== Seed terminé avec succès ===')
    process.exit(0)
  } catch (err) {
    console.error('\n=== Seed échoué ===')
    console.error(err)
    process.exit(1)
  }
}

main()
