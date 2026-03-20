# SPRINT 7 — SPEC.md
# Pilotes & Go-Live
> Durée : 2 semaines | Début : Semaine 10 | Fin cible : Semaine 11
> Objectif : 3 clients réels en production, premiers retours, premières factures

---

## Contexte

Ce sprint ne génère pas de code. Il valide que tout ce qui a été construit
fonctionne dans des conditions réelles — avec de vrais clients, un vrai domaine,
de vrais paiements et de vraies publications sur les réseaux sociaux.

C'est le test de vérité du projet.

Lire avant de démarrer :
1. Tous les rapports de test des Sprints 1 à 6 (vérifier les bugs ouverts)
2. `docs/sprints/sprint-7/PILOT_ONBOARDING.md` — procédure par client
3. `docs/sprints/sprint-7/GO_LIVE_CHECKLIST.md` — checklist complète avant mise en ligne
4. `docs/sprints/sprint-7/FEEDBACK.md` — grille de collecte retours
5. `docs/sprints/sprint-7/TESTS.md` — scénarios de validation pilotes

---

## 1. Sélection des 3 clients pilotes

### Critères de sélection

Le client pilote idéal est :
- Un contact existant Wapix SPRL — pas un prospect froid
- Disponible pour 30 minutes d'onboarding + 30 minutes de feedback à J+30
- Présent sur Google My Business (pour le module GMB)
- Actif sur Facebook (pour le module Posts RS)
- Pas en attente urgente d'un site — le délai de 48h est acceptable

### 3 profils cibles

| Pilote | Secteur | Pourquoi | Contact |
|---|---|---|---|
| **Pilote A** | Coiffure / Esthétique | Secteur testé en staging, forte présence GMB, photos disponibles | À identifier |
| **Pilote B** | BTP / Artisan | Secteur avec fort ROI devis, clients nombreux chez Wapix | À identifier |
| **Pilote C** | Médical / Paramédical OU Commerce | Diversifier les secteurs testés | À identifier |

### Ce qu'on offre aux pilotes

- Site créé gratuitement (pas de frais one-shot)
- **3 mois offerts** (valeur 267€) — paiement démarre à M+3
- Modules GMB + Posts RS + Blog actifs pendant 3 mois (offerts)
- Accès prioritaire aux futures fonctionnalités
- Témoignage vidéo ou écrit demandé à J+30 (en échange des 3 mois offerts)

### Ce qu'on NE promet PAS

- Résultats SEO garantis en 3 mois (SEO prend 6-12 mois)
- Nombre exact de leads
- Publicité payante (WapixIA = organique uniquement)

---

## 2. Semaine 1 — Onboarding pilotes

### Planning semaine 1

```
Lundi    : Signer l'accord pilote avec les 3 clients (email ou verbal)
           Envoyer les invitations dashboard (POST /api/v1/auth/invite)

Mardi    : Session onboarding Pilote A (30 min visio ou sur place)
           → questionnaire complété en live avec Salim
           → génération déclenchée

Mercredi : Session onboarding Pilote B (30 min)
           Suivi Pilote A : vérifier le site déployé + corrections éventuelles

Jeudi    : Session onboarding Pilote C (30 min)
           Suivi Pilote B

Vendredi : Vérification des 3 sites déployés
           Tests smoke manuels sur chaque site
           Connexion GMB et Facebook pour chaque pilote
           Envoi du récapitulatif aux pilotes
```

### Durée de chaque session onboarding

```
0-5min   : Présentation WapixIA (1 slide — pas de deck)
5-20min  : Questionnaire onboarding (20 questions, Salim pilote l'écran)
20-25min : Validation du contenu généré (titre, services, USP)
25-30min : Connexion Google et Facebook (OAuth en direct)
```

---

## 3. Semaine 2 — Validation et corrections

### Planning semaine 2

```
Lundi    : Revue des 3 sites en production
           → vérification SEO (robots, sitemap, Schema.org)
           → vérification des premiers contenus IA générés
           → correction des bugs remontés par les pilotes

Mardi    : Connexion des domaines personnalisés (si disponibles)
           Activation des abonnements (période d'essai gratuite)
           Premier rapport PDF mensuel généré manuellement

Mercredi : Réunion de bilan mi-sprint (30 min avec Charly si dispo)
           → mise à jour du BUG_TRACKER.md
           → décision Go/No-Go sur les 3 pilotes

Jeudi    : Corrections des bugs critiques identifiés
           Tests de régression sur les blocs touchés

Vendredi : Validation finale Go-Live
           Rédaction du bilan pilotes (pour CDC V13 ou mise à jour)
           Célébration — premier client WapixIA en production ✅
```

