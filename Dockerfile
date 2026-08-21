FROM node:20-slim

# Install yt-dlp (latest stable), ffmpeg, and minimal deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      ffmpeg \
      ca-certificates \
      curl && \
    pip3 install --break-system-packages --no-cache-dir yt-dlp && \
    apt-get purge -y python3-pip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
