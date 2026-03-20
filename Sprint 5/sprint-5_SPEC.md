# SPRINT 5 — SPEC.md
# Paiements & Abonnements
> Durée : 1 semaine | Début : Semaine 8
> Objectif : la facturation tourne automatiquement — chaque module activé génère un revenu récurrent

---

## Contexte pour Claude Code

Lire en premier (ordre obligatoire) :
1. `docs/ARCHITECTURE.md`
2. `docs/DATABASE.md` — sections 2.7 (subscriptions, payments, commissions)
3. `docs/CONVENTIONS.md`
4. `docs/ENV.md` — sections Mollie, Stripe
5. `docs/sprints/sprint-1/SPEC.md` — organisations et utilisateurs
6. `docs/sprints/sprint-4/SPEC.md` — dashboard en place
7. `docs/sprints/sprint-5/SPEC.md` — ce fichier

Sprints 1 à 4 terminés. Les sites tournent, les modules génèrent du contenu, le dashboard affiche les métriques. Ce sprint connecte le tout à la facturation — sans paiement valide, les modules se suspendent.

---

## 1. Périmètre du sprint

### Dans ce sprint ✅
- Tables subscriptions, payments, commissions (migrations complètes)
- Intégration Mollie (abonnements récurrents, Bancontact, SEPA, carte)
- Webhooks Mollie (paiement reçu, échec, remboursement)
- Intégration Stripe Connect (reversements commissions revendeurs)
- Logique dunning : relances J+1, J+7, suspension J+30
- Calcul commissions le 1er du mois (BullMQ)
- Dashboard commissions revendeur (MRR, historique)
- Portail client : historique paiements, téléchargement factures PDF
- Activation/désactivation module depuis backoffice (effet facturation)
- Emails facturation (confirmation, relance, reçu)

### Hors sprint ❌
- Stripe Connect onboarding complet revendeur (flow KYC) → V2 simplifié
- Factures avec numéro TVA belge officiel → à valider avec comptable
- Paiement one-shot 1 900€ (abonnement uniquement pour le MVP)
- Multi-devises (EUR uniquement)

---

## 2. Migrations BDD Sprint 5

### Migration 017 — Subscriptions complètes

```sql
-- packages/db/migrations/20260414_017_subscriptions.sql

CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES sites(id),
  organization_id   UUID NOT NULL REFERENCES organizations(id),

  type              TEXT NOT NULL CHECK (type IN (
    'site_subscription',   -- 89€/mois
    'hosting',             -- 19€/mois
    'module'               -- 10€/mois par module
  )),
  module_id         TEXT REFERENCES module_catalog(id),

  amount            DECIMAL(10,2) NOT NULL,
  currency          TEXT DEFAULT 'EUR',
  billing_cycle     TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN (
    'monthly', 'yearly'
  )),

  -- Provider
  payment_provider  TEXT CHECK (payment_provider IN ('mollie', 'stripe')),
  external_sub_id   TEXT,        -- ID subscription chez Mollie ou Stripe
  mollie_mandate_id TEXT,        -- Mandat SEPA Mollie pour les prélèvements

  status            TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN (
    'trialing', 'active', 'past_due', 'cancelled', 'paused', 'unpaid'
  )),

  trial_end         TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  next_billing_date    TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  cancel_reason        TEXT,
  paused_at            TIMESTAMPTZ,

  -- Dunning
  dunning_attempts     INTEGER DEFAULT 0,
  last_dunning_at      TIMESTAMPTZ,
  dunning_resolved_at  TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_site       ON subscriptions(site_id);
CREATE INDEX idx_subs_org        ON subscriptions(organization_id);
CREATE INDEX idx_subs_status     ON subscriptions(status);
CREATE INDEX idx_subs_billing    ON subscriptions(next_billing_date)
  WHERE status IN ('active', 'trialing');

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_rls" ON subscriptions FOR ALL USING (
  organization_id = auth.organization_id()
  OR organization_id IN (
    SELECT id FROM organizations WHERE parent_id = auth.organization_id()
  )
  OR auth.is_superadmin()
);

-- Trigger updated_at
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Migration 018 — Payments

```sql
-- packages/db/migrations/20260414_018_payments.sql

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id),
  organization_id   UUID NOT NULL REFERENCES organizations(id),

  amount            DECIMAL(10,2) NOT NULL,
  currency          TEXT DEFAULT 'EUR',
  status            TEXT NOT NULL CHECK (status IN (
    'pending', 'paid', 'failed', 'refunded', 'chargeback', 'expired'
  )),

  payment_provider  TEXT CHECK (payment_provider IN ('mollie', 'stripe')),
  external_payment_id TEXT UNIQUE,
  payment_method    TEXT,           -- 'bancontact', 'creditcard', 'directdebit', etc.
  failure_reason    TEXT,

  invoice_pdf_url   TEXT,           -- URL Cloudflare R2
  invoice_number    TEXT UNIQUE,    -- WIA-2026-00001

  paid_at           TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  refund_reason     TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_sub    ON payments(subscription_id);
