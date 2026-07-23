# Deploying PPay to a VM

This deploys the app as three Docker containers on a single VM:

- **`db`** — Postgres, internal only (never exposed outside the VM)
- **`backend`** — the FastAPI app (migrations run automatically on every start)
- **`web`** — the built React app served by Caddy, which also reverse-proxies `/api/*` to `backend` and gets you HTTPS automatically (Let's Encrypt) with no manual certificate work

Everything is same-origin behind Caddy — the browser talks to `https://ppay.autruckers.com` only, so there's no CORS to fight with in production.

**Reminder: this app is sandbox-only.** Deploying it doesn't change that — every payment is still simulated (see `README.md`). Going live with real money is a separate, much larger effort covered in `GO_TO_MARKET.md`. This guide just gets the sandbox product live on the internet at your domain so people can actually try it.

## 1. Prerequisites

- A VM running **Ubuntu 22.04 or 24.04** (these instructions assume that; adapt package manager commands if you're on something else). 2 vCPU / 4GB RAM is comfortably enough for this app's traffic level.
- Root or sudo access on the VM.
- The domain **`ppay.autruckers.com`** — you control DNS for `autruckers.com`.
- Nothing else needs to be pre-installed; Docker is installed below.

## 2. Point the domain at the VM

In your DNS provider for `autruckers.com`, add:

```
Type: A
Name: ppay
Value: <your VM's public IPv4 address>
TTL: 300 (or your provider's default)
```

Verify it's propagated before continuing (Caddy will fail to get a certificate if DNS isn't pointing at the VM yet):

```bash
dig +short ppay.autruckers.com
# should print your VM's IP
```

This can take anywhere from a minute to an hour depending on your DNS provider.

## 3. Firewall

Only SSH, HTTP, and HTTPS need to be reachable from the internet. HTTP (80) has to stay open — Caddy uses it for the Let's Encrypt ACME challenge, then redirects to HTTPS automatically.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## 4. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker   # or log out and back in
docker --version
docker compose version
```

## 5. Get the code onto the VM

```bash
git clone <your repo URL> ppay
cd ppay
```

(If you don't have this pushed to a Git remote yet, `scp -r` the repo directory to the VM instead — just make sure `.env` isn't among the files you copy, you'll create a fresh one below.)

## 6. Configure environment variables

```bash
cp .env.production.example .env
```

Edit `.env` and fill in **two secrets** — everything else in the template is already correct for this domain:

```bash
# Generates a strong random value you can paste in
openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → JWT_SECRET_KEY
```

Put the same `POSTGRES_PASSWORD` value into **both** `POSTGRES_PASSWORD=` and inside the `DATABASE_URL=` line (`postgresql+asyncpg://openpay:<password-here>@db:5432/openpay`). `SITE_ADDRESS` and `CORS_ORIGINS` are already set to `ppay.autruckers.com` — leave those as-is unless the domain changes.

```bash
nano .env   # or vim/your editor of choice
```

Double-check nothing is still `change-me-...` before continuing:

```bash
grep -n "change-me" .env && echo "STILL HAS PLACEHOLDERS — go back and edit .env" || echo "looks good"
```

## 7. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First run takes a few minutes (pulling base images, installing dependencies, building the frontend). Watch it happen:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

The **first time**, Caddy needs a minute to issue the Let's Encrypt certificate for `ppay.autruckers.com` — that only works once DNS is actually pointing at this VM (step 2) and port 80 is reachable from the internet (step 3). Look for `certificate obtained successfully` in the `web` service's logs.

## 8. Verify

```bash
curl -s https://ppay.autruckers.com/health
# {"status":"ok","mode":"sandbox"}
```

Then open `https://ppay.autruckers.com` in a browser — you should land on the login page with a valid HTTPS padlock. Register a merchant account and click through Products → Payment Links → Checkout to confirm a full payment goes through end to end.

Check every container is healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

All three should show `Up` (and `db`/`backend` show `(healthy)` once their healthchecks pass).

## 9. Surviving a reboot

`restart: unless-stopped` on every service means Docker restarts them automatically if the VM reboots or a container crashes, **as long as the Docker daemon itself starts on boot** — which `get.docker.com`'s installer already enables by default. Confirm:

```bash
sudo systemctl is-enabled docker
# enabled
```

## 10. Updating to a new version

```bash
cd ~/ppay
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

This rebuilds only what changed, runs any new Alembic migrations automatically (via `backend/docker-entrypoint.sh`), and restarts containers with brief downtime on `backend`/`web` only — `db` isn't touched.

## 11. Backups

The only thing worth backing up is the Postgres volume. A daily dump via cron is enough for a sandbox deployment:

```bash
mkdir -p ~/ppay-backups
crontab -e
```

Add:

```cron
0 3 * * * docker exec $(docker ps -qf "name=ppay-db-1") pg_dump -U openpay openpay | gzip > ~/ppay-backups/openpay-$(date +\%Y\%m\%d).sql.gz
```

(Adjust the container name filter if `docker ps` shows a different name — check with `docker compose -f docker-compose.prod.yml ps db`.) Prune old backups periodically; they're not compressed by Postgres itself so they'll add up.

To restore: `gunzip -c backup.sql.gz | docker exec -i <db-container> psql -U openpay openpay`.

## 12. Logs & troubleshooting

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Just the backend (webhook delivery, subscription billing, scheduler jobs all log here)
docker compose -f docker-compose.prod.yml logs -f backend

# Just Caddy (TLS issuance, reverse-proxy errors)
docker compose -f docker-compose.prod.yml logs -f web
```

**Certificate won't issue / site shows "connection refused" on HTTPS:**
Almost always DNS or the firewall. Re-check `dig +short ppay.autruckers.com` matches the VM's IP, and that port 80 is actually reachable from outside (`curl -I http://ppay.autruckers.com` from a machine that isn't the VM itself). Caddy retries automatically — fix DNS/firewall, then `docker compose -f docker-compose.prod.yml restart web`.

