# SPRINT 2 — SEO_CHECKLIST.md
# Checklist SEO + GEO + AEO
> Chaque item de cette liste doit être implémenté automatiquement à la génération de tout site WapixIA.
> Cette checklist est aussi utilisée comme guide de test manuel (Sprint 2 TESTS.md).

---

## COUCHE 1 — SEO Technique (Google/Bing)

### Indexation & Crawlabilité
- [ ] `sitemap.xml` dynamique accessible sur `/sitemap.xml`
- [ ] `sitemap.xml` soumis à Google Search Console via API à la création du site
- [ ] `robots.txt` accessible sur `/robots.txt`
- [ ] Toutes les pages publiques ont `<meta name="robots" content="index, follow">`
- [ ] Aucun `noindex` parasite sur les pages principales
- [ ] Balise canonical `<link rel="canonical" href="...">` sur chaque page
- [ ] URL en lowercase, kebab-case, sans caractères spéciaux
- [ ] Redirections 301 configurées si migration depuis un ancien site

### Meta Tags (générés par IA, uniques par page)
- [ ] `<title>` : 55-60 caractères, mot-clé + ville + marque
- [ ] `<meta name="description">` : 150-160 caractères, CTA inclus
- [ ] Balise `lang="fr"` (ou langue du site) sur la balise `<html>`
- [ ] `<meta charset="UTF-8">` présent
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` présent

### Open Graph & Social
- [ ] `<meta property="og:title">` sur toutes les pages
- [ ] `<meta property="og:description">` sur toutes les pages
- [ ] `<meta property="og:image">` : image 1200×630px (auto-générée depuis le logo ou Unsplash)
- [ ] `<meta property="og:url">` avec URL canonique
- [ ] `<meta property="og:type" content="website">` sur l'accueil
- [ ] `<meta property="og:locale" content="fr_BE">` (ou fr_FR si France)
- [ ] Twitter Card : `summary_large_image`

### Structure HTML sémantique
- [ ] Un seul `<h1>` par page (= headline du hero)
- [ ] Hiérarchie H1 > H2 > H3 respectée
- [ ] H2 formulés comme des questions (pattern AEO)
- [ ] Images avec attribut `alt` descriptif sur 100% des images
- [ ] `<img>` via `next/image` : width et height définis (évite CLS)
- [ ] Links internes cohérents entre les pages

### Performance Core Web Vitals
- [ ] LCP (Largest Contentful Paint) < 2.5s sur mobile 4G — mesuré via PageSpeed Insights API
- [ ] CLS (Cumulative Layout Shift) < 0.1 — images avec dimensions définies
- [ ] INP (Interaction to Next Paint) < 200ms
- [ ] `font-display: swap` sur les polices Google Fonts
- [ ] `<link rel="preconnect" href="https://fonts.googleapis.com">` présent
- [ ] Images hero optimisées WebP via Cloudflare R2
- [ ] Animations (Framer Motion, Aceternity) lazy-loadées après LCP
- [ ] CSS critique inliné dans `<head>` pour le Above The Fold
- [ ] SSR activé sur toutes les pages publiques (Next.js App Router)

### Fichiers de configuration
```
robots.txt minimum :
  User-agent: *
  Allow: /
  Sitemap: https://[domaine]/sitemap.xml

sitemap.xml minimum :
  <url><loc>https://[domaine]/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://[domaine]/services</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>
  <url><loc>https://[domaine]/a-propos</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://[domaine]/contact</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>
  <url><loc>https://[domaine]/faq</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  [articles de blog dynamiques Sprint 3]
```

---

## COUCHE 2 — Schema.org (Données Structurées)

### LocalBusiness — Page Accueil (obligatoire)
```json
{
  "@context": "https://schema.org",
  "@type": "[type selon secteur — voir mapping ci-dessous]",
  "name": "[business_name]",
  "description": "[description 150 mots]",
  "url": "[url du site]",
  "telephone": "[phone]",
  "email": "[email]",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "[rue]",
    "addressLocality": "[ville]",
    "postalCode": "[zip]",
    "addressCountry": "BE"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "[lat]",
    "longitude": "[lng]"
  },
  "openingHoursSpecification": [...],
  "sameAs": ["[facebook_url]", "[instagram_url]", ...],
  "priceRange": "[€ / €€ / €€€ selon price_range]"
}
```

**Mapping secteur → @type Schema.org :**
```
btp           → HomeAndConstructionBusiness
beaute        → BeautySalon
horeca        → Restaurant (ou FoodEstablishment)
immobilier    → RealEstateAgent
medical       → MedicalClinic (ou Physician si médecin)
automobile    → AutoDealer (ou AutoRepair si garage)
commerce      → Store
b2b           → ProfessionalService
fitness       → SportsClub (ou HealthClub)
asbl          → NGO
autre         → LocalBusiness
```

### FAQPage — Page FAQ et sections FAQ (obligatoire)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "[question]",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "[réponse complète]"
      }
    }
  ]
}
```
- [ ] Présent sur la page FAQ dédiée
- [ ] Présent sur la page Accueil (section FAQ)
- [ ] Présent sur la page Services (FAQ par service)

