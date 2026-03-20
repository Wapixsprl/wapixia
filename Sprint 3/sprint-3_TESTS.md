# SPRINT 3 — TESTS.md
# Modules IA Core — Scénarios de test
> À exécuter par Salim sur l'environnement staging
> Prérequis : Sprint 2 validé (62/68 ✅), 3 sites générés et accessibles
> ✅ Passé | ❌ Échoué | ⏭️ Bloqué

---

## Comptes et sites de test

| Site de test | URL staging | Secteur | Module à tester |
|---|---|---|---|
| Salon Test Sonia | salon-sonia.wapixia.com | beaute | Posts RS + GMB + Blog |
| Dupont Rénovation | dupont-btp.wapixia.com | btp | Posts RS + GMB |
| Le Vieux Moulin | vieux-moulin.wapixia.com | horeca | Blog |

**Comptes Facebook et Instagram de test :**
Créer une Page Facebook "WapixIA Test Page" et un compte Instagram Business associé.
Ne pas utiliser de vraies pages clients pour les tests.

**Compte GMB de test :**
Créer une fiche Google My Business "WapixIA Test Business" à Tournai.

---

## BLOC 1 — Migrations BDD

### T1.1 — Tables créées
**Action :** Supabase Studio → vérifier existence des tables
**Attendu :**
- [ ] Table `module_catalog` créée avec 3 entrées (gmb_reviews, social_posts, blog_seo)
- [ ] Table `site_modules` créée avec contrainte UNIQUE(site_id, module_id)
- [ ] Table `ai_contents` créée avec toutes les colonnes
- [ ] Table `google_reviews` créée avec colonne `is_negative` GENERATED ALWAYS AS
- [ ] Table `social_accounts` créée
- [ ] Table `token_usage` créée avec contrainte UNIQUE(site_id, module_id, year, month)

### T1.2 — Seed module_catalog correct
**Action SQL :**
```sql
SELECT id, name, price_monthly FROM module_catalog ORDER BY sort_order;
```
**Attendu :**
- [ ] 3 lignes : gmb_reviews (10€), social_posts (10€), blog_seo (10€)
- [ ] Pas de doublons

### T1.3 — Colonne is_negative générée automatiquement
**Action SQL :**
```sql
INSERT INTO google_reviews (site_id, gmb_review_id, author_name, rating, review_date)
VALUES ('[site_id_test]', 'test-review-001', 'Test Auteur', 1, NOW());
SELECT rating, is_negative FROM google_reviews WHERE gmb_review_id = 'test-review-001';
```
**Attendu :**
- [ ] `is_negative = true` pour rating = 1
- [ ] Tester avec rating = 3 → `is_negative = false`
- [ ] Tenter de SET is_negative manuellement → erreur (colonne générée)

