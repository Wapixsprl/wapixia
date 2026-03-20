/**
 * Service Génération de Factures — PDF + numérotation séquentielle
 * Sprint 5 : génération locale, upload R2 en stub
 *
 * Vendeur par défaut : Wapix SPRL
 * TVA 21% — devise EUR
 */

import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { InvoicePDF, type InvoiceData, type InvoiceLineItem } from '../pdf-templates/InvoicePDF.js'

// ── Types ──

interface InvoiceGeneratorConfig {
  r2BucketUrl: string
}

interface PaymentRow {
  id: string
  subscription_id: string
  mollie_payment_id: string
  amount: string
  currency: string
  method: string | null
  paid_at: string | null
  metadata: Record<string, string> | null
}

interface SubscriptionRow {
  id: string
  site_id: string
}

interface SiteRow {
  id: string
  name: string
  organization_id: string
}

interface OrganizationRow {
  id: string
  name: string
}

interface UserRow {
  email: string
  first_name: string | null
  last_name: string | null
}

interface SiteModuleRow {
  module_id: string
  module_catalog: {
    name: string
    price_monthly: string
  }
}

interface GenerateInvoiceResult {
  invoiceNumber: string
  pdfUrl: string
  pdfBuffer: Buffer
  totalHT: number
  totalVAT: number
  totalTTC: number
}

// ── Constantes vendeur ──

const WAPIX_SELLER = {
  name: 'Wapix SPRL',
  address: 'Rue de la Station 47',
  postalCode: '7500',
  city: 'Tournai',
  country: 'Belgique',
  vatNumber: 'BE0123456789',
} as const

const VAT_RATE = 21
const DEFAULT_CURRENCY = 'EUR'

// ── Service ──

export class InvoiceGeneratorService {
  private config: InvoiceGeneratorConfig

  constructor(config: InvoiceGeneratorConfig) {
    this.config = config
  }

  /**
   * Génère une facture PDF pour un paiement donné
   */
  async generateInvoicePDF(
    paymentId: string,
    supabase: SupabaseClient,
  ): Promise<GenerateInvoiceResult> {
    // 1. Récupérer le numéro de facture via la fonction SQL
    const invoiceNumber = await this.generateInvoiceNumber(supabase)

    // 2. Récupérer les données du paiement
    const { data: payment, error: payError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (payError || !payment) {
      throw new Error(`Paiement introuvable: ${payError?.message ?? 'Aucune donnée'}`)
    }

    const pay = payment as PaymentRow

    // 3. Récupérer l'abonnement et le site
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, site_id')
      .eq('id', pay.subscription_id)
      .single()

    const sub = subscription as SubscriptionRow | null

    const { data: site } = await supabase
      .from('sites')
      .select('id, name, organization_id')
      .eq('id', sub?.site_id ?? '')
      .single()

    const siteRow = site as SiteRow | null

    // 4. Récupérer l'organisation (acheteur)
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', siteRow?.organization_id ?? '')
      .single()

    const orgRow = org as OrganizationRow | null

    // 5. Récupérer le propriétaire du site pour l'email
    const { data: owner } = await supabase
      .from('users')
      .select('email, first_name, last_name')
      .eq('organization_id', siteRow?.organization_id ?? '')
      .limit(1)
      .single()

    const ownerRow = owner as UserRow | null

    // 6. Récupérer les modules actifs pour les lignes de facture
    const { data: modules } = await supabase
      .from('site_modules')
      .select('module_id, module_catalog!inner(name, price_monthly)')
      .eq('site_id', sub?.site_id ?? '')
      .eq('status', 'active')

    const moduleRows = (modules ?? []) as unknown as SiteModuleRow[]

    // 7. Construire les lignes de facture
    const lines: InvoiceLineItem[] = moduleRows.map((mod) => {
      const priceHT = Number.parseFloat(mod.module_catalog.price_monthly)
      return {
        description: `${mod.module_catalog.name} — Abonnement mensuel`,
        quantity: 1,
        unitPriceHT: priceHT,
        vatRate: VAT_RATE,
        totalHT: priceHT,
      }
    })

    // Si aucun module trouvé, utiliser le montant du paiement comme ligne unique
    if (lines.length === 0) {
      const amountTTC = Number.parseFloat(pay.amount)
      const amountHT = Math.round((amountTTC / (1 + VAT_RATE / 100)) * 100) / 100
      lines.push({
        description: `Abonnement WapixIA — ${siteRow?.name ?? 'Site'}`,
        quantity: 1,
        unitPriceHT: amountHT,
        vatRate: VAT_RATE,
        totalHT: amountHT,
      })
    }

    // 8. Calculer les totaux
    const subtotalHT = Math.round(lines.reduce((sum, l) => sum + l.totalHT, 0) * 100) / 100
    const totalVAT = Math.round(subtotalHT * (VAT_RATE / 100) * 100) / 100
    const totalTTC = Math.round((subtotalHT + totalVAT) * 100) / 100

    const now = new Date()
    const invoiceDate = now.toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(
      'fr-BE',
      { day: '2-digit', month: '2-digit', year: 'numeric' },
    )

    // 9. Préparer les données de la facture
    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate,
      dueDate,
      seller: WAPIX_SELLER,
      buyer: {
        name: orgRow?.name ?? 'Client',
        email: ownerRow?.email ?? '',
        address: '',
        postalCode: '',
        city: '',
        country: 'Belgique',
        vatNumber: undefined,
      },
      lines,
      subtotalHT,
      totalVAT,
      totalTTC,
      currency: DEFAULT_CURRENCY,
      paymentMethod: pay.method ?? 'Virement',
      paymentRef: pay.mollie_payment_id,
    }

    // 10. Générer le PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoicePDF, { data: invoiceData }),
    )