**Backend keeps restarting:**
Check `docker compose -f docker-compose.prod.yml logs backend` — the most common cause is `DATABASE_URL`'s password not matching `POSTGRES_PASSWORD`, or `db` not yet healthy on first boot (compose waits for `db`'s healthcheck automatically, but a `docker compose up -d --build` right after changing the Postgres password needs `docker compose down -v` first — see below — since the volume already has the *old* password baked in).

**Changed `POSTGRES_PASSWORD` after the volume already exists:**
Postgres only reads that env var on first initialization of an empty data directory. If you need to change it later, either change the password inside Postgres directly (`docker exec -it <db-container> psql -U openpay -c "ALTER USER openpay PASSWORD 'newpass'"` and update `.env` to match), or start over with `docker compose -f docker-compose.prod.yml down -v` (⚠️ **deletes all data** — only do this on a fresh deployment with nothing worth keeping yet).

**Want a shell inside a container:**
```bash
docker compose -f docker-compose.prod.yml exec backend sh
docker compose -f docker-compose.prod.yml exec db psql -U openpay openpay
```

## 13. Optional: seed demo data

To populate the app with realistic-looking sample transactions/customers/invoices for a demo (rather than an empty new account):

```bash
docker compose -f docker-compose.prod.yml exec backend python scripts/seed_demo.py <merchant-email>
```

Register that merchant account through the UI first, then run this against its email.

## What this setup deliberately doesn't do

- **No horizontal scaling** — `backend` runs as a single process (`--workers 1`) because the APScheduler background jobs (webhook retries, nightly settlement, subscription billing) live in-process; running multiple copies would duplicate every scheduled job. Fine at sandbox/demo traffic levels. If you outgrow one VM, the scheduler needs to move into its own dedicated worker before you add backend replicas.
- **No staging environment** — this is one VM, one environment. Test locally (`README.md`'s local dev instructions) before `git push` + redeploying here.
- **No real payment processing** — see the reminder at the top. This is infrastructure for the sandbox product, not a production payment system. That's a licensing and integration project, not a deploy script — see `GO_TO_MARKET.md`.
