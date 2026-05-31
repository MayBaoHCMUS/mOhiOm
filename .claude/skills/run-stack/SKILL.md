---
name: run-stack
description: Start the mOhiOm frontend dev server and FastAPI backend together. Use when the user wants to run the app locally or test a change in the real running app.
disable-model-invocation: false
---

Start both servers for local development:

1. **Backend** (FastAPI on port 8000):
   - Working directory: `backend/`
   - Activate the Python venv: `source venv/bin/activate`
   - Start: `uvicorn app.main:app --reload`
   - Wait for "Application startup complete" before proceeding

2. **Frontend** (Next.js on port 3000):
   - Working directory: `frontend/`
   - Start: `npm run dev`
   - Wait for "Ready in" or "started server on" before reporting ready

Both servers must be running before the app is usable. MongoDB must already be running locally on port 27017.

After both are up, report the URLs:
- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs