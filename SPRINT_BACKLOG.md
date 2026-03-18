# SPRINT_BACKLOG.md — WapixIA
> Version : 1.0 | Date : Mars 2026
> Ce fichier est le plan d'exécution complet du MVP V1.
> Chaque sprint a ses critères d'acceptation — un sprint n'est terminé que si TOUS les critères sont verts.

---

## Vue d'ensemble

| Sprint | Titre | Durée | Statut | Démarrage |
|---|---|---|---|---|
| Sprint 0 | Fondations & Documentation | 1 semaine | 🟡 EN COURS | Semaine 1 |
| Sprint 1 | Auth & Hiérarchie Admin | 1 semaine | ⬜ À FAIRE | Semaine 2 |
| Sprint 2 | Socle Site & CMS | 2 semaines | ⬜ À FAIRE | Semaine 3 |
| Sprint 3 | Modules IA Core | 2 semaines | ⬜ À FAIRE | Semaine 5 |
| Sprint 4 | Dashboard Client & Rapport ROI | 1 semaine | ⬜ À FAIRE | Semaine 7 |
| Sprint 5 | Paiements & Abonnements | 1 semaine | ⬜ À FAIRE | Semaine 8 |
| Sprint 6 | Infra & Déploiement Automatique | 1 semaine | ⬜ À FAIRE | Semaine 9 |
| Sprint 7 | Pilotes & Go-Live | 2 semaines | ⬜ À FAIRE | Semaine 10 |

**MVP en production cible : Semaine 12 (fin juin 2026)**

---

## Sprint 0 — Fondations & Documentation
> Durée : 1 semaine | Objectif : zéro ligne de code avant que tout soit documenté