CREATE INDEX idx_payments_org    ON payments(organization_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date   ON payments(created_at DESC);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_rls" ON payments FOR ALL USING (
  organization_id = auth.organization_id()
  OR organization_id IN (
    SELECT id FROM organizations WHERE parent_id = auth.organization_id()
  )
  OR auth.is_superadmin()
);

-- Séquence pour les numéros de facture
CREATE SEQUENCE invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
  SELECT 'WIA-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
    LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
$$ LANGUAGE SQL;
```

### Migration 019 — Commissions

```sql
-- packages/db/migrations/20260414_019_commissions.sql

CREATE TABLE commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id       UUID NOT NULL REFERENCES organizations(id),
  payment_id        UUID NOT NULL REFERENCES payments(id),
  site_id           UUID NOT NULL REFERENCES sites(id),

  base_amount       DECIMAL(10,2) NOT NULL,
  commission_rate   DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,

  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'paid', 'cancelled'
  )),

  stripe_transfer_id TEXT,          -- ID Stripe Transfer après reversement
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  paid_at           TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);
CREATE INDEX idx_commissions_status   ON commissions(status);
CREATE INDEX idx_commissions_period   ON commissions(period_start, period_end);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_rls" ON commissions FOR ALL USING (
  reseller_id = auth.organization_id()
  OR auth.is_superadmin()
);
```

---

## 3. Service Mollie

```typescript
// packages/api/src/services/mollie.service.ts
import { createMollieClient } from '@mollie/api-client'

export class MollieService {
  private client = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY! })

  /**
   * Crée un premier paiement + mandat SEPA pour les abonnements futurs
   * Utilisé pour l'abonnement site (89€/mois)
   */
  async createFirstPaymentWithMandate(params: {
    amount: number
    description: string
    customerEmail: string
    customerName: string
    webhookUrl: string
    redirectUrl: string
    metadata: Record<string, string>
  }): Promise<{ paymentUrl: string; paymentId: string }> {
    const customer = await this.client.customers.create({
      name: params.customerName,
      email: params.customerEmail,
    })

    const payment = await this.client.payments.create({
      amount: { currency: 'EUR', value: params.amount.toFixed(2) },
      description: params.description,
      redirectUrl: params.redirectUrl,
      webhookUrl: params.webhookUrl,
      customerId: customer.id,
      sequenceType: 'first',   // premier paiement d'une série récurrente
      metadata: params.metadata,
      method: ['bancontact', 'creditcard', 'directdebit'],
    })

    return {
      paymentUrl: payment.getCheckoutUrl()!,
      paymentId: payment.id,
    }
  }

  /**
   * Charge un paiement récurrent via mandat existant
   * Appelé chaque mois par le scheduler
   */
  async chargeRecurring(params: {
    customerId: string
    mandateId: string
    amount: number
    description: string
    webhookUrl: string
    metadata: Record<string, string>
  }): Promise<{ paymentId: string }> {
    const payment = await this.client.payments.create({
      amount: { currency: 'EUR', value: params.amount.toFixed(2) },
      description: params.description,
      webhookUrl: params.webhookUrl,
      customerId: params.customerId,
      mandateId: params.mandateId,
      sequenceType: 'recurring',
      metadata: params.metadata,
    })
    return { paymentId: payment.id }
  }

  /**
   * Vérifie le statut d'un paiement Mollie
   */
  async getPaymentStatus(paymentId: string): Promise<{
    status: 'open' | 'paid' | 'failed' | 'expired' | 'canceled'
    mandateId?: string
    method?: string
    paidAt?: Date
  }> {
    const payment = await this.client.payments.get(paymentId)
    return {
      status: payment.status as any,
      mandateId: payment.mandateId ?? undefined,
      method: payment.method ?? undefined,
      paidAt: payment.paidAt ? new Date(payment.paidAt) : undefined,
    }
  }

  /**
   * Calcule le montant total d'un abonnement (site + modules actifs)
   */
  async calculateMonthlyTotal(siteId: string): Promise<{
    total: number
    breakdown: { label: string; amount: number }[]
  }> {
    const subs = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.siteId, siteId),
        eq(subscriptions.status, 'active'),
      )
    })

    const breakdown = subs.map(s => ({
      label: s.type === 'site_subscription' ? 'Site WapixIA'
           : s.type === 'hosting' ? 'Hébergement'
           : `Module ${s.moduleId}`,
      amount: Number(s.amount),
    }))

    return {
      total: breakdown.reduce((acc, item) => acc + item.amount, 0),
      breakdown,
    }
  }
}
```

---

## 4. Webhooks Mollie

```typescript
// packages/api/src/routes/webhooks/mollie.ts

