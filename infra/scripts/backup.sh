#!/usr/bin/env bash
# @wapixia/infra — Daily PostgreSQL backup to Hetzner Object Storage (S3-compatible)
# Ubuntu 24 compatible. All config via environment variables.
#
# Required env vars:
#   DATABASE_URL          — PostgreSQL connection string
#   S3_BUCKET             — Hetzner Object Storage bucket name
#   S3_ENDPOINT           — Hetzner S3 endpoint (e.g. https://fsn1.your-objectstorage.com)
#   ALERT_WEBHOOK_URL     — Webhook URL for success/failure notifications
#
# Optional env vars:
#   BACKUP_RETENTION_DAYS — Number of days to keep backups (default: 30)
#   BACKUP_PREFIX         — S3 key prefix (default: wapixia/db)

set -euo pipefail

# ── Configuration ──

readonly TIMESTAMP=$(date -u +"%Y-%m-%dT%H%M%SZ")
readonly BACKUP_FILE="wapixia-db-${TIMESTAMP}.dump"
readonly TEMP_DIR=$(mktemp -d)
readonly DUMP_PATH="${TEMP_DIR}/${BACKUP_FILE}"
readonly RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
readonly S3_PREFIX="${BACKUP_PREFIX:-wapixia/db}"
readonly S3_DEST="s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

# ── Helpers ──

cleanup() {
  rm -rf "${TEMP_DIR}"
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
    -d "{\"status\":\"${status}\",\"service\":\"backup\",\"message\":\"${message}\",\"timestamp\":\"${TIMESTAMP}\"}" \
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

for cmd in pg_dump pg_restore s3cmd curl; do
  if ! command -v "${cmd}" &>/dev/null; then
    send_notification "failure" "Required command not found: ${cmd}"
    echo "[ERROR] Required command not found: ${cmd}" >&2
    exit 1
  fi
done

echo "[INFO] Starting backup: ${BACKUP_FILE}"

# ── Step 1: pg_dump ──

echo "[INFO] Running pg_dump with custom format and compression level 9..."

if ! pg_dump \
  "${DATABASE_URL}" \
  --format=custom \
  --compress=9 \
  --verbose \
  --file="${DUMP_PATH}" 2>&1; then
  send_notification "failure" "pg_dump failed for ${BACKUP_FILE}"
  echo "[ERROR] pg_dump failed" >&2
  exit 1
fi

DUMP_SIZE=$(stat -c%s "${DUMP_PATH}" 2>/dev/null || stat -f%z "${DUMP_PATH}" 2>/dev/null)
echo "[INFO] Dump created: ${DUMP_PATH} (${DUMP_SIZE} bytes)"

# ── Step 2: Verify integrity ──

echo "[INFO] Verifying backup integrity with pg_restore --list..."

if ! pg_restore --list "${DUMP_PATH}" >/dev/null 2>&1; then
  send_notification "failure" "Backup integrity check failed for ${BACKUP_FILE}"
  echo "[ERROR] Backup integrity verification failed" >&2
  exit 1
fi

echo "[INFO] Backup integrity verified"

# ── Step 3: Upload to S3 ──

echo "[INFO] Uploading to ${S3_DEST}..."

if ! s3cmd put \
  "${DUMP_PATH}" \
  "${S3_DEST}" \
  --host="${S3_ENDPOINT}" \
  --host-bucket="%(bucket)s.${S3_ENDPOINT}" \
  --no-ssl 2>&1; then
  send_notification "failure" "S3 upload failed for ${BACKUP_FILE}"
  echo "[ERROR] S3 upload failed" >&2
  exit 1
fi

echo "[INFO] Upload complete"

# ── Step 4: Cleanup old backups ──

echo "[INFO] Cleaning up backups older than ${RETENTION_DAYS} days..."

CUTOFF_DATE=$(date -u -d "-${RETENTION_DAYS} days" +"%Y-%m-%d" 2>/dev/null \
  || date -u -v-"${RETENTION_DAYS}"d +"%Y-%m-%d" 2>/dev/null)

s3cmd ls "s3://${S3_BUCKET}/${S3_PREFIX}/" \
  --host="${S3_ENDPOINT}" \
  --host-bucket="%(bucket)s.${S3_ENDPOINT}" \
  2>/dev/null \
  | while read -r line; do
    file_date=$(echo "${line}" | awk '{print $1}')
    file_path=$(echo "${line}" | awk '{print $4}')

    if [[ -n "${file_date}" && -n "${file_path}" && "${file_date}" < "${CUTOFF_DATE}" ]]; then
      echo "[INFO] Removing old backup: ${file_path}"
      s3cmd del "${file_path}" \
        --host="${S3_ENDPOINT}" \
        --host-bucket="%(bucket)s.${S3_ENDPOINT}" \
        2>/dev/null || true
    fi
  done

echo "[INFO] Cleanup complete"

# ── Step 5: Send success notification ──

send_notification "success" "Backup ${BACKUP_FILE} completed (${DUMP_SIZE} bytes)"
echo "[INFO] Backup completed successfully: ${BACKUP_FILE}"
