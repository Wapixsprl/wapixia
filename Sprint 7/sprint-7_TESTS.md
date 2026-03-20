# SPRINT 7 — TESTS.md
# Pilotes & Go-Live — Scénarios de validation
> À exécuter par Salim en conditions réelles sur les 3 sites pilotes
> Durée estimée : 2-3h pour les 3 pilotes combinés
> ✅ Passé | ❌ Échoué | ⏭️ Non applicable (noter la raison)

---

## Rappel : critères Go-Live absolus

Avant d'annoncer le go-live à un pilote, ces 5 points doivent être verts :

```
1. Le site charge en < 3s sur mobile 4G (PageSpeed > 80)
2. 0 bug critique ou majeur sur ce site
3. Le SSL est actif (cadenas vert)
4. Le formulaire de contact fonctionne (email reçu)
5. Le Visibility Score est calculé (même si faible — c'est normal au démarrage)
```

---

## BLOC 1 — Onboarding (commun aux 3 pilotes)

### T1.1 — Invitation dashboard envoyée et reçue
**Action :** Envoyer l'invitation → vérifier l'email du client
**Attendu (pour chaque pilote) :**
- [ ] Email reçu avec sujet "Bienvenue sur WapixIA"
- [ ] Lien d'activation valide (cliquable)
- [ ] Après activation : connexion au dashboard réussie

### T1.2 — Questionnaire complété sans erreur
**Action :** Compléter les 20 étapes en live
**Attendu :**
- [ ] Toutes les étapes obligatoires remplies sans erreur de validation
- [ ] Sauvegarde automatique fonctionnelle (vérifier si on recharge la page)
- [ ] Étape 20 affiche le récapitulatif correct

### T1.3 — Génération déclenchée et terminée
**Action :** Cliquer "Créer mon site" → observer la page d'attente
**Attendu :**
- [ ] Page d'attente s'affiche immédiatement
- [ ] Progression visible (étapes animées)
- [ ] Site accessible sur `https://[slug].wapixia.com` dans les 12 minutes
- [ ] Email "Votre site est prêt" reçu

### T1.4 — Données onboarding correctement stockées
**Action SQL :**
```sql
SELECT
  name, sector, slug, temp_domain, status, seo_score,
  onboarding_done, launched_at
FROM sites
WHERE slug = '[slug_pilote]';
```
**Attendu :**
- [ ] `onboarding_done` = true
- [ ] `status` = 'staging'
- [ ] `temp_domain` = `[slug].wapixia.com`
- [ ] `launched_at` non null
- [ ] `seo_score` entre 70 et 100

---

## BLOC 2 — Qualité du contenu généré

### T2.1 — Contenu page d'accueil — pertinence sectorielle
**Action :** Lire la page d'accueil générée pour chaque pilote
**Attendu (vérification manuelle) :**
- [ ] Le H1 mentionne le secteur ET la ville
- [ ] Le H1 est accrocheur et fidèle à l'activité (pas générique)
- [ ] La subheadline reflète l'USP fournie à l'étape 8
- [ ] Les services listés correspondent aux services déclarés
- [ ] Le ton correspond au choix de l'étape 17 (friendly/pro/expert...)
- [ ] Pas de faute d'orthographe flagrante dans les 3 premières sections

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T2.2 — Page services — profondeur du contenu
**Action :** Lire la page services
**Attendu :**
- [ ] Chaque service a une description d'au moins 80 mots
- [ ] Les titres H2 de services sont en format question
- [ ] Chaque service a 2 questions FAQ associées
- [ ] Le vocabulaire est spécifique au secteur (pas de termes génériques)

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T2.3 — FAQ — qualité AEO
**Action :** Lire la page FAQ
**Attendu :**
- [ ] 12 à 15 questions présentes
- [ ] Les questions correspondent à ce que les clients recherchent vraiment
- [ ] Chaque réponse est autonome (compréhensible sans contexte)
- [ ] La ville est mentionnée dans au moins 5 questions
- [ ] Schema.org FAQPage présent dans le code source (vérifier avec View Source)

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T2.4 — Note de satisfaction du client sur le contenu
**Action :** Demander au client pendant l'appel J+1 : "Sur 10, à quel point le contenu vous ressemble ?"
**Attendu :**
- [ ] Note ≥ 7/10

| Pilote | Note /10 | Commentaire principal |
|---|---|---|
| A | | |
| B | | |
| C | | |

---