export async function mollieWebhookHandler(request: FastifyRequest, reply: FastifyReply) {
  // Mollie envoie le paymentId dans le body
  const { id: paymentId } = request.body as { id: string }

  // Vérifier que la requête vient bien de Mollie
  // (Mollie ne signe pas les webhooks — vérifier en fetching le paiement)
  const payment = await mollieService.getPaymentStatus(paymentId)

  // Récupérer le payment en BDD via external_payment_id
  const dbPayment = await db.query.payments.findFirst({
    where: eq(payments.externalPaymentId, paymentId),
    with: { subscription: true }
  })

  if (!dbPayment) {
    // Nouveau paiement — créer l'entrée
    await handleNewPayment(paymentId, payment)
    return reply.code(200).send()
  }

  switch (payment.status) {
    case 'paid':
      await handlePaymentSuccess(dbPayment, payment)
      break
    case 'failed':
    case 'expired':
      await handlePaymentFailure(dbPayment, payment)
      break
    case 'canceled':
      await handlePaymentCancelled(dbPayment)
      break
  }

  reply.code(200).send()
}

async function handlePaymentSuccess(dbPayment: Payment, molliePayment: MolliePaymentStatus) {
  await db.transaction(async (tx) => {
    // 1. Mettre à jour le paiement
    await tx.update(payments)
      .set({
        status: 'paid',
        paidAt: molliePayment.paidAt,
        paymentMethod: molliePayment.method,
      })
      .where(eq(payments.id, dbPayment.id))

    // 2. Activer/prolonger l'abonnement
    await tx.update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
        nextBillingDate: addMonths(new Date(), 1),
        dunningAttempts: 0,
      })
      .where(eq(subscriptions.id, dbPayment.subscriptionId))

    // 3. Si premier paiement — stocker le mandat
    if (molliePayment.mandateId) {
      const sub = dbPayment.subscription
      await tx.update(subscriptions)
        .set({ mollieMandate_id: molliePayment.mandateId })
        .where(eq(subscriptions.id, sub.id))
    }

    // 4. Générer la facture PDF
    await invoiceQueue.add('generate-invoice', { paymentId: dbPayment.id })

    // 5. Calculer et enregistrer la commission revendeur
    await commissionQueue.add('calculate-commission', { paymentId: dbPayment.id })

    // 6. Email de confirmation au client
    await emailQueue.add('send-email', {
      templateId: process.env.BREVO_TEMPLATE_PAYMENT_CONFIRMED,
      to: dbPayment.subscription.ownerEmail,
      params: {
        amount: dbPayment.amount,
        period: formatPeriod(new Date()),
      }
    })
  })
}

