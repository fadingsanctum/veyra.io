# Veyra.io — Beyond the Walls

A dark, cinematic, "beyond-the-walls" themed **universal media downloader**.
One URL box. Every platform (1800+). Every format it can produce.

---

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + CSS variables for theming (`dark` / `dim` / `light`)
- **Framer Motion** for orchestrated transitions (reduced-motion aware)
- **Zustand** (persisted) for settings + download history
- **Veyra's engine** — the real open-source media engine binary, shelled out to
  server-side (never a JS reimplementation), so new platforms work
  automatically as the engine updates
- **lucide-react** icons

## Getting started

```bash
npm install
npm run dev
```

Requirements for the backend to actually work:

- The engine binary on `PATH` (or set `VEYRA_ENGINE_PATH=/path/to/engine`) — if it
  isn't found, the server **auto-downloads the official yt-dlp binary** to
  `~/.veyra/bin` on first use, so fresh workers work with zero setup. Disable
  that with `VEYRA_NO_AUTO_BOOTSTRAP=1` (e.g. air-gapped hosts).
- `ffmpeg` on `PATH` (needed for merging video+audio and audio conversion)

Keep the engine updated regularly — new-site support is inherited
automatically (run its standard pip upgrade on a cron on the worker).

## How it works

1. Paste any URL → the client POSTs to `/api/resolve`, which runs a cheap
   flat-probe of the link and, for single videos, a full metadata pull to
   gather the complete `formats[]` array.
2. The UI reveals metadata + dynamically-built dropdowns: type (video with
   audio / video only / audio only), quality & format (every resolution and
   container the source actually serves), and container/audio format.
3. "Download" POSTs to `/api/download`, which **enqueues a job** and returns
   instantly — downloads never hold an HTTP connection open. A worker process
   runs the engine, parses its progress output, and the client polls
   `/api/jobs` for live progress (rendered as an ember progress crack).
4. When done, `/api/jobs/[id]/file` streams the file to the browser. History is
   stored locally in `localStorage`.

Playlists are detected and can be queued as a batch. Pasting a multi-line list
of URLs queues each one automatically.

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/resolve` | POST `{ url }` | Probe a link → metadata + formats (or playlist entries) |
| `/api/download` | POST `{ url, format, mergeFormat?, extractAudio?, audioFormat?, filenameTemplate?, concurrentLimit? }` | Enqueue a download job |
| `/api/jobs` | GET | List all jobs (client poller) |
| `/api/jobs/[id]` | GET / DELETE | Job status / cancel + cleanup |
| `/api/jobs/[id]/file` | GET | Stream the finished file |
| `/api/sites` | GET | Live list of supported platforms (extractors) |

Errors are classified (`unsupported`, `unavailable`, `age_restricted`,
`network`, `ffmpeg`, `format_unavailable`, `rate_limited`, …) so the `/help`
troubleshooting table stays data-driven.

## Security guardrails

- URLs are validated server-side (http/https only, no credentials, no raw
  whitespace) before anything touches a shell.
- The engine is always spawned with an **args array, never a shell string**;
  the `-f` format string is matched against a strict allowlist.
- Per-IP rate limiting on resolve and download endpoints.
- Jobs write only into a per-job temp directory under the OS temp folder and
  are swept after a few hours.

## Deploying for real (why Vercel alone fails)

**If you deployed to Vercel (or any serverless platform) and pasting a link
shows *"Veyra's download engine isn't installed on this server"* — that's
expected and can't be fixed with config.** Two reasons:

1. The engine auto-installs itself into `~/.veyra/bin` on first use, but
   serverless functions have a **read-only filesystem**, so the install fails
   silently and every call falls back to the error above.
2. Even with the binary present, downloads **cannot work serverless**: the job
   queue lives in the server process's memory, each request can hit a different
   instance, and a 30-minute download outlives any function's lifetime.

The download engine needs an **always-on host**. Free options, ranked:

| Option | Cost | Always-on? | Effort | Notes |
| --- | --- | --- | --- | --- |
| **Oracle Cloud Always Free VPS** | $0 forever | ✅ | Medium | 4 ARM vCPU / 24 GB RAM. Only genuinely free *and* always-on (no cold starts). Needs an SSH + Docker setup (script provided) and Oracle may reclaim truly-idle instances. |
| **Render free web service** | $0 | ❌ sleeps after 15 min | Low | One-click from GitHub (blueprint included). ~50s cold start on the first request. No credit card. |
| Railway "free" | $5 one-time credit | — | — | Not enough to stay up 24/7 — it's a trial, not a free tier. |
| Fly.io | — | — | — | No free tier for new signups. |

### Option A — free VPS (Oracle Cloud), truly always-on

1. Sign up at <https://www.oracle.com/cloud/free/> and create an **Ampere
   (ARM) VM** in your home region with **Ubuntu 22.04/24.04** (Always Free:
   4 vCPU / 24 GB RAM / 200 GB disk).
2. SSH into the box, then run the setup script (installs Docker, clones the
   repo, builds and starts the app on port 80):

   ```bash
   VEYRA_REPO=https://github.com/<you>/<repo>.git sudo ./deploy/oracle-vps.sh
   ```

   For a private repo, pass a GitHub token: `VEYRA_TOKEN=ghp_…`.

3. Point a domain at the VM's public IP and enable HTTPS (e.g. install
   `nginx` + `certbot`). The app is on port 80 by default (`VEYRA_PORT=443`
   if you terminate TLS at nginx).

Keep the instance non-idle (a cron ping or real traffic) so Oracle doesn't
reclaim it.

### Option B — Render free (easiest, sleeps when idle)

1. Sign up at <https://render.com> (no credit card).
2. **New + → Blueprint** → select this repo. The included `render.yaml`
   creates the web service from the `Dockerfile` (yt-dlp + ffmpeg bundled).

The free instance sleeps after 15 minutes of inactivity — the first request
of the day takes ~50s to spin up, then everything works. Upgrade the plan if
you want always-on.

### The `Dockerfile`

`docker build -t veyra . && docker run -d -p 80:3000 veyra` runs the whole
app (frontend + engine worker) in one container — works on any VPS or
container host, amd64 or arm64. yt-dlp is pinned to latest at build time;
rebuild periodically to inherit new-site support.

## Architecture notes

- The in-memory job queue in `lib/queue.ts` keeps the same API surface for
  single-instance use. For multi-instance scale-out, swap it for a Redis-backed
  queue (e.g. BullMQ) — the route handlers and client poller don't need to change.
- On hosts with a read-only home directory, the engine auto-install falls back
  to the OS temp dir; disable auto-install entirely with `VEYRA_NO_AUTO_BOOTSTRAP=1`.

### Env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `VEYRA_ENGINE_PATH` | engine binary name | Path to the download engine binary |
| `VEYRA_NO_AUTO_BOOTSTRAP` | `0` | Set to `1` to disable auto-downloading the engine when it's missing |
| `VEYRA_MAX_CONCURRENT` | `3` | Hard cap on concurrent downloads |

## Legal

Only download content you own, have permission for, or that is licensed for
reuse (Creative Commons, public domain, your own uploads). See `/legal`.