## BLOC 3 — SEO & Performance technique

### T3.1 — Score PageSpeed Insights
**Action :** Tester chaque site sur https://pagespeed.web.dev
**Attendu :**
- [ ] Score mobile > 80
- [ ] Score desktop > 90
- [ ] LCP < 2.5s (mobile)
- [ ] CLS < 0.1

| Site | Score mobile | Score desktop | LCP | CLS |
|---|---|---|---|---|
| Pilote A | | | | |
| Pilote B | | | | |
| Pilote C | | | | |

### T3.2 — Vérification robots.txt
**Action :** `curl https://[site]/robots.txt`
**Attendu (même test pour les 3 sites) :**
- [ ] `User-agent: GPTBot` + `Allow: /` présent
- [ ] `User-agent: ClaudeBot` + `Allow: /` présent
- [ ] `User-agent: PerplexityBot` + `Allow: /` présent
- [ ] `User-agent: Claude-SearchBot` + `Allow: /` présent
- [ ] `Sitemap:` ligne présente
- [ ] Pas de `Disallow: /` global

### T3.3 — Validation Schema.org (Google Rich Results)
**Action :** Tester via https://search.google.com/test/rich-results
**Attendu :**
- [ ] Schema LocalBusiness valide (0 erreur)
- [ ] Schema FAQPage valide
- [ ] Aucune erreur critique (warnings acceptables)

| Pilote | LocalBusiness | FAQPage | Erreurs |
|---|---|---|---|
| A | ✅/❌ | ✅/❌ | |
| B | ✅/❌ | ✅/❌ | |
| C | ✅/❌ | ✅/❌ | |

### T3.4 — Sitemap soumis à Google Search Console
**Action :** Google Search Console → Sitemaps → vérifier la soumission
**Attendu :**
- [ ] Sitemap soumis automatiquement après déploiement
- [ ] Statut "Succès" dans GSC

**Note :** Si la GSC n'est pas encore connectée → soumettre manuellement dans les 24h.

### T3.5 — Site crawlable sans JavaScript
**Action :** `curl https://[site_pilote_A]` (sans JS) | grep -c "<h2"
**Attendu :**
- [ ] Résultat > 0 (des H2 présents dans le HTML statique)
- [ ] Le H1 visible dans le HTML (`grep "<h1"`)
- [ ] Les premiers 100 mots de contenu présents dans le HTML

---

## BLOC 4 — Modules IA — Premiers contenus

### T4.1 — Premiers posts RS générés
**Prérequis :** Module social_posts activé + Facebook connecté
**Action :** Déclencher manuellement la génération (bouton dans le dashboard)
**Attendu :**
- [ ] Au moins 2 contenus générés (1 Facebook + 1 Instagram si connecté)
- [ ] Contenus visibles dans `/content` → onglet "En attente"
- [ ] Les contenus mentionnent le secteur et la ville du client
- [ ] Les images Unsplash sont cohérentes avec le secteur

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T4.2 — Sync avis GMB
**Prérequis :** GMB connecté, fiche avec des avis existants
**Action :** `POST /api/v1/sites/[id]/reviews/sync`
**Attendu :**
- [ ] Avis importés depuis GMB dans `google_reviews`
- [ ] Au moins 1 réponse IA générée si avis avec commentaire
- [ ] Si avis 1-2 étoiles → alerte email reçue

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T4.3 — Premier post GMB généré
**Prérequis :** Module gmb_reviews activé
**Action :** Déclencher manuellement
**Attendu :**
- [ ] Post GMB généré (type "update" ou "offer")
- [ ] Contenu entre 150 et 300 mots
- [ ] Titre ≤ 58 caractères
- [ ] Image Unsplash associée

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T4.4 — Premier article blog généré
**Prérequis :** Module blog_seo activé
**Action :** Déclencher manuellement la génération d'article
**Attendu :**
- [ ] Article généré avec ≥ 1200 mots
- [ ] Schema FAQ présent dans les metadata
- [ ] Introduction TLDR-first lisible
- [ ] Au moins 4 H2 en format question
- [ ] Mots-clés sectoriels présents naturellement

**Pilote A :** ☐  **Pilote B :** ☐  **Pilote C :** ☐

### T4.5 — Interface de validation — fluide pour le client
**Action :** Connecté comme le client pilote → ouvrir `/content` → valider un post
**Attendu :**
- [ ] Le client peut valider un post en 3 clics maximum
- [ ] L'aperçu "façon Facebook" est compréhensible pour un non-technique
- [ ] Après validation → le post disparaît de "En attente"
- [ ] Pas d'erreur 500 pendant le workflow de validation

