# WapixIA

Plateforme SaaS multi-tenant de visibilite digitale propulsee par l'IA. WapixIA permet aux PME belges et europeennes de gerer automatiquement leur presence en ligne : site web, reseaux sociaux, Google My Business, blog SEO et gestion des avis clients.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, shadcn/ui |
| **API** | Fastify 4, TypeScript, Zod |
| **Base de donnees** | PostgreSQL (Supabase), Drizzle ORM |
| **CMS** | Payload CMS 3 |
| **IA** | Anthropic Claude (SDK), prompts structures |
| **File d'attente** | BullMQ, Redis (IORedis) |
| **Email** | Brevo (ex-Sendinblue) |
| **Paiements** | Mollie, Stripe Connect |
| **Hebergement** | Coolify (self-hosted), Cloudflare DNS/SSL |
| **CI/CD** | GitHub Actions, Turborepo |
| **Monorepo** | pnpm workspaces, Turborepo |

## Demarrage rapide

### Prerequis

- **Node.js** >= 20
- **pnpm** >= 9
- **Docker** et Docker Compose (pour Redis, PostgreSQL local)
- Un projet **Supabase** (local ou cloud)

### Installation

```bash
# Cloner le repo
git clone git@github.com:Wapixsprl/wapixia.git
cd wapixia

# Installer les dependances
pnpm install

# Lancer les services Docker (Redis, etc.)
docker-compose up -d

# Copier et configurer les variables d'environnement
cp .env.example .env
# Editez .env avec vos cles Supabase, Anthropic, etc.

# Valider la configuration
pnpm tsx packages/api/src/validate-env.ts

# Appliquer les migrations
pnpm --filter @wapixia/db migrate

# Seeder la base de donnees
pnpm tsx packages/db/src/seed.ts

# Lancer en mode developpement
pnpm dev
```

## Structure du projet

```
wapixia/
├── apps/
│   ├── dashboard/      # App client (Next.js) — app.wapixia.com
│   ├── admin/          # Backoffice SuperAdmin (Next.js) — admin.wapixia.com
│   ├── reseller/       # Interface revendeurs (Next.js)
│   └── web/            # Site vitrine / CMS (Payload + Next.js) — wapixia.com
│
├── packages/
│   ├── api/            # API REST (Fastify) — api.wapixia.com
│   ├── db/             # Schema Drizzle, migrations, seed
│   ├── queue/          # BullMQ queues et workers
│   ├── ai/             # Prompts IA et orchestration Anthropic
│   ├── cms/            # Configuration Payload CMS
│   ├── email/          # Templates et service Brevo
│   ├── types/          # Types TypeScript partages
│   └── ui/             # Composants UI partages (shadcn/ui)
│
├── infra/
│   ├── scripts/        # Scripts operationnels (go-live, rollback)
│   ├── coolify/        # Configuration Coolify
│   └── cloudflare/     # Configuration Cloudflare
│
└── turbo.json          # Configuration Turborepo
```

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Lance tous les services en mode developpement |
| `pnpm build` | Build de production (tous les packages) |
| `pnpm lint` | Lint via Biome (tous les packages) |
| `pnpm typecheck` | Verification TypeScript (tous les packages) |
| `pnpm test` | Lance les tests |
| `pnpm --filter @wapixia/db migrate` | Applique les migrations Drizzle |
| `pnpm --filter @wapixia/db studio` | Ouvre Drizzle Studio |
| `pnpm tsx packages/db/src/seed.ts` | Seed de la base de donnees |
| `pnpm tsx packages/api/src/validate-env.ts` | Valide les variables d'environnement |

## Deploiement

### Staging

Le deploiement staging est automatique a chaque push sur la branche `main` via GitHub Actions.

### Production

Le deploiement production se fait par approbation manuelle dans GitHub Actions :

1. Merge de la PR vers `main`
2. Le workflow CI/CD se declenche automatiquement
3. Apres validation des tests et du build, approbation manuelle requise
4. Deploiement via Coolify sur l'infrastructure de production

### Rollback

En cas de probleme en production :

```bash
./infra/scripts/rollback.sh <commit-sha>
```

### Verification pre-go-live

```bash
./infra/scripts/go-live-check.sh
```

## Variables d'environnement

Consultez le fichier `ENV.md` pour la reference complete des variables d'environnement par service.

Utilisez le script de validation pour verifier votre configuration :

```bash
pnpm tsx packages/api/src/validate-env.ts
```

## Conventions

Consultez `CONVENTIONS.md` pour les guidelines de developpement :

- Convention de nommage des branches (`sprint/S{n}-{feature}`)
- Format des commits (Conventional Commits)
- Structure des PRs
- Standards de code (Biome, TypeScript strict)

## Architecture multi-tenant

WapixIA utilise une architecture multi-tenant basee sur les organisations :

- **wapixia** : Organisation racine (SuperAdmin)
- **reseller** : Revendeurs white-label avec leur propre branding
- **direct** : Clients directs

Chaque site client est isole au niveau des donnees via `organization_id` et les politiques RLS de Supabase.

## Licence

Proprietary - Wapix SPRL. Tous droits reserves.
