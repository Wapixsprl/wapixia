# SPRINT 5 — TESTS.md
# Paiements & Abonnements — Scénarios de test
> À exécuter par Salim sur l'environnement staging
> Utiliser EXCLUSIVEMENT les clés de test Mollie et Stripe — jamais les clés live
> ✅ Passé | ❌ Échoué | ⏭️ Bloqué

---

## Comptes de test à préparer

| Compte | Email | Rôle | Organisation |
|---|---|---|---|
| SuperAdmin | superadmin@test.wapixia.com | superadmin | Wapix SPRL |
| Revendeur A | reseller@test.wapixia.com | reseller_admin | Agence Test Dupont (commission 20%) |
| Client du revendeur | client@test.wapixia.com | client_admin | Salon Test Sonia |
| Client direct | client2@test.wapixia.com | client_admin | Client Direct |

**Comptes Mollie test :** https://my.mollie.com → passer en mode test
**Comptes Stripe test :** utiliser les cartes de test Stripe (4242 4242 4242 4242)

---

## BLOC 1 — Migrations BDD

### T1.1 — Tables créées correctement
**Action :** Supabase Studio → vérifier les 3 tables
**Attendu :**
- [ ] Table `subscriptions` avec toutes les colonnes, contraintes CHECK, index
- [ ] Table `payments` avec contrainte UNIQUE sur `external_payment_id`
- [ ] Table `commissions` avec index sur reseller_id et status
- [ ] Séquence `invoice_number_seq` créée
- [ ] Fonction `generate_invoice_number()` retourne `WIA-2026-00001`

### T1.2 — Test génération numéro de facture
**Action SQL :**
```sql
SELECT generate_invoice_number();
SELECT generate_invoice_number();
SELECT generate_invoice_number();
```
**Attendu :**
- [ ] WIA-2026-00001
- [ ] WIA-2026-00002
- [ ] WIA-2026-00003 (incrémental)

### T1.3 — RLS subscriptions — isolation tenant
**Action SQL (simuler client Salon Sonia) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"[org_sonia]","role":"client_admin"}';
SELECT * FROM subscriptions;
```
**Attendu :**
- [ ] Seuls les abonnements de l'org Salon Sonia visibles
- [ ] Les abonnements du Client Direct (autre tenant) invisibles

### T1.4 — RLS commissions — revendeur voit ses commissions uniquement
**Action SQL (simuler reseller) :**
```sql
SET LOCAL request.jwt.claims TO '{"organization_id":"[org_reseller]","role":"reseller_admin"}';
SELECT * FROM commissions;
```
**Attendu :**
- [ ] Seules les commissions où `reseller_id = org_reseller` sont visibles

---

## BLOC 2 — Démarrage abonnement (Mollie)

### T2.1 — Initier le premier paiement
**Action :** `POST /api/v1/sites/[SITE_ID]/subscription/start`
```json
{ "plan": "subscription" }
```
**Attendu :**
- [ ] HTTP 201
- [ ] `data.checkoutUrl` est une URL Mollie valide (commence par `https://checkout.mollie.com/`)
- [ ] `data.totalAmount` = 89 (abonnement seul si pas de modules actifs)
- [ ] `data.breakdown` contient "Site WapixIA — 89€"
- [ ] Abonnement en BDD avec status = 'trialing'

### T2.2 — Montant avec modules actifs
**Prérequis :** Activer 3 modules (social_posts, gmb_reviews, blog_seo)
**Action :** `POST /api/v1/sites/[SITE_ID]/subscription/start`
**Attendu :**
- [ ] `data.totalAmount` = 119 (89 + 3 × 10)
- [ ] `data.breakdown` liste : Site (89€) + 3 lignes modules (10€ chacune)

### T2.3 — Paiement test Mollie — Bancontact
**Action :** Ouvrir l'URL de checkout → choisir Bancontact → payer en mode test (approuver)
**Attendu :**
- [ ] Redirect vers `https://app-staging.wapixia.com/billing?success=true`
- [ ] Webhook Mollie reçu (log dans les serveur logs)
- [ ] `subscriptions.status` = 'active'
- [ ] `subscriptions.currentPeriodEnd` = dans ~30 jours
- [ ] `payments.status` = 'paid'
- [ ] `payments.paymentMethod` = 'bancontact'
- [ ] Email "Paiement confirmé" reçu sur l'email du client

