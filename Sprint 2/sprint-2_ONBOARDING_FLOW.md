# SPRINT 2 — ONBOARDING_FLOW.md
# Questionnaire Onboarding & Prompts IA
> Ce fichier définit les 20 questions du questionnaire client
> et les prompts Claude API pour générer le contenu de chaque page.

---

## 1. Les 20 questions — Structure

Chaque question a :
- Un **type** : text, select, multiselect, textarea, upload, boolean, hours
- Un **label** visible par le client
- Une **aide contextuelle** (pourquoi on pose cette question)
- Des **validations** (required, minLength, etc.)
- Un **exemple** affiché en placeholder

```typescript
interface OnboardingQuestion {
  step: number
  key: string           // clé dans onboarding_data JSONB
  type: QuestionType
  label: string
  help: string
  placeholder?: string
  options?: string[]    // pour select et multiselect
  required: boolean
  validation?: ZodSchema
}
```

---

## 2. Les 20 questions

### BLOC A — Identité (étapes 1-5)

**Étape 1 — Nom de l'entreprise**
```
key: business_name
type: text
label: "Quel est le nom de votre entreprise ?"
help: "C'est le nom qui apparaîtra sur votre site, vos réseaux sociaux et dans Google."
placeholder: "Ex: Salon Léonie, Plomberie Dupont, Restaurant Le Moulin..."
required: true
validation: min 2 chars, max 80 chars
```

**Étape 2 — Secteur d'activité**
```
key: sector
type: select
label: "Dans quel secteur exercez-vous ?"
help: "Votre secteur détermine le design, le ton et les fonctionnalités de votre site."
options:
  - BTP / Rénovation / Artisanat → btp
  - Coiffure / Esthétique / Beauté → beaute
  - Restaurant / Brasserie / Horeca → horeca
  - Immobilier → immobilier
  - Médical / Paramédical / Santé → medical
  - Garage / Automobile → automobile
  - Commerce / Boutique / Retail → commerce
  - Conseil / Services B2B → b2b
  - Sport / Fitness / Bien-être → fitness
  - ASBL / Association → asbl
  - Autre → autre
required: true
```

**Étape 3 — Localisation**
```
key: location
type: group
fields:
  - city: text — "Dans quelle ville êtes-vous situé ?" — placeholder: "Tournai"
  - zip: text — "Code postal" — placeholder: "7500"
  - address: text — "Adresse complète (optionnel)" — placeholder: "Rue de la Paix 12"
help: "Votre localisation est cruciale pour le référencement local — Google vous trouvera pour les recherches dans votre zone."
required: city + zip
```

**Étape 4 — Contact**
```
key: contact
type: group
fields:
  - phone: text — "Numéro de téléphone" — placeholder: "+32 69 XX XX XX"
  - email: email — "Adresse email de contact" — placeholder: "contact@votreentreprise.be"
  - website_existing: text — "Avez-vous déjà un site ? (URL)" — optionnel
help: "Ces informations apparaîtront sur votre site et dans votre fiche Google."
required: phone + email
```

**Étape 5 — Description de l'activité**
```
key: description
type: textarea
label: "Décrivez votre activité en quelques phrases"
help: "Imaginez que vous expliquez votre métier à un ami. Soyez naturel. L'IA s'occupe de la mise en forme."
placeholder: "Ex: Je suis coiffeuse spécialisée en colorations naturelles et balayages depuis 2010 à Mouscron. Mon salon accueille une clientèle féminine et masculine dans une ambiance chaleureuse..."
required: true
validation: min 50 chars, max 800 chars
```

---

### BLOC B — Prestations (étapes 6-9)

**Étape 6 — Prestations principales**
```
key: services
type: dynamic_list
label: "Quelles sont vos principales prestations ou services ?"
help: "Listez 3 à 8 services. Chacun aura sa propre section sur votre site."
placeholder: "Ex: Coupe femme, Coloration, Balayage, Lissage brésilien..."
min_items: 2
max_items: 8
required: true
```

**Étape 7 — Gamme de prix**
```
key: price_range
type: select
label: "Comment se positionne votre gamme de prix ?"
help: "Cela influence le ton et le design de votre site."
options:
  - Accessible / Économique → budget
  - Milieu de gamme → medium
  - Premium / Haut de gamme → premium
  - Variable selon les projets → variable
required: true
```

