#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# rollback.sh — Script de rollback production WapixIA
#
# Deploie un commit specifique via l'API Coolify et verifie le health check.
#
# Usage : ./infra/scripts/rollback.sh <commit-sha>
# Env   : COOLIFY_BASE_URL, COOLIFY_API_TOKEN, COOLIFY_APP_ID
#          SLACK_WEBHOOK_URL (optionnel), API_URL
###############################################################################

# ── Configuration ──

COOLIFY_BASE_URL="${COOLIFY_BASE_URL:-http://localhost:8000}"
COOLIFY_API_TOKEN="${COOLIFY_API_TOKEN:-}"
COOLIFY_APP_ID="${COOLIFY_APP_ID:-}"
API_URL="${API_URL:-https://api.wapixia.com}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-15}"

# ── Helpers ──

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2
}

notify() {
  local message="$1"
  local color="${2:-warning}"

  log "Notification: ${message}"

  # Slack
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -sf --max-time 10 -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"attachments\":[{\"color\":\"${color}\",\"text\":\"${message}\",\"footer\":\"WapixIA Rollback Script\"}]}" \
      > /dev/null 2>&1 || true
  fi
}

# ── Argument validation ──

if [ $# -lt 1 ]; then
  echo "Usage: $0 <commit-sha>"
  echo ""
  echo "  Deploie le commit specifie sur la production via Coolify."
  echo ""
  echo "Variables d'environnement requises:"
  echo "  COOLIFY_BASE_URL    URL de l'instance Coolify"
  echo "  COOLIFY_API_TOKEN   Token API Coolify"
  echo "  COOLIFY_APP_ID      ID de l'application Coolify"
  echo ""
  echo "Variables optionnelles:"
  echo "  API_URL             URL de l'API pour le health check (default: https://api.wapixia.com)"
  echo "  SLACK_WEBHOOK_URL   Webhook Slack pour les notifications"
  exit 1
fi

COMMIT_SHA="$1"

# Validate commit SHA format
if ! echo "$COMMIT_SHA" | grep -qE '^[0-9a-f]{7,40}$'; then
  error "Format de commit SHA invalide: ${COMMIT_SHA}"
  exit 1
fi

# Validate required env vars
if [ -z "$COOLIFY_API_TOKEN" ]; then
  error "COOLIFY_API_TOKEN est requis"
  exit 1
fi

if [ -z "$COOLIFY_APP_ID" ]; then
  error "COOLIFY_APP_ID est requis"
  exit 1
fi

# ── Rollback ──

log "=== Rollback WapixIA vers ${COMMIT_SHA} ==="
notify "Rollback initie vers le commit \`${COMMIT_SHA}\`" "warning"

# Step 1: Update the git commit on the Coolify application
log "Step 1: Mise a jour du commit sur Coolify..."

update_response=$(curl -sf --max-time 30 \
  -X PATCH "${COOLIFY_BASE_URL}/api/v1/applications/${COOLIFY_APP_ID}" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"git_commit_sha\":\"${COMMIT_SHA}\"}" 2>&1) || {
  error "Echec de la mise a jour du commit sur Coolify"
  notify "ECHEC du rollback: impossible de mettre a jour le commit sur Coolify" "danger"
  exit 1
}

log "Commit mis a jour sur Coolify"

# Step 2: Trigger deployment
log "Step 2: Declenchement du deploiement..."

deploy_response=$(curl -sf --max-time 30 \
  -X POST "${COOLIFY_BASE_URL}/api/v1/applications/${COOLIFY_APP_ID}/restart" \
  -H "Authorization: Bearer ${COOLIFY_API_TOKEN}" 2>&1) || {
  error "Echec du declenchement du deploiement"
  notify "ECHEC du rollback: impossible de declencher le deploiement" "danger"
  exit 1
}

log "Deploiement declenche"

# Step 3: Wait for deployment and run health check
log "Step 3: Attente du deploiement et health check..."
log "  (${HEALTH_CHECK_RETRIES} tentatives, intervalle ${HEALTH_CHECK_INTERVAL}s)"

sleep 30  # Initial wait for deployment to start

health_ok=false
for i in $(seq 1 "$HEALTH_CHECK_RETRIES"); do
  log "  Health check tentative ${i}/${HEALTH_CHECK_RETRIES}..."

  if curl -sf --max-time 10 "${API_URL}/health" > /dev/null 2>&1; then
    health_ok=true
    log "  Health check OK"
    break
  fi

  if [ "$i" -lt "$HEALTH_CHECK_RETRIES" ]; then
    sleep "$HEALTH_CHECK_INTERVAL"
  fi
done

# Step 4: Final status
if [ "$health_ok" = true ]; then
  log "=== Rollback termine avec succes ==="
  notify "Rollback vers \`${COMMIT_SHA}\` termine avec succes. Health check OK." "good"
  exit 0
else
  error "=== Rollback termine mais health check echoue ==="
  error "L'API ne repond pas apres ${HEALTH_CHECK_RETRIES} tentatives."
  error "Verifiez manuellement: ${API_URL}/health"
  notify "ATTENTION: Rollback vers \`${COMMIT_SHA}\` deploye mais health check ECHOUE. Intervention manuelle requise." "danger"
  exit 1
fi
