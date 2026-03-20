# SPRINT 6 — TESTS.md
# Infra & Déploiement Auto — Scénarios de test
> À exécuter par Salim sur l'environnement staging puis production
> Prérequis : Sprint 5 validé (40/46 ✅), VPS Hetzner configuré, Coolify installé
> ✅ Passé | ❌ Échoué | ⏭️ Bloqué

---

## Environnements cibles

| Env | URL API | Dashboard | Admin |
|---|---|---|---|
| Staging | api-staging.wapixia.com | staging.wapixia.com | admin-staging.wapixia.com |
| Production | api.wapixia.com | app.wapixia.com | admin.wapixia.com |

---

## BLOC 1 — CI/CD GitHub Actions

### T1.1 — Pipeline tests s'exécute sur chaque PR
**Action :** Créer une PR vers `staging` avec un changement mineur
**Attendu :**
- [ ] Workflow "WapixIA CI/CD" se déclenche automatiquement
- [ ] Job `test` s'exécute (visible dans l'onglet Actions de GitHub)
- [ ] Les tests unitaires passent (> 90%)
- [ ] Les tests d'intégration passent
- [ ] Statut check visible sur la PR (✅ ou ❌)
- [ ] Durée totale du job test < 5 minutes

### T1.2 — Deploy staging automatique sur push
**Action :** Merger une PR vers la branche `staging`
**Attendu :**
- [ ] Job `deploy-staging` se déclenche automatiquement après `test` + `build`
- [ ] Coolify déclenche le redéploiement (visible dans Coolify dashboard)
- [ ] Smoke tests staging s'exécutent après le deploy
- [ ] `curl -f https://api-staging.wapixia.com/health` retourne 200 à la fin du pipeline
- [ ] Durée totale pipeline staging < 8 minutes

### T1.3 — Deploy production nécessite approbation manuelle
**Action :** Pusher sur `main` sans approbation préalable
**Attendu :**
- [ ] Le job `deploy-production` est bloqué en attente d'approbation
- [ ] L'approbateur (Salim) reçoit une notification GitHub
- [ ] Sans approbation → le deploy n'a pas lieu même après 30 minutes
- [ ] Avec approbation → deploy déclenché dans les 2 minutes

### T1.4 — Rollback sur échec de migration
**Action :** Introduire intentionnellement une migration SQL invalide, pusher sur `staging`
**Attendu :**
- [ ] Le job de migration échoue avec un message d'erreur clair
- [ ] Le deploy est annulé (Coolify ne redéploie pas)
- [ ] La version précédente reste en service (pas de downtime)
- [ ] Notification d'échec reçue (email ou Slack)

### T1.5 — Variables de secrets non exposées dans les logs
**Action :** Examiner les logs du pipeline GitHub Actions
**Attendu :**
- [ ] Aucun token, clé API ou mot de passe visible en clair dans les logs
- [ ] Les secrets GitHub sont masqués (`***`)
- [ ] L'adresse du VPS n'est pas exposée

---

## BLOC 2 — Provisionnement automatique d'un site

### T2.1 — Provisionnement complet d'un nouveau site
**Action :** Compléter l'onboarding d'un nouveau site test → déclencher la génération
**Attendu (suite aux étapes décrites dans le SPEC) :**
- [ ] Étape "subdomain_created" atteinte en < 30s
- [ ] Étape "app_created" atteinte en < 1min
- [ ] Étape "deployed" atteinte en < 8min
- [ ] Étape "ssl_verified" atteinte en < 10min
- [ ] Étape "done" atteinte en < 12min

### T2.2 — Sous-domaine créé dans Cloudflare
**Action :** Après provisionnement, vérifier dans Cloudflare Dashboard
**Attendu :**
- [ ] Enregistrement CNAME `[slug].wapixia.com` → `vps.wapixia.com` visible
- [ ] Le proxy Cloudflare est activé (nuage orange)
- [ ] `sites.cloudflareRecordId` non null en BDD

### T2.3 — Site accessible sur le sous-domaine
**Action :** Naviguer sur `https://[slug].wapixia.com`
**Attendu :**
- [ ] HTTP 200 (pas de 404 ou 502)
- [ ] SSL actif (cadenas vert dans le navigateur, certificat Cloudflare)
- [ ] Contenu de la page visible (SSR fonctionnel)
- [ ] Le nom de l'entreprise est correct (contenu généré au Sprint 2)