async function handlePaymentFailure(dbPayment: Payment, molliePayment: MolliePaymentStatus) {
  await db.update(payments)
    .set({
      status: 'failed',
      failureReason: 'Paiement refusé par la banque',
    })
    .where(eq(payments.id, dbPayment.id))

  const sub = dbPayment.subscription
  const newAttempts = (sub.dunningAttempts || 0) + 1

  await db.update(subscriptions)
    .set({
      status: 'past_due',
      dunningAttempts: newAttempts,
      lastDunningAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id))

  // Planifier la prochaine relance selon le nombre de tentatives
  const dunningDelay = getDunningDelay(newAttempts)
  if (dunningDelay) {
    await dunningQueue.add('retry-payment', { subscriptionId: sub.id }, {
      delay: dunningDelay,
    })
  } else {
    // 3 tentatives échouées → suspendre
    await suspendSubscription(sub.id, 'max_dunning_reached')
  }

  // Email de relance au client
  await emailQueue.add('send-email', {
    templateId: process.env.BREVO_TEMPLATE_PAYMENT_FAILED,
    to: sub.ownerEmail,
    params: {
      attemptNumber: newAttempts,
      nextRetryDate: formatDate(addDays(new Date(), dunningDelay ? dunningDelay / 86400000 : 0)),
      updatePaymentUrl: `https://app.wapixia.com/billing`,
    }
  })
}
```

---

## 5. Logique Dunning (relances impayés)

```typescript
// packages/api/src/services/dunning.service.ts

/**
 * Délais de relance selon le nombre de tentatives
 */
function getDunningDelay(attemptNumber: number): number | null {
  const delays: Record<number, number> = {
    1: 24 * 3600 * 1000,    // J+1 : relance email
    2: 7 * 24 * 3600 * 1000, // J+7 : deuxième tentative de paiement
    3: null,                  // J+30 : suspension (géré séparément)
  }
  return delays[attemptNumber] ?? null
}

/**
 * Politique complète de dunning WapixIA :
 *
 * J+0  : Paiement échoué → email "Paiement non abouti"
 * J+1  : Relance email + retry paiement automatique
 * J+3  : Email de rappel (pas de retry)
 * J+7  : Deuxième retry paiement + email "Dernier avertissement"
 * J+14 : Modules IA suspendus (site reste actif)
 * J+30 : Site suspendu (page "Compte suspendu" à la place)
 * J+60 : Annulation définitive + données conservées 90 jours
 */
export async function processDunning(subscriptionId: string): Promise<void> {
  const sub = await getSubscriptionWithSite(subscriptionId)
  if (sub.status !== 'past_due') return

  const daysPastDue = Math.floor(
    (Date.now() - sub.lastDunningAt!.getTime()) / (24 * 3600 * 1000)
  )

  if (daysPastDue >= 30) {
    await suspendSite(sub.siteId, 'payment_failure')
    await emailQueue.add('send-email', {
      templateId: process.env.BREVO_TEMPLATE_SITE_SUSPENDED,
      to: sub.ownerEmail,
      params: { reactivateUrl: `https://app.wapixia.com/billing` }
    })
  } else if (daysPastDue >= 14) {
    await suspendModules(sub.siteId)
    await emailQueue.add('send-email', {
      templateId: process.env.BREVO_TEMPLATE_MODULES_SUSPENDED,
      to: sub.ownerEmail,
    })
  } else if (daysPastDue >= 7) {
    // Retry paiement
    await retryPayment(sub)
  } else if (daysPastDue >= 1) {
    // Email de rappel uniquement
    await emailQueue.add('send-email', {
      templateId: process.env.BREVO_TEMPLATE_PAYMENT_REMINDER,
      to: sub.ownerEmail,
    })
  }
}

async function suspendSite(siteId: string, reason: string): Promise<void> {
  await db.update(sites)
    .set({ status: 'suspended' })
    .where(eq(sites.id, siteId))

  // Le site affiche une page "Compte suspendu" via middleware Next.js
  // Déclenché automatiquement via le statut du site dans le CMS
}

