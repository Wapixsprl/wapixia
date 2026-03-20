# SPRINT 2 — TESTS.md
# Socle Site & CMS — Scénarios de test
> À exécuter par Salim sur l'environnement staging
> Prérequis : Sprint 1 validé (44/46 tests ✅), comptes de test existants
> ✅ Passé | ❌ Échoué (noter le comportement observé) | ⏭️ Bloqué

---

## Comptes et données de test

| Compte | Email | Rôle | Org |
|---|---|---|---|
| SuperAdmin | superadmin@test.wapixia.com | superadmin | Wapix SPRL |
| Revendeur | reseller@test.wapixia.com | reseller_admin | Agence Test Dupont |
| Client coiffure | client@test.wapixia.com | client_admin | Salon Test Sonia |
| Client BTP | client-btp@test.wapixia.com | client_admin | Dupont Rénovation |
| Client horeca | client-horeca@test.wapixia.com | client_admin | Le Vieux Moulin |

**Créer les 3 clients de test avec leurs organisations avant de démarrer.**

---

## BLOC 1 — Migrations BDD Sprint 2

### T1.1 — Colonnes ajoutées à la table sites
**Action :** Supabase Studio → Table Editor → Table `sites`
**Attendu :**
- [ ] Colonne `sector` présente (type text, check constraint)
- [ ] Colonne `temp_domain` présente (text, unique)
- [ ] Colonne `custom_domain` présente (text, unique)
- [ ] Colonne `hosting_type` présente (text, default 'wapixia')
- [ ] Colonne `onboarding_data` présente (jsonb)
- [ ] Colonne `onboarding_done` présente (boolean, default false)
- [ ] Colonne `theme` présente (text)
- [ ] Colonne `coolify_app_id` présente (text)
- [ ] Colonne `cloudflare_record_id` présente (text)
- [ ] Colonnes Google : `google_analytics_id`, `google_tag_manager_id`, `facebook_pixel_id`, `gmb_location_id`

### T1.2 — Table onboarding_sessions créée
**Action :** `SELECT column_name FROM information_schema.columns WHERE table_name = 'onboarding_sessions'`
**Attendu :**
- [ ] Colonnes présentes : `id`, `site_id`, `user_id`, `current_step`, `answers`, `generation_status`, `generated_content`, `tokens_used`
- [ ] Contrainte check sur `generation_status` : uniquement 'pending', 'generating', 'done', 'failed'