### BreadcrumbList — Toutes les pages sauf Accueil
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "[url]" },
    { "@type": "ListItem", "position": 2, "name": "[page name]", "item": "[url/page]" }
  ]
}
```

### Article — Pages Blog (Sprint 3, préparer dès Sprint 2)
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[titre article]",
  "author": { "@type": "Organization", "name": "[business_name]" },
  "publisher": { "@type": "Organization", "name": "[business_name]" },
  "datePublished": "[ISO date]",
  "dateModified": "[ISO date]",
  "description": "[meta description]",
  "image": "[url image article]"
}
```

### Service — Page Services
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "[nom du service]",
  "provider": { "@type": "LocalBusiness", "name": "[business_name]" },
  "areaServed": { "@type": "City", "name": "[ville]" },
  "description": "[description service]"
}
```

---

## COUCHE 3 — GEO (Moteurs IA Génératifs)

### robots.txt — Crawlers IA autorisés
```
# Moteurs de recherche classiques
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# OpenAI (ChatGPT)
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

# Anthropic (Claude)
User-agent: ClaudeBot
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-Web
Allow: /

# Perplexity
User-agent: PerplexityBot
Allow: /

# Google AI (Gemini)
User-agent: Google-Extended
Allow: /

# Apple (Siri / Apple Intelligence)
User-agent: Applebot-Extended
Allow: /

# Amazon (Alexa)
User-agent: Amazonbot
Allow: /

# Meta
User-agent: Meta-ExternalAgent
Allow: /

# Bloquer les scrapers SEO non souhaités
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: MJ12bot
Disallow: /