---

## BLOC 5 — Dashboard et rapport

### T5.1 — Visibility Score affiché
**Action :** Dashboard pilote A → `/overview`
**Attendu :**
- [ ] Score visible (même 10-25 au démarrage — normal)
- [ ] Décomposition des 5 piliers affichée
- [ ] Aucune erreur 500 ou NaN dans l'interface

### T5.2 — Rapport PDF généré manuellement
**Action :** `/reports` → "Générer maintenant"
**Attendu :**
- [ ] PDF généré en < 3 minutes
- [ ] PDF téléchargeable et lisible
- [ ] Page 4 contient des recommandations pertinentes pour ce client

**Contenu minimal requis dans le rapport :**
- [ ] Nom du site correct
- [ ] Mois correct
- [ ] Visibility Score visible
- [ ] Section "Recommandations" avec 3 actions concrètes

### T5.3 — Email rapport reçu
**Action :** Déclencher l'envoi du rapport
**Attendu :**
- [ ] Email reçu sur l'adresse du client pilote
- [ ] Objet contient le mois et le nom du site
- [ ] Lien "Télécharger mon rapport PDF" fonctionnel
- [ ] L'email n'est pas en spam

---

## BLOC 6 — Paiements (validation légère — mode test acceptable)

### T6.1 — Abonnement créé après période d'essai
**Note :** Les pilotes bénéficient de 3 mois gratuits. Ce test valide le flow sans paiement réel.
**Action :** Vérifier que l'abonnement "trialing" est bien en BDD
**Attendu :**
```sql
SELECT status, trial_end, current_period_end
FROM subscriptions
WHERE site_id = '[SITE_PILOTE_A]';
```
- [ ] `status` = 'trialing'
- [ ] `trial_end` = NOW() + 90 jours (3 mois offerts)

### T6.2 — Page billing accessible au client
**Action :** Client connecté → `/billing`
**Attendu :**
- [ ] Page charge sans erreur
- [ ] Mention "Période d'essai — facturation au [date]" visible
- [ ] Les modules actifs sont listés avec leur prix
- [ ] Total futur calculé correctement

### T6.3 — Email de bienvenue paiement futur
**Action :** Vérifier qu'un email informatif a été envoyé sur la date de fin d'essai
**Attendu :**
- [ ] Email reçu : "Votre période d'essai se termine le [date]"
- [ ] Le montant futur est indiqué clairement
- [ ] Lien pour ajouter un moyen de paiement présent

---

## BLOC 7 — Stabilité sur 14 jours

> Ces tests sont à effectuer à J+14 après le déploiement des pilotes.
> Ils mesurent la stabilité réelle de la plateforme en conditions de production.

### T7.1 — Uptime 99.5% sur 14 jours
**Action :** Consulter le dashboard UptimeRobot pour chaque site
**Attendu :**
- [ ] Uptime Pilote A ≥ 99.5%
- [ ] Uptime Pilote B ≥ 99.5%
- [ ] Uptime Pilote C ≥ 99.5%
- [ ] Uptime api.wapixia.com ≥ 99.9%

| Service | Uptime % | Incidents | Durée downtime |
|---|---|---|---|
| api.wapixia.com | | | |
| app.wapixia.com | | | |
| Site Pilote A | | | |
| Site Pilote B | | | |
| Site Pilote C | | | |

### T7.2 — Contenus publiés automatiquement sur 14 jours
**Action SQL :**
```sql
SELECT
  s.name,
  COUNT(*) FILTER (WHERE ac.type = 'social_post' AND ac.status = 'published') as social_posts,
  COUNT(*) FILTER (WHERE ac.type = 'gmb_post' AND ac.status = 'published') as gmb_posts,
  COUNT(*) FILTER (WHERE ac.type = 'blog_article' AND ac.status = 'published') as blog_articles,
  COUNT(*) FILTER (WHERE ac.type = 'review_reply' AND ac.status = 'published') as replies
FROM sites s
LEFT JOIN ai_contents ac ON ac.site_id = s.id
WHERE s.slug IN ('[pilote_a]', '[pilote_b]', '[pilote_c]')
  AND ac.created_at > NOW() - INTERVAL '14 days'
GROUP BY s.name;
```
**Attendu :**
- [ ] Chaque pilote avec social_posts actif : ≥ 3 posts publiés sur 14 jours
- [ ] Chaque pilote avec gmb_reviews actif : ≥ 2 posts GMB publiés
- [ ] 0 job en état 'failed' non traité dans BullMQ

