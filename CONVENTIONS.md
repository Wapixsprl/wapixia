# CONVENTIONS.md — WapixIA
> Version : 1.0 | Date : Mars 2026
> Ces conventions s'appliquent à tout le code du projet, qu'il soit écrit par un humain ou par Claude Code.

---

## 1. TypeScript

### Règles strictes
```json
// tsconfig.json — obligatoire sur tous les packages
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Nommage
| Type | Convention | Exemple |
|---|---|---|
| Variables | camelCase | `siteId`, `organizationName` |
| Constantes | SCREAMING_SNAKE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Fonctions | camelCase | `generateBlogPost()`, `sendReviewReply()` |
| Composants React | PascalCase | `SiteCard`, `ModuleToggle` |
| Types / Interfaces | PascalCase | `Site`, `Organization`, `AIContent` |
| Enums | PascalCase | `SiteStatus`, `UserRole` |
| Fichiers composants | PascalCase | `SiteCard.tsx`, `ModuleList.tsx` |
| Fichiers utilitaires | kebab-case | `format-date.ts`, `generate-slug.ts` |
| Fichiers API routes | kebab-case | `get-sites.ts`, `create-subscription.ts` |

### Zod — validation obligatoire
```typescript
// ✅ Toujours valider les inputs avec Zod
import { z } from 'zod'

const CreateSiteSchema = z.object({
  name: z.string().min(2).max(100),
  sector: z.enum(['btp', 'beaute', 'horeca', 'immobilier', 'medical', 'automobile', 'commerce', 'b2b', 'fitness', 'asbl', 'autre']),
  plan: z.enum(['purchase', 'subscription']),
})

type CreateSiteInput = z.infer<typeof CreateSiteSchema>

// ❌ Jamais d'input non validé en BDD
async function createSite(input: unknown) {
  const data = CreateSiteSchema.parse(input) // throw si invalide
  // ...
}
```

---

## 2. Structure des fichiers

### apps/dashboard (Backoffice client)
```
dashboard/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── overview/
│   │   ├── content/
│   │   ├── modules/
│   │   ├── settings/
│   │   └── reports/
│   └── api/                    # Route handlers Next.js
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── features/               # Composants métier
│   └── layouts/                # Layouts réutilisables
├── hooks/                      # Custom React hooks
├── lib/
│   ├── supabase.ts             # Client Supabase
│   ├── api.ts                  # Client API Fastify
│   └── utils.ts                # Utilitaires généraux
└── types/
    └── index.ts                # Types locaux
```

### packages/api (Backend Fastify)
```
api/
├── src/
│   ├── routes/
│   │   ├── sites/
│   │   │   ├── index.ts        # GET /sites
│   │   │   ├── create.ts       # POST /sites
│   │   │   ├── update.ts       # PATCH /sites/:id
│   │   │   └── delete.ts       # DELETE /sites/:id
│   │   ├── modules/
│   │   ├── content/
│   │   ├── subscriptions/
│   │   └── webhooks/
│   ├── plugins/
│   │   ├── auth.ts             # Plugin Fastify auth
│   │   ├── cors.ts
│   │   └── rate-limit.ts
│   ├── services/               # Logique métier
│   │   ├── ai.service.ts
│   │   ├── payment.service.ts
│   │   └── notification.service.ts
│   ├── middleware/
│   └── server.ts
└── tests/
```

### packages/ai (Claude API wrappers)
```
ai/
├── src/
│   ├── prompts/
│   │   ├── blog/
│   │   │   ├── system.ts       # Prompt système blog
│   │   │   └── templates/      # Templates par secteur
│   │   ├── social/
│   │   ├── gmb/
│   │   └── reviews/
│   ├── generators/
│   │   ├── blog.generator.ts
│   │   ├── social.generator.ts
│   │   └── review.generator.ts
│   └── index.ts
```

---

## 3. Git workflow

### Branches
| Branche | Usage |
|---|---|
| `main` | Production — protégée, merge via PR uniquement |
| `staging` | Staging — déployé sur staging.wapixia.com |
| `develop` | Développement actif |
| `sprint/S1-auth` | Branche de sprint |
| `feat/module-name` | Nouvelle fonctionnalité |
| `fix/bug-description` | Correction de bug |
| `chore/task` | Maintenance, mise à jour deps |

### Convention de commits (Conventional Commits)
```
<type>(<scope>): <description courte en français>

[corps optionnel]