### T2.4 — Paiement test Mollie — Carte Visa
**Action :** Même flow avec carte de test `4111 1111 1111 1111`
**Attendu :**
- [ ] Même résultat que T2.3 avec paymentMethod = 'creditcard'
- [ ] `subscriptions.mollieMandate_id` non null (mandat créé pour les récurrents)

### T2.5 — Double tentative d'abonnement refusée
**Action :** Appeler `/subscription/start` une deuxième fois sur un site déjà abonné
**Attendu :**
- [ ] HTTP 409 CONFLICT
- [ ] Message : "Un abonnement actif existe déjà pour ce site"

### T2.6 — URL checkout expirée
**Action :** Attendre 15 minutes sans payer, puis tenter d'accéder à l'URL checkout
**Attendu :**
- [ ] Mollie affiche "Ce lien de paiement a expiré"
- [ ] L'abonnement en BDD reste en status 'trialing'
- [ ] Le client peut générer un nouveau checkout via le dashboard

---

## BLOC 3 — Webhooks Mollie

### T3.1 — Webhook reçu et traité (paiement réussi)
**Action :** Simuler un webhook Mollie via `curl` ou Mollie Dashboard (mode test → envoyer webhook)
```bash
curl -X POST https://api-staging.wapixia.com/api/v1/webhooks/mollie \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "id=[MOLLIE_PAYMENT_ID]"
```
**Attendu :**
- [ ] HTTP 200 retourné immédiatement
- [ ] Logs serveur : "Webhook Mollie reçu — paymentId: [id]"
- [ ] Statut du paiement mis à jour en BDD