**Étape 8 — Ce qui vous différencie**
```
key: unique_selling_point
type: textarea
label: "Qu'est-ce qui vous distingue de vos concurrents ?"
help: "Ce message deviendra votre accroche principale. Soyez spécifique — pas 'qualité et sérieux' mais ce qui est VRAIMENT unique chez vous."
placeholder: "Ex: Je suis la seule coiffeuse certifiée Davines dans la région, spécialisée en colorations végétales sans ammoniaque..."
required: true
validation: min 30 chars, max 300 chars
```

**Étape 9 — Clientèle cible**
```
key: target_audience
type: textarea
label: "Qui sont vos clients idéaux ?"
help: "Décrivez votre client type : âge, profil, besoins. Cela permettra à l'IA de créer un contenu qui leur parle directement."
placeholder: "Ex: Femmes entre 30 et 55 ans, actives, qui cherchent un soin capillaire naturel sans compromettre le résultat..."
required: true
validation: min 20 chars, max 300 chars
```

---

### BLOC C — Pratique (étapes 10-13)

**Étape 10 — Horaires**
```
key: opening_hours
type: hours_picker
label: "Quels sont vos horaires d'ouverture ?"
help: "Vos horaires seront affichés sur votre site et synchronisés avec votre fiche Google My Business."
days: [Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche]
each_day: open (bool) + from (time) + to (time) + break (bool + from/to)
required: false (optionnel mais fortement recommandé)
```

**Étape 11 — Moyens de paiement acceptés**
```
key: payment_methods
type: multiselect
label: "Quels moyens de paiement acceptez-vous ?"
help: "Cette information rassure vos clients et améliore votre fiche Google."
options:
  - Espèces → cash
  - Bancontact → bancontact
  - Carte Visa/Mastercard → card
  - Virement bancaire → wire
  - PayPal → paypal
  - Chèques → check
  - À la livraison / sur chantier → on_delivery
required: false
```

**Étape 12 — Informations pratiques**
```
key: practical_info
type: group
fields:
  - parking: boolean — "Parking disponible à proximité ?"
  - accessibility: boolean — "Accès PMR (personnes à mobilité réduite) ?"
  - delivery: boolean — "Livraison disponible ?"
  - online_booking: boolean — "Souhaitez-vous activer la prise de RDV en ligne ?"
  - quote_online: boolean — "Souhaitez-vous activer les demandes de devis en ligne ?"
help: "Ces informations pratiques améliorent votre référencement local et rassurent vos prospects."
required: false
```

**Étape 13 — Zone d'intervention**
```
key: service_area
type: group
label: "Quelle est votre zone d'intervention ?"
help: "Important pour le référencement local : Google montrera votre site aux personnes qui cherchent dans ces villes."
fields:
  - radius_km: select (5 / 10 / 20 / 50 / nationale) — "Rayon de déplacement"
  - main_cities: text — "Villes principales desservies (séparées par virgule)"
    placeholder: "Ex: Tournai, Mouscron, Lille, Mons..."
required: false
```

---

### BLOC D — Visuel & Branding (étapes 14-17)

**Étape 14 — Logo et photos**
```
key: media
type: upload_multiple
label: "Avez-vous un logo et/ou des photos de votre activité ?"
help: "Uploadez votre logo et quelques photos. L'IA utilisera Unsplash pour compléter si vous n'en avez pas."
accept: image/png, image/jpeg, image/webp, image/svg+xml
max_files: 10
max_size_mb: 5
required: false
note: "Sans photos ? Pas de problème — des images libres de droits sectorielles seront utilisées automatiquement."
```

**Étape 15 — Couleurs de la marque**
```
key: brand_colors
type: color_group
label: "Avez-vous des couleurs de marque ?"
help: "Si vous avez un logo ou une charte graphique, entrez vos couleurs. Sinon, nous choisissons automatiquement selon votre secteur."
fields:
  - primary: color picker — "Couleur principale"
  - secondary: color picker — "Couleur secondaire" — optionnel
  - use_auto: boolean — "Utiliser les couleurs recommandées pour mon secteur"
required: false (si use_auto = true, on utilise THEME_CONFIG)
```

**Étape 16 — Langues**
```
key: languages
type: multiselect
label: "En quelle(s) langue(s) souhaitez-vous votre site ?"
options:
  - Français → fr
  - Néerlandais → nl
  - Anglais → en
  - Allemand → de
default: [fr]
help: "Le site sera créé en français. Les autres langues seront traduites automatiquement."
required: true
```

**Étape 17 — Ton et style de communication**
```
key: tone
type: select
label: "Quel ton souhaitez-vous pour votre site ?"
help: "Le ton de votre site reflète votre personnalité professionnelle."
options:
  - Chaleureux et accessible → friendly
  - Professionnel et sérieux → professional
  - Expert et technique → expert
  - Dynamique et moderne → dynamic
  - Élégant et premium → premium
required: true
default: friendly
```