### T2.4 — Variables d'environnement correctement injectées
**Action :** Inspecter les logs de déploiement Coolify pour le nouveau site
**Attendu :**
- [ ] Variables `SITE_ID`, `SITE_SLUG`, `SITE_SECTOR` présentes
- [ ] `PAYLOAD_CMS_URL` pointe vers le bon CMS
- [ ] Aucune variable manquante dans les logs de démarrage Next.js

### T2.5 — Monitor UptimeRobot créé automatiquement
**Action :** Vérifier le dashboard UptimeRobot après provisionnement
**Attendu :**
- [ ] Nouveau monitor visible pour `https://[slug].wapixia.com`
- [ ] Interval = 5 minutes
- [ ] Alertes configurées vers l'email et le SMS de Wapix

### T2.6 — Email "Site prêt" envoyé au client
**Action :** Vérifier la boîte email du compte client
**Attendu :**
- [ ] Email reçu avec l'URL du site
- [ ] Lien vers le site fonctionnel
- [ ] Lien vers le dashboard fonctionnel
- [ ] Score SEO mentionné dans l'email

### T2.7 — Provisionnement de 3 sites consécutifs
**Action :** Déclencher 3 provisions en parallèle (3 clients différents)
**Attendu :**
- [ ] Les 3 sites sont déployés sans interférence
- [ ] Chacun a son propre sous-domaine unique
- [ ] Aucun site n'a les variables d'environnement d'un autre site
- [ ] Les 3 sont accessibles simultanément

---

## BLOC 3 — Connexion domaine personnalisé

### T3.1 — Instructions DNS retournées
**Action :** `POST /api/v1/sites/[id]/connect-domain` avec `{ customDomain: "test-wapixia.be" }`
**Attendu :**
- [ ] HTTP 200
- [ ] Réponse contient les instructions DNS : type CNAME, name @, value proxy.wapixia.com
- [ ] `sites.customDomain` = "test-wapixia.be" en BDD
- [ ] `sites.domainVerified` = false
- [ ] Job de vérification créé dans BullMQ (visible dans le dashboard)

### T3.2 — Domaine déjà pris refusé
**Action :** Tenter de connecter un domaine déjà utilisé par un autre site
**Attendu :**
- [ ] HTTP 409 CONFLICT
- [ ] Message : "Ce domaine est déjà connecté à un autre site"

### T3.3 — Format domaine invalide refusé
**Action :** `POST .../connect-domain` avec `{ customDomain: "pas un domaine valide !@#" }`
**Attendu :**
- [ ] HTTP 422 VALIDATION_ERROR
- [ ] Message : "Format de domaine invalide"

### T3.4 — Vérification DNS après propagation (simulation)
**Action :** En SQL, forcer `domainVerified = true` et `sslStatus = 'active'`
**Vérification :** `GET /api/v1/sites/[id]/domain-status`
**Attendu :**
- [ ] `{ verified: true, sslStatus: 'active', domain: 'test-wapixia.be' }`
- [ ] L'interface dashboard affiche "✅ Domaine vérifié — SSL actif"
- [ ] Job de vérification arrêté (plus de jobs répétitifs pour ce site)

### T3.5 — Email notification domaine connecté
**Action :** Simuler la vérification DNS (forcer verified=true en BDD)
**Attendu :**
- [ ] Email "Votre domaine est connecté" reçu par le client
- [ ] L'email mentionne le domaine et l'URL HTTPS

---

## BLOC 4 — Health Checks

### T4.1 — Endpoint /health retourne 200 si tout va bien
**Action :** `curl https://api.wapixia.com/health`
**Attendu :**
- [ ] HTTP 200
- [ ] JSON avec `status: "healthy"`
- [ ] Tous les services : `database: "up"`, `redis: "up"`, `bullmq: "up"`, `cloudflare: "up"`, `anthropic: "up"`
- [ ] `timestamp` en format ISO valide
- [ ] Temps de réponse < 500ms

### T4.2 — Endpoint /health retourne 503 si un service est down
**Action :** Arrêter Redis temporairement (`redis-cli shutdown nosave`), puis appeler `/health`
**Attendu :**
- [ ] HTTP 503
- [ ] `status: "degraded"`
- [ ] `services.redis: "down"`
- [ ] Les autres services restent "up"

### T4.3 — Health check Dashboard Next.js
**Action :** `curl https://app.wapixia.com`
**Attendu :**
- [ ] HTTP 200
- [ ] La page HTML contient le contenu de l'app (SSR)

