#!/usr/bin/env bash
# Nightly Postgres backup for the PPay database — the actual, tested disaster
# recovery mechanism. Deployed to the server via `scripts/deploy_backups.sh`
# (run once) which installs this file plus its cron.d entry.
#
# Retention: 14 daily backups locally. Off-site copy: this VM's service
# account currently only has read-only Cloud Storage scope (see
# GO_TO_MARKET.md's Disaster Recovery row) — pushing backups to GCS needs the
# scope broadened, which requires a VM restart and is a call for whoever
# operates this deployment to make, not something to change silently. Until
# then, pull backups off the VM periodically via `scp` — see RESTORE.md.
set -euo pipefail

BACKUP_DIR="/opt/ppay/backups"
RETENTION_DAYS=14
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
DEST="${BACKUP_DIR}/ppay_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# --no-owner: a restore doesn't need to fight over role ownership on a fresh
# database. pg_dump already runs inside its own transaction (consistent
# snapshot by default) — no extra flag needed for that on the dump side;
# `--single-transaction` is a *restore*-time flag (see RESTORE.md).
sudo -u postgres pg_dump --no-owner ppay | gzip -9 > "$DEST"

# A zero-byte or truncated file is worse than no file — it looks like a
# backup exists when it doesn't. Fail loudly instead of leaving it behind.
if [ ! -s "$DEST" ]; then
  echo "backup_database.sh: FAILED — ${DEST} is empty" >&2
  rm -f "$DEST"
  exit 1
fi

find "$BACKUP_DIR" -name 'ppay_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "backup_database.sh: wrote $(du -h "$DEST" | cut -f1) to ${DEST}"