### T1.4 — RLS isolation modules
**Action SQL (simuler client salon Sonia) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"[org_sonia]","role":"client_admin"}';
SELECT site_id FROM site_modules;
```
**Attendu :**
- [ ] Seuls les modules du site Salon Sonia sont visibles
- [ ] Les modules de Dupont Rénovation sont invisibles

---

## BLOC 2 — Activation des modules

### T2.1 — Activer le module social_posts
**Action :** Dashboard client Salon Sonia → `/modules` → Activer "Posts Réseaux Sociaux IA"
**Attendu :**
- [ ] `POST /api/v1/sites/[id]/modules/social_posts` retourne HTTP 201
- [ ] `site_modules` a une nouvelle ligne avec status = 'active'
- [ ] Config par défaut appliquée (autoPublish: false, postsPerMonth: 12)
- [ ] Message UI : "Module activé — premiers posts générés dans les prochaines 24h"

### T2.2 — Activer un module déjà actif
**Action :** Appeler l'API d'activation une deuxième fois pour le même module
**Attendu :**
- [ ] HTTP 409 CONFLICT
- [ ] Message : "Ce module est déjà actif sur ce site"

### T2.3 — Activer gmb_reviews sans GMB connecté
**Action :** Activer le module gmb_reviews sur un site sans gmbLocationId
**Attendu :**
- [ ] HTTP 422
- [ ] Message : "Prérequis manquant : connectez votre fiche Google My Business d'abord"

### T2.4 — Désactiver un module
**Action :** `DELETE /api/v1/sites/[id]/modules/social_posts`
**Attendu :**
- [ ] HTTP 200
- [ ] `site_modules.status` = 'cancelled' (soft disable)
- [ ] `site_modules.cancelled_at` = NOW()
- [ ] Les contenus déjà générés restent visibles dans le backoffice

### T2.5 — Modifier la config d'un module
**Action :**
```json
PATCH /api/v1/sites/[id]/modules/social_posts
{ "config": { "autoPublish": true, "postsPerMonth": 20 } }
```
**Attendu :**
- [ ] HTTP 200
- [ ] `site_modules.config` mis à jour en BDD
- [ ] La config est lue au prochain déclenchement du job

### T2.6 — Page modules UI — prérequis manquants affichés
**Action :** Naviguer vers `/modules` avec un site sans aucun réseau social connecté
**Attendu :**
- [ ] Le module "Posts RS" affiche un badge orange "Prérequis manquants"
- [ ] Tooltip ou message : "Connectez Facebook ou Instagram pour activer ce module"
- [ ] Le toggle est désactivé tant que les prérequis ne sont pas remplis

---

## BLOC 3 — Module Posts RS — Génération

### T3.1 — Déclenchement manuel d'un post
**Action :** Dashboard → `/modules/social_posts/settings` → Bouton "Générer un post maintenant"
**OU via API :** `POST /api/v1/sites/[id]/contents/generate` avec `{ moduleId: 'social_posts' }`
**Attendu :**
- [ ] HTTP 202 retourné immédiatement
- [ ] Job créé dans BullMQ (vérifiable dans /admin/queues)
- [ ] Dans les 2 minutes : nouveau contenu en BDD avec status 'pending_validation'

### T3.2 — Contenu généré — Structure correcte
**Action :** `GET /api/v1/sites/[id]/contents?status=pending_validation&type=social_post`
**Attendu :**
- [ ] Au moins 2 contenus (1 Facebook + 1 Instagram)
- [ ] Champ `content` non vide (> 50 mots)
- [ ] Champ `platform` = 'facebook' ou 'instagram'
- [ ] Champ `visual_url` contient une URL Unsplash valide
- [ ] Champ `hashtags` non vide pour Instagram
- [ ] Champ `scheduled_for` dans le futur

### T3.3 — Qualité du contenu généré
**Action :** Lire le contenu généré pour le Salon Sonia
**Attendu (vérification manuelle) :**
- [ ] Le post mentionne le secteur coiffure / beauté
- [ ] Le post mentionne la ville (Mouscron ou Tournai selon le site de test)
- [ ] Le ton est approprié (friendly pour ce test)
- [ ] Le post contient un appel à l'action
- [ ] Aucune répétition évidente vs les posts précédents
- [ ] Pas de fautes d'orthographe flagrantes

### T3.4 — Anti-duplication fonctionne
**Action :** Générer 5 posts pour le même site en rafale
**Attendu :**
- [ ] Chaque post a un sujet/angle différent
- [ ] Pas deux posts identiques à > 70% de similarité
- [ ] Les sujets varient (éducatif, promotionnel, engagement, saisonnier)

### T3.5 — Rotation des types de posts par mois
**Action SQL :** Vérifier que les types de posts générés en mars sont différents de ceux de janvier
```sql
SELECT metadata->>'postType', count(*) FROM ai_contents
WHERE module_id = 'social_posts' AND created_at > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'postType';
```
**Attendu :**
- [ ] Au moins 2 types différents parmi les posts récents
- [ ] Pour le mois en cours, la rotation correspond à `getPostTypeSchedule(currentMonth)`

### T3.6 — Image Unsplash adaptée au secteur
**Action :** Vérifier les URLs d'images des posts générés
**Attendu :**
- [ ] URL commence par `images.unsplash.com` ou équivalent
- [ ] URL contient des paramètres d'optimisation (w=1080, q=80, fm=webp)
- [ ] L'image est accessible (HTTP 200 sur l'URL)
- [ ] L'image est visuellement cohérente avec le secteur (vérification manuelle)

---

## BLOC 4 — Module Posts RS — Validation & Publication

### T4.1 — Interface backoffice — liste des contenus
**Action :** Dashboard → `/content` → onglet "En attente"
**Attendu :**
- [ ] Liste visible avec les posts générés
- [ ] Badge plateforme coloré (bleu Facebook, rose/violet Instagram)
- [ ] Extrait du contenu lisible (3 premières lignes)
- [ ] Miniature de l'image visible
- [ ] Date de publication planifiée affichée
- [ ] Boutons "Aperçu", "Approuver", "Rejeter" visibles

### T4.2 — Aperçu d'un post
**Action :** Cliquer "Aperçu" sur un post Facebook
**Attendu :**
- [ ] Modal ou page latérale s'ouvre
- [ ] Prévisualisation stylisée façon Facebook (header bleu, post card)
- [ ] Image, texte, date affichés
- [ ] Boutons "Approuver" et "Rejeter" accessibles depuis l'aperçu

### T4.3 — Approbation d'un post
**Action :** Cliquer "Approuver" sur un post Instagram
**Attendu :**
- [ ] `POST /api/v1/sites/[id]/contents/[contentId]/approve` retourne HTTP 200
- [ ] `ai_contents.status` = 'approved'
- [ ] `ai_contents.validated_by` = id de l'utilisateur courant
- [ ] `ai_contents.validated_at` = NOW()
- [ ] Le contenu disparaît de l'onglet "En attente"
- [ ] Il apparaît dans l'onglet "Planifiés"

### T4.4 — Rejet d'un post
**Action :** Cliquer "Rejeter" + saisir la note "Ton trop promotionnel"
**Attendu :**
- [ ] `ai_contents.status` = 'rejected'
- [ ] `ai_contents.rejection_note` = "Ton trop promotionnel"
- [ ] Le contenu apparaît dans l'onglet "Rejetés"

### T4.5 — Publication Facebook (test réel)
**Prérequis :** Page Facebook de test connectée
**Action :** Approuver un post Facebook avec `scheduled_for` = maintenant (modifier la date en SQL pour le test)
**Attendu :**
- [ ] Le job `publish-content` se déclenche dans les 15 minutes
- [ ] HTTP 200 de l'API Facebook Graph (vérifier les logs BullMQ)
- [ ] `ai_contents.status` = 'published'
- [ ] `ai_contents.external_id` = ID du post Facebook
- [ ] `ai_contents.published_at` = NOW()
- [ ] Le post est visible sur la Page Facebook de test

### T4.6 — Gestion d'erreur publication (token expiré)
**Action :** Remplacer le token Facebook par un token invalide en BDD, déclencher une publication
**Attendu :**
- [ ] 3 tentatives BullMQ visibles dans les logs
- [ ] `ai_contents.status` = 'publish_failed' après 3 échecs
- [ ] `ai_contents.publish_error` contient le message d'erreur
- [ ] Email d'alerte reçu à WAPIX_ALERT_EMAIL

---

## BLOC 5 — Module GMB & Avis — Sync et Réponses

### T5.1 — Sync avis GMB forcée
**Action :** `POST /api/v1/sites/[id]/reviews/sync`
**Attendu :**
- [ ] HTTP 202 (job créé)
- [ ] Dans les 2 minutes : avis présents en BDD si la fiche GMB de test a des avis
- [ ] `google_reviews.synced_at` = NOW()

### T5.2 — Ajouter un avis de test (positif)
**Action :** Ajouter un avis 5 étoiles sur la fiche GMB de test → attendre la sync
**Attendu :**
- [ ] Avis présent dans `google_reviews` avec rating = 5
- [ ] `reply_status` = 'pending'
- [ ] Job `generate-review-reply` créé dans BullMQ

### T5.3 — Réponse générée pour avis positif
**Action :** Attendre 2 minutes après le sync
**Attendu :**
- [ ] `google_reviews.reply_status` = 'generated'
- [ ] `google_reviews.ai_content_id` non null
- [ ] La réponse générée : 50-120 mots
- [ ] La réponse mentionne le nom de l'auteur
- [ ] La réponse est personnalisée (pas générique)
- [ ] La réponse contient 1-2 mots-clés du secteur

### T5.4 — Avis négatif — Alerte immédiate
**Action :** Ajouter un avis 1 étoile sur la fiche GMB de test → attendre la sync
**Attendu :**
- [ ] Email d'alerte reçu dans les 10 minutes sur l'email du client
- [ ] Email contient : nom de l'auteur, note, extrait du commentaire, lien dashboard
- [ ] `google_reviews.alert_sent` = true
- [ ] `google_reviews.alert_sent_at` = NOW()
- [ ] Job `generate-review-reply` créé avec `priority: 1` (haute priorité)

### T5.5 — Réponse avis négatif — Ton approprié
**Action :** Lire la réponse générée pour l'avis 1 étoile
**Attendu (vérification manuelle) :**
- [ ] Ton empathique et non défensif
- [ ] Invitation à résoudre en privé (mention email ou téléphone)
- [ ] Pas d'excuses excessives, pas d'agressivité
- [ ] 80-150 mots
- [ ] Aucune mention d'autres clients

### T5.6 — Interface avis — Dashboard
**Action :** Dashboard → `/content/reviews`
**Attendu :**
- [ ] Liste des avis visible avec note étoiles
- [ ] Avis négatifs avec badge rouge
- [ ] Statut réponse visible pour chaque avis
- [ ] Boutons "Voir la réponse" et "Publier" visibles pour les avis avec réponse générée

### T5.7 — Approbation et publication d'une réponse GMB
**Prérequis :** Compte GMB de test connecté
**Action :** Cliquer "Publier" sur une réponse générée
**Attendu :**
- [ ] HTTP 200 de l'API GMB (vérifier dans les logs)
- [ ] `google_reviews.reply_status` = 'published'
- [ ] `google_reviews.published_at` = NOW()
- [ ] La réponse est visible sur la fiche Google de test (délai quelques minutes)

### T5.8 — Post GMB généré automatiquement
**Action :** Déclencher manuellement `POST /api/v1/sites/[id]/contents/generate` avec `{ moduleId: 'gmb_reviews', contentType: 'gmb_post' }`
**Attendu :**
- [ ] Post GMB généré en BDD (type = 'gmb_post')
- [ ] `content` entre 150 et 300 mots
- [ ] `title` ≤ 58 caractères
- [ ] `metadata.callToAction` présent
- [ ] Image Unsplash associée

---

## BLOC 6 — Module Blog SEO — Génération

### T6.1 — Génération manuelle d'un article
**Action :** `POST /api/v1/sites/[id]/contents/generate` avec `{ moduleId: 'blog_seo' }`
**Attendu :**
- [ ] Job créé dans BullMQ queue `content:blog`
- [ ] Délai de génération < 5 minutes (article 1200 mots)
- [ ] Contenu en BDD avec type = 'blog_article'

### T6.2 — Structure de l'article générée
**Action :** `GET /api/v1/sites/[id]/contents/[contentId]` pour l'article généré
**Attendu :**
- [ ] `title` : 55-65 caractères, contient la ville
- [ ] `metadata.slug` en kebab-case
- [ ] `metadata.metaTitle` ≤ 60 caractères
- [ ] `metadata.metaDescription` : 145-160 caractères
- [ ] `excerpt` présent (160-200 caractères)
- [ ] `content` : HTML valide avec balises `<h2>`, `<p>`, `<ul>`
- [ ] `metadata.schemaFAQ` : array de 5 questions minimum
- [ ] `metadata.totalWordCount` ≥ 1200

### T6.3 — Qualité SEO de l'article
**Action :** Analyser le contenu HTML de l'article
**Attendu (vérification manuelle) :**
- [ ] H1 implicite = le titre de l'article
- [ ] Au moins 4 H2 formulés en questions
- [ ] Le mot-clé principal apparaît dans les 100 premiers mots
- [ ] La ville est mentionnée au moins 4 fois
- [ ] Au moins une donnée chiffrée ou factuelle
- [ ] Données structurées FAQ présentes dans metadata.schemaFAQ
- [ ] Introduction TLDR-first : répond directement au sujet en 2-3 phrases
- [ ] Longueur finale entre 1200 et 2500 mots

### T6.4 — Génération du sujet automatique
**Action :** Générer 3 articles sans fournir de sujet
**Attendu :**
- [ ] 3 sujets différents générés automatiquement
- [ ] Chaque sujet correspond au secteur du site
- [ ] Aucun sujet dupliqué parmi les 3

### T6.5 — Publication dans le CMS
**Action :** Approuver l'article → attendre la publication automatique
**Attendu :**
- [ ] Article visible dans Payload CMS avec statut 'published'
- [ ] Slug correct : `https://[site]/blog/[slug]`
- [ ] Meta title et description présents dans les balises `<head>`
- [ ] Schema.org FAQPage injecté dans le `<head>` en JSON-LD
- [ ] Article visible et lisible sur le site (SSR vérifié)
- [ ] Sitemap mis à jour avec l'URL du nouvel article