### T4.4 — Health check toutes les apps
**Action :** Tester chaque endpoint (staging + prod)
```bash
for url in \
  "https://api.wapixia.com/health" \
  "https://api-staging.wapixia.com/health" \
  "https://app.wapixia.com" \
  "https://admin.wapixia.com"; do
  echo -n "$url : "
  curl -s -o /dev/null -w "%{http_code}" $url
  echo ""
done
```
**Attendu :**
- [ ] Tous les 4 URLs retournent 200
- [ ] Délai moyen < 200ms

### T4.5 — Health check inclus dans le monitoring UptimeRobot
**Action :** Vérifier que le monitor UptimeRobot pour api.wapixia.com/health est configuré
**Attendu :**
- [ ] Monitor visible dans UptimeRobot dashboard
- [ ] Statut : Up ✅
- [ ] Interval : 5 minutes
- [ ] Alerte contacts configurés (email + SMS)

---

## BLOC 5 — Backups

### T5.1 — Backup quotidien exécuté
**Action :** Vérifier manuellement ou déclencher le script de backup
```bash
ssh deploy@[VPS_HOST] "bash /infra/scripts/backup.sh"
```
**Attendu :**
- [ ] Script s'exécute sans erreur
- [ ] Fichier `.dump` visible dans Hetzner Object Storage
- [ ] Message "Backup vérifié avec succès" dans les logs
- [ ] Notification succès reçue

### T5.2 — Fichier de backup présent et non corrompu
**Action :** Lister les backups sur Object Storage
```bash
s3cmd ls s3://wapixia-backups/postgres/
```
**Attendu :**
- [ ] Au moins 1 fichier présent avec la date du jour
- [ ] Taille du fichier > 0 et < 500 Mo (raisonnable pour le staging)

### T5.3 — Test de restauration réussi
**Action :** Exécuter le script de restauration test
```bash
ssh deploy@[VPS_HOST] "bash /infra/scripts/restore-test.sh"
```
**Attendu :**
- [ ] Script s'exécute sans erreur
- [ ] BDD de test créée, données restaurées
- [ ] `SELECT count(*) FROM sites` retourne un nombre cohérent
- [ ] BDD de test supprimée proprement
- [ ] Message "✅ Test de restauration réussi" affiché

### T5.4 — Rétention des backups (30 jours max)
**Action :** Vérifier que le script de nettoyage fonctionne
**Attendu (après 30+ jours de backups OU simulation) :**
- [ ] Pas plus de 30 fichiers dans le bucket S3
- [ ] Les fichiers les plus anciens sont supprimés automatiquement

