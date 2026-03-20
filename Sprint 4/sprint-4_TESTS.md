# SPRINT 4 — TESTS.md
# Dashboard Client & Rapport ROI — Scénarios de test
> À exécuter par Salim sur l'environnement staging
> Prérequis : Sprint 3 validé (43/46 ✅), modules IA actifs sur au moins 1 site
> ✅ Passé | ❌ Échoué | ⏭️ Bloqué

---

## Données de test à préparer avant de démarrer

```sql
-- Injecter des données de test en BDD pour avoir un dashboard non vide

-- 1. Leads de test
INSERT INTO leads (site_id, type, first_name, email, phone, message, estimated_value, status)
SELECT
  '[SITE_ID_SONIA]',
  (ARRAY['contact_form','quote_request','appointment','phone_call'])[floor(random()*4+1)::int],
  (ARRAY['Jean','Marie','Pierre','Sophie','Marc'])[floor(random()*5+1)::int],
  'test' || generate_series || '@test.be',
  '+32 69 00 00 ' || lpad(generate_series::text, 2, '0'),
  'Message de test numéro ' || generate_series,
  (random() * 2000 + 100)::decimal(10,2),
  (ARRAY['new','contacted','qualified','won'])[floor(random()*4+1)::int]
FROM generate_series(1, 15);

-- 2. Stats mensuelles de test (3 mois glissants)
INSERT INTO monthly_stats (site_id, period_year, period_month,
  total_visits, unique_visitors, organic_visits, google_impressions,
  google_clicks, average_position, total_leads, blog_articles_published,
  social_posts_published, gmb_posts_published, reviews_replied,
  reviews_received, average_rating, visibility_score)
VALUES
  ('[SITE_ID_SONIA]', 2026, 1, 420, 310, 180, 2800, 85, 12.4, 8, 2, 10, 3, 5, 6, 4.3, 52),
  ('[SITE_ID_SONIA]', 2026, 2, 510, 380, 230, 3400, 112, 10.1, 11, 3, 12, 4, 7, 8, 4.5, 61),
  ('[SITE_ID_SONIA]', 2026, 3, 580, 430, 270, 4100, 135, 8.7, 14, 4, 14, 5, 9, 10, 4.6, 71);

-- 3. Concurrents de test
INSERT INTO competitors (site_id, name, website_url, distance_km, gmb_rating, gmb_review_count)
VALUES
  ('[SITE_ID_SONIA]', 'Salon Prestige', 'https://salonprestige.be', 0.8, 4.2, 34),
  ('[SITE_ID_SONIA]', 'Coiffure Tendance', null, 1.4, 3.9, 18),
  ('[SITE_ID_SONIA]', 'Hair Studio Dupont', 'https://hairstudio.be', 2.1, 4.7, 67);
```

---

## BLOC 1 — Migrations BDD

### T1.1 — Tables créées correctement
**Action :** Supabase Studio → vérifier les 4 nouvelles tables
**Attendu :**
- [ ] Table `leads` avec 15 lignes de test insérées
- [ ] Table `monthly_stats` avec 3 lignes de test (janvier, février, mars 2026)
- [ ] Table `competitors` avec 3 lignes de test
- [ ] Table `reports` vide (pas encore de rapport généré)
- [ ] Contrainte UNIQUE sur monthly_stats (site_id, year, month) active

### T1.2 — RLS leads — isolation tenant
**Action SQL (simuler client org 003 — Salon Sonia) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"[org_sonia]","role":"client_admin"}';
SELECT count(*) FROM leads;
```
**Attendu :**
- [ ] Count = 15 (les leads du site Salon Sonia uniquement)
- [ ] 0 lead des autres tenants visible

### T1.3 — RLS monthly_stats — isolation tenant
**Action SQL (simuler client org 004 — Dupont BTP) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"[org_btp]","role":"client_admin"}';
SELECT * FROM monthly_stats;
```
**Attendu :**
- [ ] 0 résultat (les stats de Salon Sonia sont invisibles)

