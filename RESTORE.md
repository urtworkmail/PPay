# Disaster recovery — restoring PPay's database

This is the tested procedure, not a theoretical one — see "Verification" at
the bottom for when it was last actually run end-to-end.

## What's backed up

- **What**: the `ppay` Postgres database (all schemas — `public`, `sandbox`,
  `production`) via `pg_dump`, gzip-compressed.
- **Where**: `/opt/ppay/backups/ppay_<timestamp>.sql.gz` on the app server.
- **When**: nightly at 03:15 server time, via cron (`/etc/cron.d/ppay-backup`).
- **Retention**: 14 days, pruned automatically by the backup script.
- **Off-site copy**: none automated yet. This VM's service account has only
  read-only Cloud Storage scope — pushing to GCS needs that broadened, which
  requires restarting the VM (a call for whoever operates this deployment to
  make deliberately, not something done silently mid-session). Until then,
  **pull a copy off the VM periodically**:
  ```bash
  scp ntfy1:/opt/ppay/backups/ppay_$(date +%Y%m%d)*.sql.gz ./local-backups/
  ```

## Recovery Point / Recovery Time Objectives

- **RPO (data loss window)**: up to 24 hours — the gap between backups. If
  more frequent recovery points matter, lower the cron interval in
  `/etc/cron.d/ppay-backup` (each run takes seconds; the database is 10s of
  MB today).
- **RTO (time to restore)**: under 2 minutes for the database itself — see
  the timed run below. Add DNS/TLS/app-redeploy time on top if recovering
  onto a *new* host rather than the same one (see `ntfy1-backup-2026-09-07/RESTORE.md`
  for the full server rebuild procedure).

## Restoring

```bash
# 1. Stop the API so nothing writes during restore
sudo systemctl stop ppay-api

# 2. Drop and recreate the database (or point at a fresh one)
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ppay;"
sudo -u postgres psql -c "CREATE DATABASE ppay OWNER ppay;"

# 3. Restore from the chosen backup
gunzip -c /opt/ppay/backups/ppay_<timestamp>.sql.gz | sudo -u postgres psql -d ppay

# 4. Restart the API
sudo systemctl start ppay-api
curl -s http://127.0.0.1:8000/health
```

If restoring onto a **different** host (the original VM is gone, not just its
database), follow `ntfy1-backup-2026-09-07/RESTORE.md` first to stand the app
back up, then substitute steps 2–3 above using whichever backup file you
pulled off-site.

## Verification

Last tested: 2026-09-07, against a disposable copy of the production
database (never against live data). Procedure: dumped `ppay`, dropped it,
restored from the dump, compared row counts per table against a pre-drop
snapshot. Result: **identical row counts across every table**, restore
completed in under a minute. See the session log for the exact commands run.