### Livrables
- [x] `ARCHITECTURE.md` — stack, décisions techniques, règles Claude Code
- [x] `DATABASE.md` — schéma Supabase complet avec RLS
- [x] `CONVENTIONS.md` — nommage, git workflow, API design
- [x] `ENV.md` — toutes les variables d'environnement
- [x] `SPRINT_BACKLOG.md` — ce fichier
- [ ] Repo GitHub créé avec structure monorepo
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` créé
- [ ] Projet Supabase créé (staging + production)
- [ ] Toutes les variables d'environnement staging renseignées dans Coolify
- [ ] Compte Hetzner configuré, VPS CPX31 commandé
- [ ] Cloudflare configuré sur wapixia.com
- [ ] Domaines staging configurés : staging.wapixia.com, api-staging.wapixia.com

### Critères d'acceptation Sprint 0
- [ ] Le repo GitHub existe avec la structure définie dans `ARCHITECTURE.md`
- [ ] `npm install` fonctionne sans erreur sur tous les packages
- [ ] Le projet Supabase staging répond sur l'URL configurée
- [ ] La migration initiale du schéma BDD tourne sans erreur sur staging
- [ ] Les variables d'environnement sont validées par `validate-env.ts`

---

## Sprint 1 — Auth & Hiérarchie Admin
> Durée : 1 semaine | Objectif : les 3 niveaux d'accès fonctionnels et sécurisés

### User Stories

**US-1.1** En tant que SuperAdmin, je peux me connecter sur admin.wapixia.com et voir la liste de toutes les organisations.

**US-1.2** En tant que Revendeur, je peux me connecter sur mon dashboard white-label et voir uniquement mes clients.

**US-1.3** En tant que Client, je peux me connecter sur app.wapixia.com (ou le sous-domaine de mon revendeur) et voir uniquement mon site.

**US-1.4** En tant que SuperAdmin, je peux créer un compte Revendeur avec son taux de commission et son domaine white-label.

**US-1.5** En tant que Revendeur, je peux créer un compte Client et l'associer à un site.

**US-1.6** Si un utilisateur tente d'accéder à une ressource qui ne lui appartient pas, il reçoit une erreur 403.

### Livrables techniques
- [ ] Supabase Auth configuré avec JWT custom claims (organization_id, role)
- [ ] Middleware d'auth sur toutes les routes Fastify
- [ ] RLS policies actives et testées sur `organizations`, `users`, `sites`
- [ ] Pages de connexion sur dashboard, admin, reseller
- [ ] Route POST /api/v1/auth/invite (invitation par email)
- [ ] Route GET /api/v1/me (profil utilisateur courant)
- [ ] Tests unitaires RLS (simuler les 3 rôles et vérifier l'isolation)

### Critères d'acceptation Sprint 1
- [ ] Un SuperAdmin connecté voit les données de TOUTES les organisations
- [ ] Un Revendeur connecté ne voit QUE ses clients (test avec 2 revendeurs différents)
- [ ] Un Client connecté ne voit QUE son site
- [ ] Tentative d'accès cross-tenant retourne 403 dans 100% des cas testés
- [ ] Les tokens JWT expirent après 24h
- [ ] La page de connexion fonctionne sur les 3 applications
- [ ] Invitation par email fonctionne (email reçu, lien valide 48h)
- [ ] Tous les tests unitaires RLS passent (minimum 15 cas de test)

---

## Sprint 2 — Socle Site & CMS
> Durée : 2 semaines | Objectif : un site généré depuis l'onboarding, en ligne en 48h

### User Stories

**US-2.1** En tant que Client, je peux répondre au questionnaire d'onboarding en 20 minutes depuis mon backoffice.

**US-2.2** Après avoir soumis le questionnaire, l'IA génère automatiquement le contenu de toutes les pages (accueil, services, à propos, contact, FAQ).

**US-2.3** Le site généré est consultable sur mon sous-domaine temporaire (client.wapixia.com) dans les 48h.

**US-2.4** En tant que Client, je peux modifier le contenu de chaque page depuis le CMS (Payload CMS) dans mon backoffice.

**US-2.5** Le site est techniquement optimisé SEO dès la génération : sitemap, meta tags, Schema.org, robots.txt.

**US-2.6** En tant que Client, je peux connecter mon propre nom de domaine depuis le backoffice.

### Livrables techniques
- [ ] Questionnaire onboarding 20 questions (UI + validation)
- [ ] Générateur de contenu IA (appel Claude API avec contexte sectoriel)
- [ ] Templates Next.js par secteur (8 secteurs, 1 template each pour V1)
- [ ] Payload CMS configuré multi-tenant
- [ ] Collections Payload : Pages, Services, Team, Blog, FAQ, Testimonials
- [ ] Pipeline de déploiement automatique (questionnaire → génération → Coolify deploy)
- [ ] Sous-domaine automatique via Cloudflare API
- [ ] SEO automatique : sitemap.xml, robots.txt, meta tags, Schema.org LocalBusiness + FAQPage
- [ ] GEO/AEO : structure TLDR-first, H2 en format question, FAQ Schema
- [ ] robots.txt avec crawlers IA autorisés (GPTBot, ClaudeBot, PerplexityBot...)
- [ ] Connexion domaine personnalisé (CNAME + SSL Let's Encrypt)
- [ ] Google Analytics + Tag Manager + Search Console (connexion OAuth)
- [ ] Pixel Facebook (champ simple dans les paramètres)
- [ ] Google Maps intégré (widget sur la page contact)
- [ ] Google My Business connexion OAuth

### Critères d'acceptation Sprint 2
- [ ] Questionnaire soumis → contenu généré en moins de 5 minutes
- [ ] Le site est accessible sur le sous-domaine temporaire en moins de 10 minutes
- [ ] Le score PageSpeed Insights du site généré est > 80 sur mobile
- [ ] LCP < 2.5s mesuré par PageSpeed Insights API
- [ ] Le sitemap.xml est valide et accessible
- [ ] Le robots.txt est présent et autorise les crawlers IA
- [ ] Schema.org LocalBusiness est présent et valide (test Google Rich Results)
- [ ] Le CMS permet de modifier n'importe quelle page sans erreur
- [ ] La connexion d'un domaine personnalisé fonctionne (SSL actif en < 10 min)
- [ ] Les connexions Google OAuth fonctionnent (Analytics, GSC, GMB)
- [ ] Le site est indexable (pas de noindex parasite)
- [ ] Test sur 3 secteurs différents : BTP, Beauté, Horeca

---

## Sprint 3 — Modules IA Core
> Durée : 2 semaines | Objectif : les 3 premiers modules à 10€ opérationnels

### Modules à développer
1. **Posts GMB + Gestion Avis Google** (10€/mois)
2. **Posts Réseaux Sociaux IA** (10€/mois)
3. **Articles Blog SEO** (10€/mois)

### User Stories

**US-3.1** En tant que Client avec le module GMB activé, l'IA publie automatiquement 1 post GMB par semaine sur ma fiche Google.

**US-3.2** En tant que Client, quand je reçois un avis Google, l'IA génère une réponse dans les 24h — je peux la valider ou la modifier avant publication.

**US-3.3** Un avis avec 1 ou 2 étoiles déclenche une alerte email/SMS immédiate vers moi (le Wapix admin) et vers le client.

**US-3.4** En tant que Client avec le module RS activé, l'IA génère et planifie 12 à 20 posts/mois sur Facebook et Instagram.

**US-3.5** En tant que Client, je peux voir les posts planifiés dans mon backoffice, les valider, les modifier ou les rejeter.

**US-3.6** En tant que Client avec le module Blog activé, l'IA génère 8 articles SEO/mois — chaque article est soumis à validation avant publication.

**US-3.7** Chaque article généré est optimisé GEO+AEO : structure TLDR-first, FAQ Schema, mots-clés LSI, longueur 1 200–2 500 mots.

### Livrables techniques
- [ ] BullMQ workers : `content:social`, `content:gmb`, `content:blog`, `reputation:reviews`
- [ ] Prompts Claude par secteur (8 secteurs × 3 types de contenu = 24 prompts)
- [ ] Système de contexte : données client injectées dans chaque prompt (services, prix, zone, ton)
- [ ] Interface validation backoffice : liste des contenus en attente, aperçu, approve/reject
- [ ] Connexion Meta Graph API (publication Facebook + Instagram)
- [ ] Connexion Google My Business API (publication posts + gestion réponses avis)
- [ ] Scheduler : cron jobs pour les publications planifiées
- [ ] Sync avis Google : polling GMB API toutes les 4h
- [ ] Alertes email (Brevo) pour avis négatifs
- [ ] Retry policy sur les échecs de publication
- [ ] Tracking : nombre de tokens Claude utilisés par site/mois

### Critères d'acceptation Sprint 3
- [ ] Module GMB : 1 post publié sur une vraie fiche GMB de test
- [ ] Module Avis : réponse générée en < 30 min après réception d'un avis de test
- [ ] Alerte avis négatif : email reçu en < 5 min pour un avis 1 étoile
- [ ] Module RS : post publié sur Facebook de test avec image (Unsplash)
- [ ] Module RS : post publié sur Instagram de test
- [ ] Module Blog : article de 1 200+ mots généré, avec FAQ Schema.org valide
- [ ] Interface backoffice : liste des contenus paginée, aperçu fonctionnel, validation/rejet
- [ ] Mode auto-publication : si activé, les contenus sont publiés sans validation
- [ ] Coût Claude API mesuré par site : < 4€/mois pour les 3 modules actifs
- [ ] Zero perte de job : les jobs échoués sont retryés et loggués

---

## Sprint 4 — Dashboard Client & Rapport ROI
> Durée : 1 semaine | Objectif : le client voit la valeur de son abonnement chaque mois

### User Stories

**US-4.1** En tant que Client, j'ai un dashboard avec mon Visibility Score actuel (0-100) et son évolution sur 30 jours.

**US-4.2** Je peux voir combien de visites, leads, appels et demandes de devis mon site a générés ce mois.

**US-4.3** Je vois mon classement parmi mes concurrents locaux dans ma zone.

**US-4.4** Le 1er de chaque mois, je reçois par email un rapport PDF avec mon ROI estimé du mois.

**US-4.5** Le rapport PDF inclut : stats de trafic, leads générés, valeur estimée, évolution SEO, 3 recommandations IA pour le mois suivant.

### Livrables techniques
- [ ] Calcul Visibility Score (algorithme : positions Google + avis GMB + activité RS + score SEO)
- [ ] Dashboard UI : Visibility Score (gauge), trafic, leads, contenu publié, classement
- [ ] Graphiques tendances (30j, 90j) — recharts ou Chart.js
- [ ] Comparatif concurrents (top 5 dans la zone du client)
- [ ] Import données Google Analytics 4 API (visites, sources)
- [ ] Import données Google Search Console (impressions, clics, positions)
- [ ] Génération rapport PDF (Puppeteer ou @react-pdf/renderer)
- [ ] Envoi automatique Brevo le 1er du mois
- [ ] Job BullMQ `reports:monthly` (calcul + génération + envoi)
- [ ] Historique des rapports téléchargeables dans le backoffice

### Critères d'acceptation Sprint 4
- [ ] Le Visibility Score s'affiche et se calcule sans erreur pour un site avec données réelles
- [ ] Les données GA4 s'importent correctement (test avec vrai compte Google)
- [ ] Le rapport PDF est généré et reçu par email (test sur adresse réelle)
- [ ] Le rapport contient tous les éléments définis (vérification visuelle)
- [ ] L'historique des rapports est accessible dans le backoffice
- [ ] Temps de génération du rapport < 60 secondes
- [ ] Le dashboard se charge en < 2s (données en cache Redis)

---

## Sprint 5 — Paiements & Abonnements
> Durée : 1 semaine | Objectif : la facturation tourne automatiquement

### User Stories

**US-5.1** En tant que Client, je peux payer mon abonnement mensuel à 89€ via Mollie (Bancontact, SEPA, carte).

**US-5.2** En tant que Client ayant acheté un site à 1 900€, je peux souscrire à l'hébergement à 19€/mois ou 175€/an.

**US-5.3** En tant que Client, je peux activer un module IA à 10€/mois depuis mon backoffice — le paiement est ajouté à ma prochaine facture.

**US-5.4** En cas d'impayé, le site reste actif 7 jours, puis les modules IA sont suspendus, puis le site est suspendu à J+30.

**US-5.5** En tant que Revendeur, je vois dans mon dashboard mes commissions du mois, calculées automatiquement.

**US-5.6** WapixIA reçoit automatiquement sa commission via Stripe Connect à chaque paiement revendeur.

### Livrables techniques
- [ ] Intégration Mollie (abonnements récurrents + paiements one-shot)
- [ ] Intégration Stripe Connect (commissions revendeurs)
- [ ] Webhook handlers (Mollie + Stripe) : paiement reçu, échec, remboursement
- [ ] Logique de dunning (relances impayés J+1, J+7, J+30 avec actions automatiques)
- [ ] Calcul commissions : job BullMQ le 1er du mois
- [ ] Dashboard commissions revendeur (MRR de ses clients, commissions dues, historique)
- [ ] Emails de facturation automatiques (Brevo templates)
- [ ] Portail client : historique des paiements, téléchargement factures PDF
- [ ] Activation/désactivation module depuis backoffice client (avec effet immédiat sur la facturation)

### Critères d'acceptation Sprint 5
- [ ] Paiement test Mollie réussi (Bancontact sandbox) → abonnement activé automatiquement
- [ ] Paiement échoué → email de relance envoyé dans les 24h
- [ ] Activation module 10€ → ajouté à la prochaine facture (vérification BDD)
- [ ] Commission calculée correctement (test : client 89€, commission 20% = 17.80€)
- [ ] Dashboard revendeur affiche le bon MRR et les bonnes commissions
- [ ] Facture PDF générée et téléchargeable
- [ ] Webhook signature validée (Mollie + Stripe) — rejeter les webhooks non signés

---

## Sprint 6 — Infra & Déploiement Automatique
> Durée : 1 semaine | Objectif : déployer un nouveau site en 1 clic sans intervention manuelle

### User Stories

**US-6.1** Quand un client valide son site depuis le backoffice, il est automatiquement déployé sur le sous-domaine temporaire.

**US-6.2** Quand un client connecte son domaine, le DNS et le SSL sont configurés automatiquement en moins de 10 minutes.

**US-6.3** Si un site est down, une alerte est envoyée à Wapix dans les 5 minutes.

**US-6.4** Les backups de la BDD sont effectués quotidiennement et testés automatiquement.

### Livrables techniques
- [ ] Pipeline Coolify : GitHub push → build → deploy automatique
- [ ] Script de création de sous-domaine (Cloudflare API)
- [ ] Script de configuration DNS/SSL pour domaine personnalisé
- [ ] Health check endpoints sur tous les services
- [ ] Monitoring UptimeRobot configuré (alertes email + SMS)
- [ ] Script backup pg_dump quotidien → Hetzner Object Storage
- [ ] Script de test de restauration mensuel automatisé
- [ ] Logs centralisés (Grafana + Loki ou Betterstack)
- [ ] Script de déploiement d'un nouveau tenant (création sous-domaine + BDD + Coolify)
- [ ] Script de migration domaine client (FTP/SFTP vers hébergeur externe)

### Critères d'acceptation Sprint 6
- [ ] Nouveau site déployé automatiquement en < 10 minutes depuis la validation backoffice
- [ ] Connexion domaine personnalisé : SSL actif en < 10 minutes
- [ ] Alerte reçue en < 5 minutes quand un service est simulé down
- [ ] Backup quotidien visible dans Hetzner Object Storage
- [ ] Restauration de test réussie (données cohérentes après restauration)
- [ ] Tous les services ont un health check endpoint qui répond 200

---

## Sprint 7 — Pilotes & Go-Live
> Durée : 2 semaines | Objectif : 3 clients réels en production, premiers retours, premières factures

### Critères de sélection des 3 pilotes
- 1 coiffeur / esthétique (ex : soniaespacecoiffure.be)
- 1 artisan BTP (ex : un site du parc hébergé)
- 1 professionnel B2B ou médical

### User Stories

**US-7.1** Les 3 clients pilotes ont leur site en production avec leur vrai domaine.

**US-7.2** Les modules GMB + Avis et Posts RS sont actifs sur les 3 sites.

**US-7.3** Chaque pilote reçoit son premier rapport mensuel PDF à la fin du sprint.

**US-7.4** Wapix peut mesurer le coût réel d'infrastructure et d'API par client.

### Livrables techniques
- [ ] Onboarding des 3 clients (questionnaire + génération + validation)
- [ ] 3 sites en production avec vrais domaines et SSL
- [ ] Modules GMB + RS activés et premiers contenus générés
- [ ] Monitoring actif sur les 3 sites
- [ ] Mesure coût API Claude réel (tokens/mois/client)
- [ ] Mesure coût infrastructure réel (par VPS, par tenant)
- [ ] Bug tracker rempli avec retours des 3 pilotes

### Critères d'acceptation Sprint 7 (Go/No-Go production)
- [ ] 3 sites en ligne avec vrais domaines — accessibles et rapides
- [ ] Aucun bug critique (site down, perte de données, erreur paiement)
- [ ] Coût Claude API par client < 4€/mois (si > 4€, revoir les prompts)
- [ ] Coût infra par client < 2€/mois (si > 2€, optimiser)
- [ ] Au moins 1 contenu IA publié sur chaque site (post RS ou article)
- [ ] Rapport mensuel PDF généré pour les 3 clients
- [ ] 0 plainte de sécurité (accès cross-tenant, données exposées)
- [ ] Score Sentry : 0 erreur critique non résolue

---

## Hors scope V1 (V2/V3 roadmap)

Les fonctionnalités suivantes sont **explicitement hors scope du V1** :
- PWA
- Signature électronique eIDAS
- A/B Testing automatique
- Heatmaps & enregistrements de sessions
- Score de Présence IA (ChatGPT, Perplexity, Gemini)
- Alertes Concurrents Avancées
- Tracking appels téléphoniques
- WhatsApp Business
- QR Codes dynamiques
- Liens Bio
- E-commerce léger
- Génération de visuels IA (Stable Diffusion — Unsplash en V1)
- Notifications Push navigateur
- API publique WapixIA
- Mode multi-établissements
- Intégrations comptables (Winbooks, Exact Online)
- Connexions Doctolib, Planity
- Prospection automatisée (249€)

**Ces fonctionnalités ne seront pas implémentées, discutées ou ajoutées pendant les sprints 1 à 7.**
Si la tentation se présente, relire cette section.

---

## Métriques de succès MVP

| Métrique | Cible à S12 |
|---|---|
| Sites en production | 3 |
| Uptime | > 99.5% |
| LCP moyen des sites | < 2.5s |
| Coût API Claude par client | < 4€/mois |
| Coût infra par client | < 2€/mois |
| NPS pilotes | > 7/10 |
| Bugs critiques ouverts | 0 |
| Modules IA actifs (total) | > 5 |