### T1.3 — RLS onboarding_sessions actif
**Action SQL (simuler client org 003) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"00000000-0000-0000-0000-000000000003","role":"client_admin"}';
SELECT * FROM onboarding_sessions;
```
**Attendu :**
- [ ] Seules les sessions liées aux sites de l'org 003 sont visibles
- [ ] Les sessions d'autres tenants ne sont pas accessibles

### T1.4 — Trigger updated_at sur sites
**Action SQL :**
```sql
UPDATE sites SET name = 'Salon Test Sonia v2' WHERE slug = 'salon-sonia';
SELECT updated_at, created_at FROM sites WHERE slug = 'salon-sonia';
```
**Attendu :**
- [ ] `updated_at` > `created_at`

---

## BLOC 2 — Questionnaire Onboarding (UI)

### T2.1 — Accès au questionnaire
**Action :** Se connecter avec client@test.wapixia.com → naviguer sur `/onboarding`
**Attendu :**
- [ ] Page chargée en < 2s
- [ ] Barre de progression visible "Étape 1 / 20"
- [ ] Question 1 affichée : "Quel est le nom de votre entreprise ?"
- [ ] Placeholder exemple visible

### T2.2 — Navigation entre les étapes
**Action :** Remplir l'étape 1 (nom: "Salon Test Sonia") → cliquer Suivant
**Attendu :**
- [ ] Passage à l'étape 2
- [ ] Barre de progression mise à jour "Étape 2 / 20"
- [ ] Bouton "Précédent" actif
- [ ] Réponse de l'étape 1 toujours présente si on revient en arrière

### T2.3 — Sauvegarde automatique à chaque étape
**Action :** Remplir 5 étapes, fermer le navigateur, rouvrir `/onboarding`
**Attendu :**
- [ ] Le questionnaire reprend à l'étape 6 (là où on s'est arrêté)
- [ ] Les 5 réponses précédentes sont préremplies
- [ ] `PUT /api/v1/sites/:id/onboarding/step` retourne HTTP 200 à chaque étape

### T2.4 — Validation des champs obligatoires
**Action :** Cliquer "Suivant" à l'étape 1 sans remplir le nom
**Attendu :**
- [ ] Message d'erreur visible sous le champ : "Ce champ est requis"
- [ ] Pas de passage à l'étape 2
- [ ] Aucun appel API déclenché

### T2.5 — Étape 2 — Sélecteur de secteur
**Action :** Arriver à l'étape 2
**Attendu :**
- [ ] 10 options visibles et cliquables
- [ ] Sélection "Coiffure / Esthétique / Beauté" active visuellement
- [ ] Impossible de passer à l'étape 3 sans sélection

### T2.6 — Étape 5 — Textarea description
**Action :** Taper une description de 30 caractères (< minimum)
**Attendu :**
- [ ] Compteur de caractères visible (ex: "30 / 50 minimum")
- [ ] Message d'erreur "Décrivez votre activité en au moins 50 caractères"
- [ ] Bouton Suivant désactivé ou erreur à la soumission

### T2.7 — Étape 6 — Liste dynamique des services
**Action :** Ajouter 3 services, en supprimer 1, en rajouter 1
**Attendu :**
- [ ] Ajout d'un service fonctionne (champ texte + bouton "Ajouter")
- [ ] Suppression d'un service fonctionne (bouton "×" sur chaque service)
- [ ] Impossible d'avoir 0 service (bouton supprimer désactivé si 1 seul)
- [ ] Maximum 8 services (bouton "Ajouter" disparaît après le 8ème)

### T2.8 — Étape 10 — Horaires
**Action :** Cocher "Ouvert" pour Lundi, définir 9h-18h, cocher "Fermé" pour Dimanche
**Attendu :**
- [ ] Toggle lundi → champs horaires apparus
- [ ] Toggle dimanche → champs horaires grisés
- [ ] Données sauvegardées correctement dans `onboarding_data.opening_hours`

### T2.9 — Étape 14 — Upload logo
**Action :** Uploader un PNG de 2 Mo
**Attendu :**
- [ ] Upload réussi (barre de progression + aperçu miniature)
- [ ] Fichier stocké sur Cloudflare R2 (URL r2.wapixia.com ou media.wapixia.com)
- [ ] Aperçu visible dans le questionnaire

### T2.10 — Étape 14 — Fichier trop lourd
**Action :** Tenter d'uploader un PNG de 8 Mo (> 5 Mo limite)
**Attendu :**
- [ ] Message d'erreur : "Fichier trop volumineux — maximum 5 Mo"
- [ ] Fichier non uploadé

### T2.11 — Étape 20 — Récapitulatif
**Action :** Compléter les 19 premières étapes, arriver à l'étape 20
**Attendu :**
- [ ] Récapitulatif lisible avec toutes les réponses clés
- [ ] Bouton "🚀 Créer mon site intelligent" visible
- [ ] Possibilité de revenir modifier une étape précédente via le récapitulatif

---

## BLOC 3 — Génération IA du contenu

### T3.1 — Déclenchement de la génération
**Action :** Étape 20 → cliquer "Créer mon site intelligent"
**Attendu :**
- [ ] `POST /api/v1/sites/:id/onboarding/complete` retourne HTTP 202 en < 3s
- [ ] Réponse contient `{ data: { jobId: "...", estimatedMinutes: 5 } }`
- [ ] Redirect automatique vers `/onboarding/generating`
- [ ] `onboarding_sessions.generation_status` = 'generating' dans la BDD

### T3.2 — Page d'attente et polling
**Action :** Observer la page `/onboarding/generating`
**Attendu :**
- [ ] Animation de chargement visible
- [ ] Étapes de progression affichées ("Analyse de votre activité..." → "Génération..." → "Déploiement...")
- [ ] `GET /api/v1/sites/:id/onboarding/status` appelé toutes les 5 secondes (vérifier dans Network tab)
- [ ] Aucune erreur dans la console navigateur pendant l'attente

### T3.3 — Contenu généré — Page Accueil
**Action :** Attendre la fin de la génération, inspecter `onboarding_sessions.generated_content` dans Supabase
**Attendu (pour le compte client coiffure) :**
- [ ] `home.hero.headline` présent, contient le nom de la ville et le secteur
- [ ] `home.hero.headline` entre 60 et 80 caractères
- [ ] `home.faq` contient exactement 5 questions
- [ ] Chaque question FAQ contient le nom de la ville
- [ ] `home.testimonials` contient exactement 3 témoignages
- [ ] `home.seo.metaTitle` ≤ 60 caractères
- [ ] `home.seo.metaDescription` ≤ 160 caractères
- [ ] Le JSON est valide (pas d'erreur de parsing)

### T3.4 — Contenu généré — Page Services
**Action :** Inspecter `generated_content.services`
**Attendu :**
- [ ] Autant de services générés que de services déclarés à l'étape 6
- [ ] Chaque service a un champ `h2` formulé en question
- [ ] Chaque service a 2 questions FAQ
- [ ] Chaque description dépasse 100 mots
- [ ] Le ton correspond au choix de l'étape 17 (ex: "friendly" → langage chaleureux)

### T3.5 — Contenu généré — Page FAQ
**Action :** Inspecter `generated_content.faq`
**Attendu :**
- [ ] 3 catégories présentes
- [ ] Total de 12 à 15 questions
- [ ] Chaque réponse est autonome (compréhensible sans contexte)
- [ ] Au moins 3 questions mentionnent le nom de la ville

### T3.6 — Tokens utilisés
**Action :** `SELECT tokens_used FROM onboarding_sessions WHERE site_id = '[id]'`
**Attendu :**
- [ ] `tokens_used` > 0
- [ ] Coût estimé (tokens × prix Claude Sonnet 4) < 0.20€ par site

### T3.7 — Gestion d'erreur génération
**Action :** Simuler une erreur en coupant temporairement la clé API Claude (changer ANTHROPIC_API_KEY), déclencher une génération
**Attendu :**
- [ ] `generation_status` passe à 'failed' dans la BDD
- [ ] `error_message` contient un message descriptif
- [ ] La page `/onboarding/generating` affiche un message d'erreur clair
- [ ] Bouton "Réessayer" visible et fonctionnel

### T3.8 — Retry après erreur
**Action :** Restaurer la clé API, cliquer "Réessayer"
**Attendu :**
- [ ] Nouvelle tentative de génération déclenchée
- [ ] `generation_status` repasse à 'generating' puis 'done'
- [ ] Contenu correctement généré lors du retry

---

## BLOC 4 — Payload CMS — Injection de contenu

### T4.1 — Contenu injecté dans les collections
**Action :** Accéder au backoffice Payload CMS (cms-staging.wapixia.com/admin) avec le compte superadmin
**Attendu :**
- [ ] Collection "Pages" contient les pages : home, services, a-propos, contact, faq, mentions-legales
- [ ] Chaque page a le bon `siteId` (isolation tenant)
- [ ] Le contenu de chaque page correspond au contenu généré par IA

### T4.2 — Isolation CMS multi-tenant
**Action :** Se connecter au CMS avec le client BTP (client-btp@test.wapixia.com)
**Attendu :**
- [ ] Le client BTP ne voit que ses propres pages (pas celles du salon de coiffure)
- [ ] Tentative d'accès aux pages du salon → 403 ou résultat vide

### T4.3 — Modification d'une page depuis le backoffice client
**Action :** Se connecter avec client@test.wapixia.com → `/content/home`
**Attendu :**
- [ ] Éditeur de page chargé avec le contenu actuel
- [ ] Modification du headline hero possible (champ texte modifiable)
- [ ] Cliquer "Publier" → HTTP 200 → contenu mis à jour dans Payload

### T4.4 — Modification visible sur le site
**Action :** Modifier le headline hero, sauvegarder, visiter le sous-domaine du site
**Attendu :**
- [ ] Le nouveau headline est visible sur le site en production (revalidation ISR)
- [ ] Délai de revalidation < 30 secondes

### T4.5 — CMS refuse les inputs invalides
**Action :** Tenter de sauvegarder un meta title de 80 caractères (> 60 limite)
**Attendu :**
- [ ] Message d'erreur : "Le meta title ne doit pas dépasser 60 caractères"
- [ ] Sauvegarde refusée

---

## BLOC 5 — Déploiement & Sous-domaine

### T5.1 — Sous-domaine créé automatiquement
**Action :** Après génération réussie, vérifier la BDD
**Attendu :**
- [ ] `sites.temp_domain` = `[slug].wapixia.com` (ex: "salon-sonia.wapixia.com")
- [ ] `sites.status` = 'staging'
- [ ] `sites.coolify_app_id` non null
- [ ] `sites.cloudflare_record_id` non null

### T5.2 — Site accessible sur le sous-domaine
**Action :** Naviguer sur `https://salon-sonia.wapixia.com` (ou le sous-domaine généré)
**Attendu :**
- [ ] Site chargé (pas d'erreur 404 ou 502)
- [ ] SSL actif (cadenas vert dans le navigateur)
- [ ] Page d'accueil visible avec le contenu généré par IA
- [ ] Le nom de l'entreprise est correct
- [ ] Pas d'erreurs dans la console du navigateur

### T5.3 — SSL actif
**Action :** `curl -I https://salon-sonia.wapixia.com`
**Attendu :**
- [ ] HTTP 200 (pas de 301 vers HTTP)
- [ ] Header `strict-transport-security` présent

### T5.4 — Redirect HTTP → HTTPS
**Action :** Naviguer sur `http://salon-sonia.wapixia.com` (sans le S)
**Attendu :**
- [ ] Redirect 301 automatique vers `https://salon-sonia.wapixia.com`

### T5.5 — Email de notification envoyé
**Action :** Vérifier la boîte email du compte client (client@test.wapixia.com) après génération
**Attendu :**
- [ ] Email reçu avec sujet contenant le nom du site
- [ ] URL du sous-domaine cliquable dans l'email
- [ ] Le lien fonctionne et ouvre le bon site

### T5.6 — Délai total de génération
**Action :** Mesurer le temps entre la soumission du questionnaire et l'email de notification
**Attendu :**
- [ ] Délai total < 10 minutes
- [ ] Idéalement < 5 minutes

---

## BLOC 6 — Connexion domaine personnalisé

### T6.1 — Interface de connexion domaine
**Action :** Dashboard client → `/settings/domain`
**Attendu :**
- [ ] Sous-domaine temporaire actuel affiché
- [ ] Formulaire "Connecter mon domaine" visible
- [ ] Placeholder : "ex: monentreprise.be"

### T6.2 — Instructions DNS affichées
**Action :** Saisir "test-wapixia.be" → cliquer "Connecter"
**Attendu :**
- [ ] `POST /api/v1/sites/:id/connect-domain` retourne HTTP 200
- [ ] Instructions DNS affichées :
  ```
  Ajoutez cet enregistrement DNS chez votre registrar :
  Type : CNAME
  Nom : @  (ou www)
  Valeur : proxy.wapixia.com
  TTL : 3600
  ```
- [ ] Statut : "En attente de vérification DNS..."
- [ ] Polling démarré (vérification toutes les 5 min visible dans le statut)

### T6.3 — Domaine déjà utilisé refusé
**Action :** Tenter de connecter un domaine déjà assigné à un autre site
**Attendu :**
- [ ] HTTP 409 de l'API
- [ ] Message UI : "Ce domaine est déjà utilisé par un autre site"

### T6.4 — Vérification DNS simulée
**Action :** En SQL, forcer `domain_verified = true` et `ssl_status = 'active'` sur le site de test
**Vérification :** Recharger `/settings/domain`
**Attendu :**
- [ ] Statut affiché : "✅ Domaine vérifié — SSL actif"
- [ ] Sous-domaine temporaire indiqué comme "redirection active vers votre domaine"

---

## BLOC 7 — SEO Technique

### T7.1 — robots.txt présent et correct
**Action :** `curl https://salon-sonia.wapixia.com/robots.txt`
**Attendu :**
- [ ] HTTP 200
- [ ] `User-agent: GPTBot` présent avec `Allow: /`
- [ ] `User-agent: ClaudeBot` présent avec `Allow: /`
- [ ] `User-agent: PerplexityBot` présent avec `Allow: /`
- [ ] `User-agent: Claude-SearchBot` présent avec `Allow: /`
- [ ] `User-agent: Google-Extended` présent avec `Allow: /`
- [ ] `Sitemap:` ligne présente avec l'URL correcte

### T7.2 — sitemap.xml présent et valide
**Action :** `curl https://salon-sonia.wapixia.com/sitemap.xml`
**Attendu :**
- [ ] HTTP 200
- [ ] XML valide (pas d'erreur de parsing)
- [ ] Page accueil présente avec `priority` 1.0
- [ ] Pages services, a-propos, contact, faq présentes
- [ ] Toutes les URLs en HTTPS
- [ ] `lastmod` présent sur chaque URL

### T7.3 — Meta tags corrects sur la page d'accueil
**Action :** `curl https://salon-sonia.wapixia.com | grep -E "title|description|og:"`
**Attendu :**
- [ ] `<title>` présent, contient le nom de l'entreprise et la ville
- [ ] `<title>` ≤ 60 caractères
- [ ] `<meta name="description">` présent
- [ ] `<meta name="description">` ≤ 160 caractères et contient la ville
- [ ] `<meta property="og:title">` présent
- [ ] `<meta property="og:description">` présent
- [ ] `<meta property="og:image">` présent avec URL valide
- [ ] `<meta property="og:locale" content="fr_BE">` présent
- [ ] `<link rel="canonical">` présent avec l'URL correcte

### T7.4 — Schema.org LocalBusiness valide
**Action :** Tester avec Google Rich Results Test (https://search.google.com/test/rich-results) ou extraire le JSON-LD manuellement
```bash
curl https://salon-sonia.wapixia.com | python3 -c "
import sys, json, re
html = sys.stdin.read()
schemas = re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.DOTALL)
for s in schemas:
    print(json.dumps(json.loads(s), indent=2))
"
```
**Attendu :**
- [ ] Schema `LocalBusiness` (ou type sectoriel : `BeautySalon`, etc.) présent
- [ ] `name` correct
- [ ] `address` avec ville et code postal
- [ ] `telephone` présent
- [ ] `openingHoursSpecification` présent si horaires renseignés
- [ ] Aucune erreur dans Google Rich Results Test

### T7.5 — Schema.org FAQPage sur la page d'accueil
**Action :** Extraire le JSON-LD de la page d'accueil
**Attendu :**
- [ ] Schema `FAQPage` présent
- [ ] `mainEntity` contient au moins 5 questions
- [ ] Chaque question a `@type: Question` et `acceptedAnswer`
- [ ] Les réponses sont complètes (> 20 mots)

### T7.6 — Schema.org FAQPage sur la page FAQ
**Action :** `curl https://salon-sonia.wapixia.com/faq | python3 [script ci-dessus]`
**Attendu :**
- [ ] Schema `FAQPage` présent
- [ ] 12 à 15 questions présentes dans `mainEntity`

### T7.7 — Un seul H1 par page
**Action :** `curl https://salon-sonia.wapixia.com | grep -c "<h1"`
**Attendu :**
- [ ] Résultat = 1 (exactement un H1)
- [ ] Répéter pour les pages /services, /a-propos, /contact, /faq → chacune = 1 H1

### T7.8 — Balise lang correcte
**Action :** `curl https://salon-sonia.wapixia.com | grep "<html"`
**Attendu :**
- [ ] `<html lang="fr">` (ou `lang="fr-BE"`)

### T7.9 — Pas de contenu dupliqué
**Action :** Vérifier que les meta titles et descriptions sont uniques sur chaque page
**Pages à tester :** accueil, services, a-propos, contact, faq
**Attendu :**
- [ ] 5 meta titles différents
- [ ] 5 meta descriptions différentes
- [ ] Aucun meta title identique entre deux pages

---

## BLOC 8 — Performance Core Web Vitals

### T8.1 — Score PageSpeed Insights
**Action :** Tester `https://salon-sonia.wapixia.com` sur PageSpeed Insights (https://pagespeed.web.dev)
**Attendu :**
- [ ] Score mobile > 80
- [ ] Score desktop > 90
- [ ] LCP < 2.5s (mobile)
- [ ] CLS < 0.1
- [ ] Pas d'erreurs bloquantes

### T8.2 — Pas de layout shift sur les images
**Action :** Observer le site visuellement pendant le chargement + vérifier le score CLS
**Attendu :**
- [ ] Aucune image ne "saute" pendant le chargement
- [ ] Toutes les images ont des attributs `width` et `height` définis (vérifier dans le DOM)

### T8.3 — Animations chargées en lazy-load
**Action :** Dans Chrome DevTools → Network → Filter "js" → observer l'ordre de chargement
**Attendu :**
- [ ] Les chunks Aceternity UI / Magic UI apparaissent APRÈS le contenu principal
- [ ] Le LCP n'est pas bloqué par les animations

### T8.4 — SSR actif (rendu côté serveur)
**Action :** `curl https://salon-sonia.wapixia.com` (sans JavaScript)
**Attendu :**
- [ ] Le HTML retourné contient le texte du hero (headline, subheadline)
- [ ] Le HTML contient les titres H1, H2
- [ ] Les crawlers IA peuvent lire le contenu sans exécuter JavaScript

### T8.5 — Fonts avec font-display swap
**Action :** Inspecter le `<head>` du site
**Attendu :**
- [ ] `<link rel="preconnect" href="https://fonts.googleapis.com">` présent
- [ ] Le CSS des polices contient `font-display: swap`

---

## BLOC 9 — Connexions Google & Tracking

### T9.1 — Interface connexions Google
**Action :** Dashboard client → `/settings/integrations`
**Attendu :**
- [ ] 4 boutons de connexion visibles : Google Analytics, Search Console, My Business, Tag Manager
- [ ] Champ "Pixel Facebook ID"
- [ ] Statut "Non connecté" sur tous

### T9.2 — OAuth Google — Début du flow
**Action :** Cliquer "Connecter Google Analytics"
**Attendu :**
- [ ] Redirect vers `accounts.google.com/oauth/...` (URL Google réelle)
- [ ] Les scopes demandés incluent Analytics
- [ ] L'URL contient `redirect_uri=https://api-staging.wapixia.com/api/v1/sites/[id]/google/callback`

### T9.3 — Pixel Facebook sauvegardé
**Action :** Saisir `123456789012345` dans le champ Pixel Facebook → sauvegarder
**Attendu :**
- [ ] `sites.facebook_pixel_id` = `123456789012345` dans la BDD
- [ ] Le script `fbevents.js` est présent dans le code source du site (après revalidation)
- [ ] Le Pixel n'est chargé qu'après consentement marketing (vérifier dans Network tab avec bannière refusée)

### T9.4 — Bannière cookies présente
**Action :** Ouvrir le site en navigation privée (sans cookies)
**Attendu :**
- [ ] Bannière cookies visible au bas de la page
- [ ] 3 options : "Tout accepter", "Tout refuser", "Personnaliser"
- [ ] Cliquer "Tout refuser" → GA et Pixel ne se chargent pas (vérifier Network tab)
- [ ] Cliquer "Tout accepter" → GA et Pixel se chargent
- [ ] Choix mémorisé après rechargement de la page

---

## BLOC 10 — Thèmes Sectoriels

### T10.1 — Thème coiffure appliqué
**Action :** Visiter le site du compte client coiffure
**Attendu :**
- [ ] Couleur d'accent visible correspond au thème "beaute" (rose/rose pâle)
- [ ] Police de titre identifiable comme Playfair Display (ou la police définie pour le secteur)
- [ ] Ambiance "élégante et féminine" perceptible visuellement

### T10.2 — Thème BTP appliqué
**Action :** Générer un site pour le client BTP, visiter le résultat
**Attendu :**
- [ ] Couleur d'accent = teinte orange/ambre (thème artisan)
- [ ] Police de titre Syne
- [ ] Ambiance "robuste et rassurante" perceptible

### T10.3 — Site mobile — Responsive
**Action :** Ouvrir les sites générés sur mobile (ou Chrome DevTools → mode responsive 375px)
**Attendu :**
- [ ] Aucun élément qui déborde horizontalement
- [ ] Navigation accessible (menu hamburger ou équivalent)
- [ ] Boutons CTA cliquables facilement (taille > 44px × 44px)
- [ ] Texte lisible sans zoom

### T10.4 — 3 secteurs différents générés avec succès
**Action :** Générer un site complet pour le client coiffure, le client BTP et le client horeca
**Attendu :**
- [ ] Les 3 sites sont générés sans erreur
- [ ] Les 3 sites ont des designs visiblement différents (thème, couleurs, police)
- [ ] Les 3 sites sont accessibles sur leurs sous-domaines respectifs
- [ ] Le contenu de chaque site correspond au secteur déclaré

---

## BLOC 11 — GEO / AEO (Structure pour les IA génératives)

### T11.1 — TLDR-first sur la page d'accueil
**Action :** Voir les 100 premiers mots du contenu visible sur la page d'accueil (hors navigation)
**Attendu :**
- [ ] Une réponse directe à "Qui êtes-vous et que faites-vous ?" est présente dans les 100 premiers mots
- [ ] Le nom de l'entreprise est dans ces 100 premiers mots
- [ ] La ville est mentionnée dans ces 100 premiers mots

### T11.2 — H2 en format questions
**Action :** `curl https://salon-sonia.wapixia.com/services | grep -oP '(?<=<h2>)[^<]+'`
**Attendu :**
- [ ] Au moins 50% des H2 contiennent un point d'interrogation
- [ ] Les questions correspondent à des requêtes réelles (ex: "Combien coûte...")

### T11.3 — Crawlers IA non bloqués
**Action :** Vérifier le robots.txt (déjà testé en T7.1) + tester manuellement avec les User-Agents IA
```bash
curl -A "GPTBot" https://salon-sonia.wapixia.com
curl -A "ClaudeBot" https://salon-sonia.wapixia.com
curl -A "PerplexityBot" https://salon-sonia.wapixia.com
```
**Attendu :**
- [ ] HTTP 200 pour chacun (pas de 403 ou 404)
- [ ] Le contenu HTML est retourné (pas de page vide)

---

## BLOC 12 — Sécurité & Edge Cases

### T12.1 — Un client ne peut pas accéder au site d'un autre client
**Action :** Avec le token du client coiffure, appeler `GET /api/v1/sites/[id_site_btp]`
**Attendu :**
- [ ] HTTP 403 ou résultat vide
- [ ] Aucune donnée du site BTP n'est retournée

### T12.2 — Injection dans les champs texte
**Action :** À l'étape 1 du questionnaire, saisir `<script>alert('xss')</script>Salon Test`
**Attendu :**
- [ ] Aucune alerte JavaScript ne s'affiche
- [ ] Le contenu est échappé correctement dans le HTML généré
- [ ] En BDD : `onboarding_data.business_name` contient le texte brut (pas le script)

### T12.3 — Onboarding non terminé — Pas de génération
**Action :** Via l'API, appeler `POST /api/v1/sites/:id/onboarding/complete` avec seulement 10 étapes remplies
**Attendu :**
- [ ] HTTP 422
- [ ] Message d'erreur listant les étapes manquantes obligatoires

### T12.4 — Double déclenchement de génération
**Action :** Cliquer deux fois rapidement sur "Créer mon site intelligent" (ou appeler l'API deux fois)
**Attendu :**
- [ ] Un seul job BullMQ créé (le deuxième appel retourne HTTP 409 "Génération déjà en cours")
- [ ] Un seul site déployé (pas de doublons)

### T12.5 — Headers de sécurité sur les sites générés
**Action :** `curl -I https://salon-sonia.wapixia.com`
**Attendu :**
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` (ou SAMEORIGIN)
- [ ] `Strict-Transport-Security` présent avec `max-age` ≥ 31536000
- [ ] Pas de `X-Powered-By` exposé
- [ ] `Referrer-Policy` présent

---

## Récapitulatif — Critères de validation du Sprint 2

| Bloc | Tests | Requis |
|---|---|---|
| Bloc 1 — BDD | T1.1 → T1.4 | 4/4 ✅ |
| Bloc 2 — Onboarding UI | T2.1 → T2.11 | 10/11 min ✅ |
| Bloc 3 — Génération IA | T3.1 → T3.8 | 7/8 min ✅ |
| Bloc 4 — Payload CMS | T4.1 → T4.5 | 5/5 ✅ |
| Bloc 5 — Déploiement | T5.1 → T5.6 | 5/6 min ✅ |
| Bloc 6 — Domaine perso | T6.1 → T6.4 | 3/4 min ✅ |
| Bloc 7 — SEO Technique | T7.1 → T7.9 | 9/9 ✅ |
| Bloc 8 — Performance | T8.1 → T8.5 | 4/5 min ✅ |
| Bloc 9 — Google & Tracking | T9.1 → T9.4 | 3/4 min ✅ |
| Bloc 10 — Thèmes | T10.1 → T10.4 | 4/4 ✅ |
| Bloc 11 — GEO/AEO | T11.1 → T11.3 | 3/3 ✅ |
| Bloc 12 — Sécurité | T12.1 → T12.5 | 5/5 ✅ |

**Total minimum pour Go Sprint 3 : 62/68 tests passés**

Blocs 7 (SEO), 11 (GEO/AEO) et 12 (Sécurité) sont **non négociables** : 100% requis.

---

## Template rapport de tests Sprint 2

```
## Rapport Sprint 2 — [Date]
**Testeur :** Salim
**Environnement :** staging.wapixia.com
**Sites de test générés :**
  - Coiffure : https://[slug].wapixia.com
  - BTP : https://[slug].wapixia.com
  - Horeca : https://[slug].wapixia.com

### Résultats
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — BDD | | | |
| Bloc 2 — Onboarding UI | | | |
| Bloc 3 — Génération IA | | | |
| Bloc 4 — Payload CMS | | | |
| Bloc 5 — Déploiement | | | |
| Bloc 6 — Domaine perso | | | |
| Bloc 7 — SEO Technique | | | |
| Bloc 8 — Performance | | | |
| Bloc 9 — Google & Tracking | | | |
| Bloc 10 — Thèmes | | | |
| Bloc 11 — GEO/AEO | | | |
| Bloc 12 — Sécurité | | | |
| **TOTAL** | | | |

### Temps de génération mesuré
| Site | Secteur | Durée totale | Tokens utilisés | Coût estimé |
|---|---|---|---|---|
| [nom] | beaute | | | |
| [nom] | btp | | | |
| [nom] | horeca | | | |

### Score PageSpeed Insights
| Site | Mobile | Desktop | LCP | CLS |
|---|---|---|---|---|
| [nom] | | | | |

### Bugs identifiés
| ID | Description | Sévérité | Bloc | Test |
|---|---|---|---|---|
| BUG-S2-001 | | critique/major/minor | | |

### Décision
[ ] ✅ GO Sprint 3
[ ] ❌ STOP — bugs critiques à corriger avant

### Notes
[Observations libres sur le comportement, la qualité du contenu IA, l'UX]
```
