# SPRINT 7 — GO_LIVE_CHECKLIST.md
# Checklist mise en production — À compléter avant chaque site pilote
> Format : ☐ = à faire | ☑ = validé | ✗ = bloquant

---

## SECTION 1 — Infrastructure & Sécurité

### 1.1 Serveur et réseau
- ☐ VPS Hetzner CPX31 actif et accessible
- ☐ Coolify installé et configuré (version ≥ 4.x)
- ☐ Docker up sur le VPS (`docker ps` retourne des containers)
- ☐ Cloudflare zone wapixia.com active et configurée
- ☐ Proxy Cloudflare activé sur tous les sous-domaines WapixIA
- ☐ WAF Cloudflare activé (règles de base)
- ☐ Règles de rate limiting actives sur l'API

### 1.2 SSL et domaines
- ☐ SSL actif sur api.wapixia.com (certificat valide > 30 jours)
- ☐ SSL actif sur app.wapixia.com
- ☐ SSL actif sur admin.wapixia.com
- ☐ Redirect HTTP → HTTPS actif sur tous les domaines WapixIA
- ☐ HSTS header présent (`Strict-Transport-Security: max-age=31536000`)

### 1.3 Variables d'environnement production
- ☐ `NODE_ENV=production` sur tous les services
- ☐ `ANTHROPIC_API_KEY` valide (clé production, pas dev)
- ☐ `MOLLIE_API_KEY` = clé LIVE (pas test)
- ☐ `STRIPE_SECRET_KEY` = clé LIVE
- ☐ `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` configurés en prod
- ☐ `META_APP_ID` + `META_APP_SECRET` en mode Live (pas Development)
- ☐ `BREVO_API_KEY` valide (quota email suffisant)
- ☐ `ENCRYPTION_KEY` 32 bytes unique en production
- ☐ `JWT_SECRET` ≥ 64 chars unique en production
- ☐ Toutes les variables validées par `validate-env.ts`

---

## SECTION 2 — Base de données

### 2.1 Migrations
- ☐ Toutes les migrations 001 à 019 appliquées en production
- ☐ `npx drizzle-kit status` retourne "No pending migrations"
- ☐ RLS activé sur toutes les tables critiques (vérifier avec `SELECT tablename FROM pg_tables WHERE rowsecurity = true`)
- ☐ Seed module_catalog en place (18 modules avec les bons prix)
- ☐ Organisation WapixIA seed présente (id: 00000000-0000-0000-0000-000000000001)

### 2.2 Backups
- ☐ Script backup.sh configuré (cron 02:00 tous les jours)
- ☐ Premier backup manuel réussi avant go-live
- ☐ Backup visible dans Hetzner Object Storage
- ☐ Test de restauration passé (`restore-test.sh`)
- ☐ Alerte configurée si backup échoue

### 2.3 Connexions BDD
- ☐ `DATABASE_URL` pointe vers la BDD production (pas staging)
- ☐ `DATABASE_POOLER_URL` configuré pour les workers
- ☐ Connexions max configurées (Supabase plan adapté)

---

## SECTION 3 — Services applicatifs

### 3.1 API Fastify
- ☐ `curl https://api.wapixia.com/health` retourne HTTP 200
- ☐ Tous les services "up" dans la réponse health
- ☐ Rate limiting actif (tester avec 110 req/min → 429 à la 101ème)
- ☐ CORS configuré pour les domaines wapixia.com uniquement
- ☐ Logs structurés (JSON) visibles dans Betterstack ou console

### 3.2 Redis & BullMQ
- ☐ Redis up et accessible par l'API
- ☐ BullMQ dashboard accessible sur /admin/queues (SuperAdmin seulement)
- ☐ Queues créées et workers démarrés (vérifier les logs de démarrage)
- ☐ Scheduler cron démarré (log "Content scheduler started")
- ☐ 0 jobs en état 'failed' au démarrage

