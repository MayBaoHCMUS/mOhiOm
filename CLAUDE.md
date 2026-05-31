## 📋 SESSION CONTINUITY
Always read SESSION_LOG.md at the start of every conversation
to understand the current project state before doing anything else.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mOhiOm is an AI-powered comic generation app with a Next.js 14 frontend and FastAPI backend.

- **Frontend**: Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS — port 3000
- **Backend**: FastAPI (Python 3.10+), MongoDB via PyMongo — port 8000
- **Database**: MongoDB 7.0 running locally (not Docker by default)

## Development Commands

### Frontend (run from `frontend/`)
```bash
npm run dev        # Dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint check (no Prettier — ESLint only)
```

### Backend (run from `backend/`)
```bash
source venv/bin/activate
uvicorn app.main:app --reload   # Dev server at http://localhost:8000
```

### Full stack via Docker
```bash
docker-compose up -d   # Starts MongoDB + backend + frontend
```

## Environment Variables

**`backend/.env`**
- `GEMINI_API_KEY` — required; defaults model to `gemini-2.5-flash`
- `JWT_SECRET_KEY` — must be changed in production
- `MONGODB_URL` — defaults to `mongodb://localhost:27017` (Docker uses `mongodb://mohiom_user:mohiom_password@mongodb:27017/mohiom_db`)
- `DATABASE_NAME` — defaults to `mohiom_db`
- `NINE_ROUTER_URL` / `NINE_ROUTER_API_KEY` / `NINE_ROUTER_MODEL` — optional; when set, **completely replaces Gemini** as the LLM provider
- `CORS_ORIGINS` — must include frontend origin in production
- `GEMINI_REQUESTS_PER_SECOND` / `GEMINI_MAX_QUEUE_SIZE` / `GEMINI_MAX_QUEUE_WAIT_SECONDS` — rate limiter defaults (2 / 8 / 8); override in `.env` to change limits
- `OAUTH_GOOGLE_CLIENT_ID` / `OAUTH_GOOGLE_CLIENT_SECRET` — required for Google OAuth login
- `OAUTH_GITHUB_CLIENT_ID` / `OAUTH_GITHUB_CLIENT_SECRET` — required for GitHub OAuth login
- `AUTH_FRONTEND_URL` / `AUTH_BACKEND_URL` — required for OAuth redirect URIs
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_FROM` / `SMTP_USE_TLS` — required for password reset email

**`frontend/.env`**
- `NEXT_PUBLIC_API_URL` — defaults to `http://localhost:8000/api`
- `NEXT_PUBLIC_API_LOGGING` — set to `false` to silence request/response console logs

## Architecture Gotchas

- **MongoDB is synchronous**: PyMongo (not motor) is used. DB calls run in FastAPI's thread pool — they are not truly async despite the `async def` wrappers.
- **Dual LLM providers**: `NINE_ROUTER_URL` in `.env` completely overrides Gemini when set. Routing logic is in `backend/app/services.py`.
- **Rate limiting**: Per-user cap defaulting to 2 req/s, queue of 8, timeout of 8s (configurable via env — see above). Clients must handle `429 Too Many Requests` and `503 Service Unavailable`.
- **Streaming**: Gemini endpoints return `StreamingResponse` (SSE). Frontend consumes via `EventSource`, not `fetch`.
- **Large context file**: `frontend/src/context/ComicGenerationContext.tsx` (~72KB) owns the entire comic generation workflow across steps 1–4. This file is load-bearing and performance-sensitive.
- **No Python formatter/linter**: The backend has no ruff, black, or mypy configured. Do not add linter config without asking.
- **Docker MongoDB URI differs**: Docker Compose uses an authenticated URI (`mongodb://mohiom_user:mohiom_password@mongodb:27017/mohiom_db`). Local dev uses plain `mongodb://localhost:27017`. Don't conflate the two in `.env`.

## Frontend Conventions

- **Path alias**: `@/*` → `src/*` (e.g., `import { AuthContext } from '@/context/AuthContext'`)
- **Styling**: Tailwind CSS + CSS custom properties for Material Design tokens defined in `globals.css`. Use `var(--color-primary)` etc., not hardcoded hex.
- **Icons**: `lucide-react` only
- **Animations**: `framer-motion`
- **No Prettier**: Formatting is enforced by ESLint only. Do not add Prettier config.

## API Structure

All backend routes are prefixed with `/api`:
- `/api/auth/*` — registration, login, Google/GitHub OAuth, password reset
- `/api/gemini/*` — text generation, story analysis (streaming supported)
- `/api/comics/*` — comic generation pipeline
- `/api/items/*` — generic items router

The `frontend/src/services/api.ts` client auto-injects `X-User-Id` on every request (sourced from `localStorage` key `mohiom-user-id`) and redacts auth tokens in logs.

## Testing

No CI-integrated test suite. Manual test files:
- `backend/scripts/auth_smoke.py` — auth smoke test
- `backend/test_gemini_integration.py` — Gemini integration test
- `backend/test_text_to_comic_pipeline.py` — full pipeline integration test

No CI/CD pipelines are configured. New tests belong in `backend/` alongside existing test files.