[footer optionnel: BREAKING CHANGE ou refs #issue]
```

**Types autorisés :**
| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `refactor` | Refactoring sans changement de comportement |
| `test` | Ajout ou modification de tests |
| `docs` | Documentation uniquement |
| `chore` | Maintenance (deps, config, scripts) |
| `perf` | Amélioration de performance |
| `style` | Formatage, lint (pas de changement logique) |

**Exemples :**
```
feat(auth): ajouter l'authentification 2FA pour les clients
fix(modules): corriger la désactivation des modules sans rechargement
refactor(db): migrer les requêtes raw SQL vers Drizzle ORM
test(api): ajouter les tests d'intégration sur la route /sites
docs(arch): mettre à jour le schéma de base de données
```

### Pull Request
- **Titre** : même format que le commit message
- **Description** : quoi / pourquoi / comment tester
- **Review obligatoire** avant merge sur `staging` et `main`
- **Pas de force push** sur `staging` et `main`

---

## 4. API Design (Fastify)

### Convention des routes
```
GET    /api/v1/sites              # Liste
GET    /api/v1/sites/:id          # Détail
POST   /api/v1/sites              # Création
PATCH  /api/v1/sites/:id          # Mise à jour partielle
DELETE /api/v1/sites/:id          # Suppression (soft)

# Sous-ressources
GET    /api/v1/sites/:id/modules  # Modules d'un site
POST   /api/v1/sites/:id/modules  # Activer un module

# Actions spéciales
POST   /api/v1/sites/:id/launch   # Mettre en ligne
POST   /api/v1/sites/:id/suspend  # Suspendre
```

### Format de réponse standard
```typescript
// Succès
{
  "data": { ... },
  "meta": { "page": 1, "total": 42 }  // si liste paginée
}

// Erreur
{
  "error": {
    "code": "SITE_NOT_FOUND",
    "message": "Le site demandé n'existe pas",
    "details": {}                       // optionnel
  }
}
```

### Codes d'erreur
| Code | HTTP | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Non authentifié |
| `FORBIDDEN` | 403 | Pas les droits |
| `NOT_FOUND` | 404 | Ressource inexistante |
| `VALIDATION_ERROR` | 422 | Input invalide (Zod) |
| `CONFLICT` | 409 | Conflit (ex: slug déjà pris) |
| `PAYMENT_REQUIRED` | 402 | Module non souscrit |
| `RATE_LIMITED` | 429 | Trop de requêtes |
| `INTERNAL_ERROR` | 500 | Erreur serveur |

---

## 5. Tests

### Stratégie
- **Unit tests** (Vitest) — fonctions de logique métier, générateurs IA, calculs commissions
- **Integration tests** — routes API avec BDD de test
- **E2E tests** (Playwright) — parcours critiques : onboarding, activation module, paiement

### Convention de nommage
```
describe('createSite', () => {
  it('devrait créer un site avec les données valides', () => { ... })
  it('devrait refuser un slug déjà existant', () => { ... })
  it('devrait appliquer le RLS au tenant créateur', () => { ... })
})
```

### Coverage minimum
- **Services critiques** (paiements, commissions, RLS) : 90%
- **Routes API** : 80%
- **Composants UI** : 60%

---

## 6. Variables d'environnement

- **Jamais dans le code** — uniquement dans `.env.local` (dev) ou variables Coolify (prod)
- **Jamais committées** — `.env*` dans `.gitignore`
- **Documentées dans `ENV.md`** — toutes les variables avec leur rôle
- **Validées au démarrage** — script `validate-env.ts` lancé avant chaque démarrage

---

## 7. Logs

```typescript
// Logger structuré obligatoire (Pino, déjà intégré dans Fastify)
// ✅ Correct
logger.info({ siteId, moduleId, duration }, 'Module activé avec succès')
logger.error({ siteId, error: err.message }, 'Erreur lors de la génération d article')

// ❌ Interdit — données personnelles dans les logs
logger.info({ email, phone }, 'Nouvel utilisateur créé')

// Niveaux de log par environnement
// development: debug
// staging: info
// production: warn (erreurs seulement)
```

---

## 8. Gestion des erreurs

```typescript
// Pattern standard pour les services
export async function activateModule(
  siteId: string,
  moduleId: string
): Promise<Result<SiteModule, AppError>> {
  try {
    // ...
    return { success: true, data: module }
  } catch (error) {
    logger.error({ siteId, moduleId, error }, 'Erreur activation module')
    return { success: false, error: new AppError('MODULE_ACTIVATION_FAILED', error) }
  }
}

// Ne jamais laisser une promesse non catchée
// Ne jamais swallower une erreur silencieusement
// Toujours logger avant de rethrow
```