### 3.3 Payload CMS
- ☐ Payload CMS accessible sur cms.wapixia.com/admin
- ☐ Collections créées : Pages, Services, BlogPosts, Testimonials, FAQItems, Media, SiteSettings, Navigation
- ☐ Isolation multi-tenant active (un client ne voit pas les pages d'un autre)

### 3.4 Dashboard client
- ☐ `https://app.wapixia.com` accessible et charge < 2s
- ☐ Page login fonctionnelle
- ☐ Connexion avec le compte test réussie

### 3.5 Dashboard admin
- ☐ `https://admin.wapixia.com` accessible
- ☐ Connexion SuperAdmin fonctionnelle
- ☐ Liste des organisations visible

---

## SECTION 4 — Intégrations tierces

### 4.1 Claude API (Anthropic)
- ☐ Clé API valide (tester avec un appel minimal)
- ☐ Quota suffisant (vérifier dans Anthropic Console)
- ☐ Modèles configurés : `claude-sonnet-4-6` pour contenu, `claude-haiku-4-5-20251001` pour avis

### 4.2 Google APIs
- ☐ OAuth2 configuré (Client ID + Secret en prod)
- ☐ URI de callback autorisée dans Google Cloud Console : `https://api.wapixia.com/api/v1/sites/*/google/callback`
- ☐ APIs activées dans Google Cloud Console : Analytics Data, Search Console, My Business, Business Profile
- ☐ Test OAuth avec un compte Google de test → connexion réussie

### 4.3 Meta (Facebook / Instagram)
- ☐ App Meta en mode LIVE (pas Development)
- ☐ Permissions approuvées : `pages_manage_posts`, `pages_read_engagement`, `instagram_content_publish`
- ☐ URL de callback configurée : `https://api.wapixia.com/api/v1/sites/*/social-accounts/facebook/callback`
- ☐ Test publication sur Page de test → succès

### 4.4 Mollie
- ☐ Clé API LIVE configurée
- ☐ URL webhook Mollie configurée dans le dashboard Mollie : `https://api.wapixia.com/api/v1/webhooks/mollie`
- ☐ Test paiement Bancontact en mode live (avec un vrai Bancontact) → à faire UNIQUEMENT si montant = 0.01€ possible, sinon skip

### 4.5 Brevo
- ☐ Clé API valide
- ☐ Templates 1 à 14 créés et testés
- ☐ Sender email `noreply@wapixia.com` vérifié
- ☐ DNS (SPF, DKIM) configurés pour wapixia.com

### 4.6 Cloudflare R2
- ☐ Bucket `wapixia-media` créé
- ☐ Bucket `wapixia-backups` créé
- ☐ URL publique configurée : `media.wapixia.com`
- ☐ Test upload image → URL accessible publiquement

### 4.7 Unsplash
- ☐ Clé API Unsplash valide
- ☐ Test requête → image retournée pour le secteur "beaute"

---

## SECTION 5 — Site client (pour chaque pilote)

### 5.1 Contenu et SEO
- ☐ Page d'accueil charge correctement (HTTP 200)
- ☐ Score PageSpeed Insights mobile > 80
- ☐ LCP < 2.5s (mesuré via PageSpeed Insights API)
- ☐ CLS < 0.1
- ☐ `robots.txt` présent et autorise GPTBot, ClaudeBot, PerplexityBot
- ☐ `sitemap.xml` présent, valide et accessible
- ☐ 1 seul H1 par page (vérifier les 5 pages principales)
- ☐ Meta title ≤ 60 chars sur toutes les pages
- ☐ Meta description ≤ 160 chars sur toutes les pages
- ☐ Schema.org LocalBusiness valide (test Google Rich Results)
- ☐ Schema.org FAQPage présent sur la page accueil et la page FAQ
- ☐ Balise `lang="fr"` sur `<html>`
- ☐ Canonical URL présent sur chaque page

### 5.2 Fonctionnel
- ☐ Formulaire de contact soumis → email de notification reçu
- ☐ Tous les liens internes fonctionnent (pas de 404)
- ☐ Google Maps s'affiche sur la page Contact (si coordonnées fournies)
- ☐ Le site est responsive (test sur mobile 375px)
- ☐ Les images ne débordent pas du viewport

### 5.3 Analytics et tracking
- ☐ Google Analytics connecté (si client a consenti)
- ☐ Pixel Facebook chargé APRÈS consentement uniquement
- ☐ Bannière cookies présente sur la première visite
- ☐ Les scripts ne se chargent pas si consentement refusé

### 5.4 SSL et sécurité
- ☐ HTTPS actif sur le sous-domaine WapixIA
- ☐ Redirect HTTP → HTTPS
- ☐ Headers de sécurité présents (`X-Content-Type-Options`, `X-Frame-Options`, `HSTS`)

---

## SECTION 6 — Monitoring post go-live

- ☐ Monitor UptimeRobot créé pour chaque site pilote
- ☐ Alertes email + SMS configurées
- ☐ Dashboard UptimeRobot vérifié (statut "Up" sur tous les sites)
- ☐ Premier rapport mensuel planifié (job BullMQ programmé pour le 1er du mois)
- ☐ Alerte coût Claude configurée (seuil 4€/site/mois)

---

## Signature Go-Live

```
Date de validation : ____________________
Validé par         : Salim (Wapix SPRL)

Pilote A — [Nom] : ☐ GO  ☐ NO-GO  Commentaire : __________________
Pilote B — [Nom] : ☐ GO  ☐ NO-GO  Commentaire : __________________
Pilote C — [Nom] : ☐ GO  ☐ NO-GO  Commentaire : __________________

Bugs critiques ouverts   : 0  ☐ Confirmé
Bugs majeurs ouverts     : 0  ☐ Confirmé
Backups testés           : ☐ Confirmé
Monitoring actif         : ☐ Confirmé

DÉCISION FINALE : ☐ GO-LIVE PRODUCTION  ☐ REPORT (raison : _________)
```
