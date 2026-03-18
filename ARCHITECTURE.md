# ARCHITECTURE.md — WapixIA
> Version : 1.0 | Date : Mars 2026 | Statut : RÉFÉRENCE NON NÉGOCIABLE
> Ce fichier est la loi du projet. Toute déviation doit être discutée et documentée ici avant d'être implémentée.

---

## 1. Vue d'ensemble du système

WapixIA est une plateforme SaaS multi-tenant qui permet à des PME locales belges et francophones de disposer d'un site web intelligent géré par IA. La plateforme opère sur 3 niveaux : SuperAdmin (Wapix SPRL), Revendeurs (agences/freelances), Clients finaux (PME).

### Principe fondamental
Le **socle** (site + CMS) est découplé de la **couche IA** (modules). Le socle peut être hébergé n'importe où (infra WapixIA ou hébergeur client). La couche IA tourne exclusivement sur l'infra WapixIA et se connecte via API légère.

---

## 2. Stack technique — Décisions finales

### Frontend
| Élément | Choix | Justification |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR natif — crawlable par les bots IA, performance SEO |
| Language | TypeScript strict | Sécurité typage, meilleure DX Claude Code |
| Styling | Tailwind CSS v3 | Utility-first, compatible shadcn/ui |
| UI Base | shadcn/ui | Accessibilité, headless, copy-paste |
| UI Animations | Magic UI + Aceternity UI | Composants wow, sectoriels |
| UI Blocs | 21st.dev community | Sections complètes copy-paste |
| UI Forms | Origin UI | 400+ composants formulaires |
| Animations légères | Animata | CSS-first, Core Web Vitals safe |
| State | Zustand | Simple, léger, suffisant pour le scope |
| Data fetching | TanStack Query v5 | Cache, invalidation, optimistic updates |

### Backend
| Élément | Choix | Justification |
|---|---|---|
| Runtime | Node.js 20 LTS | Stable, compatible ecosystem |
| Framework API | Fastify v4 | Performance I/O, adapté webhooks |
| Language | TypeScript strict | Cohérence avec frontend |
| Validation | Zod | Schema validation runtime + TypeScript |
| ORM | Drizzle ORM | Type-safe, léger, compatible Supabase |

### Base de données
| Élément | Choix | Justification |
|---|---|---|
| BDD principale | PostgreSQL via Supabase | RLS natif, multi-tenant, Auth intégré |
| Cache | Redis (Upstash ou self-hosted) | Sessions, rate limiting, cache API |
| Files de travail | BullMQ (sur Redis) | Jobs IA asynchrones, retry, priorités |
| Stockage médias | Cloudflare R2 | S3-compatible, zéro coût egress |

### CMS
| Élément | Choix | Justification |
|---|---|---|
| CMS Headless | Payload CMS 3.x | TypeScript natif, self-hosted, REST + GraphQL |
| Rendu | Next.js ISR | Revalidation à la demande, performance |

### Infrastructure
| Élément | Choix | Justification |
|---|---|---|
| VPS | Hetzner CPX31 | 4 vCPU, 8GB RAM, 160GB NVMe, ~13€/mois |
| PaaS | Coolify (self-hosted) | Deploy GitHub, SSL auto, reverse proxy |
| CDN + DNS | Cloudflare | WAF, DDoS, gestion sous-domaines API |
| Stockage | Cloudflare R2 | Médias clients |
| Backups | Hetzner Object Storage | pg_dump quotidien, snapshots hebdo |

### Services tiers
| Service | Usage | SDK |
|---|---|---|
| Supabase Auth | Authentification, sessions, MFA | @supabase/supabase-js |
| Claude API (Anthropic) | Génération contenu IA | @anthropic-ai/sdk |
| Mollie | Paiements BE/FR, Bancontact | @mollie/api-client |
| Stripe Connect | Paiements internationaux, commissions | stripe |
| Brevo | Email transactionnel, newsletters | @getbrevo/brevo |
| Twilio | SMS rappels RDV, alertes | twilio |
| Google APIs | Analytics, Search Console, GMB, Maps | googleapis |
| Meta Graph API | Facebook, Instagram | node-fetch (REST direct) |

### IA & LLMs
| Usage | Modèle | Justification |
|---|---|---|
| Génération contenu (articles, posts) | claude-sonnet-4-6 | Qualité rédactionnelle optimale |
| Réponses avis Google | claude-haiku-4-5 | Rapide, économique, suffisant |
| Chatbot client sur site | Mistral 7B via Ollama (self-hosted) | RGPD, coût zéro API |
| Fallback chatbot | Groq API (Llama 3.1) | Gratuit 14 400 req/jour en phase pilote |
| Génération visuels | Stable Diffusion XL (V2+) | Self-hosted GPU — V1 : Unsplash API |

---

## 3. Architecture multi-tenant

### Principe d'isolation
Chaque organisation (revendeur ou client direct) est un **tenant** isolé via PostgreSQL Row Level Security (RLS). **Aucune séparation de schémas** — un seul schéma `public`, isolation par `organization_id` sur toutes les tables.

### Hiérarchie des rôles
```
superadmin          → accès total (bypass RLS via service_role key)
reseller_admin      → accès à son organization + ses clients
reseller_user       → accès limité à son organization (lecture)
client_admin        → accès à son tenant client uniquement
client_user         → accès restreint à son tenant (validation contenus)
```

### RLS Policy type
```sql
-- Exemple sur la table sites
CREATE POLICY "tenant_isolation" ON sites
  USING (organization_id = auth.jwt() ->> 'organization_id');
```

