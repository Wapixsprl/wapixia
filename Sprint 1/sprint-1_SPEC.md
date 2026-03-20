# SPRINT 1 — SPEC.md
# Auth & Hiérarchie Admin
> Durée : 1 semaine | Début : Semaine 2
> Objectif : les 3 niveaux d'accès fonctionnels, isolés et sécurisés

---

## Contexte pour Claude Code

Lire en premier :
- `docs/ARCHITECTURE.md` — stack, règles absolues
- `docs/DATABASE.md` — schéma complet, tables `organizations`, `users`, RLS policies
- `docs/CONVENTIONS.md` — nommage, structure fichiers, git workflow
- `docs/ENV.md` — variables Supabase, JWT

Ce sprint ne touche pas au contenu IA, aux paiements, ni aux sites. Il pose uniquement les fondations d'identité et d'isolation. Tout le reste du projet repose dessus.

---

## 1. Périmètre du sprint

### Ce qui est dans ce sprint ✅
- Schéma BDD : tables `organizations` et `users` + migrations Drizzle
- Supabase Auth configuré avec JWT custom claims
- RLS policies sur `organizations`, `users`, `sites` (table `sites` créée mais vide)
- 3 applications avec leurs pages de connexion :
  - `apps/admin` — SuperAdmin (admin.wapixia.com)
  - `apps/reseller` — Revendeur (dashboard.wapixia.com + white-label)
  - `apps/dashboard` — Client (app.wapixia.com)
- Routes API auth : login, logout, me, invite, refresh
- Middleware d'authentification sur toutes les routes Fastify
- Page de création d'organisation (SuperAdmin → créer Revendeur)
- Page de création d'utilisateur (Revendeur → créer Client)
- Tests unitaires RLS (minimum 20 cas)

### Ce qui n'est PAS dans ce sprint ❌
- Interface de gestion des sites (Sprint 2)
- Paiements (Sprint 5)
- White-label complet (CSS, logo) — uniquement le routing de domaine
- Tableau de bord avec métriques (Sprint 4)
- Invitation par lien public / auto-signup

---

## 2. Schéma de données à implémenter

### Migration 001 — Organizations

```sql
-- packages/db/migrations/20260317_001_create_organizations.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('wapixia', 'reseller', 'direct')),
  parent_id       UUID REFERENCES organizations(id),
  commission_rate DECIMAL(5,2) DEFAULT 20.00,
  stripe_account_id TEXT,
  mollie_profile_id TEXT,

  -- White-label
  white_label_domain  TEXT,
  white_label_logo_url TEXT,
  white_label_primary TEXT DEFAULT '#00D4B1',
  white_label_name    TEXT,

  -- Affiliation
  affiliate_code  TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  referred_by     UUID REFERENCES organizations(id),

  -- Status
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                    'active', 'suspended', 'cancelled', 'trial'
                  )),
  trial_ends_at   TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_organizations_parent ON organizations(parent_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_affiliate ON organizations(affiliate_code);
CREATE INDEX idx_organizations_type ON organizations(type);

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Organisation WapixIA (SuperAdmin) — seed obligatoire
INSERT INTO organizations (id, name, slug, type, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Wapix SPRL',
  'wapixia',
  'wapixia',
  'active'
);
```

### Migration 002 — Users

```sql
-- packages/db/migrations/20260317_002_create_users.sql

CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  role            TEXT NOT NULL CHECK (role IN (
                    'superadmin',
                    'reseller_admin',
                    'reseller_user',
                    'client_admin',
                    'client_user'
                  )),
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  avatar_url      TEXT,
  language        TEXT DEFAULT 'fr',
  timezone        TEXT DEFAULT 'Europe/Brussels',

  notif_email     BOOLEAN DEFAULT TRUE,
  notif_sms       BOOLEAN DEFAULT FALSE,
  notif_push      BOOLEAN DEFAULT TRUE,

  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Migration 003 — Sites (table vide pour RLS)

```sql
-- packages/db/migrations/20260317_003_create_sites_stub.sql
-- Table minimale pour les RLS policies — complétée au Sprint 2

CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  owner_user_id   UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'setup',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_sites_org ON sites(organization_id);
```

### Migration 004 — RLS Policies

```sql
-- packages/db/migrations/20260317_004_rls_policies.sql

-- Activer RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Helpers JWT
CREATE OR REPLACE FUNCTION auth.organization_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(auth.jwt() ->> 'organization_id', '')::UUID;
$$;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT auth.jwt() ->> 'role';
$$;

