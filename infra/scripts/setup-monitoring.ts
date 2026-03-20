/**
 * UptimeRobot monitoring setup for WapixIA infrastructure.
 * Run with: npx tsx infra/scripts/setup-monitoring.ts
 */

// ── Types ──

interface UptimeRobotMonitor {
  id: number
  friendly_name: string
  url: string
  status: number
  type: number
}

interface CreateMonitorPayload {
  friendly_name: string
  url: string
  type: 1 // HTTP(s)
  interval: number // seconds
  alert_contacts: string
  keyword_type?: number
  keyword_value?: string
}

interface ApiResponse<T> {
  stat: 'ok' | 'fail'
  error?: { message: string }
  monitors?: T[]
  monitor?: { id: number }
}

// ── Config ──

const UPTIMEROBOT_API_URL = 'https://api.uptimerobot.com/v2'
const API_KEY = process.env['UPTIMEROBOT_API_KEY']
const MONITOR_PREFIX = 'WapixIA'

const CORE_MONITORS: Array<{ name: string; url: string }> = [
  { name: `${MONITOR_PREFIX} — API Prod`, url: 'https://api.wapixia.com/health' },
  { name: `${MONITOR_PREFIX} — Dashboard`, url: 'https://app.wapixia.com' },
  { name: `${MONITOR_PREFIX} — Admin`, url: 'https://admin.wapixia.com' },
  { name: `${MONITOR_PREFIX} — API Staging`, url: 'https://api-staging.wapixia.com/health' },
]

// ── Stub mode ──

function isStubMode(): boolean {
  if (!API_KEY) {
    console.warn('[setup-monitoring] UPTIMEROBOT_API_KEY not set — running in stub mode')
    return true
  }
  return false
}

// ── API helpers ──

async function uptimeRobotRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<ApiResponse<T>> {
  if (!API_KEY) {
    throw new Error('UPTIMEROBOT_API_KEY is required')
  }

  const response = await fetch(`${UPTIMEROBOT_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: API_KEY, format: 'json', ...body }),
  })

  if (!response.ok) {
    throw new Error(`UptimeRobot API error: HTTP ${response.status}`)
  }

  const data = (await response.json()) as ApiResponse<T>
  if (data.stat !== 'ok' && data.error) {
    throw new Error(`UptimeRobot API error: ${data.error.message}`)
  }

  return data
}

// ── Public API ──

/**
 * Create an HTTP monitor for a WapixIA client site.
 */
export async function addSiteMonitor(siteId: string, domain: string): Promise<{ monitorId: number }> {
  if (isStubMode()) {
    console.log(`[STUB] Would create monitor for site ${siteId}: https://${domain}`)
    return { monitorId: 0 }
  }

  const payload: CreateMonitorPayload = {
    friendly_name: `${MONITOR_PREFIX} Site — ${domain} (${siteId})`,
    url: `https://${domain}`,
    type: 1,
    interval: 300, // 5 minutes
    alert_contacts: '', // configured in UptimeRobot dashboard
  }

  const result = await uptimeRobotRequest<never>('newMonitor', payload as unknown as Record<string, unknown>)
  const monitorId = result.monitor?.id ?? 0
  console.log(`[setup-monitoring] Created monitor ${monitorId} for ${domain}`)
  return { monitorId }
}

/**
 * Remove an HTTP monitor for a WapixIA client site.
 */
export async function removeSiteMonitor(siteId: string): Promise<void> {
  if (isStubMode()) {
    console.log(`[STUB] Would remove monitor for site ${siteId}`)
    return
  }

  // Find the monitor by friendly_name containing the siteId
  const monitors = await listMonitors()
  const target = monitors.find((m) => m.friendly_name.includes(siteId))

  if (!target) {
    console.warn(`[setup-monitoring] No monitor found for site ${siteId}`)
    return
  }

  await uptimeRobotRequest<never>('deleteMonitor', { id: target.id })
  console.log(`[setup-monitoring] Removed monitor ${target.id} for site ${siteId}`)
}

/**
 * List all WapixIA monitors.
 */
export async function listMonitors(): Promise<UptimeRobotMonitor[]> {
  if (isStubMode()) {
    console.log('[STUB] Would list all WapixIA monitors')
    return []
  }

  const result = await uptimeRobotRequest<UptimeRobotMonitor>('getMonitors', {
    search: MONITOR_PREFIX,
  })

  return result.monitors ?? []
}

// ── CLI entrypoint ──

async function main(): Promise<void> {
  const command = process.argv[2]

  switch (command) {
    case 'setup': {
      console.log('Setting up core monitors...\n')
      for (const monitor of CORE_MONITORS) {
        try {
          if (isStubMode()) {
            console.log(`  [STUB] ${monitor.name} -> ${monitor.url}`)
            continue
          }
          const payload: CreateMonitorPayload = {
            friendly_name: monitor.name,
            url: monitor.url,
            type: 1,
            interval: 60, // 1 minute for core infra
            alert_contacts: '',
          }
          const result = await uptimeRobotRequest<never>('newMonitor', payload as unknown as Record<string, unknown>)
          console.log(`  Created: ${monitor.name} (ID: ${result.monitor?.id ?? 'unknown'})`)
        } catch (err) {
          console.error(`  Failed: ${monitor.name} — ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      break
    }

    case 'list': {
      const monitors = await listMonitors()
      if (monitors.length === 0) {
        console.log('No WapixIA monitors found.')
        return
      }
      console.log(`Found ${monitors.length} monitor(s):\n`)
      for (const m of monitors) {
        const statusLabel = m.status === 2 ? 'UP' : m.status === 9 ? 'DOWN' : `status=${m.status}`
        console.log(`  [${statusLabel}] ${m.friendly_name} — ${m.url}`)
      }
      break
    }

    default:
      console.log('Usage: npx tsx infra/scripts/setup-monitoring.ts <setup|list>')
      console.log('  setup  — Create core infrastructure monitors')
      console.log('  list   — List all WapixIA monitors')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