### T1.4 — Contrainte UNIQUE monthly_stats
**Action SQL :**
```sql
INSERT INTO monthly_stats (site_id, period_year, period_month, total_visits)
VALUES ('[SITE_ID_SONIA]', 2026, 3, 999);  -- mars 2026 déjà existant
```
**Attendu :**
- [ ] Erreur : `duplicate key value violates unique constraint`

---

## BLOC 2 — Visibility Score

### T2.1 — Score calculé correctement
**Action :** `GET /api/v1/sites/[SITE_ID_SONIA]/visibility-score`
**Attendu :**
- [ ] HTTP 200
- [ ] `data.score` entre 0 et 100
- [ ] `data.breakdown` contient 5 piliers : seo, reputation, activity, traffic, local
- [ ] Somme des `score` des piliers = `data.score` (±1 arrondi)
- [ ] `data.breakdown.seo.max` = 30
- [ ] `data.breakdown.reputation.max` = 25
- [ ] `data.breakdown.activity.max` = 25
- [ ] `data.breakdown.traffic.max` = 15
- [ ] `data.breakdown.local.max` = 5

### T2.2 — Score cohérent avec les données de test
**Action :** Comparer le score calculé avec les données de mars 2026 injectées en T0
**Attendu :**
- [ ] Le score est proche de 71 (valeur injectée en mars) ± 5 points
- [ ] Si les modules sont actifs → le pilier Activité est > 15

### T2.3 — Score 0 pour un site vide
**Action :** Créer un site minimal sans modules ni données, calculer son score
**Attendu :**
- [ ] Score entre 10 et 20 (points de base pour site déployé + présence locale)
- [ ] Pilier SEO ≥ 10 (points de base même sans GSC)
- [ ] Pilier Traffic = 2 (base sans GA4 connecté)

### T2.4 — Score mis à jour dans sites.visibility_score
**Action SQL après appel à l'API :**
```sql
SELECT visibility_score FROM sites WHERE id = '[SITE_ID_SONIA]';
```
**Attendu :**
- [ ] La valeur correspond au score retourné par l'API (pas NULL, pas 0 si des données existent)

### T2.5 — Décomposition affichée dans le dashboard
**Action :** Naviguer sur `/overview` → section Visibility Score
**Attendu :**
- [ ] Gauge animée visible avec le score (0-100)
- [ ] 5 barres de piliers visibles avec labels et valeurs
- [ ] Les couleurs des barres indiquent le niveau (vert ≥ 70%, orange 40-70%, rouge < 40%)

---

## BLOC 3 — Import Analytics (GA4 + GSC)

### T3.1 — Import GA4 avec connexion valide
**Prérequis :** Google Analytics connecté sur le site de test
**Action :** `POST /api/v1/sites/[id]/reports/generate` avec `{ forceImport: true }`
**Attendu :**
- [ ] HTTP 202 (job créé)
- [ ] Dans les 5 minutes : `monthly_stats.total_visits` mis à jour avec de vraies données GA4
- [ ] `monthly_stats.organic_visits` > 0 si du trafic organique existe
- [ ] `monthly_stats.avg_session_duration` > 0

### T3.2 — Import GSC avec connexion valide
**Prérequis :** Google Search Console connecté
**Attendu (même job que T3.1) :**
- [ ] `monthly_stats.google_impressions` > 0
- [ ] `monthly_stats.google_clicks` ≥ 0
- [ ] `monthly_stats.average_position` entre 1 et 100
- [ ] `monthly_stats.top_queries` array non vide avec au moins 1 requête