### T6.6 — Sitemap mis à jour après publication
**Action :** `curl https://salon-sonia.wapixia.com/sitemap.xml` après publication de l'article
**Attendu :**
- [ ] L'URL de l'article est présente dans le sitemap
- [ ] `lastmod` = date de publication
- [ ] `priority` = 0.8

---

## BLOC 7 — Tracking des coûts Claude

### T7.1 — Tokens trackés après génération
**Action SQL après génération d'un post RS :**
```sql
SELECT tokens_input, tokens_output, api_calls, total_cost_eur
FROM token_usage
WHERE site_id = '[site_id]' AND module_id = 'social_posts'
  AND period_year = EXTRACT(YEAR FROM NOW())
  AND period_month = EXTRACT(MONTH FROM NOW());
```
**Attendu :**
- [ ] Ligne présente avec tokens_input > 0 et tokens_output > 0
- [ ] `api_calls` = nombre d'appels Claude effectués
- [ ] `total_cost_eur` > 0 (calculé automatiquement)

### T7.2 — Accumulation correcte des tokens
**Action :** Générer 3 contenus pour le même site, vérifier l'accumulation
**Attendu :**
- [ ] `api_calls` = 3 (pas 3 lignes différentes — une seule ligne mise à jour)
- [ ] `total_cost_eur` = somme des 3 générations
- [ ] Contrainte UNIQUE(site_id, module_id, year, month) respectée

