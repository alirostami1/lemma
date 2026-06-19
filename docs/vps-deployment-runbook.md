# VPS Deployment Runbook

This runbook describes the current single-VPS production test deployment.
It is not a high-availability design. App traffic can roll blue/green with
near-zero downtime; Postgres, Garage, Keycloak, host restarts, Docker restarts,
and destructive migrations can still cause downtime.

## Deployment Decisions

Chosen for the first VPS rollout:

1. VPS provider and OS: Hetzner Cloud, Ubuntu 24.04 LTS recommended.
2. Domain layout: subdomains under `lemma.ac`.
3. Admin exposure: public `admin.lemma.ac`, protected by Keycloak.
4. SMTP/email verification: disabled for first deploy.
5. TLS/ACME contact email: `ops@lemma.ac`.
6. Backups: deferred until after first successful boot; do not onboard real
   users until backup and restore are rehearsed.
7. GitHub deploy trigger: keep manual workflow until first deploy, rollback,
   and smoke tests pass.

Use URL-safe, shell-safe secrets only: alphanumeric plus `_` and `-`. The
server `.env` is consumed by Docker Compose and production shell scripts.

## DNS

Create A records pointing at the VPS public IPv4 address:

- `app.lemma.ac`
- `api.lemma.ac`
- `admin.lemma.ac`
- `auth.lemma.ac`
- `realtime.lemma.ac`
- `files.lemma.ac`

Use the exact values in GitHub Actions variables and
`infra/production/production.sops.env`.

## Cloudflare TLS

The `lemma.ac` zone is behind the Cloudflare proxy. Caddy uses Cloudflare
DNS-01 ACME validation, so the records can stay proxied during first deploy.

1. In Cloudflare DNS, create the six A records above and leave them proxied
   (orange cloud).
2. Create a scoped Cloudflare API token for `lemma.ac` with `Zone:Read` and
   `DNS:Edit`.
3. Store that token as `CLOUDFLARE_API_TOKEN` in `/opt/lemma/.env`.
4. Keep VPS firewall ports `80` and `443` open.
5. In Cloudflare SSL/TLS, set encryption mode to Full (strict).
6. In Cloudflare Network, keep WebSockets enabled for `realtime.lemma.ac`.
7. Run the first deploy.
8. Verify Caddy has issued certificates and all hosts load over HTTPS.

Do not use Flexible mode. Flexible encrypts browser-to-Cloudflare only and can
cause redirect loops or insecure origin traffic. Full (strict) requires the VPS
origin to present a valid certificate for each proxied hostname.

After the first deploy is stable, it is safe to enable Cloudflare Always Use
HTTPS. Do not enable it before Caddy has issued origin certificates.

## VPS Bootstrap

Run the bootstrap playbook from a workstation or CI runner that can SSH to the
VPS as a sudo-capable user:

```sh
ANSIBLE_CONFIG=infra/ansible/ansible.cfg ansible-playbook infra/ansible/playbooks/bootstrap.yml \
  --extra-vars "ansible_host=<vps-ip-or-hostname>" \
  --extra-vars "ansible_user=<sudo-user>"
```

The playbook installs Docker Engine and the Compose plugin, creates the deploy
user, opens SSH/HTTP/HTTPS with UFW, and creates `/opt/lemma` directories.

## Server Environment

Edit the encrypted production env file with SOPS:

```sh
sops infra/production/production.sops.env
```

Generate shell-safe secrets:

```sh
openssl rand -base64 32 | tr -d '=+/'
openssl rand -hex 32
```

Do not store image tags or active color in the SOPS env file. The deploy script
stores rollout state in `/opt/lemma/.deploy-state.env`.

Set `POSTGRES_PASSWORD_URL_ENCODED` to the URL-encoded form of
`POSTGRES_PASSWORD`. If the password is URL-safe already, it can be the same.

Set `CLOUDFLARE_API_TOKEN` to the scoped Cloudflare token for DNS-01 ACME
validation. CI decrypts this file using the GitHub environment secret
`SOPS_AGE_KEY` and copies it to `/opt/lemma/.env`.

## GitHub Configuration

Create a GitHub environment named `vps`.

Required secrets:

