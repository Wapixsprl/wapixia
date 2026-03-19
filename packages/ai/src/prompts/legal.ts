// @wapixia/ai — Legal page prompt (Belgian law + GDPR)

/**
 * Build the user prompt for legal page content generation.
 * Uses Belgian law and GDPR references. VAT number is left as a placeholder.
 */
export function buildLegalPrompt(onboardingData: Record<string, unknown>): string {
  const businessName = typeof onboardingData['business_name'] === 'string'
    ? onboardingData['business_name']
    : '[Nom entreprise]'

  const location = onboardingData['location'] as Record<string, unknown> | undefined
  const address = typeof location?.['address'] === 'string' ? location['address'] : ''
  const zip = typeof location?.['zip'] === 'string' ? location['zip'] : ''
  const city = typeof location?.['city'] === 'string' ? location['city'] : ''
  const fullAddress = [address, `${zip} ${city}`.trim()].filter(Boolean).join(', ')

  const contact = onboardingData['contact'] as Record<string, unknown> | undefined
  const email = typeof contact?.['email'] === 'string' ? contact['email'] : '[email]'

  return `Génère les mentions légales pour ce site web basé en Belgique.

DONNÉES :
- Nom entreprise : ${businessName}
- Numéro TVA : [NUMÉRO TVA À COMPLÉTER]
- Adresse : ${fullAddress}
- Email : ${email}
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
Utiliser le droit belge. Mentionner le RGPD (Règlement Général sur la Protection des Données).
Indiquer [NUMÉRO TVA À COMPLÉTER] là où le numéro TVA est nécessaire.`
}
