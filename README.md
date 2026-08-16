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

- The engine binary on `PATH` (or set `VEYRA_ENGINE_PATH=/path/to/engine`)
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

## Architecture notes (for production deployment)

The frontend is plain Next.js and deploys anywhere (Vercel). The engine
worker, however, is **not serverless-friendly**: long-running downloads and
FFmpeg don't fit request/response lifetimes. Recommended topology:

- **Vercel** — frontend + `/api/resolve` + queue API
- **Always-on container** (Railway / Render / Fly.io) — the actual download
  worker; set `VEYRA_ENGINE_PATH`, `VEYRA_MAX_CONCURRENT`, and a cron for the
  engine's standard pip upgrade

The in-memory job queue in `lib/queue.ts` keeps the same API surface for
single-instance use. For multi-instance scale-out, swap it for a Redis-backed
queue (e.g. BullMQ) — the route handlers and client poller don't need to change.

### Env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `VEYRA_ENGINE_PATH` | engine binary name | Path to the download engine binary |
| `VEYRA_MAX_CONCURRENT` | `3` | Hard cap on concurrent downloads |

## Legal

Only download content you own, have permission for, or that is licensed for
reuse (Creative Commons, public domain, your own uploads). See `/legal`.