---

### BLOC E — Présence digitale existante (étapes 18-20)

**Étape 18 — Réseaux sociaux existants**
```
key: social_links
type: group
label: "Avez-vous déjà des profils sur les réseaux sociaux ?"
help: "Vos profils existants seront liés à votre site. Laissez vide si vous n'en avez pas."
fields:
  - facebook: url — placeholder: "https://www.facebook.com/votrepage"
  - instagram: url — placeholder: "https://www.instagram.com/votreprofil"
  - linkedin: url — placeholder: "https://www.linkedin.com/company/..."
  - youtube: url — placeholder: "https://www.youtube.com/@..."
required: false
```

**Étape 19 — Fiche Google My Business**
```
key: gmb_info
type: group
label: "Avez-vous déjà une fiche Google My Business ?"
fields:
  - has_gmb: boolean — "Oui, j'ai déjà une fiche Google"
  - gmb_url: url — "URL de votre fiche Google (optionnel)"
    placeholder: "https://g.page/..."
  - gmb_rating: number — "Votre note actuelle (si connue)"
  - gmb_review_count: number — "Nombre d'avis (si connu)"
help: "Si vous avez une fiche Google, nous la connecterons pour synchroniser vos avis et publier des posts automatiquement."
required: false
```

**Étape 20 — Récapitulatif & Validation**
```
type: summary
label: "Votre site est prêt à être créé !"
content: Affiche un récapitulatif de toutes les réponses
  - Nom: [business_name]
  - Secteur: [sector]
  - Ville: [city]
  - Services: [liste]
  - Ton: [tone]
  - Langues: [langues]
  
Note: "Vous pourrez modifier tout ce contenu depuis votre tableau de bord après la livraison."

CTA: Bouton "🚀 Créer mon site intelligent" → POST /onboarding/complete
```

---

## 3. Prompts Claude API — Génération du contenu

### Prompt Système Global

```
Tu es un expert en création de contenu web pour les PME locales belges et francophones.
Tu génères du contenu pour un site vitrine professionnel optimisé pour :
1. Le référencement Google local (SEO)
2. Les moteurs IA génératifs comme ChatGPT et Perplexity (GEO)
3. Les extraits de réponse directe de Google (AEO)

Règles absolues de rédaction :
- Commencer chaque page par une réponse directe et complète à la question principale (TLDR-first)
- Les titres H2 sont formulés comme des questions réelles que les clients posent
- Intégrer naturellement le nom de la ville et le secteur dans le contenu
- Ton : [TONE] — friendly/professional/expert/dynamic/premium
- Langue : français belge (pas de "vous pouvez" mais "vous pouvez" — belgicismes naturels)
- Éviter les superlatifs vides ("le meilleur", "exceptionnel")
- Chaque section doit avoir une valeur informative standalone (extractable par les IA)
- Toujours répondre en JSON valide — jamais de texte libre autour du JSON
```

### Prompt Page d'accueil

```typescript
const homePrompt = `
Tu dois générer le contenu de la page d'accueil pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec exactement cette structure :
{
  "hero": {
    "headline": "string — H1 accrocheur 60-80 chars, inclure la ville et le secteur",
    "subheadline": "string — 120-150 chars, USP principale + CTA implicite",
    "ctaPrimary": "string — action principale (ex: 'Prendre rendez-vous', 'Demander un devis')",
    "ctaSecondary": "string — action secondaire (ex: 'Découvrir nos services')"
  },
  "intro": "string — 80-100 mots, réponse directe à 'Qui êtes-vous et que faites-vous ?', commence par le nom de l'entreprise",
  "features": [
    {
      "icon": "string — nom d'icône Lucide React (ex: 'Star', 'Shield', 'Clock')",
      "title": "string — 3-5 mots",
      "description": "string — 20-30 mots"
    }
  ],
  "testimonials": [
    {
      "author": "string — prénom + initiale du nom (ex: 'Marie D.')",
      "role": "string — profil client (ex: 'Cliente depuis 3 ans')",
      "rating": 5,
      "text": "string — 40-60 mots, avis authentique et spécifique au secteur"
    }
  ],
  "faq": [
    {
      "question": "string — question réelle d'un client potentiel, inclure la ville",
      "answer": "string — réponse directe et complète en 40-60 mots"
    }
  ],
  "ctaFinal": {
    "headline": "string — 40-60 chars, urgence ou bénéfice",
    "subtext": "string — 50-70 chars, réassurance",
    "cta": "string — action (identique à ctaPrimary)"
  },
  "seo": {
    "metaTitle": "string — max 60 chars, mot-clé principal + ville + marque",
    "metaDescription": "string — max 160 chars, USP + CTA, inclure ville et secteur",
    "h1": "string — identique à hero.headline"
  }
}

