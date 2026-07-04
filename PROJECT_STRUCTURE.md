# Project Structure

This document summarizes the current tech stack and repository layout for the mOhiOm workspace.

## Tech Stack

### Frontend
- Framework: Next.js 14 (App Router)
- UI: React 18
- Language: TypeScript
- Styling: Tailwind CSS, PostCSS, Autoprefixer
- Networking: Axios
- Content rendering: react-markdown, remark-gfm
- Icons: lucide-react
- Motion: framer-motion
- Linting: ESLint (next lint)

### Backend
- Framework: FastAPI
- Server: Uvicorn
- Data validation: Pydantic, pydantic-settings
- Database: MongoDB (via PyMongo)
- Auth/security: python-jose, passlib
- HTTP client: httpx
- File handling: python-multipart
- AI integration: google-genai, google-api-core

### Database & Infrastructure
- MongoDB setup via `database/` and `docker-compose.yml`
- Docker: root-level `docker-compose.yml` for local orchestration

## Repository Layout

```
/Users/thuongnguyen/mOhiOm
├── README.md
├── PROJECT_STRUCTURE.md
├── DOCUMENTATION_INDEX.md
├── FILE_MANIFEST.md
├── START_HERE.md
├── QUICK_START.md
├── COMPLETE_SETUP_GUIDE.md
├── docker-compose.yml
├── backend/
│   ├── README.md
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── crud.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── services.py
│   │   ├── emailer.py
│   │   ├── lifespan.py
│   │   ├── rate_limit.py
│   │   └── routers/
│   ├── scripts/
│   └── test_text_to_comic_pipeline.py
├── database/
│   ├── docker-compose.yml
│   ├── init-mongo.js
│   ├── init.sql
│   └── README.md
├── frontend/
│   ├── README.md
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── public/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── context/
│       ├── services/
│       ├── styles/
│       └── utils/
└── Reference/
    ├── README.md
    ├── index.html
    ├── metadata.json
    └── src/
```

Notes:
- The `frontend/src/app/` folder uses the Next.js App Router.
- The `backend/app/` folder contains FastAPI entry points, configuration, and routes.
- Additional setup, verification, and Gemini integration guides are available at the repository root.