### T7.3 — Alerte coût > 4€
**Action :** En SQL, forcer `total_cost_eur = 5.00` sur un site → déclencher une génération supplémentaire
**Attendu :**
- [ ] Email d'alerte reçu sur WAPIX_ALERT_EMAIL
- [ ] Sujet contient "[ALERT] Coût Claude dépassé"
- [ ] La génération continue malgré l'alerte (l'alerte est informationnelle)

### T7.4 — Coût réel par site < 4€/mois
**Action :** Calculer le coût total pour un site avec les 3 modules actifs pendant 1 mois simulé
```sql
SELECT SUM(total_cost_eur) as monthly_cost, SUM(api_calls) as total_calls
FROM token_usage
WHERE site_id = '[site_id]'
  AND period_year = EXTRACT(YEAR FROM NOW())
  AND period_month = EXTRACT(MONTH FROM NOW());
```
**Attendu :**
- [ ] `monthly_cost` < 4.00€ pour un mois complet (12 posts + 1 article + 8 réponses avis)
- [ ] Si > 4€ → analyser les prompts et réduire les maxTokens

---

## BLOC 8 — Scheduler & Automation

### T8.1 — Scheduler démarré au lancement du serveur
**Action :** Redémarrer le service API et vérifier les logs
**Attendu :**
- [ ] Message dans les logs : "Content scheduler started"
- [ ] Les 5 crons sont enregistrés (sync avis, GMB posts, posts RS, blog, publication)
- [ ] Pas d'erreur au démarrage