### T5.5 — Alerte si backup échoue
**Action :** Simuler un échec de backup (couper l'accès S3 temporairement)
**Attendu :**
- [ ] Script se termine avec un code d'erreur non-zéro
- [ ] Notification d'échec envoyée (email ou webhook)
- [ ] Pas de fausse notification de succès

---

## BLOC 6 — Monitoring et alertes

### T6.1 — Alerte UptimeRobot reçue si site down
**Action :** Stopper temporairement l'app Coolify d'un site test
**Attendu :**
- [ ] Dans les 10 minutes : email d'alerte UptimeRobot reçu
- [ ] L'alerte mentionne le nom du monitor et l'URL
- [ ] SMS reçu si configuré

### T6.2 — Alerte résolue quand site de nouveau up
**Action :** Relancer l'app Coolify → attendre la prochaine vérification UptimeRobot
**Attendu :**
- [ ] Email de résolution reçu
- [ ] Statut UptimeRobot repasse à "Up"

### T6.3 — Logs structurés en production
**Action :** Déclencher une erreur contrôlée (ex: appel à une route inexistante)
**Vérification :** Consulter les logs (Betterstack ou console VPS)
**Attendu :**
- [ ] Logs en format JSON structuré (pas de logs texte bruts)
- [ ] Chaque log contient : `level`, `timestamp`, `message`
- [ ] Aucune donnée personnelle (email, téléphone) dans les logs
- [ ] Les erreurs 500 incluent le stack trace mais pas les données sensibles

### T6.4 — Dashboard BullMQ accessible aux SuperAdmins
**Action :** Se connecter avec le compte SuperAdmin → naviguer sur `/admin/queues`
**Attendu :**
- [ ] Dashboard BullMQ visible avec les queues actives
- [ ] Accès refusé pour les autres rôles (tester avec un compte client)
- [ ] Les jobs en cours sont visibles en temps réel

### T6.5 — Alerte interne si trop de jobs BullMQ en échec
**Action SQL :** Insérer artificiellement 60 jobs avec status 'failed' dans une queue
**Action :** Appeler `/health`
**Attendu :**
- [ ] `services.bullmq` = "down" dans la réponse /health
- [ ] HTTP 503 retourné

---

## BLOC 7 — Smoke Tests automatiques

### T7.1 — Smoke test après provisionnement
**Action :** Déclencher un provisionnement et observer les logs
**Attendu :**
- [ ] Les 7 checks du smoke test sont exécutés dans les logs
- [ ] Résultat de chaque check visible : `passed: true/false`
- [ ] Score SEO calculé et stocké dans `sites.seoScore`

### T7.2 — Smoke test bloque si score < 60
**Action :** Modifier temporairement un template pour produire une page sans H1 ni meta description
**Attendu :**
- [ ] Smoke test échoue sur les checks meta tags et structure HTML
- [ ] `sites.status` reste à 'setup' (pas de passage à 'staging')
- [ ] Alerte SuperAdmin envoyée avec les checks échoués
- [ ] Log clair : "Provisionnement bloqué — score SEO insuffisant (45/100)"

### T7.3 — Smoke test vérifie le SSR
**Action :** Vérifier que le check SSR détecte bien une page rendue côté serveur
```bash
curl https://[site-test].wapixia.com | grep "<h1"
```
**Attendu :**
- [ ] Le tag `<h1>` est présent dans le HTML retourné par curl (sans JavaScript)
- [ ] Le check SSR marque `passed: true`

### T7.4 — Smoke test robots.txt et sitemap
**Action :** Observer les logs de smoke test pour un site fraîchement déployé
**Attendu :**
- [ ] Check "robots.txt present" : passed ✅
- [ ] Check "sitemap.xml present" : passed ✅
- [ ] Le sitemap contient au moins l'URL de la page d'accueil

---

## BLOC 8 — Migration FTP/SFTP

### T8.1 — Test de connexion FTP
**Prérequis :** Compte FTP de test (ex: chez Hostinger ou OVH)
**Action :** `POST /api/v1/sites/[id]/test-ftp-connection`
```json
{
  "type": "ftp",
  "host": "[ftp-test-host]",
  "port": 21,
  "username": "[ftp-user]",
  "password": "[ftp-pass]",
  "remotePath": "/public_html"
}
```
**Attendu :**
- [ ] HTTP 200 avec `{ connected: true, serverInfo: "..." }`
- [ ] Si credentials invalides → HTTP 422 avec message d'erreur clair

### T8.2 — Migration déclenchée avec succès
**Action :** Déclencher la migration FTP pour un site de test
**Attendu :**
- [ ] Job BullMQ créé pour la migration
- [ ] Files du site copiées sur le serveur FTP de test
- [ ] `sites.hostingType` = 'client_ftp' en BDD
- [ ] L'app Coolify du site est supprimée (plus de facturation hosting)
- [ ] Email de confirmation de migration envoyé

### T8.3 — Credentials FTP chiffrés en BDD
**Action SQL :**
```sql
SELECT hosting_config FROM sites WHERE hosting_type = 'client_ftp';
```
**Attendu :**
- [ ] `hosting_config` contient des données chiffrées (pas le password en clair)
- [ ] La valeur n'est pas déchiffrable sans `ENCRYPTION_KEY`

---

## BLOC 9 — Sécurité & Robustesse

### T9.1 — Headers de sécurité sur tous les services
**Action :**
```bash
for url in https://api.wapixia.com/health https://app.wapixia.com https://admin.wapixia.com; do
  echo "=== $url ==="
  curl -sI $url | grep -iE "X-Content-Type|X-Frame|Strict-Transport|Content-Security"
done
```
**Attendu :**
- [ ] `X-Content-Type-Options: nosniff` présent sur tous
- [ ] `X-Frame-Options: DENY` présent sur tous
- [ ] `Strict-Transport-Security` avec `max-age` ≥ 31536000
- [ ] Aucun `X-Powered-By` exposé

### T9.2 — WAF Cloudflare bloque les attaques communes
**Action :** Tester quelques requêtes malveillantes
```bash
# SQL injection
curl "https://api.wapixia.com/api/v1/sites?id=1' OR '1'='1"
# XSS
curl "https://api.wapixia.com/api/v1/sites?name=<script>alert(1)</script>"
# Path traversal
curl "https://api.wapixia.com/../../../etc/passwd"
```
**Attendu :**
- [ ] Cloudflare WAF bloque les requêtes malveillantes (HTTP 403 ou 400)
- [ ] Aucune donnée sensible retournée

### T9.3 — Restart automatique des services via Coolify
**Action :** Killer manuellement le process API (`kill -9 [PID]`)
**Attendu :**
- [ ] Coolify redémarre le container automatiquement en < 30s
- [ ] UptimeRobot ne détecte pas de downtime (restart trop rapide)

### T9.4 — Pipeline ne deploy pas si tests échoués
**Action :** Introduire un test unitaire délibérément cassé → pusher
**Attendu :**
- [ ] Job `test` échoue
- [ ] Les jobs `build` et `deploy-*` ne s'exécutent PAS
- [ ] La PR ne peut pas être mergée avec des checks en échec

### T9.5 — Secrets non dans les logs CI/CD
**Action :** Vérifier les logs publics du pipeline GitHub Actions
**Attendu :**
- [ ] Aucun token, clé API ou mot de passe visible
- [ ] Les variables `${{ secrets.* }}` apparaissent comme `***` dans les logs

---

## Récapitulatif — Critères de validation du Sprint 6

| Bloc | Tests | Requis |
|---|---|---|
| Bloc 1 — CI/CD | T1.1 → T1.5 | 5/5 ✅ |
| Bloc 2 — Provisionnement | T2.1 → T2.7 | 6/7 min ✅ |
| Bloc 3 — Domaines | T3.1 → T3.5 | 4/5 min ✅ |
| Bloc 4 — Health Checks | T4.1 → T4.5 | 5/5 ✅ |
| Bloc 5 — Backups | T5.1 → T5.5 | 5/5 ✅ |
| Bloc 6 — Monitoring | T6.1 → T6.5 | 4/5 min ✅ |
| Bloc 7 — Smoke Tests | T7.1 → T7.4 | 4/4 ✅ |
| Bloc 8 — Migration FTP | T8.1 → T8.3 | 2/3 min ✅ |
| Bloc 9 — Sécurité | T9.1 → T9.5 | 5/5 ✅ |

**Total minimum pour Go Sprint 7 : 40/44 tests passés**

Blocs 1 (CI/CD), 4 (Health), 5 (Backups) et 9 (Sécurité) sont **non négociables** — 100% requis.
T2.1 (délai < 12 min) est critique — si le provisionnement prend > 15 min, optimiser avant de continuer.

---

## Template rapport Sprint 6

```
## Rapport Sprint 6 — [Date]
**Testeur :** Salim | **Env :** staging + production

### Métriques clés
| Métrique | Valeur mesurée | Cible |
|---|---|---|
| Durée provisionnement site | | < 12 min |
| Durée pipeline CI/CD staging | | < 8 min |
| Temps réponse /health | | < 500ms |
| Taille backup quotidien | | < 500 Mo |
| Durée restore test | | < 5 min |

### Résultats tests
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — CI/CD | /5 | | |
| Bloc 2 — Provisionnement | /7 | | |
| Bloc 3 — Domaines | /5 | | |
| Bloc 4 — Health Checks | /5 | | |
| Bloc 5 — Backups | /5 | | |
| Bloc 6 — Monitoring | /5 | | |
| Bloc 7 — Smoke Tests | /4 | | |
| Bloc 8 — Migration FTP | /3 | | |
| Bloc 9 — Sécurité | /5 | | |
| **TOTAL** | /44 | | |

### Sites provisionnés pendant le sprint
| Site | Secteur | Délai provision | Score SEO | SSL |
|---|---|---|---|---|
| [nom] | | min | /100 | ✅/⏳ |

### État des services en production
| Service | Statut | Uptime % | Dernier incident |
|---|---|---|---|
| api.wapixia.com | | | |
| app.wapixia.com | | | |
| admin.wapixia.com | | | |

### Bugs identifiés
| ID | Description | Sévérité |
|---|---|---|
| BUG-S6-001 | | |

### Décision
[ ] ✅ GO Sprint 7 — Pilotes & Go-Live
[ ] ❌ STOP — bugs critiques
```
