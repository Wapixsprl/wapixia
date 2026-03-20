#!/usr/bin/env bash
# @wapixia/infra — Monthly restore verification
# Downloads the latest backup from S3, restores to a temp database,
# runs integrity checks, then cleans up.
# Ubuntu 24 compatible. All config via environment variables.
#
# Required env vars:
#   DATABASE_URL          — PostgreSQL connection string (used to derive host/port/user)
#   S3_BUCKET             — Hetzner Object Storage bucket name
#   S3_ENDPOINT           — Hetzner S3 endpoint
#   ALERT_WEBHOOK_URL     — Webhook URL for success/failure notifications
#   PGPASSWORD            — PostgreSQL password (or use .pgpass)
#
# Optional env vars:
#   BACKUP_PREFIX         — S3 key prefix (default: wapixia/db)
#   TEMP_DB_NAME          — Name of the temporary restore database (default: wapixia_restore_test)

set -euo pipefail

# ── Configuration ──

readonly TIMESTAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
readonly TEMP_DIR=$(mktemp -d)
readonly S3_PREFIX="${BACKUP_PREFIX:-wapixia/db}"
readonly TEMP_DB="${TEMP_DB_NAME:-wapixia_restore_test}"

# Parse DATABASE_URL for psql/createdb/dropdb commands
# Format: postgresql://user:pass@host:port/dbname
parse_db_url() {
  local url="${DATABASE_URL}"
  # Remove protocol
  url="${url#postgresql://}"
  url="${url#postgres://}"

  DB_USER=$(echo "${url}" | sed -E 's/^([^:]+):.*/\1/')
  DB_HOST=$(echo "${url}" | sed -E 's/.*@([^:\/]+).*/\1/')
  DB_PORT=$(echo "${url}" | sed -E 's/.*:([0-9]+)\/.*/\1/')
  DB_NAME=$(echo "${url}" | sed -E 's/.*\/([^?]+).*/\1/')
}

# ── Helpers ──

cleanup() {
  echo "[INFO] Cleaning up..."

  # Drop temp database if it exists
  dropdb \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --if-exists \
    "${TEMP_DB}" 2>/dev/null || true

  rm -rf "${TEMP_DIR}"
  echo "[INFO] Cleanup complete"
}
trap cleanup EXIT

send_notification() {
  local status="$1"
  local message="$2"

  if [[ -z "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "[WARN] ALERT_WEBHOOK_URL not set, skipping notification"
    return 0
  fi

  curl -sf -X POST "${ALERT_WEBHOOK_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"${status}\",\"service\":\"restore-test\",\"message\":\"${message}\",\"timestamp\":\"${TIMESTAMP}\"}" \
    || echo "[WARN] Failed to send notification"
}

# ── Validation ──

for var in DATABASE_URL S3_BUCKET S3_ENDPOINT; do
  if [[ -z "${!var:-}" ]]; then
    send_notification "failure" "Missing required env var: ${var}"
    echo "[ERROR] Missing required environment variable: ${var}" >&2
    exit 1
  fi
done

for cmd in pg_restore psql createdb dropdb s3cmd curl; do
  if ! command -v "${cmd}" &>/dev/null; then
    send_notification "failure" "Required command not found: ${cmd}"
    echo "[ERROR] Required command not found: ${cmd}" >&2
    exit 1
  fi
done

parse_db_url

echo "[INFO] Starting restore verification at ${TIMESTAMP}"

# ── Step 1: Find and download latest backup ──

echo "[INFO] Listing backups in s3://${S3_BUCKET}/${S3_PREFIX}/..."

LATEST_BACKUP=$(s3cmd ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  --host="${S3_ENDPOINT}" \
  --host-bucket="%(bucket)s.${S3_ENDPOINT}" \
  2>/dev/null \
  | grep '\.dump$' \
  | sort -k1,2 \
  | tail -n 1 \
  | awk '{print $4}')

if [[ -z "${LATEST_BACKUP}" ]]; then
  send_notification "failure" "No backup files found in S3"
  echo "[ERROR] No backup files found in S3" >&2
  exit 1
fi

BACKUP_FILENAME=$(basename "${LATEST_BACKUP}")
LOCAL_DUMP="${TEMP_DIR}/${BACKUP_FILENAME}"

echo "[INFO] Downloading latest backup: ${LATEST_BACKUP}"

if ! s3cmd get \
  "${LATEST_BACKUP}" \
  "${LOCAL_DUMP}" \
  --host="${S3_ENDPOINT}" \
  --host-bucket="%(bucket)s.${S3_ENDPOINT}" \
  2>&1; then
  send_notification "failure" "Failed to download backup: ${BACKUP_FILENAME}"
  echo "[ERROR] Failed to download backup" >&2
  exit 1
fi

echo "[INFO] Download complete: ${LOCAL_DUMP}"

# ── Step 2: Create temp database and restore ──

echo "[INFO] Creating temporary database: ${TEMP_DB}"

# Drop if leftover from a previous failed run
dropdb \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --if-exists \
  "${TEMP_DB}" 2>/dev/null || true

if ! createdb \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  "${TEMP_DB}" 2>&1; then
  send_notification "failure" "Failed to create temp database: ${TEMP_DB}"
  echo "[ERROR] Failed to create temp database" >&2
  exit 1
fi

echo "[INFO] Restoring backup into ${TEMP_DB}..."

if ! pg_restore \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${TEMP_DB}" \
  --no-owner \
  --no-privileges \
  --verbose \
  "${LOCAL_DUMP}" 2>&1; then
  send_notification "failure" "pg_restore failed for ${BACKUP_FILENAME}"
  echo "[ERROR] pg_restore failed" >&2
  exit 1
fi

echo "[INFO] Restore complete"

# ── Step 3: Run integrity checks ──

echo "[INFO] Running integrity checks..."

run_check() {
  local description="$1"
  local query="$2"
  local min_expected="${3:-0}"

  local result
  result=$(psql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --dbname="${TEMP_DB}" \
    --tuples-only \
    --no-align \
    -c "${query}" 2>/dev/null)

  result=$(echo "${result}" | tr -d '[:space:]')

  if [[ -z "${result}" || "${result}" -lt "${min_expected}" ]]; then
    echo "[FAIL] ${description}: got ${result:-null}, expected >= ${min_expected}"
    return 1
  fi

  echo "[OK]   ${description}: ${result}"
  return 0
}

CHECKS_PASSED=0
CHECKS_FAILED=0

if run_check "Sites count" "SELECT COUNT(*) FROM sites;" 0; then
  ((CHECKS_PASSED++))
else
  ((CHECKS_FAILED++))
fi

if run_check "Users count" "SELECT COUNT(*) FROM users;" 0; then
  ((CHECKS_PASSED++))
else
  ((CHECKS_FAILED++))
fi

if run_check "Organizations count" "SELECT COUNT(*) FROM organizations;" 0; then
  ((CHECKS_PASSED++))
else
  ((CHECKS_FAILED++))
fi

echo "[INFO] Integrity checks: ${CHECKS_PASSED} passed, ${CHECKS_FAILED} failed"

# ── Step 4: Report result ──

if [[ "${CHECKS_FAILED}" -gt 0 ]]; then
  send_notification "failure" "Restore test failed: ${CHECKS_FAILED} integrity checks failed (backup: ${BACKUP_FILENAME})"
  echo "[ERROR] Restore verification FAILED" >&2
  exit 1
fi

send_notification "success" "Restore test passed: ${CHECKS_PASSED} checks OK (backup: ${BACKUP_FILENAME})"
echo "[INFO] Restore verification completed successfully"