Génère exactement 4 features, 3 testimonials, 5 questions FAQ.
Toutes les questions FAQ doivent inclure le nom de la ville.
`
```

### Prompt Page Services

```typescript
const servicesPrompt = `
Tu dois générer le contenu de la page services pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

SERVICES DÉCLARÉS : ${JSON.stringify(onboardingData.services)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 en format réponse directe (ex: 'Nos services de coiffure à Mouscron')",
  "intro": "string — 80-100 mots TLDR-first : répondre directement à 'quels services proposez-vous ?'",
  "services": [
    {
      "name": "string — nom exact du service",
      "h2": "string — titre H2 en format question (ex: 'Combien coûte une coloration à Mouscron ?')",
      "description": "string — 100-150 mots, description détaillée avec bénéfices",
      "details": "string — 40-60 mots supplémentaires sur le processus ou les matériaux",
      "duration": "string ou null — durée estimée si applicable",
      "priceFrom": "string ou null — prix indicatif si applicable",
      "faq": [
        {
          "question": "string — question spécifique à ce service",
          "answer": "string — réponse directe 30-50 mots"
        }
      ]
    }
  ],
  "seo": {
    "metaTitle": "string — max 60 chars",
    "metaDescription": "string — max 160 chars"
  }
}

Génère le contenu pour TOUS les services listés (${onboardingData.services.length} services).
Chaque service doit avoir 2 questions FAQ.
`
```

### Prompt Page À Propos

```typescript
const aboutPrompt = `
Tu dois générer le contenu de la page "À Propos" pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'À propos de [nom] — [secteur] à [ville]')",
  "story": "string — 150-200 mots, histoire de l'entreprise en 1ère personne, ton chaleureux",
  "mission": "string — 60-80 mots, mission et valeurs",
  "why": {
    "title": "string — H2 (ex: 'Pourquoi choisir [nom] à [ville] ?')",
    "reasons": [
      { "title": "string — 3-5 mots", "text": "string — 30-40 mots" }
    ]
  },
  "expertise": {
    "title": "string — H2 (ex: 'Notre expertise en [secteur]')",
    "text": "string — 80-100 mots",
    "certifications": []
  },
  "seo": {
    "metaTitle": "string — max 60 chars",
    "metaDescription": "string — max 160 chars"
  }
}

Génère exactement 4 raisons dans le tableau "reasons".
Reste authentique — ne pas inventer de certifications non mentionnées.
`
```

### Prompt Page Contact

```typescript
const contactPrompt = `
Tu dois générer le contenu de la page Contact pour ce site web.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'Contactez [nom] à [ville]')",
  "intro": "string — 40-60 mots TLDR-first, inviter au contact de manière chaleureuse",
  "address_section": {
    "title": "string — H2 (ex: 'Où nous trouver ?')",
    "directions": "string — 30-50 mots, comment se rendre sur place, points de repère locaux"
  },
  "hours_section": {
    "title": "string — H2 (ex: 'Nos horaires d\\'ouverture')",
    "note": "string ou null — note sur les horaires (ex: 'Sur rendez-vous le samedi')"
  },
  "form_section": {
    "title": "string — H2 (ex: 'Envoyez-nous un message')",
    "subtitle": "string — 20-30 mots d'encouragement"
  },
  "seo": {
    "metaTitle": "string — max 60 chars (inclure adresse)",
    "metaDescription": "string — max 160 chars (téléphone + horaires + ville)"
  }
}
`
```

### Prompt FAQ Globale + Schema

```typescript
const faqPrompt = `
Tu dois générer une FAQ complète pour ce site web.
Cette FAQ sera balisée en Schema.org FAQPage pour Google et les IA génératives.

DONNÉES DE L'ENTREPRISE :
${JSON.stringify(onboardingData, null, 2)}

Génère un objet JSON avec cette structure :
{
  "title": "string — H1 (ex: 'Questions fréquentes — [nom] à [ville]')",
  "intro": "string — 40-60 mots TLDR-first",
  "categories": [
    {
      "name": "string — catégorie (ex: 'Tarifs et paiement', 'Prise de rendez-vous', 'Nos services')",
      "questions": [
        {
          "question": "string — question réelle, inclure ville si pertinent",
          "answer": "string — réponse complète et autonome, 40-80 mots"
        }
      ]
    }
  ]
}