    // 11. Upload vers R2 (stub — retourne une URL locale)
    const pdfUrl = await this.uploadToR2(invoiceNumber, pdfBuffer)

    // 12. Enregistrer la facture en base
    await supabase.from('invoices').insert({
      payment_id: paymentId,
      invoice_number: invoiceNumber,
      amount_ht: String(subtotalHT),
      amount_vat: String(totalVAT),
      amount_ttc: String(totalTTC),
      currency: DEFAULT_CURRENCY,
      pdf_url: pdfUrl,
      issued_at: now.toISOString(),
    })

    return {
      invoiceNumber,
      pdfUrl,
      pdfBuffer: Buffer.from(pdfBuffer),
      totalHT: subtotalHT,
      totalVAT,
      totalTTC,
    }
  }

  // ── Méthodes privées ──

  /**
   * Génère un numéro de facture séquentiel via la fonction SQL
   * Format : WAPIX-2026-000001
   */
  private async generateInvoiceNumber(supabase: SupabaseClient): Promise<string> {
    const { data, error } = await supabase.rpc('generate_invoice_number')

    if (error || !data) {
      // Fallback si la fonction SQL n'existe pas encore
      const now = new Date()
      const year = now.getFullYear()
      const seq = Math.floor(Math.random() * 999999)
        .toString()
        .padStart(6, '0')
      console.log(
        '[InvoiceGeneratorService] Fonction SQL generate_invoice_number() introuvable, utilisation du fallback',
      )
      return `WAPIX-${year}-${seq}`
    }

    return data as string
  }

  /**
   * Upload du PDF vers Cloudflare R2 (stub)
   * Retourne une URL locale pour le développement
   */
  private async uploadToR2(
    invoiceNumber: string,
    _pdfBuffer: Uint8Array,
  ): Promise<string> {
    const filename = `invoices/${invoiceNumber.replace(/\s/g, '_')}.pdf`

    if (!this.config.r2BucketUrl || this.config.r2BucketUrl === 'stub') {
      console.log(
        `[InvoiceGeneratorService] STUB R2: upload("${filename}") — ${_pdfBuffer.byteLength} octets`,
      )
      return `https://cdn.wapixia.com/${filename}`
    }

    // TODO Sprint 7 : implémenter l'upload réel vers Cloudflare R2
    // const uploadUrl = `${this.config.r2BucketUrl}/${filename}`
    // await fetch(uploadUrl, { method: 'PUT', body: pdfBuffer, headers: { ... } })

    return `${this.config.r2BucketUrl}/${filename}`
  }
}

/**
 * Factory -- crée une instance depuis les variables d'environnement
 */
export function createInvoiceGeneratorService(): InvoiceGeneratorService {
  return new InvoiceGeneratorService({
    r2BucketUrl: process.env.R2_BUCKET_URL ?? 'stub',
  })
}
