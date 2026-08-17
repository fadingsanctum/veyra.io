# Veyra.io — self-hosted worker image.
#
# Run this on any always-on host (VPS, Render, Railway, Fly.io…). It bundles
# ffmpeg (merging / audio conversion) and the latest yt-dlp (on PATH) so the
# download engine works out of the box — no runtime auto-bootstrap needed.
#
# NOTE: this cannot run on serverless platforms (Vercel, Netlify, CF Pages) —
# the filesystem is read-only and downloads outlive any single function call.
FROM node:20-bookworm-slim

# ffmpeg + python3/pip (to keep yt-dlp on PATH for both amd64 and arm64 hosts)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --no-cache-dir -U yt-dlp

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