### White-label
Chaque organisation revendeur peut avoir :
- Un domaine personnalisé (CNAME sur infra WapixIA)
- Un logo, couleurs primaires, nom d'enseigne
- Des sous-domaines clients au format `client.mondomaine.com`
- Des emails envoyés depuis `noreply@mondomaine.com`

---

## 4. Architecture des modules IA

### Principe de découplage
Les modules IA ne modifient pas directement le site client. Ils génèrent du contenu qui est :
1. Stocké dans la BDD WapixIA
2. Soumis à validation dans le backoffice client (si mode validation activé)
3. Poussé vers la destination finale (site via API CMS, RS via APIs sociales, GMB via API Google)

### Pipeline d'un job IA
```
Trigger (schedule ou event)
  → BullMQ Job créé (priorité, retry policy)
  → Worker récupère le job
  → Contexte assemblé (données client, historique, instructions sectorielles)
  → Appel Claude API (prompt système + contexte)
  → Résultat stocké en BDD avec statut "pending_validation"
  → Notification client (email ou push)
  → Client valide → publication automatique
  → Client rejette → job archivé, feedback optionnel
```

### Queues BullMQ
| Queue | Priorité | Retry | Concurrence |
|---|---|---|---|
| `content:blog` | LOW | 3x, backoff exponentiel | 5 workers |
| `content:social` | MEDIUM | 3x | 10 workers |
| `content:gmb` | MEDIUM | 3x | 5 workers |
| `reputation:reviews` | HIGH | 5x | 10 workers |
| `notifications:email` | HIGH | 3x | 20 workers |
| `notifications:sms` | HIGH | 3x | 10 workers |
| `reports:monthly` | LOW | 2x | 2 workers |
| `seo:audit` | LOW | 2x | 3 workers |

---

## 5. Structure du repo

```
wapixia/
├── apps/
│   ├── web/                    # Frontend Next.js (site client)
│   ├── dashboard/              # Backoffice client (Next.js)
│   ├── admin/                  # Dashboard SuperAdmin (Next.js)
│   └── reseller/               # Dashboard Revendeur (Next.js)
├── packages/
│   ├── api/                    # Backend Fastify
│   ├── cms/                    # Payload CMS
│   ├── db/                     # Drizzle schema + migrations
│   ├── ui/                     # Composants partagés (shadcn/ui)
│   ├── ai/                     # Wrappers Claude API + prompts
│   ├── queue/                  # BullMQ workers + job definitions
│   ├── email/                  # Templates Brevo + helpers
│   └── types/                  # Types TypeScript partagés
├── infra/
│   ├── coolify/                # Configs Coolify
│   ├── cloudflare/             # Workers + KV configs
│   └── scripts/                # Scripts de déploiement
├── docs/                       # Documentation (ce dossier)
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── CONVENTIONS.md
│   ├── ENV.md
│   └── sprints/
│       ├── sprint-0/
│       ├── sprint-1/
│       └── ...
└── tests/
    ├── e2e/                    # Playwright
    ├── integration/            # API tests
    └── unit/                   # Vitest
```

---

## 6. Sécurité — Règles absolues

- **Jamais de clés API dans le code** — uniquement dans les variables d'environnement
- **Jamais de `service_role` key côté client** — uniquement côté serveur
- **Toutes les routes API authentifiées** sauf `/health` et routes webhook (validées par signature)
- **Validation Zod sur tous les inputs** — aucune donnée non validée ne touche la BDD
- **Rate limiting sur toutes les routes publiques** — via Redis + middleware Fastify
- **CORS strict** — whitelist des domaines autorisés par tenant
- **Logs anonymisés** — aucune PII dans les logs d'application
- **HTTPS partout** — Let's Encrypt via Coolify, pas d'exception

---

## 7. Performance — Règles absolues

- **LCP < 2.5s sur mobile 4G** — mesuré via PageSpeed Insights API à chaque déploiement
- **CLS < 0.1** — toutes les images avec width/height définis
- **INP < 200ms** — pas de JavaScript bloquant sur le thread principal
- **SSR obligatoire** sur les pages publiques des sites clients — les crawlers IA ne lisent pas le JS client
- **Lazy-load obligatoire** sur les animations (Framer Motion, Aceternity) — chargées après le LCP
- **Images via next/image** obligatoire — WebP automatique, responsive, lazy par défaut

---

## 8. Règles pour Claude Code

Quand Claude Code travaille sur ce projet, il DOIT :

1. **Lire `ARCHITECTURE.md` et `DATABASE.md` en premier** avant de générer du code
2. **Utiliser TypeScript strict** — `"strict": true` dans tsconfig, zéro `any`
3. **Valider tous les inputs avec Zod** — aucune exception
4. **Écrire les tests unitaires** pour chaque fonction de logique métier
5. **Respecter la structure du repo** définie en section 5
6. **Commenter les décisions non évidentes** — pas besoin de commenter `const x = 1`
7. **Ne jamais modifier le schéma BDD directement** — créer une migration Drizzle
8. **Préfixer les commits** : `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
9. **Une fonctionnalité = une branche** — jamais de commit direct sur `main`
10. **Signaler les dépendances ambiguës** plutôt que de deviner

Claude Code NE DOIT PAS :
- Installer des packages non listés dans `ARCHITECTURE.md` sans validation
- Modifier les RLS policies sans review humaine
- Toucher aux variables d'environnement de production
- Implémenter des fonctionnalités hors scope du sprint en cours
