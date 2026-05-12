# Project Summary: mOhiOm

A full-stack web app with a Next.js frontend, FastAPI backend, and MongoDB database. This file is a quick orientation map for coding and navigation.

## Architecture at a glance
- Frontend: React 18 + Next.js 14 + TypeScript, served at http://localhost:3000
- Backend: FastAPI + Uvicorn + Pydantic + PyMongo, served at http://localhost:8000
- Database: MongoDB (local or Docker)
- API base URL: http://localhost:8000/api

## Key directories
- frontend/src/app: Next.js App Router pages
- frontend/src/components: Reusable UI components
- frontend/src/services/api.ts: Axios API client
- frontend/src/styles: Global styles and tokens
- backend/app/main.py: FastAPI entry point and router registration
- backend/app/routers: API route modules
- backend/app/schemas.py: Pydantic models
- backend/app/database.py: MongoDB connection manager
- database/: MongoDB compose and init scripts

## Frontend routes
- /: Landing page
- /login: Sign in
- /register: Create account
- /forgot-password: Password reset
- /studio: Text-to-comic generator
- /studio/dashboard: Studio dashboard
- /studio/story-setup: Story input setup
- /studio/character-setup: Character consistency setup
- /studio/character-manager: Character manager
- /studio/editor: Comic editor workspace
- /studio/export: Export and publish
- /studio/layout-engine: Layout engine control widget
- /settings: Creator settings and profile hub
- /pricing: Pricing and billing
- /gallery: Public comic reader gallery
- /admin/analytics: Admin analytics and monitoring
- /admin/moderation: Trust and safety moderation

## Backend endpoints
- GET /items: List all items
- POST /items: Create new item
- GET /items/{id}: Get item by ID
- PUT /items/{id}: Update item
- DELETE /items/{id}: Delete item
- GET /health: Health check
- Docs: http://localhost:8000/docs

## Environment configuration
- Frontend: frontend/.env.local
  - NEXT_PUBLIC_API_URL=http://localhost:8000/api
- Backend: backend/.env
  - MONGODB_URL=mongodb://localhost:27017
  - DATABASE_NAME=mohiom_db
  - DEBUG=False
  - CORS_ORIGINS=["http://localhost:3000"]

## Common commands
- Frontend dev:
  - npm install
  - npm run dev
- Backend dev:
  - python3 -m venv venv
  - venv\Scripts\activate
  - pip3 install -r requirements.txt
  - python3 -m app.main
- Docker compose:
  - docker-compose up -d
  - docker-compose down

## Docs to start with
- START_HERE.md
- QUICK_START.md
- SETUP_SUMMARY_LOCAL_MONGODB.md
- frontend/README.md
- backend/README.md
- database/README.md

