# mOhiOm — Turn Text Into Comics

**Undergraduate Thesis Project — Faculty of Information Technology, University of Science (HCMUS), VNU-HCM**

> **Đề tài:** Phát triển hệ thống đa phương tiện để sáng tác truyện tranh từ văn bản
> **Thesis title:** *Development of a Multimedia System for Comic Creation from Narrative Text*

| | |
|---|---|
| **Student** | Nguyễn Hoài Thương — MSSV 22120364 |
| **Advisors** | TS. Lê Trung Nghĩa, ThS. Trần Duy Quang |
| **Term** | 01/2026 – 07/2026 |

---

## Overview

Turning a written story into a comic traditionally takes a trained illustrator 4–8 hours per page. Existing text-to-image tools (Midjourney, Stable Diffusion) generate beautiful single images, but fall apart the moment you need a *coherent multi-page comic*: characters change appearance between panels, panel layout is entirely manual, and rendered text/speech is unreliable.

**mOhiOm** is an end-to-end web platform that takes raw narrative text and automatically produces a finished, exportable comic — while keeping a human in the loop at every step. It is organized as a 5-step guided pipeline:

1. **Story Analysis** — an LLM reads the input text, identifies characters, breaks the plot into scene "beats," and extracts dialogue.
2. **Character Design & Consistency** — structured character descriptions plus a user-approved reference portrait are carried into every subsequent image generation via IP-Adapter conditioning, so the same character looks the same across panels.
3. **Panel Script** — the analyzed story is broken into a panel-by-panel visual script.
4. **Image Generation & Layout** — panels are rendered (full-page or panel-by-panel) into one of several auto-suggested layout templates, with automatic retry on failure.
5. **Dialogue & Export** — a visual speech-bubble editor (with auto-import from the parsed script) and multi-format export (PDF / EPUB / image ZIP), plus one-click publishing to a public reader with view-count analytics.

## Key Features

- **Character consistency without model fine-tuning** — structured LLM-authored character sheets + a user-selected reference portrait, fed into image generation via IP-Adapter, with a reusable cross-project character library.
- **Multi-provider LLM orchestration** — Gemini by default, with an optional custom OpenAI-compatible provider ("NineRouter") or bring-your-own-key, selectable per deployment.
- **Streaming everywhere it matters** — long-running LLM calls stream token-by-token over SSE so the UI never shows a blank/frozen screen.
- **Resilient generation** — per-user rate limiting with a bounded queue, automatic retry (with backoff) on transient image-generation failures, pause/resume for long batch jobs.
- **Community Gallery** — authors can publish a finished comic (or a standalone character) to a public, no-login-required gallery; everything else in the app requires authentication.
- **Full account system** — email/password and Google/GitHub OAuth, password reset via email, JWT-based sessions.
- **Cloud project persistence** — save/resume projects across sessions and devices; generated images are stored in Cloudflare R2, not as base64 blobs in MongoDB.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript (strict), Tailwind CSS, Framer Motion |
| Backend | FastAPI (Python 3.10+), Pydantic, PyMongo |
| Database | MongoDB 7.0 |
| Object storage | Cloudflare R2 (generated comic images) |
| LLM providers | Google Gemini (default), custom OpenAI-compatible endpoint, or user-supplied key |
| Image generation | External GPU-hosted diffusion/IP-Adapter service, integrated via a server-side proxy |
| Auth | JWT + HTTP-only cookies, Google/GitHub OAuth |
| Email | Resend (transactional email API — chosen because most free-tier hosts block outbound SMTP) |

## Project Structure

```
mOhiOm/
├── frontend/                  # Next.js 14 application
│   ├── src/
│   │   ├── app/                # App Router pages (routes below)
│   │   ├── components/         # Reusable UI + the studio-steps wizard components
│   │   ├── context/             # ComicGenerationContext (pipeline state), AuthContext, ...
│   │   ├── services/            # Typed API client (api.ts)
│   │   └── styles/               # Tailwind + Material-token globals.css
│   └── package.json
│
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── main.py              # Entry point
│   │   ├── config.py            # Settings (env-driven)
│   │   ├── database.py          # MongoDB connection
│   │   ├── schemas.py           # Pydantic models
│   │   ├── services.py          # LLM provider orchestration (Gemini / NineRouter)
│   │   ├── r2_storage.py        # Cloudflare R2 upload helpers
│   │   ├── rate_limit.py        # Per-user request queue
│   │   └── routers/             # One module per API area (see below)
│   └── requirements.txt
│
├── database/                  # Local MongoDB Docker config + init script
├── ThesisInformation/          # Thesis-related materials (mostly untracked/private)
├── docker-compose.yml          # Full-stack local orchestration
└── DEPLOYMENT.md               # Production deployment guide (Vercel + Render + Atlas)
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB 7.0 (local install or Docker)
- A Google Gemini API key (or a configured alternative LLM provider)

### Option 1 — Manual setup (recommended for local development)

**1. Start MongoDB** (must already be running locally on `27017`):
```bash
mongosh
```

**2. Backend**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in GEMINI_API_KEY at minimum
uvicorn app.main:app --reload
```
API: http://localhost:8000 · Interactive docs: http://localhost:8000/docs