### T8.2 — Sync avis toutes les 4h
**Action :** Vérifier les logs sur 8h
**Attendu :**
- [ ] 2 syncs visibles dans les logs BullMQ dashboard
- [ ] Interval ≈ 4h entre chaque sync

### T8.3 — Publication automatique des contenus planifiés
**Action :** Créer manuellement un contenu avec `status = 'auto_approved'` et `scheduled_for = NOW() - 1 minute`
**Attendu :**
- [ ] Dans les 15 minutes : le contenu est publié (`status = 'published'`)
- [ ] Job visible dans BullMQ avec statut 'completed'

### T8.4 — Quota mensuel respecté
**Action SQL :** Forcer 12 lignes `ai_contents` avec status = 'published' pour le module social_posts sur un site
**Puis :** Déclencher une génération manuelle
**Attendu :**
- [ ] Le worker détecte que le quota (12/mois) est atteint
- [ ] Log : "Quota mensuel atteint (12/12) — skip"
- [ ] Aucun nouveau contenu généré

---

## BLOC 9 — Sécurité & Edge Cases

### T9.1 — Tokens chiffrés en BDD
**Action SQL :**
```sql
SELECT access_token FROM social_accounts WHERE platform = 'facebook' LIMIT 1;
```
**Attendu :**
- [ ] Le token n'est PAS en clair (la valeur est chiffrée, illisible)
- [ ] Le token commence par un préfixe chiffré (ex: base64 ou hex)

### T9.2 — Un client ne peut pas approuver les contenus d'un autre client
**Action :** Avec le token du client Salon Sonia, appeler :
`POST /api/v1/sites/[id_dupont_site]/contents/[content_id]/approve`
**Attendu :**
- [ ] HTTP 403 FORBIDDEN