### T3.3 — Dashboard sans GA4 connecté — pas d'erreur
**Action :** Créer un site de test sans Google connecté, naviguer sur `/overview`
**Attendu :**
- [ ] La page se charge sans erreur
- [ ] Les KPIs trafic affichent "–" ou "Non connecté" (pas d'erreur 500)
- [ ] Message "Connectez Google Analytics pour voir vos statistiques" affiché
- [ ] Le Visibility Score s'affiche quand même (sans le pilier trafic)

### T3.4 — Données du mois courant uniquement
**Action :** Vérifier que l'import GA4 ne récupère que le mois courant
**Attendu :**
- [ ] `monthly_stats.period_month` = mois courant
- [ ] `monthly_stats.period_year` = année courante
- [ ] Pas de contamination avec les données d'autres mois

---

## BLOC 4 — Dashboard UI

### T4.1 — Chargement initial du dashboard
**Action :** Se connecter avec client@test.wapixia.com → naviguer sur `/overview`
**Attendu :**
- [ ] Page chargée en < 2s
- [ ] État "chargement" visible brièvement (skeleton loaders)
- [ ] Aucune erreur dans la console navigateur

### T4.2 — KPIs affichés correctement
**Action :** Observer les 4 KPIs principaux
**Attendu :**
- [ ] "Visites ce mois" = valeur cohérente avec monthly_stats
- [ ] "Leads générés" = nombre de leads du mois
- [ ] "Note Google" = note moyenne des avis
- [ ] "Position Google" = position moyenne GSC (ou "–" si non connecté)
- [ ] Chaque KPI a un delta vs mois précédent (ex: "↑ +12%")

### T4.3 — Deltas calculés correctement
**Vérification manuelle avec les données de test :**
- [ ] Visites : 580 (mars) vs 510 (fév) → delta = +13.7% → affiche "↑ +14%"
- [ ] Leads : 14 vs 11 → delta = +27% → affiche "↑ +27%"
- [ ] Visibility Score : 71 vs 61 → delta = +10pts → affiche "↑ +10"

### T4.4 — Graphique trafic 30 jours
**Action :** Observer le graphique de trafic
**Attendu :**
- [ ] Graphique recharts visible (LineChart ou AreaChart)
- [ ] Axe X : dates sur 30 jours
- [ ] Axe Y : nombre de visites
- [ ] Tooltip au hover avec les valeurs
- [ ] Si pas de données GA4 → message "Connectez Google Analytics" à la place du graphique

### T4.5 — Section contenus publiés
**Action :** Observer la section "Ce mois" dans le dashboard
**Attendu :**
- [ ] Compteurs visibles : posts FB, posts IG, posts GMB, articles
- [ ] Valeurs cohérentes avec les contenus status='published' en BDD
- [ ] Lien vers /content cliquable sur chaque compteur

### T4.6 — Section leads récents
**Action :** Observer la liste des leads récents
**Attendu :**
- [ ] 5 derniers leads affichés (les plus récents)
- [ ] Chaque lead : type + prénom + date + statut
- [ ] Badge de couleur par statut (new=gris, won=vert, lost=rouge)
- [ ] Clic sur un lead → modal ou page détail du lead

### T4.7 — Badge "Contenus en attente"
**Action :** S'assurer qu'il y a des contenus en status='pending_validation'
**Attendu :**
- [ ] Badge rouge visible avec le nombre de contenus en attente
- [ ] Badge cliquable → redirect vers /content?status=pending_validation
- [ ] Disparaît si 0 contenus en attente

### T4.8 — Page analytics — graphiques
**Action :** Naviguer sur `/analytics`
**Attendu :**
- [ ] Sélecteur de période fonctionnel ([Ce mois] [3 mois] [6 mois] [12 mois])
- [ ] BarChart trafic par canal visible (organique, direct, social...)
- [ ] LineChart Visibility Score historique sur 12 mois (avec les 3 mois de données test)
- [ ] Section SEO : impressions, clics, position, top 10 requêtes
- [ ] Bouton "Export CSV leads" fonctionnel (fichier téléchargeable)

### T4.9 — Export CSV leads
**Action :** `/analytics` → cliquer "Export CSV"
**Attendu :**
- [ ] Fichier `leads-[sitename]-[date].csv` téléchargé
- [ ] Le CSV contient : date, type, prénom, email, téléphone, statut, valeur estimée
- [ ] Les données personnelles ne sont pas exposées publiquement (auth requise pour télécharger)

### T4.10 — Comparatif concurrents
**Action :** Observer la section concurrents dans `/analytics` ou `/overview`
**Attendu :**
- [ ] 3 concurrents de test visibles (nom, distance, note GMB, nb avis)
- [ ] Classement clair : Salon Sonia vs ses concurrents
- [ ] Si pas de concurrents détectés → message "Analyse en cours"

---

## BLOC 5 — Génération rapport PDF

### T5.1 — Génération manuelle du rapport
**Action :** Dashboard → `/reports` → bouton "Générer maintenant"
**OU via API :** `POST /api/v1/sites/[id]/reports/generate`
**Attendu :**
- [ ] HTTP 202 (job créé)
- [ ] Job visible dans BullMQ dashboard (queue reports:monthly)
- [ ] Dans les 3 minutes : URL PDF disponible dans la réponse API

### T5.2 — PDF accessible et valide
**Action :** Télécharger le PDF généré
**Attendu :**
- [ ] Fichier PDF téléchargeable (pas 404)
- [ ] PDF s'ouvre correctement dans un lecteur
- [ ] Taille < 2 Mo
- [ ] Exactement 4 pages

### T5.3 — Contenu du rapport — Page 1 (Résumé)
**Action :** Ouvrir le PDF, vérifier la page 1
**Attendu :**
- [ ] Nom du site visible en haut
- [ ] Période correcte (mois précédent)
- [ ] Gauge Visibility Score visible avec le bon score
- [ ] Décomposition 5 piliers lisible
- [ ] 4 KPIs : visites, leads, avis, position Google
- [ ] Delta vs mois précédent visible pour chaque KPI

### T5.4 — Contenu du rapport — Page 2 (Trafic & SEO)
**Action :** Vérifier la page 2
**Attendu :**
- [ ] Graphique/tableau du trafic par canal
- [ ] Données GSC : impressions, clics, position
- [ ] Top 5 requêtes Google listées
- [ ] Si pas de données GA4 → section "Données non disponibles — connectez Google Analytics"

### T5.5 — Contenu du rapport — Page 3 (Contenu & Réputation)
**Action :** Vérifier la page 3
**Attendu :**
- [ ] Compteurs de contenus publiés (posts RS, GMB, articles)
- [ ] Section avis : note moyenne, reçus, répondus
- [ ] Top 3 contenus les plus performants listés

### T5.6 — Contenu du rapport — Page 4 (Concurrents & Recommandations)
**Action :** Vérifier la page 4
**Attendu :**
- [ ] Top 3 concurrents avec distance, note, nb avis
- [ ] 3 recommandations IA lisibles et pertinentes
- [ ] Chaque recommandation avec niveau de priorité (Haute/Moyenne/Faible)
- [ ] Les recommandations sont spécifiques au site (pas génériques)
- [ ] Footer avec date de génération

### T5.7 — Recommandations IA cohérentes avec les données
**Vérification manuelle :**
- [ ] Si pilier Réputation < 15/25 → au moins 1 recommandation sur les avis
- [ ] Si pilier Activité < 15/25 → au moins 1 recommandation sur les contenus
- [ ] Si GA4 non connecté → recommandation "Connectez Google Analytics"
- [ ] Les recommandations ne se répètent pas

### T5.8 — PDF généré en moins de 3 minutes
**Action :** Mesurer le temps entre le déclenchement du job et la disponibilité du PDF
**Attendu :**
- [ ] PDF disponible en < 3 minutes
- [ ] Idéalement < 90 secondes

---

## BLOC 6 — Envoi email rapport mensuel

### T6.1 — Email reçu après génération
**Action :** Déclencher la génération du rapport → vérifier la boîte email du client
**Attendu :**
- [ ] Email reçu avec sujet contenant le mois et le nom du site
- [ ] Email contient le Visibility Score en évidence
- [ ] Bouton "Télécharger mon rapport PDF" présent et lien valide
- [ ] Bouton "Voir mon dashboard" présent avec le bon lien
- [ ] Email non catégorisé comme spam

### T6.2 — Statut email mis à jour en BDD
**Action SQL après réception de l'email :**
```sql
SELECT email_sent, email_sent_at FROM reports
WHERE site_id = '[SITE_ID_SONIA]'
ORDER BY created_at DESC LIMIT 1;
```
**Attendu :**
- [ ] `email_sent` = true
- [ ] `email_sent_at` = date/heure de l'envoi (précision à la minute)

### T6.3 — Pas de double envoi
**Action :** Déclencher 2x le job de rapport pour le même site et le même mois
**Attendu :**
- [ ] Le PDF n'est généré qu'une seule fois (UNIQUE constraint sur reports)
- [ ] L'email n'est envoyé qu'une seule fois (vérifier `email_sent = true` avant d'envoyer)
- [ ] Le second job se termine avec message "Rapport déjà généré pour cette période"

