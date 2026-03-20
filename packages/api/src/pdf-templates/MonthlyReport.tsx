/**
 * MonthlyReport — PDF template using @react-pdf/renderer
 * Sprint 4 : Layout A4 4 pages avec branding WapixIA
 *
 * Page 1 : Header + Visibility Score gauge + 4 KPIs avec deltas
 * Page 2 : Traffic breakdown + SEO stats + top queries table
 * Page 3 : Contenu publié + Réputation + Leads par type
 * Page 4 : Comparaison concurrents + 3 recommandations IA
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'

// ---------- Brand constants ----------

const BRAND = {
  primary: '#00D4B1',
  primaryDark: '#00B89C',
  dark: '#1A1A2E',
  gray: '#6B7280',
  lightGray: '#F3F4F6',
  white: '#FFFFFF',
  red: '#EF4444',
  green: '#10B981',
  orange: '#F59E0B',
} as const

// ---------- Styles ----------

const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.white,
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BRAND.dark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.primary,
  },
  brandName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  siteName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.dark,
  },
  periodText: {
    fontSize: 9,
    color: BRAND.gray,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.dark,
    marginBottom: 12,
    marginTop: 16,
  },
  // Score gauge
  scoreContainer: {
    alignItems: 'center',
    marginVertical: 20,
    padding: 24,
    backgroundColor: BRAND.lightGray,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 11,
    color: BRAND.gray,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
  },
  scoreMax: {
    fontSize: 16,
    color: BRAND.gray,
  },
  // KPI cards
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  kpiCard: {
    flex: 1,
    padding: 14,
    backgroundColor: BRAND.lightGray,
    borderRadius: 6,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    color: BRAND.gray,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  kpiValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.dark,
  },
  kpiDelta: {
    fontSize: 9,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
  },
  deltaPositive: {
    color: BRAND.green,
  },
  deltaNegative: {
    color: BRAND.red,
  },
  deltaNeutral: {
    color: BRAND.gray,
  },
  // Pillar breakdown
  pillarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.lightGray,
  },
  pillarLabel: {
    fontSize: 10,
    width: 100,
  },
  pillarBar: {
    flex: 1,
    height: 10,
    backgroundColor: BRAND.lightGray,
    borderRadius: 5,
    marginHorizontal: 8,
  },
  pillarBarFill: {
    height: 10,
    backgroundColor: BRAND.primary,
    borderRadius: 5,
  },
  pillarScore: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 50,
    textAlign: 'right',
  },
  // Table
  table: {
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.dark,
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    color: BRAND.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase' as const,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.lightGray,
  },
  tableRowAlt: {
    backgroundColor: BRAND.lightGray,
  },
  tableCell: {
    fontSize: 9,
  },
  // Traffic breakdown
  trafficRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.lightGray,
  },
  trafficLabel: {
    fontSize: 10,
  },
  trafficValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  // Recommendations
  recommendationCard: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: BRAND.lightGray,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.primary,
  },
  recommendationTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.dark,
    marginBottom: 4,
  },
  recommendationBody: {
    fontSize: 9,
    color: BRAND.gray,
    lineHeight: 1.5,
  },
  // Competitor
  competitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.lightGray,
  },
  competitorName: {
    fontSize: 10,
    flex: 1,
  },
  competitorScore: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primary,
    width: 50,
    textAlign: 'right',
  },
  // Stats grid (for content + reputation + leads)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  statBox: {
    width: '48%',
    padding: 12,
    backgroundColor: BRAND.lightGray,
    borderRadius: 6,
  },
  statLabel: {
    fontSize: 8,
    color: BRAND.gray,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.dark,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: BRAND.lightGray,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: BRAND.gray,
  },
  footerPage: {
    fontSize: 7,
    color: BRAND.gray,
  },
})

// ---------- Data types ----------

export interface KPIData {
  label: string
  value: string
  delta: number | null
  unit?: string
}

export interface TrafficBreakdownItem {
  source: string
  sessions: number
  percentage: number
}

export interface QueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: string
  position: string
}

export interface ContentStat {
  label: string
  value: number
}

export interface ReputationStat {
  avgRating: number
  totalReviews: number
  replyRate: number
  newReviewsThisMonth: number
}

export interface LeadStat {
  type: string
  count: number
}

export interface CompetitorData {
  name: string
  score: number
}

export interface RecommendationData {
  title: string
  body: string
}

export interface PillarBreakdown {
  label: string
  score: number
  maxPoints: number
}

export interface MonthlyReportData {
  siteName: string
  siteUrl: string
  period: string
  generatedAt: string
  visibilityScore: number
  pillars: PillarBreakdown[]
  kpis: KPIData[]
  trafficBreakdown: TrafficBreakdownItem[]
  seoStats: {
    avgPosition: string
    totalClicks: number
    totalImpressions: number
    avgCTR: string
  }
  topQueries: QueryRow[]
  contentStats: ContentStat[]
  reputation: ReputationStat
  leads: LeadStat[]
  competitors: CompetitorData[]
  recommendations: RecommendationData[]
}

// ---------- Sub-components ----------

interface PageHeaderProps {
  siteName: string
  period: string
}

function PageHeader({ siteName, period }: PageHeaderProps): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.brandName}>WapixIA</Text>
      <View style={styles.headerRight}>
        <Text style={styles.siteName}>{siteName}</Text>
        <Text style={styles.periodText}>{period}</Text>
      </View>
    </View>
  )
}

interface PageFooterProps {
  pageNumber: number
  totalPages: number
  generatedAt: string
}

function PageFooter({ pageNumber, totalPages, generatedAt }: PageFooterProps): React.JSX.Element {
  return (
    <View style={styles.footer}>
      <Text style={styles.footerText}>
        Rapport WapixIA — {generatedAt}
      </Text>
      <Text style={styles.footerPage}>
        {pageNumber} / {totalPages}
      </Text>
    </View>
  )
}

function DeltaText({ delta }: { delta: number | null }): React.JSX.Element {
  if (delta === null) {
    return <Text style={[styles.kpiDelta, styles.deltaNeutral]}>N/A</Text>
  }
  const isPositive = delta > 0
  const sign = isPositive ? '+' : ''
  const style = isPositive
    ? styles.deltaPositive
    : delta < 0
      ? styles.deltaNegative
      : styles.deltaNeutral
  return (
    <Text style={[styles.kpiDelta, style]}>
      {sign}{delta}%
    </Text>
  )
}

// ---------- Page components ----------

function ScorePage({ data }: { data: MonthlyReportData }): React.JSX.Element {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader siteName={data.siteName} period={data.period} />

      <Text style={styles.sectionTitle}>Score de Visibilite</Text>

      <View style={styles.scoreContainer}>
        <Text style={styles.scoreLabel}>VISIBILITY SCORE</Text>
        <Text style={styles.scoreValue}>{data.visibilityScore}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>

      {/* Pillar breakdown */}
      {data.pillars.map((pillar) => (
        <View style={styles.pillarRow} key={pillar.label}>
          <Text style={styles.pillarLabel}>{pillar.label}</Text>
          <View style={styles.pillarBar}>
            <View
              style={[
                styles.pillarBarFill,
                { width: `${(pillar.score / pillar.maxPoints) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.pillarScore}>
            {pillar.score}/{pillar.maxPoints}
          </Text>
        </View>
      ))}

      {/* 4 KPIs */}
      <Text style={styles.sectionTitle}>Indicateurs Cles</Text>
      <View style={styles.kpiRow}>
        {data.kpis.map((kpi) => (
          <View style={styles.kpiCard} key={kpi.label}>
            <Text style={styles.kpiLabel}>{kpi.label}</Text>
            <Text style={styles.kpiValue}>
              {kpi.value}{kpi.unit ?? ''}
            </Text>
            <DeltaText delta={kpi.delta} />
          </View>
        ))}
      </View>

      <PageFooter pageNumber={1} totalPages={4} generatedAt={data.generatedAt} />
    </Page>
  )
}

function TrafficSEOPage({ data }: { data: MonthlyReportData }): React.JSX.Element {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader siteName={data.siteName} period={data.period} />

      <Text style={styles.sectionTitle}>Sources de Trafic</Text>
      {data.trafficBreakdown.map((item) => (
        <View style={styles.trafficRow} key={item.source}>
          <Text style={styles.trafficLabel}>{item.source}</Text>
          <Text style={styles.trafficValue}>
            {item.sessions} ({item.percentage}%)
          </Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Performance SEO</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Position moyenne</Text>
          <Text style={styles.statValue}>{data.seoStats.avgPosition}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Clics</Text>
          <Text style={styles.statValue}>{data.seoStats.totalClicks}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Impressions</Text>
          <Text style={styles.statValue}>{data.seoStats.totalImpressions}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>CTR moyen</Text>
          <Text style={styles.statValue}>{data.seoStats.avgCTR}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Top Requetes</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Requete</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Clics</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Impr.</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>CTR</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Pos.</Text>
        </View>
        {data.topQueries.map((row, index) => (
          <View
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            key={row.query}
          >
            <Text style={[styles.tableCell, { flex: 3 }]}>{row.query}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{row.clicks}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{row.impressions}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{row.ctr}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{row.position}</Text>
          </View>
        ))}
      </View>

      <PageFooter pageNumber={2} totalPages={4} generatedAt={data.generatedAt} />
    </Page>
  )
}

function ContentReputationPage({ data }: { data: MonthlyReportData }): React.JSX.Element {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader siteName={data.siteName} period={data.period} />

      <Text style={styles.sectionTitle}>Contenu Publie</Text>
      <View style={styles.statsGrid}>
        {data.contentStats.map((stat) => (
          <View style={styles.statBox} key={stat.label}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statValue}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Reputation</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Note moyenne</Text>
          <Text style={styles.statValue}>{data.reputation.avgRating}/5</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total avis</Text>
          <Text style={styles.statValue}>{data.reputation.totalReviews}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Taux de reponse</Text>
          <Text style={styles.statValue}>{Math.round(data.reputation.replyRate * 100)}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Nouveaux avis (ce mois)</Text>
          <Text style={styles.statValue}>{data.reputation.newReviewsThisMonth}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Leads par Type</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Type</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Nombre</Text>
        </View>
        {data.leads.map((lead, index) => (
          <View
            style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
            key={lead.type}
          >
            <Text style={[styles.tableCell, { flex: 2 }]}>{lead.type}</Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>{lead.count}</Text>
          </View>
        ))}
      </View>

      <PageFooter pageNumber={3} totalPages={4} generatedAt={data.generatedAt} />
    </Page>
  )
}

function CompetitorsRecommendationsPage({ data }: { data: MonthlyReportData }): React.JSX.Element {
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader siteName={data.siteName} period={data.period} />

      <Text style={styles.sectionTitle}>Comparaison Concurrents</Text>
      {data.competitors.length > 0 ? (
        data.competitors.map((competitor) => (
          <View style={styles.competitorRow} key={competitor.name}>
            <Text style={styles.competitorName}>{competitor.name}</Text>
            <Text style={styles.competitorScore}>{competitor.score}/100</Text>
          </View>
        ))
      ) : (
        <Text style={{ fontSize: 10, color: BRAND.gray, fontStyle: 'italic' }}>
          Aucun concurrent detecte pour le moment.
        </Text>
      )}

      <Text style={styles.sectionTitle}>Recommandations IA</Text>
      {data.recommendations.map((rec) => (
        <View style={styles.recommendationCard} key={rec.title}>
          <Text style={styles.recommendationTitle}>{rec.title}</Text>
          <Text style={styles.recommendationBody}>{rec.body}</Text>
        </View>
      ))}

      <PageFooter pageNumber={4} totalPages={4} generatedAt={data.generatedAt} />
    </Page>
  )
}

// ---------- Main document ----------

interface MonthlyReportProps {
  data: MonthlyReportData
}

export function MonthlyReport({ data }: MonthlyReportProps): React.JSX.Element {
  return (
    <Document
      title={`Rapport mensuel - ${data.siteName}`}
      author="WapixIA"
      subject={`Rapport de visibilite ${data.period}`}
    >
      <ScorePage data={data} />
      <TrafficSEOPage data={data} />
      <ContentReputationPage data={data} />
      <CompetitorsRecommendationsPage data={data} />
    </Document>
  )
}