async function suspendModules(siteId: string): Promise<void> {
  await db.update(siteModules)
    .set({ status: 'paused' })
    .where(and(
      eq(siteModules.siteId, siteId),
      eq(siteModules.status, 'active')
    ))
  // Les jobs BullMQ vérifient module.status avant de générer du contenu
}
```

---

## 6. Service Stripe Connect — Commissions revendeurs

```typescript
// packages/api/src/services/stripe-connect.service.ts
import Stripe from 'stripe'

export class StripeConnectService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

  /**
   * Transfère la commission d'un paiement vers le compte Stripe du revendeur
   */
  async transferCommission(params: {
    resellerId: string
    amount: number           // en centimes
    currency: string
    paymentId: string
    description: string
  }): Promise<{ transferId: string }> {
    const reseller = await db.query.organizations.findFirst({
      where: eq(organizations.id, params.resellerId)
    })

    if (!reseller?.stripeAccountId) {
      throw new Error(`Revendeur ${params.resellerId} n'a pas de compte Stripe Connect`)
    }

    const transfer = await this.stripe.transfers.create({
      amount: Math.round(params.amount * 100), // EUR → centimes
      currency: params.currency.toLowerCase(),
      destination: reseller.stripeAccountId,
      description: params.description,
      metadata: { paymentId: params.paymentId, resellerId: params.resellerId },
    })

    return { transferId: transfer.id }
  }
}

/**
 * Job BullMQ — Calcul et paiement des commissions (1er du mois)
 */
export async function processMonthlyCommissions(): Promise<void> {
  const now = new Date()
  const periodStart = startOfMonth(subMonths(now, 1))
  const periodEnd = endOfMonth(subMonths(now, 1))

  // Récupérer tous les paiements du mois précédent avec un revendeur
  const paidPayments = await db.query.payments.findMany({
    where: and(
      eq(payments.status, 'paid'),
      gte(payments.paidAt, periodStart),
      lte(payments.paidAt, periodEnd),
    ),
    with: {
      subscription: { with: { organization: true } }
    }
  })

  for (const payment of paidPayments) {
    const org = payment.subscription.organization
    if (org.type !== 'reseller' || !org.stripeAccountId) continue

    const rate = Number(org.commissionRate) / 100
    const commissionAmount = Number(payment.amount) * rate

    // Créer la commission en BDD
    const [commission] = await db.insert(commissions).values({
      resellerId: org.id,
      paymentId: payment.id,
      siteId: payment.subscription.siteId,
      baseAmount: payment.amount,
      commissionRate: org.commissionRate,
      commissionAmount,
      status: 'processing',
      periodStart,
      periodEnd,
    }).returning()

    // Transférer via Stripe Connect
    try {
      const { transferId } = await stripeConnectService.transferCommission({
        resellerId: org.id,
        amount: commissionAmount,
        currency: 'EUR',
        paymentId: payment.id,
        description: `Commission ${formatMonth(periodStart)} — ${payment.subscription.siteId}`,
      })

      await db.update(commissions)
        .set({ status: 'paid', stripeTransferId: transferId, paidAt: new Date() })
        .where(eq(commissions.id, commission.id))

    } catch (error) {
      await db.update(commissions)
        .set({ status: 'pending' })  // réessayer manuellement
        .where(eq(commissions.id, commission.id))

      await alertSuperAdmin({ type: 'commission_transfer_failed', commissionId: commission.id, error: error.message })
    }
  }
}
```

---

## 7. Générateur de factures PDF

```typescript
// packages/api/src/services/invoice-generator.service.ts
import { renderToBuffer } from '@react-pdf/renderer'