### T6.4 — Historique des rapports dans le backoffice
**Action :** Dashboard → `/reports`
**Attendu :**
- [ ] Liste des rapports générés visible
- [ ] Chaque ligne : mois, Visibility Score, statut email (envoyé/non), bouton télécharger
- [ ] Les rapports sont triés par date décroissante (le plus récent en haut)
- [ ] Bouton "Télécharger" ouvre le PDF dans un nouvel onglet

---

## BLOC 7 — Scheduler rapport mensuel

### T7.1 — Scheduler configuré au 1er du mois
**Action :** Vérifier les logs de démarrage du serveur
**Attendu :**
- [ ] Message dans les logs : "Monthly report scheduler registered — runs on 1st of each month at 6:00"
- [ ] Pas d'erreur d'initialisation cron

### T7.2 — Rapport déclenché automatiquement (test manuel du cron)
**Action :** En staging, modifier temporairement le cron pour s'exécuter toutes les 5 minutes (`*/5 * * * *`), redémarrer, attendre
**Attendu :**
- [ ] Jobs créés dans BullMQ pour chaque site actif
- [ ] Les jobs sont étales avec des délais aléatoires (pas tous en même temps)

### T7.3 — Étalement des jobs (anti-surcharge)
**Action :** Vérifier les logs BullMQ après un déclenchement automatique avec 3+ sites
**Attendu :**
- [ ] Les 3 jobs ont des `delay` différents (0 à 3600s)
- [ ] Pas de 3 jobs qui s'exécutent simultanément dans la première minute

