## SESSION: 2026-05-31

### ✅ COMPLETED

#### 1. Import JSON feature (file-based, no DB)
- Added `loadProjectJson(json)` to `ComicGenerationContext` — auto-detects two formats:
  - **Legacy format** (`step_1_analysis` snake_case keys) — from the old "Download JSON" export
  - **Full-save format** (`step1` camelCase keys) — from cloud save (see below)
- "Import JSON" button added to **Step 0 Setup** (file picker, `.json` only)
- "My Projects" button added to Step 0 — opens `ProjectsDrawer` to load from cloud
- On import, all steps are restored and the app navigates to Step 4

#### 2. Remote project save/load to MongoDB
- **Backend** — new `projects` collection + router at `backend/app/routers/projects.py`:
  - `POST /api/projects/save` — upsert by `(user_id, project_id)` using `X-User-Id` header
  - `GET /api/projects/` — list metadata (project_id, saved_at, genre, step completion flags)
  - `GET /api/projects/{project_id}` — load full project JSON
  - `DELETE /api/projects/{project_id}` — remove project
  - Registered in `backend/app/main.py`
- **What gets saved**: user inputs + image gen settings + steps 1–3 full data + step 2 image review (selected candidate image only per character, not all candidates) + step 4 panel list (no generated page images — too large)
- **Context additions** (`ComicGenerationContext.tsx`):
  - `buildFullSave()` — assembles the payload; strips unselected image candidates and page images
  - `restoreFromFullSave(json)` — full restore including character images back into candidate slots, all approval flags, image gen settings; unlocks all steps
  - `saveToCloud()` / `loadFromCloud(projectId)` / `listCloudProjects()` — API wrappers with `cloudSaveStatus` / `cloudSaveError` state
  - On-mount effect reads `localStorage['mohiom-pending-load']`; if set, calls `loadFromCloud()` and clears the key (used by dashboard to trigger project load in studio context)
- **UI**:
  - `ProjectsDrawer.tsx` — slide-in right panel; save current project, list all projects with step badges (S1/S2/Img/S3/S4), Load button per row
  - **Step 4 "Project export" card**: "Save to Cloud" + "My Projects" buttons added alongside existing Copy/Download JSON
  - **Step 0**: "My Projects" button only (save belongs at Step 4 after pipeline is complete)
- **Schemas added to `backend/app/schemas.py`**: `ProjectSaveRequest`, `ProjectListItem` (includes `genre` field)

#### 3. Dashboard — real data replacing hardcoded static arrays
- `frontend/src/app/studio/dashboard/page.tsx` converted to `'use client'` component
- Fetches `projectsApi.list()` for Recent Projects, `projectsApi.characters()` for Recent Characters
- **Recent Projects**: gradient cover cards (deterministic color per project_id hash), genre badge (first word/segment), step completion badges (S1/S2/Img/S3/S4), "last saved Xm/h/d ago" timestamp; clicking sets `localStorage['mohiom-pending-load']` + navigates to `/studio`
- **Recent Characters**: avatar with saved image, name, project source; clicking loads that project
- **"Resume Last Project"** hero button wires to the most recent saved project
- Loading skeletons for both sections; empty states with CTAs
- `timeAgo()` helper and deterministic `gradientFor(id)` from a 6-color palette

#### 4. Character Manager — full CRUD + merged with character-setup
- `frontend/src/app/studio/character-manager/page.tsx` fully rewritten as `'use client'`
- **Layout**: left 2/3 = character list cards; right 1/3 = sticky dynamic panel
- **Character cards**: avatar, name, seed (hash of character_id), prompt excerpt (2-line clamp), project label, lock-face toggle (local state), selected highlight border
- **Right panel modes**:
  - **Stats** (default): locked/slots progress bars, "By Project" breakdown with load buttons
  - **Detail** (character selected): editable name input, prompt textarea, Image API URL field (pre-filled from `sessionStorage['mohiom-image-api-url']`), Generate Image button (calls `/api/image-proxy`), live preview with checkmark badge, Save Changes (PATCH), Delete with two-click confirm
