# SPRINT 7 — PILOT_ONBOARDING.md
# Procédure d'onboarding des 3 clients pilotes
> Document opérationnel — à suivre pas à pas pour chaque pilote
> Durée par session : 30 à 45 minutes

---

## Avant la session (J-1)

### Checklist pré-session

```
[ ] L'invitation dashboard a été envoyée (POST /api/v1/auth/invite)
[ ] Le client a créé son mot de passe (lien d'invitation valide 48h)
[ ] Le VPS Hetzner est up (vérifier UptimeRobot)
[ ] L'API staging/production répond (curl /health)
[ ] Les quotas Claude API sont disponibles (tableau de bord Anthropic)
[ ] Avoir un onglet ouvert : app.wapixia.com/onboarding
[ ] Avoir un onglet ouvert : Supabase Studio (pour debug si besoin)
[ ] Avoir le numéro de téléphone du client à portée
```

---

## Pendant la session (30 min)

### 0-5 min — Accueil et cadrage

**Ce que tu dis :**
> "WapixIA va créer votre site en répondant à une vingtaine de questions.
> L'IA génère tout — les textes, la FAQ, les meta descriptions pour Google.
> Vous pourrez tout modifier ensuite depuis votre tableau de bord.
> On commence ?"

**Ce que tu fais :**
- Ouvrir `https://app.wapixia.com/login` en partage d'écran
- Se connecter avec les identifiants du client

---

### 5-25 min — Questionnaire (20 questions)

Suivre l'ordre exact du questionnaire. Pour chaque question :
- Lire la question à voix haute si visio
- Aider le client à formuler si il hésite
- Ne pas reformuler pour lui — c'est SA voix qui doit apparaître

**Questions sensibles à anticiper :**

**Étape 7 (gamme de prix) :**
> Si le client hésite entre "médium" et "premium" → conseiller "premium" si
> il cite des concurrents moins chers, "médium" si il cite des concurrents plus chers.

**Étape 8 (USP) :**
> C'est la question la plus importante. Si le client dit "qualité et sérieux" →
> lui demander : "Mais concrètement, qu'est-ce que VOS clients vous disent
> qu'ils ne trouvent pas ailleurs ?" → relancer jusqu'à obtenir quelque chose
> de concret.