CREATE OR REPLACE FUNCTION auth.is_superadmin()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT auth.jwt() ->> 'role' = 'superadmin';
$$;

-- ── ORGANIZATIONS ──────────────────────────────────────────────────
-- Superadmin voit tout
-- Revendeur voit son org + ses sous-orgs
-- Client voit uniquement son org

CREATE POLICY "org_select" ON organizations FOR SELECT USING (
  auth.is_superadmin()
  OR id = auth.organization_id()
  OR parent_id = auth.organization_id()
);

CREATE POLICY "org_insert" ON organizations FOR INSERT WITH CHECK (
  auth.is_superadmin()
  OR (
    auth.user_role() IN ('reseller_admin')
    AND parent_id = auth.organization_id()
    AND type = 'direct'
  )
);

CREATE POLICY "org_update" ON organizations FOR UPDATE USING (
  auth.is_superadmin()
  OR id = auth.organization_id()
);

-- ── USERS ──────────────────────────────────────────────────────────
CREATE POLICY "users_select" ON users FOR SELECT USING (
  auth.is_superadmin()
  OR organization_id = auth.organization_id()
  OR organization_id IN (
    SELECT id FROM organizations WHERE parent_id = auth.organization_id()
  )
);

CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (
  auth.is_superadmin()
  OR (
    organization_id = auth.organization_id()
    AND role NOT IN ('superadmin')
  )
  OR (
    auth.user_role() = 'reseller_admin'
    AND organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
    AND role IN ('client_admin', 'client_user')
  )
);

CREATE POLICY "users_update" ON users FOR UPDATE USING (
  auth.is_superadmin()
  OR id = auth.uid()
  OR (
    auth.user_role() IN ('reseller_admin')
    AND organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
);

-- ── SITES ──────────────────────────────────────────────────────────
CREATE POLICY "sites_select" ON sites FOR SELECT USING (
  auth.is_superadmin()
  OR organization_id = auth.organization_id()
  OR organization_id IN (
    SELECT id FROM organizations WHERE parent_id = auth.organization_id()
  )
);

CREATE POLICY "sites_insert" ON sites FOR INSERT WITH CHECK (
  auth.is_superadmin()
  OR organization_id = auth.organization_id()
  OR (
    auth.user_role() = 'reseller_admin'
    AND organization_id IN (
      SELECT id FROM organizations WHERE parent_id = auth.organization_id()
    )
  )
);

CREATE POLICY "sites_update" ON sites FOR UPDATE USING (
  auth.is_superadmin()
  OR organization_id = auth.organization_id()
);
```

### Migration 005 — JWT Hook (custom claims)

```sql
-- packages/db/migrations/20260317_005_jwt_hook.sql
-- Supabase Auth Hook : injecter organization_id et role dans le JWT

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  claims JSONB;
  v_user_id UUID;
  v_org_id UUID;
  v_role TEXT;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;
  claims := event -> 'claims';

  SELECT organization_id, role
  INTO v_org_id, v_role
  FROM public.users
  WHERE id = v_user_id;

  IF v_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{organization_id}', to_jsonb(v_org_id::TEXT));
    claims := jsonb_set(claims, '{role}', to_jsonb(v_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Activer le hook dans Supabase Dashboard :
-- Authentication > Hooks > Custom Access Token > custom_access_token_hook
```

---

## 3. Routes API à implémenter

### Structure des routes auth

```
packages/api/src/routes/
├── auth/
│   ├── me.ts                   GET  /api/v1/auth/me
│   ├── refresh.ts              POST /api/v1/auth/refresh
│   └── invite.ts               POST /api/v1/auth/invite
├── organizations/
│   ├── index.ts                GET  /api/v1/organizations
│   ├── create.ts               POST /api/v1/organizations
│   ├── [id]/
│   │   ├── get.ts              GET  /api/v1/organizations/:id
│   │   └── update.ts           PATCH /api/v1/organizations/:id
└── users/
    ├── index.ts                GET  /api/v1/users
    ├── create.ts               POST /api/v1/users
    └── [id]/
        ├── get.ts              GET  /api/v1/users/:id
        └── update.ts           PATCH /api/v1/users/:id
```

### Détail des routes

#### GET /api/v1/auth/me
```typescript
// Réponse
{
  data: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    role: UserRole
    organization: {
      id: string
      name: string
      type: OrgType
      whiteLabel: {
        domain: string | null
        logoUrl: string | null
        primary: string
        name: string | null
      }
    }
  }
}
```

#### POST /api/v1/auth/invite
```typescript
// Body
{
  email: string           // email de l'invité
  role: UserRole          // rôle à attribuer
  organizationId: string  // org de destination
  firstName?: string
  lastName?: string
}

// Comportement :
// 1. Valider que le caller a le droit de créer ce rôle dans cette org
// 2. Créer l'user Supabase Auth avec sendInvitation: true
// 3. Créer l'entrée dans public.users
// 4. Envoyer l'email Brevo template BREVO_TEMPLATE_WELCOME
// 5. Retourner { data: { userId, email, inviteLink } }
```

#### GET /api/v1/organizations
```typescript
// Query params
?page=1&limit=20&type=reseller&status=active&search=agence

// Réponse (paginée)
{
  data: Organization[]
  meta: { page: number, limit: number, total: number }
}

// Filtres appliqués automatiquement par le RLS :
// - Superadmin : toutes les orgs
// - Reseller : son org + ses clients
// - Client : son org uniquement
```

#### POST /api/v1/organizations
```typescript
// Body
{
  name: string
  slug: string              // validé : lowercase, alphanum, tirets, unique
  type: 'reseller' | 'direct'
  commissionRate?: number   // défaut 20, uniquement si type = 'reseller'
  whiteLabel?: {
    domain?: string
    logoUrl?: string
    primary?: string
    name?: string
  }
}

// Règles :
// - Seul superadmin peut créer type = 'reseller'
// - reseller_admin peut créer type = 'direct' (ses clients)
// - Le parent_id est automatiquement défini selon le caller
```

---

## 4. Middleware d'authentification

```typescript
// packages/api/src/plugins/auth.ts

import { FastifyPluginAsync } from 'fastify'
import { createClient } from '@supabase/supabase-js'

export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)
  fastify.decorateRequest('organizationId', null)

  fastify.addHook('preHandler', async (request, reply) => {
    // Routes publiques exemptées
    const PUBLIC_ROUTES = ['/health', '/api/v1/webhooks']
    if (PUBLIC_ROUTES.some(r => request.url.startsWith(r))) return

    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token manquant' } })
    }

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Token invalide' } })
    }

    // Injecter dans la request
    request.user = user
    request.organizationId = user.user_metadata.organization_id
    request.userRole = user.user_metadata.role
  })
}