### T9.3 — Contenu vide refusé par Zod
**Action :** `POST /api/v1/sites/[id]/contents/generate` avec `{ moduleId: 'social_posts', content: '' }`
**Attendu :**
- [ ] HTTP 422 VALIDATION_ERROR
- [ ] Message d'erreur Zod précis

### T9.4 — Double génération évitée
**Action :** Appeler generate 2x simultanément (Promise.all)
**Attendu :**
- [ ] 2 jobs créés en BullMQ MAIS jobId unique par site+date
- [ ] Le deuxième job détecte un doublon et se termine sans générer

### T9.5 — API Facebook rate limit géré
**Action :** Envoyer 250 publications en 1 heure (simulé en staging en réduisant les délais)
**Attendu :**
- [ ] Les jobs se mettent en file d'attente (delayed) au lieu de crasher
- [ ] Pas d'erreur non catchée dans les logs
- [ ] Reprise automatique après le cooldown

### T9.6 — Contenu généré JSON invalide — Retry
**Action :** Temporairement modifier le prompt pour forcer une réponse non-JSON
**Attendu :**
- [ ] Le worker catch l'erreur de parsing JSON
- [ ] BullMQ retry automatique (2 autres tentatives)
- [ ] Si 3 échecs → `status = 'failed'` dans BullMQ + alerte email

---

## Récapitulatif — Critères de validation du Sprint 3

| Bloc | Tests | Requis |
|---|---|---|
| Bloc 1 — BDD | T1.1 → T1.4 | 4/4 ✅ |
| Bloc 2 — Activation modules | T2.1 → T2.6 | 6/6 ✅ |
| Bloc 3 — Génération Posts RS | T3.1 → T3.6 | 6/6 ✅ |
| Bloc 4 — Validation & Publication | T4.1 → T4.6 | 5/6 min ✅ |
| Bloc 5 — GMB & Avis | T5.1 → T5.8 | 7/8 min ✅ |
| Bloc 6 — Blog SEO | T6.1 → T6.6 | 5/6 min ✅ |
| Bloc 7 — Tracking coûts | T7.1 → T7.4 | 4/4 ✅ |
| Bloc 8 — Scheduler | T8.1 → T8.4 | 4/4 ✅ |
| Bloc 9 — Sécurité | T9.1 → T9.6 | 6/6 ✅ |

**Total minimum pour Go Sprint 4 : 43/46 tests passés**

Blocs 1, 2, 7 et 9 sont **non négociables** — 100% requis.
T4.5 (publication réelle Facebook) est requis sauf si le compte de test n'est pas disponible.

---

## Template rapport Sprint 3

```
## Rapport Sprint 3 — [Date]
**Testeur :** Salim
**Environnement :** staging.wapixia.com

### Sites testés
| Site | Secteur | Modules actifs | URL |
|---|---|---|---|
| Salon Sonia | beaute | social_posts, gmb_reviews, blog_seo | |
| Dupont BTP | btp | social_posts, gmb_reviews | |

### Résultats tests
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — BDD | | | |
| Bloc 2 — Modules | | | |
| Bloc 3 — Génération RS | | | |
| Bloc 4 — Validation | | | |
| Bloc 5 — GMB & Avis | | | |
| Bloc 6 — Blog | | | |
| Bloc 7 — Coûts | | | |
| Bloc 8 — Scheduler | | | |
| Bloc 9 — Sécurité | | | |
| **TOTAL** | /46 | | |

### Métriques de coût Claude (réels)
| Site | Module | Posts générés | Tokens input | Tokens output | Coût (€) |
|---|---|---|---|---|---|
| Sonia | social_posts | | | | |
| Sonia | gmb_reviews | | | | |
| Sonia | blog_seo | | | | |
| **Total par site/mois** | | | | | |

### Qualité du contenu (note 1-5)
| Type | Pertinence | Ton | SEO | Note globale |
|---|---|---|---|---|
| Post Facebook | | | | |
| Post Instagram | | | | |
| Réponse avis positif | | | | |
| Réponse avis négatif | | | | |
| Article blog | | | | |
| Post GMB | | | | |

### Bugs identifiés
| ID | Description | Sévérité | Bloc | Test |
|---|---|---|---|---|
| BUG-S3-001 | | | | |

### Décision
[ ] ✅ GO Sprint 4
[ ] ❌ STOP — bugs critiques à corriger

### Observations qualité contenu
[Notes libres sur la qualité, le ton, les répétitions détectées, les améliorations de prompts suggérées]
```