---

## 4. Infrastructure de suivi pilotes

### Tracking des anomalies

```typescript
// Structure du BUG_TRACKER.md pendant le sprint 7

interface PiloteBug {
  id: string                    // BUG-P7-001
  pilote: 'A' | 'B' | 'C'
  severity: 'critical' | 'major' | 'minor' | 'cosmetic'
  description: string
  reproSteps: string
  expectedBehavior: string
  actualBehavior: string
  status: 'open' | 'in_progress' | 'fixed' | 'wont_fix'
  fixedAt?: Date
  sprintFix?: number            // dans quel sprint le fix sera livré
}
```

### Seuils de tolérance Go-Live

| Sévérité | Définition | Seuil Go-Live |
|---|---|---|
| Critical | Site inaccessible, perte de données, bug de sécurité, double facturation | **0 accepté** |
| Major | Fonctionnalité principale cassée (onboarding, génération IA, publication) | **0 accepté** |
| Minor | Fonctionnalité secondaire dégradée, UX sous-optimale | **≤ 5 acceptés** (avec date de fix) |
| Cosmetic | Problème visuel, texte incorrect, lien mort | **Non bloquant** |

---

## 5. Métriques de succès du sprint

### KPIs minimum pour valider le sprint

| KPI | Cible | Critique |
|---|---|---|
| Sites en production | 3/3 | Oui |
| Uptime sur 14 jours | ≥ 99.5% | Oui |
| LCP moyen des sites | < 2.5s | Oui |
| Score SEO moyen | ≥ 80/100 | Non |
| Coût Claude par site/mois | < 4€ | Oui |
| Coût infra par site/mois | < 2€ | Oui |
| Bugs critiques ouverts | 0 | Oui |
| Bugs majeurs ouverts | 0 | Oui |
| Satisfaction pilotes | ≥ 7/10 | Non |
| Contenus IA publiés | ≥ 3/site | Non |
| NPS pilotes | ≥ 8/10 | Non |

### Mesures de coût réelles

```
Coût Claude par site/mois :
  Posts RS (12 posts, 2 plateformes) → ~1.20€
  Posts GMB (4 posts + 8 réponses avis) → ~0.60€
  Blog (4 articles × 2500 mots) → ~1.80€
  Rapport mensuel (recommandations) → ~0.10€
  Total estimé : ~3.70€/mois/site
  Cible : < 4€ ✅

Coût infra par site/mois :
  VPS Hetzner CPX31 : 13€/mois → 40 sites → 0.325€/site
  Cloudflare : inclus (plan gratuit suffisant en V1)
  Redis : partagé → ~0.10€/site
  R2 stockage : ~0.01€/site/mois (médias légers)
  Total estimé : ~0.50€/site/mois
  Cible : < 2€ ✅

Marge brute module :
  Revenu module : 10€/mois
  Coût Claude : 3.70€ (si 3 modules actifs)
  Coût infra : 0.50€
  Marge brute : ~5.80€/mois/site (58%)
```

---

## 6. Communication pilotes

### Email J-3 (avant l'onboarding)

```
Objet : Votre site WapixIA est en cours de préparation 🚀

Bonjour [Prénom],

Merci d'avoir accepté de tester WapixIA en avant-première !

Voici ce qui va se passer lors de notre session de [Date] :
- 20 minutes pour répondre à quelques questions sur votre activité
- L'IA génère automatiquement tout le contenu de votre site
- Votre site est en ligne dans les 2 heures suivantes

Ce dont vous aurez besoin :
✓ Vos identifiants Google (pour connecter GMB et Analytics)
✓ Vos identifiants Facebook (pour connecter votre Page)
✓ Votre logo si vous en avez un (JPG ou PNG)
✓ 30 minutes devant un écran

À très bientôt,
Salim — WapixIA
```

### Email J+1 (après l'onboarding)

```
Objet : Votre site [NOM] est en ligne ✅

Bonjour [Prénom],

Votre site est accessible sur : https://[slug].wapixia.com

Ce qui a été créé automatiquement :
✓ 6 pages de contenu optimisées pour Google
✓ FAQ balisée pour apparaître dans Google AI Overviews
✓ Fiche Google My Business connectée
✓ Premiers posts réseaux sociaux en attente de validation

Votre tableau de bord : https://app.wapixia.com
Identifiant : [email]
Mot de passe provisoire : [lien d'invitation]

Prochaine étape : dans votre dashboard, validez les 3 premiers posts
générés par l'IA avant qu'ils soient publiés automatiquement.

Des questions ? Répondez à cet email.
Salim
```