// Helper : vérifier les permissions
export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.userRole)) {
      return reply.code(403).send({
        error: { code: 'FORBIDDEN', message: 'Droits insuffisants' }
      })
    }
  }
}
```

---

## 5. Pages frontend à implémenter

### apps/admin — Page login (admin.wapixia.com/login)
```
Champs : email, password
Actions : connexion, mot de passe oublié
Redirect : /dashboard après connexion
Guard : si non superadmin → redirect /login avec message
```

### apps/admin — Page /dashboard (liste des organisations)
```
Tableau avec colonnes : Nom, Type, Clients, MRR, Status, Actions
Filtres : type (reseller/direct), status
Bouton : "Créer un revendeur"
Pagination : 20 par page
```

### apps/admin — Page /dashboard/organizations/new
```
Formulaire création revendeur :
- Nom *
- Slug (auto-généré depuis le nom, modifiable)
- Taux de commission (défaut 20%)
- Domaine white-label (optionnel)
- Email admin du revendeur * → envoie invitation
```

### apps/reseller — Page login (dashboard.wapixia.com/login)
```
Même structure que admin
Guard : si non reseller_admin ou reseller_user → /login
Note : si white_label_domain défini, la page login doit être accessible
       sur ce domaine avec le logo/couleurs du revendeur
```

### apps/reseller — Page /clients (liste des clients)
```
Tableau avec colonnes : Nom, Site, Modules actifs, MRR, Status, Actions
Bouton : "Ajouter un client"
```

### apps/dashboard — Page login (app.wapixia.com/login)
```
Guard : si non client_admin ou client_user → /login
```

### apps/dashboard — Page /overview (après connexion)
```
Pour Sprint 1 : page placeholder avec message de bienvenue
"Votre site est en cours de configuration — revenez dans 48h"
État compte : prénom, email, organisation
```

---

## 6. Drizzle Schema (TypeScript)

```typescript
// packages/db/src/schema/organizations.ts
import { pgTable, uuid, text, decimal, boolean, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const organizations = pgTable('organizations', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           text('name').notNull(),
  slug:           text('slug').unique().notNull(),
  type:           text('type', {
                    enum: ['wapixia', 'reseller', 'direct']
                  }).notNull(),
  parentId:       uuid('parent_id').references((): any => organizations.id),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('20.00'),

  // White-label
  whitelabelDomain:   text('white_label_domain'),
  whitelabelLogoUrl:  text('white_label_logo_url'),
  whitelabelPrimary:  text('white_label_primary').default('#00D4B1'),
  whitelabelName:     text('white_label_name'),

  // Affiliation
  affiliateCode:  text('affiliate_code').unique(),
  referredBy:     uuid('referred_by').references((): any => organizations.id),

  // Status
  status:         text('status', {
                    enum: ['active', 'suspended', 'cancelled', 'trial']
                  }).notNull().default('active'),
  trialEndsAt:    timestamp('trial_ends_at', { withTimezone: true }),

  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:      timestamp('deleted_at', { withTimezone: true }),
})