**Étape 14 (logo et photos) :**
> Si le client n'a pas de logo → l'informer que le site utilisera ses couleurs
> sectorielles par défaut. Proposer de lui créer un logo simple après si besoin.
> Si il a des photos → lui demander de les uploader depuis son téléphone
> (le lien d'upload fonctionne sur mobile).

**Étape 18 (réseaux sociaux) :**
> Profiter de cette étape pour récupérer les URLs Facebook/Instagram
> pour la connexion OAuth qui suit.

**Étape 19 (GMB) :**
> Demander : "Avez-vous une fiche Google My Business ?"
> Si oui → lui demander de l'ouvrir dans un autre onglet pour avoir
> l'URL à portée pour la connexion OAuth.

---

### 25-30 min — Connexions OAuth et déclenchement

#### Connexion Google (obligatoire si GMB actif)

```
1. Tableau de bord → Paramètres → Intégrations
2. Cliquer "Connecter Google"
3. Pop-up Google → choisir le compte Gmail lié au GMB
4. Autoriser les permissions (Analytics, Search Console, GMB)
5. Vérifier : "Connecté ✅" affiché
```

**Si le client n'a pas accès à son Gmail en direct :**
> "Pas de problème — vous pourrez le faire depuis votre tableau de bord
> après la session. Je vous envoie les instructions par email."

#### Connexion Facebook (si module Posts RS activé)

```
1. Paramètres → Intégrations → Connecter Facebook
2. Pop-up Meta → choisir le compte Facebook du client
3. Sélectionner la Page professionnelle (pas le profil personnel)
4. Autoriser les permissions (publish_pages, instagram_basic)
5. Si Instagram lié → apparaît automatiquement
6. Vérifier : "Page [Nom] connectée ✅"
```

#### Déclenchement de la génération

```
1. Étape 20 du questionnaire → cliquer "🚀 Créer mon site intelligent"
2. Page d'attente → montrer l'animation de génération au client
3. Informer : "Dans 5 à 10 minutes, votre site sera en ligne"
4. Planifier un appel de suivi à J+1 (15 min) pour valider le résultat
```

---

## Après la session (J+1 — 15 min de suivi)

### Vérifications à faire avant l'appel de suivi

```bash
# 1. Vérifier que le site est up
curl -f https://[slug].wapixia.com

# 2. Vérifier le SEO automatique
curl https://[slug].wapixia.com/robots.txt | grep GPTBot
curl https://[slug].wapixia.com/sitemap.xml | grep "<url>"

# 3. Vérifier le Schema.org
curl https://[slug].wapixia.com | grep "application/ld+json"

# 4. Vérifier le score SEO
# GET /api/v1/sites/[id]/visibility-score

# 5. Vérifier les contenus générés (en attente de validation)
# GET /api/v1/sites/[id]/contents?status=pending_validation
```

### Appel de suivi J+1

**Ce que tu vérifies avec le client :**

```
[ ] "Le site ressemble bien à votre activité ?"
[ ] "Le titre principal est correct ?"
[ ] "Les services listés correspondent à ce que vous faites ?"
[ ] "Y a-t-il des informations incorrectes à corriger ?"
[ ] "Avez-vous pu vous connecter à votre tableau de bord ?"
```

**Corrections fréquentes à anticiper :**

| Problème | Correction |
|---|---|
| Texte du hero trop générique | Modifier via CMS → /content/home → hero.headline |
| Service manquant | CMS → /content/services → Ajouter un service |
| Horaires incorrects | Paramètres → Infos entreprise → Horaires |
| Téléphone erroné | Paramètres → Infos entreprise → Téléphone |
| Logo non uploadé | Paramètres → Branding → Logo |

---

## Fiche par pilote

### PILOTE A — [À compléter]

```
Nom entreprise   : ___________________________
Secteur          : ___________________________
Contact          : ___________________________
Email            : ___________________________
Téléphone        : ___________________________
Date onboarding  : ___________________________
URL site         : ___________________________
Slug             : ___________________________
Site ID (BDD)    : ___________________________
GMB connecté     : ☐ Oui  ☐ Non
Facebook connecté: ☐ Oui  ☐ Non
Modules activés  : ☐ social_posts  ☐ gmb_reviews  ☐ blog_seo
Domaine perso    : ___________________________
Notes session    : ___________________________
```

### PILOTE B — [À compléter]

```
Nom entreprise   : ___________________________
Secteur          : ___________________________
Contact          : ___________________________
Email            : ___________________________
Téléphone        : ___________________________
Date onboarding  : ___________________________
URL site         : ___________________________
Slug             : ___________________________
Site ID (BDD)    : ___________________________
GMB connecté     : ☐ Oui  ☐ Non
Facebook connecté: ☐ Oui  ☐ Non
Modules activés  : ☐ social_posts  ☐ gmb_reviews  ☐ blog_seo
Domaine perso    : ___________________________
Notes session    : ___________________________
```

### PILOTE C — [À compléter]

```
Nom entreprise   : ___________________________
Secteur          : ___________________________
Contact          : ___________________________
Email            : ___________________________
Téléphone        : ___________________________
Date onboarding  : ___________________________
URL site         : ___________________________
Slug             : ___________________________
Site ID (BDD)    : ___________________________
GMB connecté     : ☐ Oui  ☐ Non
Facebook connecté: ☐ Oui  ☐ Non
Modules activés  : ☐ social_posts  ☐ gmb_reviews  ☐ blog_seo
Domaine perso    : ___________________________
Notes session    : ___________________________
```

---

## Problèmes courants et solutions

### "La génération est bloquée depuis 20 minutes"

```bash
# 1. Vérifier le statut du job
# GET /api/v1/sites/[id]/onboarding/status

# 2. Si status = 'failed' → vérifier les logs BullMQ
# Dashboard BullMQ → queue content:social → job en échec

# 3. Si erreur Anthropic API (rate limit ou timeout)
# → Attendre 5 min + cliquer "Réessayer" dans le dashboard

# 4. Si erreur Coolify deploy
# → Vérifier les logs Coolify → relancer le déploiement manuellement
```

### "Le contenu généré est mauvais"

1. Ne pas régénérer entièrement — trop coûteux
2. Modifier directement via le CMS les sections problématiques
3. Identifier pourquoi le prompt a raté (USP trop vague ? Secteur mal sélectionné ?)
4. Améliorer le prompt correspondant pour les prochains clients

### "L'OAuth Google ne fonctionne pas"

```
Vérifications :
1. GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET corrects en prod ?
2. L'URL de redirect est bien dans les URI autorisées dans Google Cloud Console :
   https://api.wapixia.com/api/v1/sites/[id]/google/callback
3. Les APIs activées dans Google Cloud Console :
   - Google Analytics Data API
   - Google Search Console API
   - Google My Business API
   - Google Business Profile API
```

### "Facebook dit 'Permission refusée'"

```
1. Vérifier que la Page Facebook est bien une Page Pro (pas un profil)
2. L'utilisateur doit être Admin de la Page (pas juste Éditeur)
3. Dans Meta for Developers → App en mode Live (pas Development)
4. Permissions requises : pages_manage_posts, pages_read_engagement,
   instagram_basic, instagram_content_publish
```
