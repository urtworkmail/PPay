#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting API server..."
# --workers 1 is deliberate: the APScheduler jobs (webhook retry, nightly
# settlement, payout sweep, subscription billing) run in-process. Multiple
# workers would each start their own copy of the scheduler and run every job
# multiple times. If you need to scale the API beyond one process, move the
# scheduler into a separate dedicated worker process/container first.
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