// packages/db/src/schema/users.ts
export const users = pgTable('users', {
  id:             uuid('id').primaryKey(),  // = auth.users.id
  organizationId: uuid('organization_id').notNull()
                    .references(() => organizations.id),
  role:           text('role', {
                    enum: ['superadmin', 'reseller_admin', 'reseller_user', 'client_admin', 'client_user']
                  }).notNull(),
  firstName:      text('first_name'),
  lastName:       text('last_name'),
  email:          text('email').notNull(),
  phone:          text('phone'),
  language:       text('language').default('fr'),
  timezone:       text('timezone').default('Europe/Brussels'),
  notifEmail:     boolean('notif_email').default(true),
  notifSms:       boolean('notif_sms').default(false),
  notifPush:      boolean('notif_push').default(true),
  lastSeenAt:     timestamp('last_seen_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Types inférés
export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserRole = 'superadmin' | 'reseller_admin' | 'reseller_user' | 'client_admin' | 'client_user'
export type OrgType = 'wapixia' | 'reseller' | 'direct'
```

---

## 7. Seed de données de test

```typescript
// packages/db/src/seed/sprint1.ts
// À exécuter une fois sur l'environnement staging

const SEED_DATA = {
  organizations: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Wapix SPRL',
      slug: 'wapixia',
      type: 'wapixia' as const,
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Agence Test Dupont',
      slug: 'agence-dupont',
      type: 'reseller' as const,
      parentId: '00000000-0000-0000-0000-000000000001',
      commissionRate: '20.00',
      whitelabelDomain: 'dashboard.agencedupont-test.be',
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Salon Test Sonia',
      slug: 'salon-sonia',
      type: 'direct' as const,
      parentId: '00000000-0000-0000-0000-000000000002',
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      name: 'Client Direct WapixIA',
      slug: 'client-direct-test',
      type: 'direct' as const,
      parentId: '00000000-0000-0000-0000-000000000001',
    },
  ],
  // Les users sont créés via Supabase Auth invite
  // Emails de test :
  // superadmin@test.wapixia.com → role: superadmin, org: 000...001
  // reseller@test.wapixia.com   → role: reseller_admin, org: 000...002
  // client@test.wapixia.com     → role: client_admin, org: 000...003
  // client2@test.wapixia.com    → role: client_admin, org: 000...004
}
```

---

## 8. Instructions pour Claude Code

```
Tu travailles sur le Sprint 1 de WapixIA — Auth & Hiérarchie Admin.

Contexte obligatoire à lire AVANT de coder :
- docs/ARCHITECTURE.md
- docs/DATABASE.md (sections 2.1, 2.2, 2.3, 3)
- docs/CONVENTIONS.md
- docs/ENV.md (section 1 Supabase)
- docs/sprints/sprint-1/SPEC.md (ce fichier)

Stack : Next.js 14+ App Router, TypeScript strict, Fastify, Drizzle ORM, Supabase Auth, Zod, Tailwind CSS, shadcn/ui

Ce que tu dois livrer dans l'ordre :
1. packages/db — migrations 001 à 005 + schéma Drizzle + types + seed
2. packages/api — plugin auth, middleware, routes /auth/me, /auth/invite, /organizations, /users
3. apps/admin — page login + page dashboard (liste orgs) + page /organizations/new
4. apps/reseller — page login + page /clients
5. apps/dashboard — page login + page /overview placeholder

Règles absolues :
- TypeScript strict, zéro any
- Tous les inputs validés avec Zod
- Les RLS policies de DATABASE.md s'appliquent exactement telles que définies
- Les noms de tables, colonnes et types correspondent EXACTEMENT à DATABASE.md
- Ne pas modifier le schéma sans créer une migration Drizzle
- Une fonctionnalité = une branche git (ex: feat/sprint1-db-schema)
```
