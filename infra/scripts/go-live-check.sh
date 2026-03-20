#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# go-live-check.sh — Script de verification pre-go-live WapixIA
#
# Verifie que tous les services sont prets pour la mise en production.
# Exit code 0 = tout OK, 1 = au moins un check echoue.
#
# Usage : ./infra/scripts/go-live-check.sh
# Prerequis : curl, openssl, dig, redis-cli, pg_isready
###############################################################################

# ── Configuration ──

API_URL="${API_URL:-https://api.wapixia.com}"
DASHBOARD_URL="${DASHBOARD_URL:-https://app.wapixia.com}"
ADMIN_URL="${ADMIN_URL:-https://admin.wapixia.com}"

DOMAIN="${DOMAIN:-wapixia.com}"
SUBDOMAINS=("api" "app" "admin" "cms")

DATABASE_URL="${DATABASE_URL:-}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"

SSL_MIN_DAYS="${SSL_MIN_DAYS:-30}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-24}"
BACKUP_CHECK_URL="${BACKUP_CHECK_URL:-}"

UPTIMEROBOT_API_KEY="${UPTIMEROBOT_API_KEY:-}"

# ── State ──

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo "  [PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo "  [FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo "  [WARN] $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

# ── 1. Health Endpoints ──

echo ""
echo "=== 1. Health Endpoints ==="

check_health() {
  local name="$1"
  local url="$2"

  if curl -sf --max-time 10 "${url}/health" > /dev/null 2>&1; then
    pass "${name} health OK (${url}/health)"
  else
    fail "${name} health UNREACHABLE (${url}/health)"
  fi
}

check_health "API" "$API_URL"
check_health "Dashboard" "$DASHBOARD_URL"
check_health "Admin" "$ADMIN_URL"

# ── 2. SSL Certificates ──

echo ""
echo "=== 2. SSL Certificates ==="

check_ssl() {
  local host="$1"

  if ! command -v openssl &> /dev/null; then
    warn "openssl non installe, SSL check ignore pour ${host}"
    return
  fi

  local expiry_date
  expiry_date=$(echo | openssl s_client -servername "$host" -connect "${host}:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null \
    | sed 's/notAfter=//')

  if [ -z "$expiry_date" ]; then
    fail "SSL: impossible de verifier ${host}"
    return
  fi

  local expiry_epoch
  expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null || echo "0")
  local now_epoch
  now_epoch=$(date +%s)
  local diff_days=$(( (expiry_epoch - now_epoch) / 86400 ))

  if [ "$diff_days" -gt "$SSL_MIN_DAYS" ]; then
    pass "SSL ${host}: valide encore ${diff_days} jours"
  else
    fail "SSL ${host}: expire dans ${diff_days} jours (minimum: ${SSL_MIN_DAYS})"
  fi
}

for sub in "${SUBDOMAINS[@]}"; do
  check_ssl "${sub}.${DOMAIN}"
done

# ── 3. DNS Records ──

echo ""
echo "=== 3. DNS Records ==="

check_dns() {
  local fqdn="$1"

  if ! command -v dig &> /dev/null; then
    warn "dig non installe, DNS check ignore pour ${fqdn}"
    return
  fi

  local result
  result=$(dig +short "$fqdn" 2>/dev/null)

  if [ -n "$result" ]; then
    pass "DNS ${fqdn} -> ${result}"
  else
    fail "DNS ${fqdn}: aucun enregistrement"
  fi
}

for sub in "${SUBDOMAINS[@]}"; do
  check_dns "${sub}.${DOMAIN}"
done

# ── 4. Database Connectivity ──

echo ""
echo "=== 4. Database ==="

if [ -n "$DATABASE_URL" ]; then
  if command -v pg_isready &> /dev/null; then
    if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
      pass "PostgreSQL accessible"
    else
      fail "PostgreSQL inaccessible"
    fi
  else
    # Fallback: test via curl to Supabase health
    if curl -sf --max-time 5 "${SUPABASE_URL:-http://localhost:8000}/rest/v1/" -H "apikey: ${SUPABASE_ANON_KEY:-}" > /dev/null 2>&1; then
      pass "Supabase REST API accessible"
    else
      warn "pg_isready non disponible et Supabase REST non accessible"
    fi
  fi
else
  warn "DATABASE_URL non defini, check ignore"
fi

# ── 5. Redis Connectivity ──

echo ""
echo "=== 5. Redis ==="

if command -v redis-cli &> /dev/null; then
  if redis-cli -u "$REDIS_URL" ping 2>/dev/null | grep -q "PONG"; then
    pass "Redis accessible (PONG)"
  else
    fail "Redis inaccessible"
  fi
else
  warn "redis-cli non installe, Redis check ignore"
fi

# ── 6. Backup Check ──

echo ""
echo "=== 6. Backups ==="

if [ -n "$BACKUP_CHECK_URL" ]; then
  backup_response=$(curl -sf --max-time 10 "$BACKUP_CHECK_URL" 2>/dev/null || echo "")

  if [ -n "$backup_response" ]; then
    # Expects JSON with last_backup_at ISO timestamp
    last_backup=$(echo "$backup_response" | grep -oP '"last_backup_at"\s*:\s*"\K[^"]+' 2>/dev/null || echo "")

    if [ -n "$last_backup" ]; then
      backup_epoch=$(date -d "$last_backup" +%s 2>/dev/null || echo "0")
      now_epoch=$(date +%s)
      age_hours=$(( (now_epoch - backup_epoch) / 3600 ))

      if [ "$age_hours" -lt "$BACKUP_MAX_AGE_HOURS" ]; then
        pass "Backup recent (${age_hours}h)"
      else
        fail "Backup trop ancien (${age_hours}h, max: ${BACKUP_MAX_AGE_HOURS}h)"
      fi
    else
      fail "Backup: reponse invalide (pas de last_backup_at)"
    fi
  else
    fail "Backup: endpoint inaccessible (${BACKUP_CHECK_URL})"
  fi
else
  warn "BACKUP_CHECK_URL non defini — verifiez manuellement que les backups Supabase sont actifs"
fi

# ── 7. UptimeRobot Monitors ──

echo ""
echo "=== 7. UptimeRobot ==="

if [ -n "$UPTIMEROBOT_API_KEY" ]; then
  monitors_response=$(curl -sf --max-time 10 \
    -X POST "https://api.uptimerobot.com/v2/getMonitors" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "api_key=${UPTIMEROBOT_API_KEY}&format=json" 2>/dev/null || echo "")

  if [ -n "$monitors_response" ]; then
    monitor_count=$(echo "$monitors_response" | grep -oP '"total"\s*:\s*\K[0-9]+' 2>/dev/null || echo "0")

    if [ "$monitor_count" -ge 3 ]; then
      pass "UptimeRobot: ${monitor_count} monitors configures"
    else
      fail "UptimeRobot: seulement ${monitor_count} monitors (minimum 3 attendus: API, Dashboard, Admin)"
    fi
  else
    fail "UptimeRobot: API inaccessible"
  fi
else
  warn "UPTIMEROBOT_API_KEY non defini, check ignore"
fi

# ── Summary ──

echo ""
echo "============================================"
echo "  RESULTATS GO-LIVE CHECK"
echo "============================================"
echo "  PASS : ${PASS_COUNT}"
echo "  FAIL : ${FAIL_COUNT}"
echo "  WARN : ${WARN_COUNT}"
echo "============================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "  STATUT : ECHEC — ${FAIL_COUNT} verification(s) echouee(s)"
  echo "  Corrigez les problemes ci-dessus avant le go-live."
  echo ""
  exit 1
else
  echo ""
  echo "  STATUT : SUCCES — Pret pour le go-live !"
  echo ""
  exit 0
fi