- **Tabs**: Active / Archived (archived shows empty state — no archived concept yet)
- **Search**: filters by name or project_id
- **FAB** + "Add Character" slot → open `CreateCharacterModal`
- **Backend routes added** to `backend/app/routers/projects.py`:
  - `POST /api/projects/{project_id}/characters` — append new character; 409 if ID already exists
  - `PATCH /api/projects/{project_id}/characters/{character_id}` — update name/prompt/selectedImageUrl in-place (fetch → modify Python list → $set)
  - `DELETE /api/projects/{project_id}/characters/{character_id}` — remove from array
- **Schemas added**: `CharacterUpsertPayload`, `CharacterPatchPayload`
- `CharacterSummary` schema now includes `prompt` field
- **`api.ts` additions**: `CharacterCreatePayload`, `CharacterPatchPayload` types; `projectsApi.createCharacter()`, `projectsApi.updateCharacter()`, `projectsApi.deleteCharacter()`

#### 5. CreateCharacterModal — 3-method reusable creation modal
- New file: `frontend/src/components/CreateCharacterModal.tsx`
- **Props**: `isOpen`, `onClose`, `onCreated(char)`, `projects[]`, `defaultProjectId?`
- **Layout**: large centered modal (max-w-4xl), two columns — left (config) + right (preview + project selector + actions)
- **Method 1 — Start from Image**: drag-and-drop / file picker zone; uploaded image immediately becomes the character; no generation needed
- **Method 2 — Describe your Character**: description textarea + 14 style chips: Photorealistic, Digital Art, Anime, 3D Render, Pixar, Fantasy Art, RPG, Comic Book, Clay, Vector Art, Minimalist, Watercolor, Oil Painting, GTA Style
- **Method 3 — Build your Character**: 5 chip selectors — Look Vibe (10 options), Gender (4), Ethnicity (8), Age Range (6), Build (6) — plus optional free-text Additional Description; auto-assembles a descriptive prompt from all selections
- Shared: Image API URL field (pre-filled from `sessionStorage`), Generate Image → `/api/image-proxy`, live preview, project selector dropdown, Save Character via `projectsApi.createCharacter()`
- Resets all state on close; Escape + backdrop-click to close
- **Used in**: Character Manager page (replaces the old inline `CreatePanel`)

#### 6. Select character into project (CharacterLibraryModal)
- New file: `frontend/src/components/CharacterLibraryModal.tsx`
- **Props**: `isOpen`, `onClose`, `existingIds: Set<string>`, `onConfirm(chars[])`
- Fetches `projectsApi.characters()` fresh on each open
- 4-column image grid with search (name or project_id)
- Characters already in the project shown greyed-out with "Added" badge (not selectable)
- New selections show filled checkmark overlay; footer shows live count "Add N to Project"
- **`injectLibraryCharacters(chars: CharacterSummary[])` added to `ComicGenerationContext`**:
  - Deduplicates against existing `step2ImageReview.data.characters` by `characterId`
  - Converts each `CharacterSummary` → `CharacterImageItem` with the saved image as a pre-selected candidate (`status: 'success'`)
  - Sets `step2ImageReview.locked = false` so review section activates even if Step 2 hasn't run — allows bypassing AI generation entirely
- **"From Library" button** added to Step 2 Reference Image Review section in `Step2Characters.tsx`
- Info notice shown when library characters are present but Step 2 hasn't been generated

#### 7. CLAUDE.md improvements (via /init)
- Added missing env vars: OAuth (Google/GitHub), SMTP (for password reset), Auth URLs, rate limiter overrides
- Noted Docker MongoDB URI difference vs local dev
- Added "No Python formatter/linter" gotcha
- Added "No Prettier on frontend — ESLint only"
- Corrected Testing section: 3 actual test files documented with paths
- `api/items/*` route added to API Structure
- Prepended session continuity instruction at top of CLAUDE.md

---

### 🔧 IN PROGRESS / NEEDS CONTINUATION

