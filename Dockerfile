# Veyra.io — self-hosted worker image.
#
# Run this on any always-on host (VPS, Render, Railway, Fly.io…). It bundles
# ffmpeg (merging / audio conversion) and the latest yt-dlp so the download
# engine works out of the box — no runtime auto-bootstrap needed.
#
# NOTE: this cannot run on serverless platforms (Vercel, Netlify, CF Pages) —
# the filesystem is read-only and downloads outlive any single function call.
FROM node:20-bookworm-slim

# ffmpeg for merging/audio conversion, curl to fetch the official yt-dlp binary.
# yt-dlp is installed as its official static binary — no Python needed, which
# also avoids Debian bookworm's externally-managed pip restrictions.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Official static yt-dlp binary for the target architecture (amd64 default,
# arm64 for free ARM VPSes like Oracle Cloud).
ARG TARGETARCH
RUN case "${TARGETARCH}" in \
      arm64) URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64" ;; \
      *)     URL="https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" ;; \
    esac \
  && curl -fsSL "${URL}" -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp \
  && yt-dlp --version

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV VEYRA_ENGINE_PATH=/usr/local/bin/yt-dlp

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