export async function generateInvoicePDF(paymentId: string): Promise<string> {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.id, paymentId),
    with: {
      subscription: {
        with: { site: true, organization: true }
      }
    }
  })

  if (!payment) throw new Error(`Payment ${paymentId} introuvable`)

  // Générer le numéro de facture si pas encore assigné
  if (!payment.invoiceNumber) {
    const invoiceNumber = await db.execute(sql`SELECT generate_invoice_number()`)
    await db.update(payments)
      .set({ invoiceNumber: invoiceNumber.rows[0].generate_invoice_number })
      .where(eq(payments.id, paymentId))
    payment.invoiceNumber = invoiceNumber.rows[0].generate_invoice_number
  }

  const pdfBuffer = await renderToBuffer(
    InvoicePDF({
      invoiceNumber: payment.invoiceNumber,
      issueDate: payment.paidAt || payment.createdAt,
      dueDate: payment.paidAt,
      seller: {
        name: 'Wapix SPRL',
        address: 'Rue de la Station 47, 7500 Tournai',
        vatNumber: 'BE0123456789',
        email: 'facturation@wapixia.com',
      },
      buyer: {
        name: payment.subscription.organization.name,
        address: '',  // à compléter depuis les données org
        vatNumber: '',
      },
      lines: [{
        description: getSubscriptionDescription(payment.subscription),
        quantity: 1,
        unitPrice: Number(payment.amount),
        vatRate: 21,
        total: Number(payment.amount),
      }],
      subtotal: Number(payment.amount),
      vatAmount: Number(payment.amount) * 0.21,
      total: Number(payment.amount) * 1.21,
      currency: 'EUR',
    })
  )

  // Upload sur R2
  const fileName = `invoices/${payment.subscription.organizationId}/${payment.invoiceNumber}.pdf`
  await r2Client.put(fileName, pdfBuffer, { contentType: 'application/pdf' })
  const invoiceUrl = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${fileName}`

  await db.update(payments)
    .set({ invoicePdfUrl: invoiceUrl })
    .where(eq(payments.id, paymentId))

  return invoiceUrl
}
```

---

## 8. Routes API Sprint 5

```
── Abonnements ──
GET  /api/v1/sites/:id/subscription          Abonnement actuel + modules facturés
POST /api/v1/sites/:id/subscription/start    Démarrer l'abonnement (1er paiement Mollie)
GET  /api/v1/sites/:id/subscription/checkout URL checkout Mollie
POST /api/v1/sites/:id/subscription/cancel   Résilier l'abonnement
GET  /api/v1/sites/:id/billing               Récap facturation (total mensuel)

── Paiements ──
GET  /api/v1/sites/:id/payments              Historique des paiements
GET  /api/v1/sites/:id/payments/:paymentId/invoice  Télécharger facture PDF

── Webhooks ──
POST /api/v1/webhooks/mollie                 Webhook Mollie (pas d'auth Bearer)
POST /api/v1/webhooks/stripe                 Webhook Stripe (signature HMAC)

── Commissions (revendeurs) ──
GET  /api/v1/reseller/commissions            Liste des commissions (par reseller)
GET  /api/v1/reseller/mrr                    MRR total revendeur
GET  /api/v1/admin/commissions               Toutes les commissions (superadmin)
POST /api/v1/admin/commissions/process       Déclencher le calcul manuellement
```

### Détail — POST /api/v1/sites/:id/subscription/start

```typescript
// 1. Valider que le site est en status 'staging' ou 'live'
// 2. Vérifier qu'il n'y a pas déjà un abonnement actif
// 3. Créer l'abonnement en BDD (status = 'trialing', trial_end = now + 14j)
// 4. Créer le paiement initial chez Mollie
// 5. Retourner l'URL de checkout Mollie
// 6. Le client paie → webhook Mollie → statut passe à 'active'

// Montant initial = 89€ (abonnement) + modules actifs (N × 10€)
// Ex: 89€ + 3 modules = 119€ pour le premier mois

Response: {
  data: {
    subscriptionId: string
    checkoutUrl: string       // URL Mollie à ouvrir dans le browser
    totalAmount: number
    breakdown: { label: string; amount: number }[]
  }
}
```

---

## 9. Pages frontend à implémenter

### apps/dashboard — /billing