- **Character archive/delete at project level**: The "Archived" tab in Character Manager shows an empty state placeholder. No archive concept exists yet.
- **`character-setup/page.tsx`** still exists as a static hardcoded page — it was not deleted or redirected. It is now superseded by the Detail panel inside character-manager. Should be removed or redirected.
- **CreateCharacterModal in pipeline**: The modal was implemented and works in the Character Manager, but was not wired into the pipeline itself (e.g., a "Create New Character" button inside Step 2). Only "From Library" exists in Step 2.
- **No MongoDB index** on `projects` collection `(user_id, project_id)` — index is never explicitly created. PyMongo upsert works without it but will be slow at scale.

---

### 🐛 ISSUES & DECISIONS

- **Document size limit for page images**: MongoDB has a 16 MB document limit. Character images (~300–500 KB base64 each) fit. Panel/page images (~500 KB–1 MB each × 20 pages) would exceed it. Decision: **page images are never saved to DB** — users regenerate them after loading a project. Only the selected character candidate image per character is saved.
- **`/api/projects/characters` route ordering**: FastAPI matches literal paths before parameterized ones at the same level. `GET /projects/characters` must be defined **before** `GET /projects/{project_id}` in the router or it gets swallowed. This is correctly ordered in the current code.
- **`loadProjectJson` format detection**: Two exported JSON formats exist. Detection logic: if `json.steps.step1` (camelCase) exists → full-save format; if `json.steps.step_1_analysis` (snake_case) → legacy export format.
- **"Save to Cloud" placement**: Initially placed on Step 0, but moved to Step 4 because step 3 must be complete before there's anything meaningful to save, and the user is on Step 4 by that point.
- **`injectLibraryCharacters` bypasses lock**: Intentional. The point of the library feature is to let users skip the AI generation step (Step 2) and use pre-made characters. Setting `locked: false` on `step2ImageReview` enables this.
- **Image API URL storage**: The local image API URL is stored in `sessionStorage['mohiom-image-api-url']` (set by the studio context). The Character Manager and CreateCharacterModal read directly from sessionStorage to pre-fill the field, since they run outside the ComicGenerationContext.
- **User identity**: All project/character endpoints use `X-User-Id` header (auto-injected by `apiClient` interceptor from `localStorage['mohiom-user-id']`). No JWT auth required for these endpoints — same pattern as existing routes.

---

### 📂 KEY FILES CHANGED

**Backend**
- `backend/app/schemas.py` — Added: `ProjectSaveRequest`, `ProjectListItem` (+ `genre`), `CharacterSummary` (+ `prompt`), `CharacterUpsertPayload`, `CharacterPatchPayload`
- `backend/app/routers/projects.py` — **New file**: 8 endpoints — save, list, load, delete project; list characters; create/patch/delete character within project
- `backend/app/main.py` — Registered `projects.router`

**Frontend — Context**
- `frontend/src/context/ComicGenerationContext.tsx` — Added: `buildFullSave()`, `restoreFromFullSave()`, modified `loadProjectJson()` (format detection), `saveToCloud()`, `loadFromCloud()`, `listCloudProjects()`, `injectLibraryCharacters()`, `cloudSaveStatus`/`cloudSaveError` state, pending-load mount effect, `CharacterSummary` type import

**Frontend — Services**
- `frontend/src/services/api.ts` — Added: `FullProjectSave`, `CloudProjectListItem` (+ `genre`), `CharacterSummary` (+ `prompt`), `CharacterCreatePayload`, `CharacterPatchPayload`, `projectsApi` object (save/list/load/delete/characters/createCharacter/updateCharacter/deleteCharacter)

**Frontend — New components**
- `frontend/src/components/ProjectsDrawer.tsx` — Slide-in drawer: save current project + list/load/delete saved projects with step badges
- `frontend/src/components/CreateCharacterModal.tsx` — 3-method character creation modal (image upload / describe+style / structured builder)
- `frontend/src/components/CharacterLibraryModal.tsx` — Multi-select character picker from saved library; shows "Already Added" state for existing project characters

**Frontend — Modified components**
- `frontend/src/components/story-setup/Step1.tsx` — Added: "Import JSON" file picker button, "My Projects" button (opens ProjectsDrawer), `loadProjectJson` + `listCloudProjects` wired from context
- `frontend/src/components/studio-steps/Step2Characters.tsx` — Added: "From Library" button, `CharacterLibraryModal` wired with `injectLibraryCharacters`, info notice for library-sourced characters
- `frontend/src/components/studio-steps/Step4Generation.tsx` — Added: "Save to Cloud" button, "My Projects" button, `ProjectsDrawer`, `saveToCloud`/`cloudSaveStatus`/`cloudSaveError` from context

