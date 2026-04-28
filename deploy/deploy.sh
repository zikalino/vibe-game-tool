#!/usr/bin/env bash
# deploy.sh — bootstrap and run the vibe-game-tool backend stack on a fresh Ubuntu VM.
#
# Usage:
#   1. Copy deploy/.env.example to deploy/.env and fill in all values.
#   2. scp this script (or clone the repo) onto your UpCloud VM.
#   3. Run: bash deploy.sh
#
# The script is idempotent — safe to run again to pull the latest image/code.

set -euo pipefail

REPO_URL="https://github.com/zikalino/vibe-game-tool.git"
REPO_DIR="/opt/vibe-game-tool"
DEPLOY_DIR="${REPO_DIR}/deploy"

# ---------------------------------------------------------------------------
# 1. Install Docker Engine + Docker Compose plugin (idempotent)
# ---------------------------------------------------------------------------
install_docker() {
  if command -v docker &>/dev/null; then
    echo "✓ Docker already installed ($(docker --version))"
    return
  fi

  echo "→ Installing Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  echo "✓ Docker installed ($(docker --version))"
}

# ---------------------------------------------------------------------------
# 2. Clone repo or pull latest
# ---------------------------------------------------------------------------
clone_or_pull() {
  if [ -d "${REPO_DIR}/.git" ]; then
    echo "→ Pulling latest changes..."
    git -C "${REPO_DIR}" pull --ff-only
  else
    echo "→ Cloning repository..."
    git clone "${REPO_URL}" "${REPO_DIR}"
  fi
}

# ---------------------------------------------------------------------------
# 3. Ensure .env file exists
# ---------------------------------------------------------------------------
check_env() {
  local env_file="${DEPLOY_DIR}/.env"
  if [ ! -f "${env_file}" ]; then
    echo ""
    echo "ERROR: ${env_file} not found."
    echo "       Copy ${DEPLOY_DIR}/.env.example to ${env_file} and fill in all values."
    echo ""
    exit 1
  fi

  # Validate required variables are set and non-empty (no placeholder values)
  local required_vars=("GH_CLIENT_ID" "GH_CLIENT_SECRET" "JWT_SECRET" "DOMAIN")
  local missing=0
  for var in "${required_vars[@]}"; do
    local val
    val=$(grep -E "^${var}=" "${env_file}" | cut -d= -f2- | tr -d '[:space:]')
    if [ -z "${val}" ] || \
       [ "${val}" = "your_github_client_id_here" ] || \
       [ "${val}" = "your_github_client_secret_here" ] || \
       [ "${val}" = "replace_with_a_random_32_byte_hex_string" ] || \
       [ "${val}" = "your.domain.here" ]; then
      echo "ERROR: ${var} is not configured in ${env_file} (current value looks like a placeholder)"
      missing=1
    fi
  done
  if [ "${missing}" -eq 1 ]; then
    exit 1
  fi

  echo "✓ .env file looks good"
}

# ---------------------------------------------------------------------------
# 4. Derive CADDY_DOMAIN from DOMAIN
# ---------------------------------------------------------------------------
# Caddy cannot obtain a public TLS certificate for a bare IP address and will
# fall back to its internal (self-signed) CA, which browsers reject with an
# SSL error.  When DOMAIN looks like an IPv4 address we therefore prefix it
# with "http://" so that Caddy serves the site over plain HTTP instead.
# For proper hostnames Caddy's automatic HTTPS continues to work unchanged.
# ---------------------------------------------------------------------------
set_caddy_domain() {
  local env_file="${DEPLOY_DIR}/.env"
  local domain
  domain=$(grep -E "^DOMAIN=" "${env_file}" | cut -d= -f2- | tr -d '[:space:]')

  local caddy_domain
  if [[ "${domain}" =~ ^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$ ]]; then
    echo "→ DOMAIN is a bare IP address; configuring Caddy for plain HTTP"
    caddy_domain="http://${domain}"
  else
    caddy_domain="${domain}"
  fi

  # Always update CADDY_DOMAIN so that a changed DOMAIN value is picked up on
  # re-deploy (e.g. when migrating from a bare IP to a proper domain name).
  if grep -q "^CADDY_DOMAIN=" "${env_file}" 2>/dev/null; then
    sed -i "s|^CADDY_DOMAIN=.*|CADDY_DOMAIN=${caddy_domain}|" "${env_file}"
  else
    echo "CADDY_DOMAIN=${caddy_domain}" >> "${env_file}"
  fi
  echo "✓ CADDY_DOMAIN=${caddy_domain}"
}


# ---------------------------------------------------------------------------
# 5. Start the stack
# ---------------------------------------------------------------------------
start_stack() {
  echo "→ Building and starting Docker Compose stack..."
  cd "${DEPLOY_DIR}"
  docker compose --env-file .env up -d --build --remove-orphans
  echo "✓ Stack started"
}

# ---------------------------------------------------------------------------
# 6. Print status and URL
# ---------------------------------------------------------------------------
print_status() {
  cd "${DEPLOY_DIR}"
  echo ""
  echo "=== Service status ==="
  docker compose ps
  echo ""

  local caddy_domain
  caddy_domain=$(grep -E "^CADDY_DOMAIN=" "${DEPLOY_DIR}/.env" | cut -d= -f2- | tr -d '[:space:]')

  # Determine the public URL from CADDY_DOMAIN.
  # If CADDY_DOMAIN already starts with "http://" (bare-IP deployment) use it
  # directly; otherwise assume HTTPS.
  local service_url
  if [[ "${caddy_domain}" == http://* ]]; then
    service_url="${caddy_domain}"
  else
    service_url="https://${caddy_domain}"
  fi

  echo "=== Deployment complete ==="
  echo "  Service URL : ${service_url}"
  echo "  Health check: ${service_url%/}/health"
  echo "  Logs        : docker compose -f ${DEPLOY_DIR}/docker-compose.yml logs -f"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root (or with sudo)." >&2
  exit 1
fi

install_docker
clone_or_pull
check_env
set_caddy_domain
start_stack
print_status
