#!/usr/bin/env bash
# Deploy Veyra on an always-free VPS — e.g. Oracle Cloud Always Free ARM
# (4 vCPU / 24 GB RAM, $0 forever, no cold starts). The only free hosting that
# is always-on, so downloads never get interrupted by spin-down.
#
# Prereqs: a fresh Ubuntu 22.04/24.04 VM, root access, and a git repo URL.
#
# Usage:
#   # public repo:
#   VEYRA_REPO=https://github.com/<you>/<repo>.git sudo ./deploy/oracle-vps.sh
#   # private repo (GitHub fine-grained token with repo read scope):
#   VEYRA_REPO=https://github.com/<you>/<repo>.git VEYRA_TOKEN=ghp_xxx sudo ./deploy/oracle-vps.sh
#
# Env: VEYRA_REPO (required), VEYRA_TOKEN (optional, private repos),
#      VEYRA_BRANCH (default main), VEYRA_PORT (default 80).
set -euo pipefail

: "${VEYRA_REPO:?Set VEYRA_REPO to your git repo URL (https://github.com/<you>/<repo>.git)}"
VEYRA_BRANCH="${VEYRA_BRANCH:-main}"
VEYRA_APP_DIR="${VEYRA_APP_DIR:-/opt/veyra}"
VEYRA_PORT="${VEYRA_PORT:-80}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (e.g. prefix with sudo)." >&2
  exit 1
fi

# 1. Install Docker (official repo, works on Ubuntu ARM64/amd64)
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker…"
  apt-get update
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io
fi

# 2. Clone the repo (with token auth for private repos)
echo "==> Cloning $VEYRA_REPO ($VEYRA_BRANCH)…"
rm -rf "$VEYRA_APP_DIR"
if [ -n "${VEYRA_TOKEN:-}" ]; then
  REPO_URL="$(printf '%s' "$VEYRA_REPO" | sed "s#https://#https://x-access-token:${VEYRA_TOKEN}@#")"
else
  REPO_URL="$VEYRA_REPO"
fi
git clone --depth 1 --branch "$VEYRA_BRANCH" "$REPO_URL" "$VEYRA_APP_DIR"

# 3. Build the image (bundles yt-dlp + ffmpeg) and run it
echo "==> Building image (this takes a few minutes)…"
cd "$VEYRA_APP_DIR"
docker build -t veyra .
docker rm -f veyra >/dev/null 2>&1 || true
docker run -d --name veyra --restart unless-stopped \
  -p "${VEYRA_PORT}:3000" \
  -e VEYRA_MAX_CONCURRENT=3 \
  veyra

echo
echo "Veyra is up:  http://$(hostname -I | awk '{print $1}'):${VEYRA_PORT}"
echo "Logs:         docker logs -f veyra"
echo "Update later: cd $VEYRA_APP_DIR && git pull && docker build -t veyra . && docker rm -f veyra && docker run -d --name veyra --restart unless-stopped -p ${VEYRA_PORT}:3000 -e VEYRA_MAX_CONCURRENT=3 veyra"