### T3.2 — Webhook avec paymentId invalide
**Action :** Envoyer un webhook avec un ID inexistant
```bash
curl -X POST .../webhooks/mollie -d "id=tr_FAKE123"
```
**Attendu :**
- [ ] HTTP 200 (Mollie exige toujours un 200, même en cas d'erreur)
- [ ] Log : "Payment tr_FAKE123 introuvable — ignoré"
- [ ] Aucune modification en BDD

### T3.3 — Idempotence webhook — doublon ignoré
**Action :** Envoyer le même webhook 3 fois de suite
**Attendu :**
- [ ] Le paiement est marqué 'paid' une seule fois (pas de duplication)
- [ ] La facture PDF est générée une seule fois
- [ ] L'email de confirmation est envoyé une seule fois
- [ ] Les commissions sont calculées une seule fois

### T3.4 — Webhook Stripe signature validée
**Action :** Envoyer un webhook Stripe sans signature valide (ou signature altérée)
```bash
curl -X POST .../webhooks/stripe \
  -H "Stripe-Signature: t=fake,v1=badsignature" \
  -d '{"type":"payment_intent.succeeded"}'
```
**Attendu :**
- [ ] HTTP 400 BAD REQUEST
- [ ] Log : "Stripe webhook signature invalide"
- [ ] Aucune action exécutée

---

## BLOC 4 — Dunning (relances impayés)

### T4.1 — Simulation paiement échoué
**Action :** Avec Mollie test mode, utiliser la carte de test de refus (4000 0000 0000 0002)
**Attendu :**
- [ ] Webhook paiement échoué reçu
- [ ] `subscriptions.status` = 'past_due'
- [ ] `subscriptions.dunningAttempts` = 1
- [ ] Email "Paiement non abouti" reçu par le client
- [ ] Job dunning créé dans BullMQ avec delay = 24h

### T4.2 — Simulation deuxième échec (J+1)
**Action SQL :** Forcer `last_dunning_at = NOW() - INTERVAL '25 hours'` → déclencher le worker dunning
**Attendu :**
- [ ] Deuxième tentative de paiement effectuée automatiquement
- [ ] Si encore échec : `dunning_attempts` = 2
- [ ] Email de rappel envoyé

### T4.3 — Suspension modules à J+14
**Action SQL :** Forcer `last_dunning_at = NOW() - INTERVAL '15 days'` et `dunning_attempts = 2`
**Action :** Déclencher le job dunning manuellement
**Attendu :**
- [ ] `site_modules.status` = 'paused' pour tous les modules du site
- [ ] `subscriptions.status` = 'past_due' (le site reste actif)
- [ ] Email "Modules suspendus" reçu
- [ ] Le site est encore accessible (pas de page d'erreur)
- [ ] Vérifier que les jobs BullMQ de génération de contenu sont ignorés (module paused)

### T4.4 — Suspension site à J+30
**Action SQL :** Forcer `last_dunning_at = NOW() - INTERVAL '31 days'`
**Action :** Déclencher le job dunning
**Attendu :**
- [ ] `sites.status` = 'suspended'
- [ ] Email "Site suspendu" reçu avec lien de réactivation
- [ ] Le site affiche une page "Compte suspendu — régularisez votre situation"
- [ ] La page de suspension est accessible sur le domaine du client (pas une 404)

### T4.5 — Réactivation après paiement régularisé
**Action :** Payer via le lien de réactivation (Mollie checkout)
**Attendu :**
- [ ] `subscriptions.status` = 'active'
- [ ] `subscriptions.dunning_attempts` = 0
- [ ] `sites.status` = 'live' (ou 'staging' si pas encore mis en production)
- [ ] `site_modules.status` = 'active' (modules réactivés)
- [ ] Email "Compte réactivé" reçu

### T4.6 — Email de rappel envoyé au bon destinataire
**Action :** Vérifier la boîte email du compte client pendant le dunning
**Attendu :**
- [ ] Les emails partent à l'adresse du client_admin du site
- [ ] Pas d'email envoyé au revendeur (à moins qu'il soit aussi admin du site)
- [ ] Pas d'email envoyé en doublon

---

## BLOC 5 — Facturation et factures PDF

### T5.1 — Facture générée après paiement réussi
**Action :** Attendre 2 minutes après un paiement test réussi (T2.3)
**Attendu :**
- [ ] `payments.invoice_pdf_url` non null
- [ ] URL accessible (HTTP 200)
- [ ] PDF téléchargeable

### T5.2 — Contenu de la facture PDF
**Action :** Télécharger et ouvrir la facture
**Attendu :**
- [ ] Numéro de facture format `WIA-2026-XXXXX`
- [ ] Date d'émission correcte
- [ ] Vendeur : Wapix SPRL + adresse + numéro TVA
- [ ] Acheteur : nom de l'organisation cliente
- [ ] Lignes : description + montant HT
- [ ] Total HT, TVA 21%, Total TTC
- [ ] Devise EUR

### T5.3 — Numéro de facture séquentiel et unique
**Action :** Générer 5 factures via des paiements test successifs
**Attendu :**
- [ ] Les 5 numéros sont séquentiels (WIA-2026-00001 → WIA-2026-00005)
- [ ] Aucun numéro en double (contrainte UNIQUE en BDD)
- [ ] L'ordre correspond à l'ordre chronologique des paiements

### T5.4 — Facture téléchargeable depuis le backoffice
**Action :** Dashboard client → `/billing` → cliquer l'icône PDF sur un paiement
**Attendu :**
- [ ] `GET /api/v1/sites/[id]/payments/[paymentId]/invoice` retourne HTTP 200
- [ ] Réponse : URL signée de la facture (valide 1h)
- [ ] La facture s'ouvre dans un nouvel onglet

### T5.5 — Facture inaccessible sans auth
**Action :** Copier l'URL de la facture, l'ouvrir en navigation privée
**Attendu :**
- [ ] URL R2 signée avec expiration (paramètre `X-Amz-Expires`) OU
- [ ] Redirection vers la page de login si accès non autorisé

---

## BLOC 6 — Commissions revendeurs

### T6.1 — Commission calculée correctement
**Action :** Après un paiement de 89€ du client d'un revendeur à 20% de commission
**Vérification SQL :**
```sql
SELECT base_amount, commission_rate, commission_amount
FROM commissions
WHERE reseller_id = '[RESELLER_ORG_ID]'
ORDER BY created_at DESC LIMIT 1;
```
**Attendu :**
- [ ] `base_amount` = 89.00
- [ ] `commission_rate` = 20.00
- [ ] `commission_amount` = 17.80 (89 × 20% = 17.80)

### T6.2 — Commission avec 3 modules (129€ total)
**Attendu :**
- [ ] `base_amount` = 129.00 (89 + 3 × 10)
- [ ] `commission_amount` = 25.80 (129 × 20%)

### T6.3 — Reversement Stripe Connect
**Prérequis :** Compte Stripe Connect de test configuré pour le revendeur
**Action :** Déclencher manuellement `POST /api/v1/admin/commissions/process`
**Attendu :**
- [ ] Job créé dans BullMQ
- [ ] `commissions.status` = 'paid'
- [ ] `commissions.stripe_transfer_id` non null
- [ ] Transfert visible dans le dashboard Stripe test

### T6.4 — Client direct — pas de commission
**Action :** Paiement d'un site dont l'organisation est de type 'direct' (parent = WapixIA)
**Vérification SQL :**
```sql
SELECT count(*) FROM commissions WHERE site_id = '[SITE_CLIENT_DIRECT]';
```
**Attendu :**
- [ ] Count = 0 (aucune commission pour les clients directs WapixIA)

### T6.5 — Dashboard commissions revendeur
**Action :** Se connecter avec reseller@test.wapixia.com → `/commissions`
**Attendu :**
- [ ] MRR affiché = somme des abonnements actifs des clients
- [ ] Tableau des commissions avec : mois, nb clients, MRR, taux, montant, statut
- [ ] Colonne "Statut" : Pending / Versé ✅
- [ ] Lien affiliation UUID visible avec bouton "Copier"

### T6.6 — Isolation commissions entre revendeurs
**Action :** Créer un deuxième revendeur B avec ses propres clients, vérifier l'isolation
**Attendu :**
- [ ] Le revendeur A ne voit PAS les commissions du revendeur B
- [ ] Le revendeur B ne voit PAS les commissions du revendeur A
- [ ] SuperAdmin voit TOUTES les commissions

---

## BLOC 7 — Activation modules et facturation

### T7.1 — Activer un module → ajouté à la facturation
**Action :** Activer le module social_posts sur un site avec abonnement actif
**Attendu :**
- [ ] Nouvelle ligne dans `subscriptions` : type='module', module_id='social_posts', amount=10.00
- [ ] Le récapitulatif `/billing` affiche la nouvelle ligne (+10€/mois)
- [ ] Prochain prélèvement = 99€ (89 + 10)

### T7.2 — Désactiver un module → retiré de la facturation
**Action :** Désactiver le module social_posts
**Attendu :**
- [ ] `subscriptions.status` = 'cancelled' pour la ligne module
- [ ] La ligne disparaît du récapitulatif billing
- [ ] Prochain prélèvement revient à 89€

### T7.3 — Prorata d'activation en cours de mois
**Action :** Activer un module le 15 du mois (mi-mois)
**Attendu :**
- [ ] Le premier prélèvement du module est proratisé (5€ pour 15 jours restants)
- [ ] Le mois suivant : 10€ complets
- [ ] Note : si le prorata n'est pas implémenté, accepter 10€ complets pour la V1

### T7.4 — Résiliation abonnement
**Action :** Cliquer "Résilier l'abonnement" → confirmer dans le modal
**Attendu :**
- [ ] Modal de confirmation avec message d'avertissement
- [ ] `POST /api/v1/sites/[id]/subscription/cancel` → HTTP 200
- [ ] `subscriptions.status` = 'cancelled'
- [ ] `subscriptions.cancelled_at` = NOW()
- [ ] Email de confirmation de résiliation envoyé
- [ ] Le site reste actif jusqu'à la fin de la période courante
- [ ] Aucun nouveau prélèvement après la résiliation

---

## BLOC 8 — Interface billing UI

### T8.1 — Page /billing accessible et correcte
**Action :** Se connecter client → `/billing`
**Attendu :**
- [ ] Page chargée < 2s
- [ ] Abonnement actuel affiché avec statut, montant, prochain prélèvement
- [ ] Récapitulatif mensuel avec chaque ligne de facturation
- [ ] Total HT + TVA 21% + Total TTC calculés correctement
- [ ] Tableau historique des paiements avec dates et montants

### T8.2 — Statut impayé visible
**Action :** Mettre manuellement un abonnement en status 'past_due', recharger /billing
**Attendu :**
- [ ] Bannière d'avertissement orange visible : "Paiement en attente — régularisez votre situation"
- [ ] Lien "Mettre à jour ma méthode de paiement"
- [ ] Le contenu du dashboard reste accessible (pas de blocage)

### T8.3 — Statut suspendu visible
**Action :** Mettre manuellement `sites.status = 'suspended'`, recharger l'app
**Attendu :**
- [ ] Le dashboard affiche un message de suspension clair
- [ ] Bouton "Réactiver mon compte" visible
- [ ] Les pages de contenu et modules ne sont pas accessibles

### T8.4 — MRR SuperAdmin
**Action :** Se connecter SuperAdmin → `/admin/billing`
**Attendu :**
- [ ] MRR global affiché (somme de toutes les subscriptions actives)
- [ ] Tableau par organisation avec MRR + commissions dues
- [ ] Bouton "Lancer les reversements du mois" fonctionnel

---

## BLOC 9 — Sécurité & Edge Cases

### T9.1 — Webhook sans corps refusé
**Action :** `curl -X POST .../webhooks/mollie` sans body
**Attendu :**
- [ ] HTTP 200 (Mollie exige 200) avec log "Webhook ignoré — corps invalide"

### T9.2 — Montant négatif refusé
**Action :** Tenter de créer une subscription avec amount = -10
**Attendu :**
- [ ] HTTP 422 VALIDATION_ERROR (Zod rejette les montants ≤ 0)

### T9.3 — Accès facture d'un autre client interdit
**Action :** Avec token du client Salon Sonia, appeler `/api/v1/sites/[SITE_DUPONT]/payments/[id]/invoice`
**Attendu :**
- [ ] HTTP 403 FORBIDDEN

### T9.4 — Transaction BDD atomique en cas d'erreur
**Action :** Simuler une erreur de BDD au milieu d'un handlePaymentSuccess (ex: couper la connexion)
**Attendu :**
- [ ] Aucune mise à jour partielle en BDD (soit tout, soit rien)
- [ ] Le webhook Mollie retourne HTTP 200 (Mollie retentera)
- [ ] L'état de la BDD est cohérent après l'erreur

### T9.5 — Prévention double facturation
**Action :** Déclencher le job de prélèvements récurrents 2x en même temps
**Attendu :**
- [ ] Un seul paiement créé par abonnement (pas de doublon)
- [ ] Mécanisme de verrou ou de vérification `currentPeriodEnd` avant tout prélèvement

---

## Récapitulatif — Critères de validation du Sprint 5

| Bloc | Tests | Requis |
|---|---|---|
| Bloc 1 — BDD | T1.1 → T1.4 | 4/4 ✅ |
| Bloc 2 — Démarrage abonnement | T2.1 → T2.6 | 5/6 min ✅ |
| Bloc 3 — Webhooks | T3.1 → T3.4 | 4/4 ✅ |
| Bloc 4 — Dunning | T4.1 → T4.6 | 5/6 min ✅ |
| Bloc 5 — Factures PDF | T5.1 → T5.5 | 5/5 ✅ |
| Bloc 6 — Commissions | T6.1 → T6.6 | 5/6 min ✅ |
| Bloc 7 — Modules & facturation | T7.1 → T7.4 | 3/4 min ✅ |
| Bloc 8 — UI billing | T8.1 → T8.4 | 4/4 ✅ |
| Bloc 9 — Sécurité | T9.1 → T9.5 | 5/5 ✅ |

**Total minimum pour Go Sprint 6 : 40/46 tests passés**
Blocs 1, 3, 5 et 9 sont **non négociables** — 100% requis.
T3.3 (idempotence webhook) est critique — aucun doublon de facturation acceptable.

---

## Template rapport Sprint 5

```
## Rapport Sprint 5 — [Date]
**Testeur :** Salim | **Env :** staging | **Mode :** TEST Mollie + TEST Stripe

### Résultats
| Bloc | Passés | Échoués | Bloqués |
|---|---|---|---|
| Bloc 1 — BDD | | | |
| Bloc 2 — Abonnement | | | |
| Bloc 3 — Webhooks | | | |
| Bloc 4 — Dunning | | | |
| Bloc 5 — Factures | | | |
| Bloc 6 — Commissions | | | |
| Bloc 7 — Modules | | | |
| Bloc 8 — UI | | | |
| Bloc 9 — Sécurité | | | |
| **TOTAL** | /46 | | |

### Paiements test effectués
| Méthode | Montant | Résultat | Facture générée |
|---|---|---|---|
| Bancontact test | 89€ | | |
| Carte Visa test | 119€ | | |
| Paiement refusé | 89€ | | |

### Vérification commissions
| Revendeur | Paiements clients | Commission calculée | Commission reversée |
|---|---|---|---|
| Agence Test Dupont (20%) | | | |

### Bugs identifiés
| ID | Description | Sévérité |
|---|---|---|
| BUG-S5-001 | | |

### Décision
[ ] ✅ GO Sprint 6 — Infra & Déploiement Auto
[ ] ❌ STOP — bugs critiques
```