**Frontend — Pages**
- `frontend/src/app/studio/dashboard/page.tsx` — Full rewrite: `'use client'`, real API data for recent projects (gradient cards + step badges) and recent characters (real avatars), load-project navigation via `mohiom-pending-load`
- `frontend/src/app/studio/character-manager/page.tsx` — Full rewrite: `'use client'`, CRUD character list + detail panel + stats panel; uses `CreateCharacterModal`; removed old `CreatePanel` and `generateImage` helper

**Docs**
- `CLAUDE.md` — Added missing env vars (OAuth, SMTP, Auth URLs, rate limiter overrides), Docker MongoDB URI note, no-Python-linter gotcha, no-Prettier note, corrected test file paths, session continuity instruction prepended

---

### 🎯 NEXT STEPS (highest priority)

1. **Delete or redirect `studio/character-setup/page.tsx`** — it's now superseded by the character-manager detail panel; keeping it causes confusion
2. **MongoDB index for projects collection** — add compound unique index `{user_id: 1, project_id: 1}` at app startup in `lifespan.py` to avoid slow scans as project count grows
3. **Wire CreateCharacterModal into Step 2 pipeline** — add a "Create Character" button alongside "From Library" in Step 2 so users can create a new character without leaving the studio
4. **Character archive feature** — the "Archived" tab in character-manager shows a placeholder; implement archiving (soft-delete flag on character document or separate archived array)
5. **Test the full save/load round-trip** — specifically verify that character images (base64 data URLs) survive the MongoDB round-trip and render correctly after load; base64 strings in MongoDB can be slow to query if large
6. **"Resume Last Project" button on dashboard** — currently works if at least one saved project exists; add a loading spinner on the hero button while the project is being fetched

---

### 💡 CONTEXT TO REMEMBER

- **Characters live inside project documents**, not in a separate collection. `steps.step2ImageReview.data.characters[]` in the `projects` MongoDB collection. The `/api/projects/characters` endpoint aggregates across all projects per user. This is a trade-off (simpler data model, but character queries require scanning all projects).
- **`X-User-Id` header** is the only identity mechanism for project/character endpoints — no JWT required. Value comes from `localStorage['mohiom-user-id']` (auto-created UUID on first visit), injected by the Axios interceptor in `api.ts`.
- **Image API URL** is stored in `sessionStorage['mohiom-image-api-url']` by the studio context. Components outside the context (Character Manager, CreateCharacterModal) read it directly from sessionStorage.
- **`mohiom-pending-load` localStorage key** is the handshake between the dashboard/character-manager and the studio context. Set it to a `project_id`, navigate to `/studio`, and the context's mount effect will auto-load that project and clear the key.
- **Two JSON export formats coexist**: the old `projectSnapshot` export (snake_case step keys, no character images) and the new full-save format (camelCase step keys, includes character images). `loadProjectJson()` detects format and routes accordingly.
- **Step 4 page images are never persisted** (too large for MongoDB 16 MB doc limit). Users always regenerate them after loading a project. Character images are saved (selected candidate only, ~300–500 KB base64 per character).
- **The `step2ImageReview.locked` flag gates the image review section** in Step 2. `injectLibraryCharacters()` forcibly sets it to `false` so library characters bypass the Step 2 generation requirement — this is intentional behavior.
- **Material Symbols** icons are used throughout the studio UI (not lucide-react). CLAUDE.md says lucide-react only for the pipeline UI, but dashboard/character-manager use Material Symbols. Don't mix within the same component.
- **`ComicGenerationContext.tsx` is ~2400 lines and load-bearing** — be very careful with edits; TypeScript strict mode will catch type errors but runtime bugs in state management can corrupt the pipeline.
- **No test suite** — always run `npx tsc --noEmit` after frontend changes and `python3 -c "import ast; ast.parse(...)"` for backend syntax checks.
