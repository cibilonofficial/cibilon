#!/usr/bin/env bash
# =============================================================================
# Cibilon — Full VPS Backend Setup
# Run as root on a fresh Ubuntu 22.04/24.04 VPS
# Usage: bash vps-setup.sh
# =============================================================================
set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── config (edit before running) ─────────────────────────────────────────────
REPO_URL="https://github.com/cibilonofficial/cibilon.git"
APP_DIR="/opt/cibilon"
DB_NAME="cibilon"
DB_USER="cibilon"
# Leave blank to auto-generate a strong password
DB_PASS=""
# Your Cloudflare Pages URL (update after frontend deploy)
FRONTEND_ORIGIN="https://cibilon-crm.pages.dev"
# Leave blank to auto-generate
JWT_SECRET=""
METRICS_TOKEN=""
DATA_ENC_KEY=""
DOC_ENC_KEY=""
SEED_PASSWORD="cibilon@123"

# ── helpers ───────────────────────────────────────────────────────────────────
gen_hex()  { node -e "process.stdout.write(require('crypto').randomBytes($1).toString('hex'))"; }
gen_pass() { node -e "process.stdout.write(require('crypto').randomBytes(20).toString('base64url'))"; }

# ── 1. system packages ────────────────────────────────────────────────────────
info "Installing system packages..."
apt-get update -qq
apt-get install -y curl git nginx postgresql postgresql-contrib ufw

# ── 2. Node 22 ────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].slice(1))')" -lt 22 ]]; then
  info "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
info "Node $(node -v) / npm $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
npm install -g pm2 &>/dev/null
info "PM2 $(pm2 -v)"

# ── 4. PostgreSQL ─────────────────────────────────────────────────────────────
info "Configuring PostgreSQL..."
systemctl enable --now postgresql

[[ -z "$DB_PASS" ]] && DB_PASS=$(gen_pass)

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
info "PostgreSQL ready — db=${DB_NAME} user=${DB_USER}"

# ── 5. Clone / update repo ────────────────────────────────────────────────────
if [[ -d "${APP_DIR}/.git" ]]; then
  info "Updating existing repo..."
  cd "${APP_DIR}"
  git pull --ff-only
else
  info "Cloning repo..."
  git clone "${REPO_URL}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

# ── 6. npm install ────────────────────────────────────────────────────────────
info "Installing npm dependencies..."
npm ci --prefer-offline

# ── 7. Generate secrets if not set ───────────────────────────────────────────
[[ -z "$JWT_SECRET"    ]] && JWT_SECRET=$(gen_hex 24)
[[ -z "$METRICS_TOKEN" ]] && METRICS_TOKEN=$(gen_hex 24)
[[ -z "$DATA_ENC_KEY"  ]] && DATA_ENC_KEY=$(gen_hex 32)
[[ -z "$DOC_ENC_KEY"   ]] && DOC_ENC_KEY=$(gen_hex 32)

# ── 8. Write .env.production ──────────────────────────────────────────────────
info "Writing .env.production..."
cat > "${APP_DIR}/.env.production" <<ENV
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=4000

DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public
DIRECT_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public
DATABASE_POOL_MAX=10
DATABASE_POOL_IDLE_TIMEOUT_MS=30000
DATABASE_POOL_CONNECT_TIMEOUT_MS=10000

FRONTEND_ORIGIN=${FRONTEND_ORIGIN}

JWT_ACCESS_SECRET=${JWT_SECRET}
JWT_ACCESS_TTL_SECONDS=900
JWT_ISSUER=cibilon-api
JWT_AUDIENCE=cibilon-web
REFRESH_TOKEN_TTL_DAYS=30
REFRESH_COOKIE_NAME=cibilon_refresh
REFRESH_COOKIE_SAME_SITE=strict
COOKIE_SECURE=false
TRUST_PROXY=true

LOG_LEVEL=info
GLOBAL_RATE_LIMIT_WINDOW_MS=60000
GLOBAL_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=50
LOGIN_RATE_LIMIT_MAX=10

