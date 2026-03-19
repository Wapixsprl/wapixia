import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

/**
 * Tests RLS — Sprint 1
 * Vérifie l'isolation multi-tenant sur les 3 tables : organizations, users, sites
 *
 * On génère des JWT custom pour simuler chaque rôle
 * et on vérifie que chaque rôle ne voit que ses données autorisées.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://xcjvbgcjjjzpsupekpze.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Test data IDs — seront créés en beforeAll
let wapixiaOrgId: string
let resellerOrgId: string
let clientOrgId: string
let superadminUserId: string
let resellerUserId: string
let clientUserId: string
let clientSiteId: string

function createJWT(claims: Record<string, unknown>): string {
  return jwt.sign(
    {
      aud: 'authenticated',
      role: 'authenticated',
      ...claims,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SUPABASE_JWT_SECRET,
  )
}

function clientAs(claims: Record<string, unknown>): SupabaseClient {
  const token = createJWT(claims)
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  })
}

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

describe('RLS Policies — Sprint 1', () => {
  beforeAll(async () => {
    // Skip if no credentials
    if (!SUPABASE_JWT_SECRET || !SERVICE_ROLE_KEY) {
      console.warn('⚠️  Skipping RLS tests — missing SUPABASE_JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY')
      return
    }

    const admin = adminClient()

    // Create test organizations
    const { data: wapixiaOrg } = await admin
      .from('organizations')
      .insert({ name: 'WapixIA Test', slug: 'wapixia-test-rls', type: 'wapixia' })
      .select('id')
      .single()
    wapixiaOrgId = wapixiaOrg!.id

    const { data: resellerOrg } = await admin
      .from('organizations')
      .insert({ name: 'Reseller Test', slug: 'reseller-test-rls', type: 'reseller' })
      .select('id')
      .single()
    resellerOrgId = resellerOrg!.id

    const { data: clientOrg } = await admin
      .from('organizations')
      .insert({
        name: 'Client Test',
        slug: 'client-test-rls',
        type: 'direct',
        parent_id: resellerOrgId,
      })
      .select('id')
      .single()
    clientOrgId = clientOrg!.id

    // Create test auth users via admin API
    const { data: saUser } = await admin.auth.admin.createUser({
      email: 'sa-rls-test@wapixia.test',
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: { organization_id: wapixiaOrgId, role: 'superadmin' },
    })
    superadminUserId = saUser.user!.id

    const { data: rsUser } = await admin.auth.admin.createUser({
      email: 'reseller-rls-test@wapixia.test',
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: { organization_id: resellerOrgId, role: 'reseller_admin' },
    })
    resellerUserId = rsUser.user!.id

    const { data: clUser } = await admin.auth.admin.createUser({
      email: 'client-rls-test@wapixia.test',
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: { organization_id: clientOrgId, role: 'client_admin' },
    })
    clientUserId = clUser.user!.id

    // Insert user records
    await admin.from('users').insert([
      { id: superadminUserId, organization_id: wapixiaOrgId, role: 'superadmin', email: 'sa-rls-test@wapixia.test' },
      { id: resellerUserId, organization_id: resellerOrgId, role: 'reseller_admin', email: 'reseller-rls-test@wapixia.test' },
      { id: clientUserId, organization_id: clientOrgId, role: 'client_admin', email: 'client-rls-test@wapixia.test' },
    ])

    // Create test site
    const { data: site } = await admin
      .from('sites')
      .insert({
        organization_id: clientOrgId,
        owner_user_id: clientUserId,
        name: 'Site Test RLS',
        slug: 'site-test-rls',
        sector: 'beaute',
        hosting_type: 'wapixia',
        plan: 'subscription',
        plan_price: 89.00,
      })
      .select('id')
      .single()
    clientSiteId = site!.id

    return async () => {
      // Cleanup
      await admin.from('sites').delete().eq('id', clientSiteId)
      await admin.from('users').delete().in('id', [superadminUserId, resellerUserId, clientUserId])
      await admin.from('organizations').delete().eq('id', clientOrgId)
      await admin.from('organizations').delete().eq('id', resellerOrgId)
      await admin.from('organizations').delete().eq('id', wapixiaOrgId)
      await admin.auth.admin.deleteUser(superadminUserId)
      await admin.auth.admin.deleteUser(resellerUserId)
      await admin.auth.admin.deleteUser(clientUserId)
    }
  })

  // ── Organizations ──

  describe('organizations', () => {
    it('T01 — superadmin voit TOUTES les organisations', async () => {
      const client = clientAs({ sub: superadminUserId, organization_id: wapixiaOrgId, org_type: 'wapixia', role: 'superadmin' })
      const { data } = await client.from('organizations').select('id')
      expect(data!.length).toBeGreaterThanOrEqual(3)
    })

    it('T02 — reseller voit son org + ses clients enfants', async () => {
      const client = clientAs({ sub: resellerUserId, organization_id: resellerOrgId, org_type: 'reseller', role: 'reseller_admin' })
      const { data } = await client.from('organizations').select('id')
      const ids = data!.map((o: any) => o.id)
      expect(ids).toContain(resellerOrgId)
      expect(ids).toContain(clientOrgId) // enfant
      expect(ids).not.toContain(wapixiaOrgId)
    })

    it('T03 — client ne voit QUE son org', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('organizations').select('id')
      expect(data!.length).toBe(1)
      expect(data![0].id).toBe(clientOrgId)
    })

    it('T04 — client ne peut PAS voir l org du reseller', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('organizations').select('id').eq('id', resellerOrgId)
      expect(data!.length).toBe(0)
    })
  })

  // ── Users ──

  describe('users', () => {
    it('T05 — superadmin voit TOUS les utilisateurs', async () => {
      const client = clientAs({ sub: superadminUserId, organization_id: wapixiaOrgId, org_type: 'wapixia', role: 'superadmin' })
      const { data } = await client.from('users').select('id')
      expect(data!.length).toBeGreaterThanOrEqual(3)
    })

    it('T06 — reseller voit ses users + ceux de ses clients', async () => {
      const client = clientAs({ sub: resellerUserId, organization_id: resellerOrgId, org_type: 'reseller', role: 'reseller_admin' })
      const { data } = await client.from('users').select('id')
      const ids = data!.map((u: any) => u.id)
      expect(ids).toContain(resellerUserId)
      expect(ids).toContain(clientUserId) // client enfant
      expect(ids).not.toContain(superadminUserId)
    })

    it('T07 — client ne voit QUE ses propres users', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('users').select('id')
      expect(data!.length).toBe(1)
      expect(data![0].id).toBe(clientUserId)
    })

    it('T08 — client ne peut PAS voir le superadmin', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('users').select('id').eq('id', superadminUserId)
      expect(data!.length).toBe(0)
    })

    it('T09 — un utilisateur peut modifier son propre profil', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { error } = await client.from('users').update({ first_name: 'TestUpdate' }).eq('id', clientUserId)
      expect(error).toBeNull()
    })

    it('T10 — un utilisateur ne peut PAS modifier un autre profil', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('users').update({ first_name: 'Hacked' }).eq('id', resellerUserId).select()
      expect(data!.length).toBe(0)
    })
  })

  // ── Sites ──

  describe('sites', () => {
    it('T11 — superadmin voit TOUS les sites', async () => {
      const client = clientAs({ sub: superadminUserId, organization_id: wapixiaOrgId, org_type: 'wapixia', role: 'superadmin' })
      const { data } = await client.from('sites').select('id')
      expect(data!.length).toBeGreaterThanOrEqual(1)
    })

    it('T12 — reseller voit les sites de ses clients', async () => {
      const client = clientAs({ sub: resellerUserId, organization_id: resellerOrgId, org_type: 'reseller', role: 'reseller_admin' })
      const { data } = await client.from('sites').select('id')
      const ids = data!.map((s: any) => s.id)
      expect(ids).toContain(clientSiteId)
    })

    it('T13 — client voit uniquement ses sites', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('sites').select('id')
      expect(data!.length).toBe(1)
      expect(data![0].id).toBe(clientSiteId)
    })

    it('T14 — client ne peut PAS voir les sites d une autre org', async () => {
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data } = await client.from('sites').select('id').eq('organization_id', resellerOrgId)
      expect(data!.length).toBe(0)
    })

    it('T15 — reseller ne voit PAS les sites de WapixIA org', async () => {
      const client = clientAs({ sub: resellerUserId, organization_id: resellerOrgId, org_type: 'reseller', role: 'reseller_admin' })
      const { data } = await client.from('sites').select('id').eq('organization_id', wapixiaOrgId)
      expect(data!.length).toBe(0)
    })
  })

  // ── Cross-tenant 403 ──

  describe('isolation cross-tenant', () => {
    it('T16 — tentative accès cross-tenant retourne 0 résultat', async () => {
      // Client A essaie de lire les données du Reseller
      const client = clientAs({ sub: clientUserId, organization_id: clientOrgId, org_type: 'direct', role: 'client_admin' })
      const { data: orgs } = await client.from('organizations').select('id').eq('id', resellerOrgId)
      const { data: usrs } = await client.from('users').select('id').eq('organization_id', resellerOrgId)
      const { data: sts } = await client.from('sites').select('id').eq('organization_id', resellerOrgId)
      expect(orgs!.length).toBe(0)
      expect(usrs!.length).toBe(0)
      expect(sts!.length).toBe(0)
    })
  })
})
