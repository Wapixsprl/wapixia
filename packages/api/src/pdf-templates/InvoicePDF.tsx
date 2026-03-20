/**
 * Template PDF Facture — WapixIA
 * Utilise @react-pdf/renderer pour générer un PDF A4
 * Branding WapixIA : #00D4B1
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ── Types ──

export interface InvoiceLineItem {
  description: string
  quantity: number
  unitPriceHT: number
  vatRate: number
  totalHT: number
}

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string

  // Vendeur
  seller: {
    name: string
    address: string
    postalCode: string
    city: string
    country: string
    vatNumber: string
  }

  // Acheteur
  buyer: {
    name: string
    email: string
    address: string
    postalCode: string
    city: string
    country: string
    vatNumber?: string
  }

  // Lignes
  lines: InvoiceLineItem[]

  // Totaux
  subtotalHT: number
  totalVAT: number
  totalTTC: number
  currency: string

  // Paiement
  paymentMethod: string
  paymentRef: string
}

// ── Couleurs ──

const BRAND_COLOR = '#00D4B1'
const DARK_COLOR = '#050D1A'
const GRAY_COLOR = '#6B7280'
const LIGHT_GRAY = '#F3F4F6'
const BORDER_COLOR = '#E5E7EB'

// ── Styles ──

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 40,
    color: DARK_COLOR,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  brandName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_COLOR,
  },
  invoiceTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: DARK_COLOR,
    textAlign: 'right',
  },
  invoiceMeta: {
    fontSize: 9,
    color: GRAY_COLOR,
    textAlign: 'right',
    marginTop: 4,
  },
  // Parties (vendeur / acheteur)
  partiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  partyBlock: {
    width: '45%',
  },
  partyLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_COLOR,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 1,
  },
  partyName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  partyDetail: {
    fontSize: 9,
    color: GRAY_COLOR,
    marginBottom: 1,
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: DARK_COLOR,
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  tableRowAlt: {
    backgroundColor: LIGHT_GRAY,
  },
  tableCell: {
    fontSize: 9,
  },
  // Colonnes
  colDescription: { width: '40%' },
  colQuantity: { width: '12%', textAlign: 'center' },
  colUnitPrice: { width: '16%', textAlign: 'right' },
  colVAT: { width: '12%', textAlign: 'center' },
  colTotal: { width: '20%', textAlign: 'right' },
  // Totaux
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 30,
  },
  totalsBlock: {
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: 9,
    color: GRAY_COLOR,
  },
  totalValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalTTCRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: BRAND_COLOR,
    borderRadius: 4,
    marginTop: 4,
  },
  totalTTCLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  totalTTCValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: GRAY_COLOR,
  },
  paymentInfo: {
    marginBottom: 20,
  },
  paymentLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: BRAND_COLOR,
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 1,
  },
  paymentDetail: {
    fontSize: 9,
    color: GRAY_COLOR,
  },
})

// ── Helpers ──

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

// ── Composant principal ──

export function InvoicePDF({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>WapixIA</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceMeta}>N° {data.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Date : {data.invoiceDate}</Text>
            <Text style={styles.invoiceMeta}>Échéance : {data.dueDate}</Text>
          </View>
        </View>

        {/* Vendeur / Acheteur */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Vendeur</Text>
            <Text style={styles.partyName}>{data.seller.name}</Text>
            <Text style={styles.partyDetail}>{data.seller.address}</Text>
            <Text style={styles.partyDetail}>
              {data.seller.postalCode} {data.seller.city}
            </Text>
            <Text style={styles.partyDetail}>{data.seller.country}</Text>
            <Text style={styles.partyDetail}>TVA : {data.seller.vatNumber}</Text>
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Client</Text>
            <Text style={styles.partyName}>{data.buyer.name}</Text>
            <Text style={styles.partyDetail}>{data.buyer.email}</Text>
            <Text style={styles.partyDetail}>{data.buyer.address}</Text>
            <Text style={styles.partyDetail}>
              {data.buyer.postalCode} {data.buyer.city}
            </Text>
            <Text style={styles.partyDetail}>{data.buyer.country}</Text>
            {data.buyer.vatNumber && (
              <Text style={styles.partyDetail}>TVA : {data.buyer.vatNumber}</Text>
            )}
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQuantity]}>Qté</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>Prix unit. HT</Text>
            <Text style={[styles.tableHeaderCell, styles.colVAT]}>TVA</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total HT</Text>
          </View>

          {/* Table Rows */}
          {data.lines.map((line, index) => (
            <View
              key={`line-${index}`}
              style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colDescription]}>
                {line.description}
              </Text>
              <Text style={[styles.tableCell, styles.colQuantity]}>{line.quantity}</Text>
              <Text style={[styles.tableCell, styles.colUnitPrice]}>
                {formatCurrency(line.unitPriceHT, data.currency)}
              </Text>
              <Text style={[styles.tableCell, styles.colVAT]}>{line.vatRate}%</Text>
              <Text style={[styles.tableCell, styles.colTotal]}>
                {formatCurrency(line.totalHT, data.currency)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totaux */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sous-total HT</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.subtotalHT, data.currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA 21%</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(data.totalVAT, data.currency)}
              </Text>
            </View>
            <View style={styles.totalTTCRow}>
              <Text style={styles.totalTTCLabel}>Total TTC</Text>
              <Text style={styles.totalTTCValue}>
                {formatCurrency(data.totalTTC, data.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Infos paiement */}
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentLabel}>Informations de paiement</Text>
          <Text style={styles.paymentDetail}>
            Méthode : {data.paymentMethod}
          </Text>
          <Text style={styles.paymentDetail}>
            Référence : {data.paymentRef}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.seller.name} — {data.seller.address}, {data.seller.postalCode}{' '}
            {data.seller.city} — TVA {data.seller.vatNumber}
          </Text>
          <Text style={styles.footerText}>
            Généré par WapixIA — www.wapixia.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}