```
/billing
  ┌── Abonnement actuel
  │   ├── Plan : WapixIA Mensuel — 89€/mois
  │   ├── Statut : Actif ✅ / Impayé ⚠️ / Suspendu ❌
  │   ├── Prochain prélèvement : [date] — [montant]
  │   └── Bouton "Résilier l'abonnement"
  │
  ├── Récapitulatif mensuel
  │   ├── Site WapixIA : 89€
  │   ├── [Module X] : 10€
  │   ├── [Module Y] : 10€
  │   └── Total HT : [N]€ | TVA 21% : [N]€ | Total TTC : [N]€
  │
  ├── Historique des paiements
  │   └── Tableau : date | description | montant | statut | facture PDF
  │
  └── Méthode de paiement
      ├── Méthode actuelle (ex: Bancontact XXXX)
      └── Bouton "Modifier ma méthode de paiement"
```

### apps/reseller — /commissions

```
/commissions
  ┌── MRR actuel (somme des abonnements de tous les clients)
  │   └── Évolution vs mois précédent
  │
  ├── Commissions du mois en cours (en attente)
  │
  ├── Historique des reversements
  │   └── Tableau : mois | nb clients | MRR | taux | commission | statut | date
  │
  └── Lien affiliation UUID
      └── Copier le lien | stats clics | stats conversions
```

### apps/admin — /billing (SuperAdmin)

```
/billing (SuperAdmin)
  ├── MRR global WapixIA (toutes les orgs)
  ├── Tableau par organisation : MRR | commission due | statut
  ├── Commissions en attente de reversement
  └── Bouton "Lancer les reversements du mois"
```

---

## 10. Variables d'environnement Sprint 5

```env
# Mollie
MOLLIE_API_KEY=live_...
MOLLIE_API_KEY_TEST=test_...
MOLLIE_WEBHOOK_URL=https://api.wapixia.com/api/v1/webhooks/mollie

# Stripe Connect
STRIPE_SECRET_KEY=sk_live_...
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...

# Brevo templates facturation
BREVO_TEMPLATE_PAYMENT_CONFIRMED=8
BREVO_TEMPLATE_PAYMENT_FAILED=9
BREVO_TEMPLATE_PAYMENT_REMINDER=10
BREVO_TEMPLATE_MODULES_SUSPENDED=11
BREVO_TEMPLATE_SITE_SUSPENDED=12

# Facturation
INVOICE_SELLER_NAME=Wapix SPRL
INVOICE_SELLER_VAT=BE0123456789
INVOICE_SELLER_ADDRESS=Rue de la Station 47, 7500 Tournai
```

---

## 11. Instructions pour Claude Code

```
Tu travailles sur le Sprint 5 de WapixIA — Paiements & Abonnements.

Lire avant de coder :
1. docs/ARCHITECTURE.md
2. docs/DATABASE.md — section 2.7
3. docs/CONVENTIONS.md
4. docs/ENV.md — sections Mollie, Stripe
5. docs/sprints/sprint-5/SPEC.md

Ordre de livraison :
1. feat/sprint5-db-migrations       — migrations 017 à 019
2. feat/sprint5-mollie-service      — MollieService + webhooks
3. feat/sprint5-dunning-service     — logique relances J+1/J+7/J+30
4. feat/sprint5-stripe-connect      — commissions revendeurs
5. feat/sprint5-invoice-generator   — PDF factures @react-pdf/renderer
6. feat/sprint5-commission-job      — job BullMQ 1er du mois
7. feat/sprint5-api-billing         — routes subscription + payments
8. feat/sprint5-api-webhooks        — handlers Mollie + Stripe
9. feat/sprint5-frontend-billing    — page /billing client
10. feat/sprint5-frontend-commissions — page /commissions revendeur

Règles absolues Sprint 5 :
- Les webhooks Mollie/Stripe n'ont PAS de Bearer auth — valider par fetch du paiement
- Stripe webhooks validés par signature HMAC (stripe.webhooks.constructEvent)
- Toutes les transactions BDD dans des db.transaction() — atomicité obligatoire
- Jamais suspendre un site sans email préalable au client
- Tester avec les clés de TEST Mollie/Stripe en staging (jamais les clés live)
- Le montant en BDD est TOUJOURS HT — TVA calculée à l'affichage
```