---

## BLOC 8 — Performance et cache

### T8.1 — Endpoint dashboard mis en cache
**Action :** Appeler `GET /api/v1/sites/[id]/dashboard` 3 fois de suite rapidement
**Attendu :**
- [ ] 1ère requête : ~500ms (calcul + mise en cache)
- [ ] 2ème et 3ème requêtes : < 50ms (réponse depuis Redis)
- [ ] En-tête `X-Cache: HIT` ou équivalent sur les requêtes en cache

### T8.2 — Invalidation cache après nouveau lead
**Action :** Créer un nouveau lead en BDD via l'API → rappeler `/dashboard`
**Attendu :**
- [ ] Le compteur leads dans le dashboard reflète le nouveau lead
- [ ] Le cache a été invalidé (pas d'info stale)

### T8.3 — Chargement des graphiques < 2s
**Action :** Naviguer sur `/analytics` et mesurer le temps de chargement total
**Attendu :**
- [ ] Page complètement rendue (tous les graphiques visibles) < 2s
- [ ] Pas de "flash" vide pendant le chargement (skeleton loaders corrects)

### T8.4 — Dashboard accessible sans données GA4
**Action :** Tester le dashboard avec un site créé aujourd'hui (aucune donnée historique)
**Attendu :**
- [ ] Page chargée sans erreur
- [ ] Graphiques vides avec message "Pas encore de données"
- [ ] KPIs affichent "0" ou "–" selon le contexte
- [ ] Visibility Score calculé uniquement sur les données disponibles

---

## BLOC 9 — Sécurité & Edge Cases

### T9.1 — Client ne voit pas les rapports des autres clients
**Action :** Avec le token du client Salon Sonia, appeler :
`GET /api/v1/sites/[SITE_ID_DUPONT]/reports`
**Attendu :**
- [ ] HTTP 403 FORBIDDEN ou HTTP 200 avec array vide

### T9.2 — PDF non accessible sans auth
**Action :** Copier l'URL d'un PDF Cloudflare R2 et l'ouvrir en navigation privée (sans cookie)
**Attendu :**
- [ ] L'URL R2 est signée (avec expiration) OU
- [ ] Le PDF nécessite un token d'accès validé par le backend
- [ ] Un visiteur anonyme ne peut pas télécharger le rapport d'un client

### T9.3 — Rapport avec zéro données — pas de crash
**Action :** Générer un rapport pour un site qui n'a aucune donnée (leads = 0, modules = 0, pas de GA4)
**Attendu :**
- [ ] PDF généré sans erreur (pas de crash)
- [ ] PDF contient un message "Votre présence digitale se met en place — plus de données disponibles le mois prochain"
- [ ] Le Visibility Score est à sa valeur minimale (10-20 points de base)

### T9.4 — Injection dans le nom du site
**Action :** Créer un site avec le nom `<script>alert('xss')</script>` → générer le rapport
**Attendu :**
- [ ] Le PDF contient le texte brut (échappé) sans exécuter de script
- [ ] L'email ne contient pas de contenu injecté

### T9.5 — Concurrence — deux générations simultanées
**Action :** Déclencher 2 jobs de rapport en parallèle pour le même site/mois
**Attendu :**
- [ ] Un seul PDF généré (le deuxième job détecte le conflit UNIQUE et s'arrête proprement)
- [ ] Un seul email envoyé

---

## Récapitulatif — Critères de validation du Sprint 4

| Bloc | Tests | Requis |
|---|---|---|
| Bloc 1 — BDD | T1.1 → T1.4 | 4/4 ✅ |
| Bloc 2 — Visibility Score | T2.1 → T2.5 | 5/5 ✅ |
| Bloc 3 — Import Analytics | T3.1 → T3.4 | 3/4 min ✅ |
| Bloc 4 — Dashboard UI | T4.1 → T4.10 | 9/10 min ✅ |
| Bloc 5 — PDF Rapport | T5.1 → T5.8 | 7/8 min ✅ |
| Bloc 6 — Email | T6.1 → T6.4 | 4/4 ✅ |
| Bloc 7 — Scheduler | T7.1 → T7.3 | 2/3 min ✅ |
| Bloc 8 — Performance | T8.1 → T8.4 | 3/4 min ✅ |
| Bloc 9 — Sécurité | T9.1 → T9.5 | 5/5 ✅ |

**Total minimum pour Go Sprint 5 : 42/46 tests passés**

Blocs 1, 2, 6 et 9 sont **non négociables** — 100% requis.
T3.1 et T3.2 peuvent être marqués ⏭️ si Google n'est pas connecté en staging (acceptable).

---

## Template rapport Sprint 4

```
## Rapport Sprint 4 — [Date]
**Testeur :** Salim
**Environnement :** staging.wapixia.com

### Résultats tests
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — BDD | | | |
| Bloc 2 — Visibility Score | | | |
| Bloc 3 — Analytics | | | |
| Bloc 4 — Dashboard UI | | | |
| Bloc 5 — PDF Rapport | | | |
| Bloc 6 — Email | | | |
| Bloc 7 — Scheduler | | | |
| Bloc 8 — Performance | | | |
| Bloc 9 — Sécurité | | | |
| **TOTAL** | /46 | | |

### Métriques dashboard
| Site | Visibility Score calculé | Temps génération PDF | Taille PDF |
|---|---|---|---|
| Salon Sonia | | | |

### Qualité du rapport PDF
[ ] Page 1 : résumé lisible et complet
[ ] Page 2 : trafic et SEO corrects
[ ] Page 3 : contenu et réputation corrects
[ ] Page 4 : recommandations pertinentes et spécifiques
[ ] Mise en page professionnelle (pas de bug d'affichage)
[ ] Toutes les données cohérentes avec la BDD

### Performance dashboard
| Métrique | Valeur mesurée | Cible |
|---|---|---|
| Chargement /overview | | < 2s |
| Cache Redis hit rate | | > 80% |
| Temps génération PDF | | < 3min |
| Taille PDF | | < 2 Mo |

### Bugs identifiés
| ID | Description | Sévérité | Bloc | Test |
|---|---|---|---|---|
| BUG-S4-001 | | | | |

### Décision
[ ] ✅ GO Sprint 5 — Paiements & Abonnements
[ ] ❌ STOP — bugs critiques à corriger

### Observations
[Notes libres : UX dashboard, pertinence des recommandations IA, qualité visuelle du PDF]
```