### Email J+30 (feedback)

```
Objet : Un mois avec WapixIA — qu'est-ce que ça a changé ?

Bonjour [Prénom],

Un mois déjà ! Votre rapport mensuel est disponible dans votre dashboard.

En résumé ce mois-ci :
- Visibility Score : [N]/100
- Visites estimées : [N]
- Contenus publiés : [N] posts + [N] articles
- Avis Google répondus : [N]

Avez-vous 10 minutes pour nous donner votre retour ?
→ [Lien formulaire de feedback]

Votre témoignage nous aidera à améliorer WapixIA pour tous les futurs clients.

Merci,
Salim
```

---

## 7. Plan de bascule production

### Checklist technique avant Go-Live

Voir `docs/sprints/sprint-7/GO_LIVE_CHECKLIST.md` pour la version complète.

### Ordre de mise en production

```
1. Vérifier que staging est stable depuis 48h (0 erreur critique dans Sentry)
2. Merger staging → main (via PR approuvée)
3. Approbation manuelle du workflow GitHub Actions
4. Deploy automatique production (CI/CD Sprint 6)
5. Smoke tests automatiques post-deploy
6. Vérification manuelle des 3 URLs production
7. Activer les monitors UptimeRobot production
8. Annoncer aux pilotes : "Votre site est maintenant en production"
```

### Procédure de rollback

```bash
# Si un bug critique est détecté en production

# 1. Identifier le dernier SHA stable
git log --oneline main | head -5

# 2. Revert via GitHub (ou en CLI)
git revert HEAD
git push origin main

# 3. Le pipeline CI/CD redéploie automatiquement la version précédente

# 4. Notifier les pilotes si impact visible
# "Maintenance technique en cours — site de retour dans 15 minutes"

# 5. Analyser et corriger sur une branche feat/
# Ne jamais corriger directement sur main
```

---

## 8. Post-sprint — Actions immédiates

### Semaine 12 (après Sprint 7)

```
1. Facturation :
   - Activer les abonnements payants pour les clients post-pilote
   - Préparer les contrats de prestation simples (email suffit en V1)

2. Commercialisation :
   - Transformer les témoignages pilotes en social proof
   - Mettre à jour la landing page (wapixia_landing.html) avec les vrais témoignages
   - Lancer la prospection active sur le parc Wapix (203 sites hébergés)

3. Développement V2 :
   - Ouvrir les issues GitHub pour la V2 (visuels IA, PWA, eIDAS...)
   - Prioriser selon les retours pilotes
   - Planifier Sprint 8 (premier sprint V2)

4. Équipe :
   - Brief complet au dev Kenitra sur les prochains modules
   - Évaluer si un deuxième développeur est nécessaire pour la V2
```

---

## 9. Gestion des imprévus

### Scénarios de risque et réponse

| Risque | Probabilité | Impact | Réponse |
|---|---|---|---|
| Un pilote abandonne | Faible | Moyen | Remplacer par un autre contact Wapix immédiatement |
| Bug critique en production | Moyen | Critique | Rollback + fix + redeploy (< 2h) |
| API Google suspendue | Faible | Majeur | Désactiver les modules Google, site reste actif |
| API Anthropic hors service | Faible | Majeur | Mettre les jobs en file d'attente, reprendre quand ça revient |
| Coût Claude > 4€/site | Faible | Moyen | Réduire `max_tokens`, passer Haiku pour le blog |
| Pilote insatisfait du contenu | Moyen | Mineur | Session de correction manuelle + amélioration des prompts |
| Score SEO < 80 sur un site | Moyen | Mineur | Corrections SEO manuelles + revalidation |

---

## 10. Livrables de fin de sprint

À produire avant de déclarer le Sprint 7 terminé :

```
✅ 3 sites en production avec domaines permanents (ou sub-domaines WapixIA)
✅ 3 rapports PDF mensuels générés et envoyés
✅ BUG_TRACKER.md à jour (0 critique, 0 major open)
✅ Coûts réels documentés (Claude + infra par site)
✅ Bilan pilotes avec retours clients (FEEDBACK.md rempli)
✅ CDC mis à jour si des décisions produit ont changé
✅ Issues V2 créées sur GitHub avec priorité
✅ README.md du repo mis à jour avec les instructions de déploiement
```