- `VPS_HOST`
- `VPS_DEPLOY_USER`
- `VPS_SSH_PRIVATE_KEY`
- `GHCR_READ_USER`
- `GHCR_READ_TOKEN`
- `SOPS_AGE_KEY`

Required variables:

- `LEMMA_WEB_APP_TITLE`
- `LEMMA_WEB_APP_URL`
- `LEMMA_WEB_API_URL`
- `LEMMA_WEB_REALTIME_URL`
- `LEMMA_WEB_OIDC_ISSUER_URI`
- `LEMMA_WEB_OIDC_CLIENT_ID`
- `LEMMA_ADMIN_APP_TITLE`
- `LEMMA_ADMIN_APP_URL`
- `LEMMA_ADMIN_API_URL`
- `LEMMA_ADMIN_OIDC_ISSUER_URI`
- `LEMMA_ADMIN_OIDC_CLIENT_ID`

Recommended values:

```text
LEMMA_WEB_APP_URL=https://app.lemma.ac
LEMMA_WEB_API_URL=https://api.lemma.ac
LEMMA_WEB_REALTIME_URL=wss://realtime.lemma.ac/connection/websocket
LEMMA_WEB_OIDC_ISSUER_URI=https://auth.lemma.ac/realms/lemma
LEMMA_WEB_OIDC_CLIENT_ID=lemma-web
LEMMA_ADMIN_APP_URL=https://admin.lemma.ac
LEMMA_ADMIN_API_URL=https://api.lemma.ac
LEMMA_ADMIN_OIDC_ISSUER_URI=https://auth.lemma.ac/realms/lemma
LEMMA_ADMIN_OIDC_CLIENT_ID=lemma-admin
```

## First Deploy

Run the `Deploy VPS` GitHub Actions workflow manually. Keep automatic `main`
deploy disabled operationally until first boot and rollback are proven.

The workflow:

1. Builds API, worker, web, admin, Keycloak, LibreOffice worker, and Caddy images.
2. Pushes images to GHCR with the immutable commit SHA tag.
3. Decrypts `infra/production/production.sops.env`.
4. Runs the Ansible deploy playbook.
5. The playbook uploads Compose, Caddy, scripts, and `/opt/lemma/.env`.
6. The playbook logs the VPS into GHCR and runs `/opt/lemma/scripts/production/deploy.sh`.

The deploy script:

1. Acquires `/opt/lemma/.deploy.lock`.
2. Writes production Garage and Keycloak config from `/opt/lemma/.env`.
3. Sets the inactive color and image tag in `/opt/lemma/.deploy-state.env`.
4. Pulls images.
5. Starts stateful services.
6. Runs migrations.
7. Starts inactive API, web, and admin containers.
8. Waits for health checks.
9. Switches Caddy to the new color.
10. Restarts the single worker on the new shared image tag.
11. Stops the old app color.

## Smoke Tests

After first deploy:

```sh
curl -fsS https://api.lemma.ac/api/health
```

Then test in browser:

- login through Keycloak
- open web app
- open admin app
- upload a file
- upload a workbook and preview it
- run question generation
- verify realtime status updates

## Rollback

Rollback switches app traffic to the previous color and its stored image tag.
It does not undo migrations, Keycloak imports, Garage writes, or worker/shared
service image changes.

```sh
ssh deploy@<vps-ip-or-hostname>
/opt/lemma/scripts/production/rollback.sh
```

Use rollback only after checking that schema changes are backward-compatible.

## Backups

Run:

```sh
/opt/lemma/scripts/production/backup.sh
```

It writes:

- app Postgres dump
- Keycloak Postgres dump
- Garage data archive
- Garage metadata archive

Copy backups off the VPS immediately.

After first successful boot, add a backup destination outside the VPS, then add
a cron entry like:

```cron
15 3 * * * /opt/lemma/scripts/production/backup.sh >/opt/lemma/backups/backup.log 2>&1
```

## Pre-Production Checklist

- DNS records resolve to the VPS.
- Firewall exposes only `22`, `80`, and `443`.
- `/opt/lemma/.env` is mode `600`.
- All placeholder values are replaced.
- GHCR read token can pull packages.
- GitHub environment `vps` has required secrets and variables.
- First deploy completes.
- Health checks pass.
- Rollback is tested once.
- Backup is added, tested once, and copied off-host before real users.
- A restore rehearsal is planned before real users.
