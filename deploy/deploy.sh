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
  local required_vars=("GITHUB_CLIENT_ID" "GITHUB_CLIENT_SECRET" "JWT_SECRET" "DOMAIN")
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
# 4. Start the stack
# ---------------------------------------------------------------------------
start_stack() {
  echo "→ Building and starting Docker Compose stack..."
  cd "${DEPLOY_DIR}"
  docker compose --env-file .env up -d --build --remove-orphans
  echo "✓ Stack started"
}

# ---------------------------------------------------------------------------
# 5. Print status and URL
# ---------------------------------------------------------------------------
print_status() {
  cd "${DEPLOY_DIR}"
  echo ""
  echo "=== Service status ==="
  docker compose ps
  echo ""

  local domain
  domain=$(grep -E "^DOMAIN=" "${DEPLOY_DIR}/.env" | cut -d= -f2- | tr -d '[:space:]')
  echo "=== Deployment complete ==="
  echo "  Service URL : https://${domain}"
  echo "  Health check: https://${domain}/health"
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
start_stack
print_status