METRICS_TOKEN=${METRICS_TOKEN}
BCRYPT_ROUNDS=12
DATA_ENCRYPTION_KEY=${DATA_ENC_KEY}
DOCUMENT_ENCRYPTION_KEY=${DOC_ENC_KEY}

STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=${APP_DIR}/storage/documents
EXPORT_STORAGE_PATH=${APP_DIR}/storage/exports
EXPORT_JOB_POLL_MS=2000
MAX_DOCUMENT_SIZE_BYTES=10485760

SEED_DEFAULT_PASSWORD=${SEED_PASSWORD}
ENV
chmod 600 "${APP_DIR}/.env.production"

# ── 9. Storage dirs ───────────────────────────────────────────────────────────
mkdir -p "${APP_DIR}/storage/documents" "${APP_DIR}/storage/exports"

# ── 10. Build API ─────────────────────────────────────────────────────────────
info "Generating Prisma client..."
npm run db:generate

info "Building API..."
npm run build:api

# ── 11. Migrate + seed ────────────────────────────────────────────────────────
info "Running DB migrations..."
set -a; source "${APP_DIR}/.env.production"; set +a
npx prisma migrate deploy

info "Seeding database..."
npx prisma db seed || warn "Seed skipped (already seeded or error — check manually)"

# ── 12. PM2 ecosystem ─────────────────────────────────────────────────────────
info "Writing PM2 ecosystem config..."
cat > "${APP_DIR}/ecosystem.config.cjs" <<'PM2'
module.exports = {
  apps: [
    {
      name: 'cibilon-api',
      script: 'server/dist/server/src/server.js',
      cwd: '/opt/cibilon',
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      interpreter: 'node',
      pre_start: 'set -a && source /opt/cibilon/.env.production && set +a',
    },
    {
      name: 'cibilon-worker',
      script: 'server/dist/server/src/worker.js',
      cwd: '/opt/cibilon',
      instances: 1,
      autorestart: true,
      max_memory_restart: '256M',
      interpreter: 'node',
      pre_start: 'set -a && source /opt/cibilon/.env.production && set +a',
    },
  ],
};
PM2

pm2 delete cibilon-api cibilon-worker 2>/dev/null || true
pm2 start "${APP_DIR}/ecosystem.config.cjs"
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 13. Nginx ─────────────────────────────────────────────────────────────────
info "Configuring Nginx..."
cat > /etc/nginx/sites-available/cibilon <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 12M;

    location /api/ {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/cibilon /etc/nginx/sites-enabled/cibilon
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx && systemctl reload nginx

# ── 14. UFW firewall ──────────────────────────────────────────────────────────
info "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx HTTP'
ufw --force enable

# ── 15. Health check ──────────────────────────────────────────────────────────
info "Waiting for API to start..."
sleep 5
if curl -sf http://127.0.0.1:4000/api/v1/health > /dev/null; then
  info "✅ API health check passed"
else
  warn "API health check failed — check: pm2 logs cibilon-api"
fi

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Cibilon backend deployed successfully!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo "  API endpoint : http://187.127.140.74/api/v1"
echo "  Health check : http://187.127.140.74/api/v1/health"
echo ""
echo "  DB password  : ${DB_PASS}"
echo "  JWT secret   : ${JWT_SECRET}"
echo "  Metrics token: ${METRICS_TOKEN}"
echo ""
echo "  Secrets saved to: ${APP_DIR}/.env.production"
echo ""
echo "  PM2 commands:"
echo "    pm2 status"
echo "    pm2 logs cibilon-api"
echo "    pm2 logs cibilon-worker"
echo ""
echo -e "${YELLOW}  Next: deploy frontend to Cloudflare Pages${NC}"
echo -e "${YELLOW}  Then update FRONTEND_ORIGIN in .env.production and run:${NC}"
echo -e "${YELLOW}    pm2 restart cibilon-api${NC}"
echo ""