**3. Frontend**
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:3000

### Option 2 — Docker Compose (full stack, including MongoDB)
```bash
docker-compose up -d
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a full production deployment walkthrough (Vercel + Render + MongoDB Atlas).

## Configuration

### `backend/.env`
| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Required — powers story analysis, character design, and script generation |
| `MONGODB_URL` / `DATABASE_NAME` | Database connection |
| `JWT_SECRET_KEY` | **Must be changed for production** |
| `CORS_ORIGINS` | Must include the deployed frontend origin |
| `NINE_ROUTER_URL` / `NINE_ROUTER_API_KEY` / `NINE_ROUTER_MODEL` | Optional — fully replaces Gemini as the LLM provider when set |
| `OAUTH_GOOGLE_CLIENT_ID` / `_SECRET`, `OAUTH_GITHUB_CLIENT_ID` / `_SECRET` | Google/GitHub sign-in |
| `RESEND_API_KEY` / `RESEND_FROM` | Password-reset email delivery |
| `GEMINI_REQUESTS_PER_SECOND` / `_MAX_QUEUE_SIZE` / `_MAX_QUEUE_WAIT_SECONDS` | Per-user rate-limit tuning |

See [`backend/.env.example`](./backend/.env.example) for the complete, documented list.

### `frontend/.env`
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL (defaults to `http://localhost:8000/api`) |
| `NEXT_PUBLIC_API_LOGGING` | Set to `false` to silence request/response console logs |

## Application Routes

| Route | Description |
|---|---|
| `/` | Landing page (public) |
| `/gallery` | Community Gallery — public comics/characters showcase, no login required |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Authentication |
| `/pricing` | Pricing |
| `/privacy`, `/terms` | Legal |
| `/studio` | The 5-step text-to-comic pipeline wizard |
| `/studio/dashboard` | Studio home — recent projects & characters |
| `/studio/story-setup` | Story input & quick-start |
| `/studio/character-manager` | Character library — create, edit, publish to gallery |
| `/studio/editor` | Comic/dialogue editor workspace |
| `/studio/publish` | Publish a finished comic to a shareable reader link |
| `/studio/publish-history` | View counts for previously published comics |
| `/studio/my-stories` | Saved story drafts |
| `/studio/analytics` | Per-project stats |
| `/studio/layout-engine` | Layout template picker/preview |
| `/settings` | Profile, password, and integration settings |
| `/admin`, `/admin/analytics`, `/admin/moderation` | Admin dashboards (key-gated) |

All routes under `/studio/*` require an authenticated session; `/gallery` and the marketing pages are intentionally public.

## API Overview

All backend routes are prefixed with `/api`. Interactive, always-current documentation is available at `/docs` (Swagger UI) and `/openapi.json` once the backend is running. Main route groups:

| Router | Purpose |
|---|---|
| `/api/auth/*` | Registration, login, OAuth, password reset |
| `/api/gemini/*` | Story analysis, character/panel prompt generation, panel image generation (streaming supported) |
| `/api/comics/*` | Comic generation pipeline jobs |
| `/api/projects/*` | Save/load projects, character library, publish toggle |
| `/api/gallery/*` | Public (no-auth) reads of published comics/characters |
| `/api/bubbles/*`, `/api/comic-layout/*` | Dialogue bubbles and page layout |
| `/api/ratings/*` | Human evaluation scores (panels/comics/characters) |
| `/api/analytics/*`, `/api/admin/*` | Usage analytics and admin/thesis-evaluation reporting |
| `/api/settings/*` | User-configurable text-gen provider settings |
| `/health` | Health check |

## Testing

There is no CI-integrated automated test suite (this is a solo thesis project on a tight timeline — see the thesis's testing-strategy chapter for the reasoning). Manual/integration test scripts live in `backend/`:

- `backend/scripts/auth_smoke.py` — auth flow smoke test
- `backend/test_gemini_integration.py` — Gemini integration test
- `backend/test_text_to_comic_pipeline.py` — full pipeline integration test

Static checks: `npx tsc --noEmit` and `npm run lint` (frontend, ESLint only — no Prettier).

## Documentation

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — production deployment guide
- [`CLAUDE.md`](./CLAUDE.md) — engineering conventions and architecture gotchas for contributors
- [`database/README.md`](./database/README.md) — local MongoDB setup details

## License

This repository is an academic thesis project developed for graduation requirements at the Faculty of Information Technology, University of Science (HCMUS), VNU-HCM. All rights reserved by the author unless a separate license is added.