Génère 3 catégories avec 4-5 questions chacune (12-15 questions au total).
Les questions doivent couvrir : tarifs, localisation, prise de contact, services spécifiques, praticités.
Toutes les réponses doivent être autonomes (compréhensibles sans le contexte de la page).
`
```

### Prompt Mentions Légales

```typescript
const legalPrompt = `
Génère les mentions légales pour ce site web basé en Belgique.

DONNÉES :
- Nom entreprise : ${onboardingData.business_name}
- Numéro TVA : [À COMPLÉTER PAR LE CLIENT — PLACEHOLDER]
- Adresse : ${onboardingData.location.address}, ${onboardingData.location.zip} ${onboardingData.location.city}
- Email : ${onboardingData.contact.email}
- Hébergeur : Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne

Génère un objet JSON :
{
  "title": "Mentions légales",
  "sections": [
    { "title": "string", "content": "string — HTML basique autorisé (<p>, <strong>, <ul>, <li>)" }
  ]
}

Inclure les sections : Éditeur du site, Hébergement, Propriété intellectuelle, 
Politique de confidentialité résumée, Cookies, Contact.
Utiliser le droit belge. Mentionner le RGPD.
Indiquer [NUMÉRO TVA À COMPLÉTER] là où le numéro TVA est nécessaire.
`
```

---

## 4. Worker BullMQ — Orchestration

```typescript
// packages/queue/src/workers/site-generator.worker.ts

export async function processSiteGeneration(job: Job<SiteGenerationJobData>) {
  const { siteId, onboardingData } = job.data

  try {
    // Étape 1 : Mise à jour statut
    await updateOnboardingStatus(siteId, 'generating')
    await job.updateProgress(10)

    // Étape 2 : Génération du contenu (6 appels Claude en parallèle)
    const [home, services, about, contact, faq, legal] = await Promise.all([
      generatePage('home', homePrompt, onboardingData),
      generatePage('services', servicesPrompt, onboardingData),
      generatePage('about', aboutPrompt, onboardingData),
      generatePage('contact', contactPrompt, onboardingData),
      generatePage('faq', faqPrompt, onboardingData),
      generatePage('legal', legalPrompt, onboardingData),
    ])
    await job.updateProgress(40)

    // Étape 3 : Injection dans Payload CMS
    await injectContentToCMS(siteId, { home, services, about, contact, faq, legal })
    await job.updateProgress(60)

    // Étape 4 : Création sous-domaine Cloudflare
    const subdomain = await cloudflareService.createSubdomain(siteSlug)
    await job.updateProgress(70)

    // Étape 5 : Déploiement Coolify
    const { appId } = await coolifyService.createApplication({
      name: siteSlug,
      domain: subdomain,
      envVars: buildSiteEnvVars(siteId, onboardingData),
    })
    const { deploymentId } = await coolifyService.triggerDeploy(appId)
    await job.updateProgress(80)

    // Étape 6 : Polling déploiement (max 10 min)
    await waitForDeployment(deploymentId, 600_000)
    await job.updateProgress(95)

    // Étape 7 : Mise à jour BDD + email client
    await db.update(sites).set({
      status: 'staging',
      tempDomain: subdomain,
      coolifyAppId: appId,
      launchedAt: new Date(),
    }).where(eq(sites.id, siteId))

    await brevoService.send({
      templateId: BREVO_TEMPLATE_SITE_READY,
      to: onboardingData.contact.email,
      params: { siteName: onboardingData.business_name, siteUrl: `https://${subdomain}` }
    })

    await updateOnboardingStatus(siteId, 'done')
    await job.updateProgress(100)

  } catch (error) {
    await updateOnboardingStatus(siteId, 'failed', error.message)
    throw error  // BullMQ retry
  }
}
```

---

## 5. Estimation tokens Claude par génération

| Page | Tokens input | Tokens output | Coût estimé (Sonnet 4) |
|---|---|---|---|
| Accueil | ~1 500 | ~800 | ~0.017€ |
| Services (5 services) | ~1 800 | ~1 500 | ~0.027€ |
| À propos | ~1 200 | ~600 | ~0.015€ |
| Contact | ~800 | ~400 | ~0.010€ |
| FAQ | ~1 500 | ~1 200 | ~0.023€ |
| Mentions légales | ~800 | ~800 | ~0.014€ |
| **TOTAL onboarding** | **~7 600** | **~5 300** | **~0.11€** |

Coût total de génération d'un site : **moins de 0.15€**. Négligeable.