### T7.3 — Coût Claude réel < 4€/mois
**Action SQL :**
```sql
SELECT
  s.name,
  SUM(tu.total_cost_eur) as monthly_cost,
  SUM(tu.api_calls) as api_calls
FROM token_usage tu
JOIN sites s ON s.id = tu.site_id
WHERE tu.period_year = EXTRACT(YEAR FROM NOW())
  AND tu.period_month = EXTRACT(MONTH FROM NOW())
GROUP BY s.name;
```
**Attendu :**
- [ ] Coût mensuel de chaque site < 4€
- [ ] Si > 4€ → analyser les prompts (tokens trop longs) et corriger avant la V1 officielle

| Site | Coût réel/mois | Cible |
|---|---|---|
| Pilote A | | < 4€ |
| Pilote B | | < 4€ |
| Pilote C | | < 4€ |

### T7.4 — 0 erreur critique dans les logs
**Action :** Consulter Betterstack ou les logs Pino sur 14 jours
**Attendu :**
- [ ] 0 erreur de niveau "fatal" ou "error" non résolue
- [ ] Les erreurs "warn" sont documentées (pas de surprises)
- [ ] Aucune PII exposée dans les logs

### T7.5 — Satisfaction pilotes J+14
**Action :** Appel de 10 minutes avec chaque pilote
**Attendu :**
- [ ] Note de satisfaction ≥ 7/10 (question directe)
- [ ] Aucun pilote ne veut se retirer du programme

---

## BLOC 8 — Feedback clients (à J+30)

> Ce bloc est prévu pour la semaine suivant le Sprint 7, mais la grille est
> préparée maintenant pour ne pas oublier.

### Formulaire de feedback J+30

**Envoyer ce formulaire par email ou en visio à chaque pilote :**

```
GRILLE DE FEEDBACK WAPIXIA — CLIENT PILOTE

1. Sur 10, à quel point votre site vous ressemble-t-il ?
   [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5  [ ] 6  [ ] 7  [ ] 8  [ ] 9  [ ] 10

2. Avez-vous reçu des demandes de contact via votre site depuis sa création ?
   [ ] Oui, combien environ : ___  [ ] Non

3. Avez-vous utilisé votre tableau de bord au moins une fois ?
   [ ] Oui  [ ] Non — raison : _________________

4. Les contenus générés par l'IA (posts, articles) vous ont-ils semblé :
   [ ] Très bien — je publie sans modifier
   [ ] Bien — je modifie légèrement avant de publier
   [ ] Moyen — je dois réécrire trop souvent
   [ ] Mauvais — je ne les utilise pas

5. Sur 10, recommanderiez-vous WapixIA à un autre commerçant ou artisan ?
   [ ] 1  [ ] 2  [ ] 3  [ ] 4  [ ] 5  [ ] 6  [ ] 7  [ ] 8  [ ] 9  [ ] 10

6. Quelle est la fonctionnalité que vous utilisez le plus ?
   _______________________________________________

7. Quelle est la fonctionnalité qui vous manque le plus ?
   _______________________________________________

8. Acceptez-vous de laisser un témoignage (texte ou vidéo) ?
   [ ] Oui  [ ] Non

9. Commentaires libres :
   _______________________________________________
```

### Résultats feedback pilotes (à remplir à J+30)

| Question | Pilote A | Pilote B | Pilote C | Moyenne |
|---|---|---|---|---|
| Q1 — Site vous ressemble (/10) | | | | |
| Q2 — Demandes reçues | | | | |
| Q5 — NPS (/10) | | | | |
| Q4 — Qualité contenus | | | | |

**Seuil de succès produit : NPS moyen ≥ 8/10**

---

## BLOC 9 — Bug Tracker Sprint 7

### Format des bugs (à remplir au fil des tests)

```
| ID | Pilote | Sévérité | Description | Steps | Statut | Fix |
|---|---|---|---|---|---|---|
| BUG-P7-001 | A | critical | | | open | |
| BUG-P7-002 | B | major | | | open | |
```

### Bugs connus à surveiller (héritage des sprints précédents)

> Lister ici tous les bugs "minor" ou "cosmetic" non résolus des sprints 1-6
> qui pourraient affecter l'expérience pilote.