Sitemap: https://[domaine]/sitemap.xml
```

### Structure de contenu LLM-ready
- [ ] **TLDR-first** : chaque page commence par une réponse complète à la question principale dans les 100 premiers mots
- [ ] **Réponse directe H1** : le H1 est une affirmation qui répond à la requête principale (ex: "Coiffeur à Mouscron — Sonia Espace Coiffure")
- [ ] **H2 en format question** : chaque section H2 pose une question réelle (ex: "Combien coûte une coloration à Mouscron ?")
- [ ] **Données chiffrables** : prix indicatifs, délais, distances, années d'expérience — les LLMs citent les données factuelles
- [ ] **Sections autonomes** : chaque section H2+contenu est compréhensible sans le reste de la page
- [ ] **Entité géographique explicite** : le nom de la ville est présent dans chaque page (au moins dans le H1 et la meta description)
- [ ] **Date de mise à jour visible** : `<time datetime="[ISO]">Mis à jour le [date lisible]</time>` sur les pages de contenu
- [ ] **Vocabulaire sectoriel cohérent** : même terminologie sur toutes les pages (ex: toujours "coiffure" pas tantôt "coiffure", tantôt "salon de beauté")

### E-E-A-T — Signaux d'autorité
- [ ] Page "À Propos" avec historique de l'entreprise et photo si disponible
- [ ] Mentions de l'ancienneté (ex: "depuis 2010")
- [ ] Certifications ou formations mentionnées si disponibles
- [ ] Avis Google synchronisés et affichés (Sprint 3 — préparer la structure)
- [ ] Adresse physique visible sur toutes les pages (footer)
- [ ] Téléphone et email visibles (header + footer + page contact)
- [ ] Politique de confidentialité et mentions légales accessibles

---

## COUCHE 4 — AEO (AI Overviews & Featured Snippets)

### Sections FAQ structurées
- [ ] FAQ sur la page Accueil : 5 questions minimum
- [ ] FAQ sur la page Services : 2-3 questions par service
- [ ] FAQ sur une page dédiée : 12-15 questions en catégories
- [ ] Toutes les questions balisées Schema.org FAQPage
- [ ] Questions formulées exactement comme les gens les tapent dans Google

### Contenu extractable
- [ ] **Définitions en début de section** : "La coiffure végétale est..." (pattern que Google extrait pour les requêtes "c'est quoi")
- [ ] **Listes à puces pour les étapes** : Google extrait les listes ordonnées pour les requêtes "comment faire"
- [ ] **Tableaux comparatifs** pour les tarifs ou services (Google extrait les tableaux en featured snippet)
- [ ] **Chiffres et statistiques locaux** : "à 5 min du centre de Mouscron", "plus de 500 clients satisfaits"
- [ ] **Réponse directe en max 2 phrases** pour les questions clés (position 0)

### Questions type Featured Snippet à optimiser (par secteur)

**BTP / Artisan :**
- "Combien coûte [service] à [ville] ?"
- "Quel est le délai pour [service] ?"
- "Comment choisir un [artisan] à [ville] ?"
- "Quelles sont les garanties pour [travaux] ?"

**Coiffure / Beauté :**
- "Combien coûte une [prestation] à [ville] ?"
- "Comment prendre rendez-vous chez [nom] ?"
- "Quels sont les horaires du salon [nom] ?"
- "Où se trouve le salon [nom] ?"

**Horeca :**
- "Est-ce que [restaurant] est ouvert le [jour] ?"
- "Comment réserver une table chez [restaurant] ?"
- "Quel est le menu de [restaurant] ?"
- "Où se trouve [restaurant] à [ville] ?"

**Médical :**
- "Comment prendre rendez-vous avec [docteur/kiné] ?"
- "Est-ce que [praticien] est conventionné ?"
- "Quels sont les honoraires de [praticien] ?"
- "Où se trouve le cabinet de [praticien] ?"

---

## COUCHE 5 — Connexions Analytics & Tracking

### Google Analytics 4
- [ ] Snippet GA4 injecté via Google Tag Manager (ou directement si GTM non configuré)
- [ ] Événements trackés : page_view, contact_form_submit, appointment_booked, phone_click
- [ ] Conversion goals configurés : formulaire soumis, RDV pris
- [ ] IP anonymisation activée (RGPD)

### Google Tag Manager
- [ ] Container GTM chargé de manière asynchrone
- [ ] Déclencheur page_view configuré
- [ ] Variable URL de page configurée

### Google Search Console
- [ ] Vérification du site via balise HTML meta (Search Console)
- [ ] Sitemap soumis via Search Console API à la création

### Pixel Facebook / Meta
- [ ] Pixel injecté si facebook_pixel_id renseigné
- [ ] Événements : PageView, Lead (sur soumission formulaire), Contact
- [ ] `fbevents.js` chargé de manière différée (après interaction utilisateur ou 3s)

### Consentement & RGPD
- [ ] Bannière cookies avec catégories : Nécessaires / Analytics / Marketing
- [ ] Analytics et Pixel chargés uniquement si consentement Analytics donné
- [ ] Pixel Facebook chargé uniquement si consentement Marketing donné
- [ ] État du consentement stocké en localStorage
- [ ] Lien vers la politique de confidentialité dans la bannière

---

## Vérification automatique post-déploiement

À exécuter via script après chaque déploiement de site :

```typescript
// packages/api/src/services/seo-audit.service.ts

async function runPostDeployAudit(siteUrl: string): Promise<AuditResult> {
  const checks = await Promise.all([
    checkPageSpeed(siteUrl),                 // PageSpeed Insights API
    checkRobotsTxt(`${siteUrl}/robots.txt`),
    checkSitemap(`${siteUrl}/sitemap.xml`),
    checkMetaTags(siteUrl),                  // Puppeteer headless
    checkSchemaOrg(siteUrl),                 // Google Rich Results Test API
    checkSSL(siteUrl),                       // ssl-checker npm
    checkHttps(siteUrl),                     // redirect HTTP → HTTPS
  ])

  return {
    passed: checks.every(c => c.passed),
    score: calculateSEOScore(checks),
    issues: checks.filter(c => !c.passed).map(c => c.issue),
  }
}
```

**Score minimum requis avant livraison au client : 80/100**

Si score < 80 → alerte Wapix admin + blocage mise en ligne automatique.
