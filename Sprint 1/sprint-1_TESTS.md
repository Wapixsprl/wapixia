# SPRINT 1 — TESTS.md
# Auth & Hiérarchie Admin — Scénarios de test
> À exécuter par Salim (chef d'orchestre) sur l'environnement staging
> Un test = une action + un résultat attendu précis
> ✅ = Passé | ❌ = Échoué (noter le comportement observé) | ⏭️ = Bloqué par un autre test

---

## Comptes de test à créer avant de démarrer

| Compte | Email | Rôle | Organisation |
|---|---|---|---|
| SuperAdmin | superadmin@test.wapixia.com | superadmin | Wapix SPRL |
| Revendeur A | reseller@test.wapixia.com | reseller_admin | Agence Test Dupont |
| Client du revendeur A | client@test.wapixia.com | client_admin | Salon Test Sonia |
| Client direct WapixIA | client2@test.wapixia.com | client_admin | Client Direct WapixIA |
| User revendeur (non admin) | reseller-user@test.wapixia.com | reseller_user | Agence Test Dupont |

---

## BLOC 1 — Migrations & Base de données

### T1.1 — Tables créées
**Action :** Se connecter à Supabase Studio staging → Table Editor
**Attendu :**
- [ ] Table `organizations` existe avec toutes les colonnes de DATABASE.md
- [ ] Table `users` existe avec toutes les colonnes de DATABASE.md
- [ ] Table `sites` existe (stub minimaliste)
- [ ] Index créés (vérifier via SQL : `SELECT indexname FROM pg_indexes WHERE tablename = 'organizations'`)

### T1.2 — Seed SuperAdmin présent
**Action :** `SELECT * FROM organizations WHERE type = 'wapixia'`
**Attendu :**
- [ ] 1 résultat avec id `00000000-0000-0000-0000-000000000001` et name `Wapix SPRL`

### T1.3 — Contraintes CHECK fonctionnelles
**Action SQL :** `INSERT INTO organizations (name, slug, type) VALUES ('Test', 'test', 'invalid_type')`
**Attendu :**
- [ ] Erreur PostgreSQL : `violates check constraint`

### T1.4 — Trigger updated_at fonctionnel
**Action SQL :**
```sql
UPDATE organizations SET name = 'Wapix SPRL v2' WHERE slug = 'wapixia';
SELECT updated_at FROM organizations WHERE slug = 'wapixia';
```
**Attendu :**
- [ ] `updated_at` est plus récent que `created_at`

### T1.5 — Affiliate code auto-généré
**Action SQL :** `SELECT affiliate_code FROM organizations WHERE slug = 'wapixia'`
**Attendu :**
- [ ] Un code hexadécimal de 12 caractères est présent (non NULL)

---

## BLOC 2 — JWT Custom Claims

### T2.1 — Claims injectés dans le token
**Action :**
1. Se connecter avec superadmin@test.wapixia.com via l'API Supabase Auth
2. Décoder le JWT reçu (jwt.io)
**Attendu :**
- [ ] Le payload contient `organization_id` = `00000000-0000-0000-0000-000000000001`
- [ ] Le payload contient `role` = `superadmin`

### T2.2 — Claims corrects pour un revendeur
**Action :** Même test avec reseller@test.wapixia.com
**Attendu :**
- [ ] `organization_id` = `00000000-0000-0000-0000-000000000002`
- [ ] `role` = `reseller_admin`

### T2.3 — Claims corrects pour un client
**Action :** Même test avec client@test.wapixia.com
**Attendu :**
- [ ] `organization_id` = `00000000-0000-0000-0000-000000000003`
- [ ] `role` = `client_admin`

### T2.4 — Token expiré refusé
**Action :** Utiliser un token expiré (modifier l'heure système ou attendre expiration) sur GET /api/v1/auth/me
**Attendu :**
- [ ] HTTP 401 avec `{ error: { code: "UNAUTHORIZED" } }`

---

## BLOC 3 — RLS Policies

### T3.1 — SuperAdmin voit toutes les organisations
**Action SQL (connecté en tant que superadmin via service role) :**
```sql
SET LOCAL role TO 'authenticated';
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000001","role":"superadmin"}';
SELECT count(*) FROM organizations;
```
**Attendu :**
- [ ] Count = 4 (toutes les organisations seed)

### T3.2 — Revendeur voit uniquement son org et ses clients
**Action SQL (simuler revendeur) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000002","role":"reseller_admin"}';
SELECT id, name, type FROM organizations;
```
**Attendu :**
- [ ] Exactement 2 résultats : Agence Test Dupont + Salon Test Sonia
- [ ] Wapix SPRL N'EST PAS visible
- [ ] Client Direct WapixIA N'EST PAS visible

### T3.3 — Client ne voit que son organisation
**Action SQL (simuler client) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000003","role":"client_admin"}';
SELECT id, name FROM organizations;
```
**Attendu :**
- [ ] Exactement 1 résultat : Salon Test Sonia
- [ ] Aucune autre organisation visible

### T3.4 — Revendeur ne peut pas créer un autre revendeur
**Action SQL (simuler reseller_admin) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000002","role":"reseller_admin"}';
INSERT INTO organizations (name, slug, type, parent_id)
VALUES ('Faux revendeur', 'faux-reseller', 'reseller', '00000000-0000-0000-0000-000000000002');
```
**Attendu :**
- [ ] Erreur RLS : `new row violates row-level security policy`

### T3.5 — Client ne peut pas voir les users d'une autre organisation
**Action SQL (simuler client org 003) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000003","role":"client_admin"}';
SELECT id, email, organization_id FROM users;
```
**Attendu :**
- [ ] Seuls les users de l'organisation `00000000-0000-0000-0000-000000000003` sont retournés
- [ ] Les users de l'org 002 (Agence Dupont) ne sont PAS visibles

### T3.6 — Revendeur peut voir les users de ses clients
**Action SQL (simuler reseller_admin org 002) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000002","role":"reseller_admin"}';
SELECT id, email, organization_id FROM users;
```
**Attendu :**
- [ ] Les users de l'org 002 (Agence Dupont) sont visibles
- [ ] Les users de l'org 003 (Salon Test Sonia — client du revendeur) sont visibles
- [ ] Les users de l'org 001 (Wapix SPRL) NE sont PAS visibles
- [ ] Les users de l'org 004 (Client Direct — autre revendeur) NE sont PAS visibles

### T3.7 — Sites : isolation cross-tenant
**Action :** Créer 1 site stub en SQL pour org 003, puis simuler org 004
```sql
-- Setup
INSERT INTO sites (organization_id, owner_user_id, name, slug)
SELECT '00000000-0000-0000-0000-000000000003', id, 'Site Sonia', 'site-sonia'
FROM users WHERE email = 'client@test.wapixia.com';

-- Test
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000004","role":"client_admin"}';
SELECT * FROM sites;
```
**Attendu :**
- [ ] 0 résultats — le site de l'org 003 est invisible depuis l'org 004

---

## BLOC 4 — API Routes

### T4.1 — GET /api/v1/auth/me — SuperAdmin
**Action :** `curl -H "Authorization: Bearer <token_superadmin>" https://api-staging.wapixia.com/api/v1/auth/me`
**Attendu :**
- [ ] HTTP 200
- [ ] `data.role` = `superadmin`
- [ ] `data.organization.type` = `wapixia`
- [ ] `data.organization.name` = `Wapix SPRL`

### T4.2 — GET /api/v1/auth/me — Sans token
**Action :** Même requête sans header Authorization
**Attendu :**
- [ ] HTTP 401
- [ ] `error.code` = `UNAUTHORIZED`

### T4.3 — GET /api/v1/auth/me — Token invalide
**Action :** Header `Authorization: Bearer token_bidon_123`
**Attendu :**
- [ ] HTTP 401

### T4.4 — GET /api/v1/organizations — SuperAdmin voit tout
**Action :** GET /api/v1/organizations avec token superadmin
**Attendu :**
- [ ] HTTP 200
- [ ] `meta.total` >= 4
- [ ] Les 4 organisations seed sont présentes

### T4.5 — GET /api/v1/organizations — Revendeur voit le bon périmètre
**Action :** GET /api/v1/organizations avec token reseller
**Attendu :**
- [ ] HTTP 200
- [ ] `meta.total` = 2
- [ ] Les org visibles sont : Agence Test Dupont + Salon Test Sonia

### T4.6 — POST /api/v1/organizations — SuperAdmin crée un revendeur
**Action :**
```json
POST /api/v1/organizations
Authorization: Bearer <token_superadmin>
{
  "name": "Nouvelle Agence Test",
  "slug": "nouvelle-agence-test",
  "type": "reseller",
  "commissionRate": 15
}
```
**Attendu :**
- [ ] HTTP 201
- [ ] `data.id` présent
- [ ] `data.type` = `reseller`
- [ ] `data.commissionRate` = `15`
- [ ] `data.parentId` = `00000000-0000-0000-0000-000000000001`

### T4.7 — POST /api/v1/organizations — Revendeur crée un client
**Action :**
```json
POST /api/v1/organizations
Authorization: Bearer <token_reseller>
{
  "name": "Nouveau Client Test",
  "slug": "nouveau-client-test",
  "type": "direct"
}
```
**Attendu :**
- [ ] HTTP 201
- [ ] `data.parentId` = `00000000-0000-0000-0000-000000000002` (automatiquement assigné)

### T4.8 — POST /api/v1/organizations — Client ne peut pas créer une org
**Action :** Même requête avec token client
**Attendu :**
- [ ] HTTP 403
- [ ] `error.code` = `FORBIDDEN`

### T4.9 — POST /api/v1/organizations — Slug déjà existant
**Action :** POST avec `slug: "wapixia"` (déjà existant)
**Attendu :**
- [ ] HTTP 409
- [ ] `error.code` = `CONFLICT`

### T4.10 — POST /api/v1/auth/invite — Envoi invitation
**Action :**
```json
POST /api/v1/auth/invite
Authorization: Bearer <token_superadmin>
{
  "email": "nouveau-user@test.com",
  "role": "reseller_admin",
  "organizationId": "00000000-0000-0000-0000-000000000002",
  "firstName": "Jean",
  "lastName": "Dupont"
}
```
**Attendu :**
- [ ] HTTP 201
- [ ] Email d'invitation reçu sur nouveau-user@test.com (vérifier boîte mail)
- [ ] L'email contient un lien de définition de mot de passe valide
- [ ] L'user apparaît dans `SELECT * FROM users WHERE email = 'nouveau-user@test.com'`
- [ ] Son rôle est `reseller_admin` et son `organization_id` est correct

### T4.11 — Validation Zod — Champs manquants
**Action :** POST /api/v1/organizations sans le champ `name`
**Attendu :**
- [ ] HTTP 422
- [ ] `error.code` = `VALIDATION_ERROR`
- [ ] `error.details` mentionne le champ `name`

### T4.12 — Rate limiting
**Action :** Envoyer 110 requêtes GET /api/v1/auth/me en moins d'1 minute (script curl en boucle)
**Attendu :**
- [ ] Les premières 100 requêtes : HTTP 200
- [ ] La 101ème requête : HTTP 429

---

## BLOC 5 — Frontend Admin (admin.wapixia.com)

### T5.1 — Page login accessible
**Action :** Naviguer sur https://admin-staging.wapixia.com/login
**Attendu :**
- [ ] Page chargée en < 2s
- [ ] Formulaire avec champs Email et Mot de passe visible
- [ ] Bouton "Se connecter" présent

### T5.2 — Connexion SuperAdmin réussie
**Action :** Se connecter avec superadmin@test.wapixia.com
**Attendu :**
- [ ] Redirect vers /dashboard
- [ ] Message de bienvenue avec le prénom du compte

### T5.3 — Accès refusé pour non-superadmin
**Action :** Tenter de se connecter avec reseller@test.wapixia.com sur admin.wapixia.com
**Attendu :**
- [ ] Message d'erreur : "Accès réservé aux administrateurs WapixIA"
- [ ] Pas de redirect vers /dashboard

### T5.4 — Liste des organisations affichée
**Action :** Se connecter en SuperAdmin, naviguer sur /dashboard
**Attendu :**
- [ ] Tableau visible avec au moins 4 lignes (les organizations seed)
- [ ] Colonnes : Nom, Type, Status (au minimum)
- [ ] Pas d'erreur dans la console navigateur

### T5.5 — Formulaire création revendeur
**Action :** Cliquer "Créer un revendeur", remplir et soumettre
**Attendu :**
- [ ] Formulaire s'ouvre
- [ ] Le slug est auto-généré depuis le nom (en temps réel)
- [ ] Après soumission réussie : nouveau revendeur visible dans le tableau
- [ ] Email d'invitation envoyé à l'email admin saisi

### T5.6 — Déconnexion
**Action :** Cliquer sur le bouton déconnexion
**Attendu :**
- [ ] Redirect vers /login
- [ ] Tentative d'accès à /dashboard → redirect vers /login

---

## BLOC 6 — Frontend Reseller (dashboard.wapixia.com)

### T6.1 — Connexion revendeur
**Action :** Se connecter sur https://dashboard-staging.wapixia.com/login avec reseller@test.wapixia.com
**Attendu :**
- [ ] Connexion réussie, redirect vers /clients
- [ ] Nom de l'agence "Agence Test Dupont" visible dans le header

### T6.2 — Liste des clients
**Action :** Naviguer sur /clients
**Attendu :**
- [ ] 1 client visible : Salon Test Sonia
- [ ] Client Direct WapixIA N'EST PAS visible

### T6.3 — Accès refusé pour client sur dashboard reseller
**Action :** Tenter de se connecter avec client@test.wapixia.com sur dashboard.wapixia.com
**Attendu :**
- [ ] Message d'erreur approprié
- [ ] Pas d'accès au dashboard revendeur

---

## BLOC 7 — Frontend Dashboard Client (app.wapixia.com)

### T7.1 — Connexion client
**Action :** Se connecter sur https://app-staging.wapixia.com/login avec client@test.wapixia.com
**Attendu :**
- [ ] Connexion réussie, redirect vers /overview
- [ ] Page placeholder : "Votre site est en cours de configuration"
- [ ] Prénom du client et nom de l'organisation visible

### T7.2 — Accès refusé pour revendeur sur dashboard client
**Action :** Tenter de se connecter avec reseller@test.wapixia.com sur app.wapixia.com
**Attendu :**
- [ ] Message d'erreur : "Accès réservé aux clients WapixIA"

---

## BLOC 8 — Tests de sécurité

### T8.1 — Impossible de s'attribuer le rôle superadmin
**Action :**
```json
POST /api/v1/auth/invite
Authorization: Bearer <token_reseller>
{
  "email": "hack@test.com",
  "role": "superadmin",
  "organizationId": "00000000-0000-0000-0000-000000000002"
}
```
**Attendu :**
- [ ] HTTP 403 ou 422 — impossible d'inviter un superadmin si on n'est pas superadmin

### T8.2 — Impossible de créer un user dans une autre organisation
**Action :**
```json
POST /api/v1/auth/invite
Authorization: Bearer <token_reseller>
{
  "email": "hack2@test.com",
  "role": "client_admin",
  "organizationId": "00000000-0000-0000-0000-000000000001"  // Wapix SPRL !
}
```
**Attendu :**
- [ ] HTTP 403 — on ne peut pas créer un user dans une org qui n'est pas la sienne ou ses clients

### T8.3 — SQL injection sur le champ slug
**Action :** POST /api/v1/organizations avec `"slug": "test'; DROP TABLE organizations; --"`
**Attendu :**
- [ ] HTTP 422 (Zod rejette le slug invalide avant même d'arriver en BDD)
- [ ] La table `organizations` existe toujours après cette requête

### T8.4 — Headers de sécurité présents
**Action :** `curl -I https://app-staging.wapixia.com`
**Attendu :**
- [ ] Header `X-Content-Type-Options: nosniff` présent
- [ ] Header `X-Frame-Options: DENY` présent
- [ ] Header `Strict-Transport-Security` présent
- [ ] Pas de `X-Powered-By` exposé

### T8.5 — CORS restrictif
**Action :** Requête depuis une origine non autorisée (ex: curl avec Origin: https://attacker.com)
**Attendu :**
- [ ] Pas de header `Access-Control-Allow-Origin: *`
- [ ] L'origine de test est refusée

---

## BLOC 9 — Résistance & Edge Cases

### T9.1 — Double connexion simultanée
**Action :** Se connecter avec le même compte dans 2 onglets/navigateurs
**Attendu :**
- [ ] Les 2 sessions fonctionnent indépendamment
- [ ] Pas d'erreur de conflit

### T9.2 — Token refresh
**Action :** Attendre l'expiration du token d'accès (ou forcer via Supabase), faire une requête, observer si le refresh automatique fonctionne
**Attendu :**
- [ ] Le token est refreshé automatiquement sans déconnexion

### T9.3 — Organisation supprimée (soft delete)
**Action SQL :** `UPDATE organizations SET deleted_at = NOW() WHERE slug = 'salon-sonia'`
**Vérification :** GET /api/v1/organizations avec token reseller
**Attendu :**
- [ ] Salon Test Sonia n'apparaît plus dans la liste
- [ ] La ligne existe toujours en BDD (`SELECT * FROM organizations WHERE deleted_at IS NOT NULL`)

### T9.4 — Slug avec caractères spéciaux
**Action :** POST /api/v1/organizations avec `"slug": "mon slug avec espaces"`
**Attendu :**
- [ ] HTTP 422 — le slug est invalide (Zod le refuse)

---

## Récapitulatif — Critères de validation du Sprint 1

Le sprint est validé si et seulement si :

| Bloc | Tests | Résultat requis |
|---|---|---|
| Bloc 1 — BDD | T1.1 à T1.5 | 5/5 ✅ |
| Bloc 2 — JWT | T2.1 à T2.4 | 4/4 ✅ |
| Bloc 3 — RLS | T3.1 à T3.7 | 7/7 ✅ |
| Bloc 4 — API | T4.1 à T4.12 | 12/12 ✅ |
| Bloc 5 — Admin UI | T5.1 à T5.6 | 5/6 min ✅ |
| Bloc 6 — Reseller UI | T6.1 à T6.3 | 3/3 ✅ |
| Bloc 7 — Client UI | T7.1 à T7.2 | 2/2 ✅ |
| Bloc 8 — Sécurité | T8.1 à T8.5 | 5/5 ✅ |
| Bloc 9 — Edge cases | T9.1 à T9.4 | 3/4 min ✅ |

**Total minimum pour Go Sprint 2 : 44/46 tests passés**
Les tests T5.x et T9.x ont une tolérance de 1 échec mineur si et seulement si les Blocs 2, 3 et 8 sont à 100%.

---

## Template de rapport de tests

```
## Rapport Sprint 1 — [Date]
**Testeur :** Salim
**Environnement :** staging.wapixia.com

### Résultats
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — BDD | | | |
| Bloc 2 — JWT | | | |
| Bloc 3 — RLS | | | |
| Bloc 4 — API | | | |
| Bloc 5 — Admin UI | | | |
| Bloc 6 — Reseller UI | | | |
| Bloc 7 — Client UI | | | |
| Bloc 8 — Sécurité | | | |
| Bloc 9 — Edge cases | | | |
| **TOTAL** | | | |

### Bugs identifiés
| ID | Description | Sévérité | Test concerné |
|---|---|---|---|
| BUG-001 | | critique/major/minor | |

### Décision
[ ] ✅ GO Sprint 2
[ ] ❌ STOP — bugs critiques à corriger avant
```