```
[ ] Vérifier les bugs ouverts dans le rapport Sprint 1
[ ] Vérifier les bugs ouverts dans le rapport Sprint 2
[ ] Vérifier les bugs ouverts dans le rapport Sprint 3
[ ] Vérifier les bugs ouverts dans le rapport Sprint 4
[ ] Vérifier les bugs ouverts dans le rapport Sprint 5
[ ] Vérifier les bugs ouverts dans le rapport Sprint 6
```

---

## Récapitulatif — Critères de validation Sprint 7

### Go-Live par pilote (avant annonce client)

| Critère | Pilote A | Pilote B | Pilote C |
|---|---|---|---|
| Site accessible HTTPS | ☐ | ☐ | ☐ |
| Score PageSpeed mobile > 80 | ☐ | ☐ | ☐ |
| robots.txt crawlers IA OK | ☐ | ☐ | ☐ |
| Schema.org valide | ☐ | ☐ | ☐ |
| Formulaire contact fonctionne | ☐ | ☐ | ☐ |
| Visibility Score calculé | ☐ | ☐ | ☐ |
| 0 bug critique | ☐ | ☐ | ☐ |
| 0 bug majeur | ☐ | ☐ | ☐ |

### Validation Sprint 7 (à J+14)

| KPI | Cible | Réel | Statut |
|---|---|---|---|
| Sites en production | 3 | | ☐ |
| Uptime moyen 14j | ≥ 99.5% | | ☐ |
| LCP moyen | < 2.5s | | ☐ |
| Coût Claude moyen/site | < 4€/mois | | ☐ |
| Coût infra moyen/site | < 2€/mois | | ☐ |
| Bugs critiques ouverts | 0 | | ☐ |
| Bugs majeurs ouverts | 0 | | ☐ |
| Contenus publiés auto | ≥ 3/site | | ☐ |

**Le Sprint 7 est déclaré terminé quand tous les critères Go-Live sont verts
pour les 3 pilotes ET les KPIs J+14 sont atteints.**

---

## Rapport final Sprint 7

```
## Rapport Sprint 7 — [Date]
**Chef de projet :** Salim (Wapix SPRL)
**Durée effective :** ____ jours

### Pilotes en production
| Pilote | Secteur | URL | Date mise en prod | Score SEO | Modules actifs |
|---|---|---|---|---|---|
| A | | | | | |
| B | | | | | |
| C | | | | | |

### Métriques techniques (J+14)
| Site | Uptime | LCP | Coût Claude | Contenus publiés |
|---|---|---|---|---|
| Pilote A | | | | |
| Pilote B | | | | |
| Pilote C | | | | |

### Satisfaction clients
| Pilote | Note /10 | NPS /10 | Témoignage obtenu |
|---|---|---|---|
| A | | | ☐ |
| B | | | ☐ |
| C | | | ☐ |

### Bugs identifiés pendant le sprint
| ID | Sévérité | Description | Résolu | Sprint fix |
|---|---|---|---|---|
| | | | | |

### Coûts réels totaux du projet (Sprints 0-7)
| Poste | Coût estimé | Coût réel |
|---|---|---|
| Dev temps Salim (heures × 0) | 0€ | 0€ |
| Dev Kenitra (revue + déploiement) | | |
| Claude API (génération MVP) | ~15€ | |
| Hetzner VPS | ~13€/mois | |
| Supabase | ~25€/mois (Pro) | |
| Mollie | 0€ (commission sur transactions) | |
| Brevo | ~0-25€/mois | |
| Cloudflare | 0€ (plan gratuit) | |
| UptimeRobot | 0€ (plan gratuit) | |
| **Total mensuel en croisière** | **~80€/mois** | |

### Décision post-sprint
[ ] ✅ MVP VALIDÉ — Lancement commercial
[ ] ⚠️ MVP PARTIEL — Corriger [problèmes] avant lancement
[ ] ❌ PIVOT NÉCESSAIRE — Réévaluation complète

### Actions immédiates semaine 12
[ ] Activer la prospection sur le parc Wapix (203 sites)
[ ] Mettre à jour la landing page avec vrais témoignages
[ ] Lancer le Sprint 8 (premier sprint V2)
[ ] Brief dev Kenitra sur les modules V2 prioritaires

### Apprentissages clés
[Notes libres sur ce qui a bien marché, ce qui a surpris, ce qu'on ferait différemment]
```
