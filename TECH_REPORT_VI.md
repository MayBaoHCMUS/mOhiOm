# Báo cáo kỹ thuật mOhiOm

## 1) TECH STACK OVERVIEW

### Ngôn ngữ lập trình
- **Python**: backend FastAPI, pipeline xử lý, MongoDB, compose/split ảnh.
- **TypeScript / TSX**: frontend Next.js App Router.
- **JavaScript**: một số file cấu hình và route runtime.
- **CSS / Tailwind**: giao diện frontend.
- **JSON**: payload API, lưu project, import/export.

### Frameworks & thư viện
**Backend**
- FastAPI
- Uvicorn
- Pydantic v2, pydantic-settings
- PyMongo
- httpx
- google-genai, google-api-core
- python-jose
- bcrypt
- Pillow
- python-multipart

**Frontend**
- Next.js 14
- React 18
- Axios
- Tailwind CSS
- framer-motion
- lucide-react
- react-markdown, remark-gfm, rehype-raw
- jszip, jspdf

### AI/ML models & APIs tích hợp
- **Gemini** qua `google-genai`
  - Default backend model: `gemini-2.5-flash`
  - Pipeline legacy: `gemini-3-flash-preview`
- **9Router** làm provider thay thế khi cấu hình `NINE_ROUTER_URL`
  - Default model: `kr/claude-sonnet-4.5`
- **Image generation server ngoài** qua `/api/image-proxy`
  - Code cho thấy dùng `scene_prompt`, `reference_image_b64`, `control_image_b64`, `ip_adapter_scale`, `controlnet_scale`
  - `SESSION_LOG.md` mô tả server kiểu **SD 1.5 + IP-Adapter Plus v2**
- **Pollinations**: dùng để tạo URL ảnh nhẹ trong backend

### Database
- **MongoDB 7.0** qua PyMongo

### Công cụ / dịch vụ khác
- Docker Compose
- SSE / StreamingResponse
- OAuth Google/GitHub
- JWT
- SMTP cho reset password
- localStorage/sessionStorage để truyền trạng thái giữa các màn hình

---

## 2) PROJECT STRUCTURE

### Top-level folders
- `backend/` — FastAPI backend, AI services, MongoDB, auth, ratings, gallery, analytics, legacy pipeline.
- `frontend/` — Next.js 14 UI, studio wizard, gallery, admin dashboard, proxy routes.
- `database/` — tài nguyên và script cho MongoDB.
- `Reference/` — bộ reference/demo cho các tính năng.
- `.claude/`, `.continue/`, `.idea/`, `.github/` — tooling, IDE, metadata.
- Các file `.md` ở root — tài liệu kiến trúc, setup, log phiên, checklist.

### Entry points chính
**Backend**
- `backend/app/main.py`
- `backend/app/routers/gemini.py`
- `backend/app/routers/text_to_comic.py`
- `backend/text_to_comic_pipeline.py`

**Frontend**
- `frontend/src/app/page.tsx`
- `frontend/src/app/studio/page.tsx`
- `frontend/src/components/TextToComicGenerator.tsx`
- `frontend/src/app/studio/story-setup/page.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/gallery/page.tsx`

---

## 3) SYSTEM PIPELINE / WORKFLOW

### Luồng end-to-end TEXT → COMIC
1. **Story Setup**
   - Người dùng nhập story text, genre/tone, creative direction, target pages/chapters, art style, image API URL.
   - File chính: `frontend/src/app/studio/story-setup/page.tsx`

2. **Step 1 — Story Analysis**
   - Sinh phân tích story, chia chương, cảnh, nhân vật, thống kê.
   - Backend: `POST /api/gemini/analyze-story-structured`
   - Service: `GeminiService.generate_plot_analysis()`

3. **Step 2 — Character Designs**
   - Sinh character sheets, prompt ảnh cho từng nhân vật.
   - Backend: `POST /api/gemini/character-designs-structured`
   - Service: `GeminiService.generate_step2_stream()`

4. **Step 3 — Panel Script**
   - Sinh script theo chapter/page/panel, shot type, dialogue, image prompt.
   - Backend: `POST /api/gemini/panel-script-structured`
   - Service: `GeminiService.generate_step3_stream()`

5. **Step 4 — Image Generation + Composition + Export**
   - Gọi image generation server ngoài qua `/api/image-proxy`.
   - Compose panel thành page bằng Pillow.
   - Export ZIP/PDF/JSON hoặc lưu cloud.

### Component xử lý từng bước
- `ComicGenerationContext.tsx`: state machine và orchestration toàn pipeline
- `Step0Setup`, `Step1Analysis`, `Step2Characters`, `Step3Script`, `Step4Generation`: UI cho từng bước
- `backend/app/services.py`: prompt, streaming, parsing, fallback JSON
- `backend/app/comic_composer.py`: dàn trang comic
- `backend/app/panel_splitter.py`: tách page thành panel
- `backend/app/routers/projects.py`: save/load project
- `backend/app/routers/gallery.py`: public gallery
- `backend/app/routers/admin_analytics.py`: dashboard analytics

### Pipeline batch/legacy
- `POST /api/comics/generate` chạy pipeline 4 bước trong background bằng `TextToComicPipeline`
- Lưu file kết quả:
  - `step1_result.json`
  - `step2_result.json`
  - `step3_result.json`
  - `step4_result.json`
  - `Final_Manga_Script.md`

---

## 4) KEY MODULES / COMPONENTS

| Module / File | Vai trò |
|---|---|
| `backend/app/main.py` | Khởi tạo FastAPI app, CORS, lifespan MongoDB, đăng ký routers |
| `backend/app/services.py` | Gemini/9Router text generation, streaming, prompt engineering, fallback JSON, image URL helper |
| `backend/app/routers/gemini.py` | API text analysis, script generation, image/layout endpoints |
| `backend/app/routers/text_to_comic.py` | API batch pipeline `/api/comics/*` |
| `backend/text_to_comic_pipeline.py` | Orchestrator pipeline legacy/CLI |
| `backend/app/comic_composer.py` | Ghép panel images thành comic page bằng Pillow |
| `backend/app/panel_splitter.py` | Detect gutter, split page thành panel |
| `backend/app/database.py` | Kết nối MongoDB |
| `backend/app/crud.py` | CRUD repository cho users/items/oauth |
| `backend/app/security.py` | bcrypt + JWT + OAuth state + reset token hash |
| `backend/app/rate_limit.py` | Rate limit per-user cho Gemini endpoints |
| `backend/app/emailer.py` | Gửi email reset password |
| `frontend/src/context/ComicGenerationContext.tsx` | Orchestration toàn bộ wizard/studio |
| `frontend/src/components/TextToComicGenerator.tsx` | Root shell của wizard 5 bước |
| `frontend/src/app/studio/story-setup/page.tsx` | Nhập story và cấu hình đầu vào |
| `frontend/src/components/studio-steps/Step1Analysis.tsx` | UI phân tích story |
| `frontend/src/components/studio-steps/Step2Characters.tsx` | UI character design và reference |
| `frontend/src/components/studio-steps/Step3Script.tsx` | UI panel script |
| `frontend/src/components/studio-steps/Step4Generation.tsx` | Sinh ảnh, compose, preview, export |
| `frontend/src/app/api/image-proxy/route.ts` | Proxy tới image generation server ngoài |
| `frontend/src/app/api/image-proxy/characters/route.ts` | Lưu character reference lên image server |
| `frontend/src/app/admin/page.tsx` | Dashboard analytics admin |
| `frontend/src/app/gallery/page.tsx` | Community gallery comics/characters |

---

## 5) AI MODELS & INTEGRATION DETAIL

### Mô hình dùng trong hệ thống
- **Gemini**: mô hình chính cho text generation/analysis.
- **9Router**: provider thay thế Gemini khi được cấu hình.
- **Image generation server ngoài**: nhận prompt + reference image + control image để tạo ảnh.

### Cách gọi
- **Gemini**: dùng client SDK `google-genai` trực tiếp từ backend.
- **9Router**: gọi HTTP async qua `httpx` với endpoint `/chat/completions`.
- **Streaming**: dùng SSE / `StreamingResponse`.
- **Image generation**: frontend gọi `POST /api/image-proxy`, sau đó proxy sang server ảnh thực tế.

### Fine-tuning / custom training
- Không thấy pipeline fine-tuning/training trong repo.
- Hệ thống chủ yếu dựa trên:
  - prompt engineering
  - structured JSON
  - reference image / control image
  - external image API

---

## 6) INPUT & OUTPUT

### Input formats
- Plain text story
- Structured JSON từ các step trước
- File JSON import
- Base64 data URL cho ảnh
- Form data/UI state
- localStorage/sessionStorage handoff data

### Output formats
- Streaming markdown qua SSE
- Structured JSON snapshot
- Image base64 / data URL
- Composed comic page PNG base64
- PDF comic export
- ZIP image pack export
- JSON export / cloud save
- Web UI render

### Legacy pipeline output
- `pipeline_output/<job_id>/step1_result.json`
- `step2_result.json`
- `step3_result.json`
- `step4_result.json`
- `Final_Manga_Script.md`

---

## 7) DEPENDENCIES

### `frontend/package.json`
```json
{
  "name": "mohiom-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "framer-motion": "^11.0.0",
    "jspdf": "^4.2.1",
    "jszip": "^3.10.1",
    "lucide-react": "^0.445.0",
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^9.0.1",
    "rehype-raw": "^7.0.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "postcss": "^8.4.24",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0"
  }
}
```

### `backend/requirements.txt`
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.0
pydantic-settings==2.1.0
pymongo==4.6.0
python-dotenv==1.0.0
python-multipart==0.0.6
httpx==0.25.0
google-genai>=1.0.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
google-api-core==2.17.1
Pillow>=10.0.0
```

---

## 8) NOTABLE CHALLENGES OR LIMITATIONS

- `ComicGenerationContext.tsx` rất lớn và load-bearing; dễ gây regression nếu sửa state/pipeline.
- Rate limiting Gemini mặc định khá chặt: 2 req/s, queue 8, timeout 8s.
- Page images không được lưu vào MongoDB vì giới hạn kích thước document; phải regenerate sau khi load project.
- Một số chỗ còn TODO / placeholder:
  - gallery pagination backend
  - gallery auth gate cho “Add to My Library”
  - index MongoDB cho `projects`
  - `Archived` tab trong Character Manager
  - `studio/character-setup/page.tsx` còn tồn tại dù bị supersede
- `passlib[bcrypt]` vẫn nằm trong requirements nhưng `security.py` đã chuyển sang bcrypt trực tiếp.
- `backend/text_to_comic_pipeline.py` dùng model mặc định khác với backend config, dễ gây nhầm lẫn.

---

## Ghi chú ngắn
- Hệ thống hiện là **web app sinh comic end-to-end** với pipeline 5 bước ở frontend/studio, backend FastAPI làm AI orchestration, MongoDB làm persistence, và một image generation server ngoài làm phần ảnh.
# Báo cáo kỹ thuật mOhiOm

## 1) TECH STACK OVERVIEW

### Ngôn ngữ lập trình
- **Python**: backend FastAPI, pipeline xử lý, MongoDB, compose/split ảnh.
- **TypeScript / TSX**: frontend Next.js App Router.
- **JavaScript**: một số file cấu hình và route runtime.
- **CSS / Tailwind**: giao diện frontend.
- **JSON**: payload API, lưu project, import/export.

### Frameworks & thư viện
**Backend**
- FastAPI
- Uvicorn
- Pydantic v2, pydantic-settings
- PyMongo
- httpx
- google-genai, google-api-core
- python-jose
- bcrypt
- Pillow
- python-multipart

**Frontend**
- Next.js 14
- React 18
- Axios
- Tailwind CSS
- framer-motion
- lucide-react
- react-markdown, remark-gfm, rehype-raw
- jszip, jspdf

### AI/ML models & APIs tích hợp
- **Gemini** qua `google-genai`
  - Default backend model: `gemini-2.5-flash`
  - Pipeline legacy: `gemini-3-flash-preview`
- **9Router** làm provider thay thế khi cấu hình `NINE_ROUTER_URL`
  - Default model: `kr/claude-sonnet-4.5`
- **Image generation server ngoài** qua `/api/image-proxy`
  - Code cho thấy dùng `scene_prompt`, `reference_image_b64`, `control_image_b64`, `ip_adapter_scale`, `controlnet_scale`
  - `SESSION_LOG.md` mô tả server kiểu **SD 1.5 + IP-Adapter Plus v2**
- **Pollinations**: dùng để tạo URL ảnh nhẹ trong backend

### Database
- **MongoDB 7.0** qua PyMongo

### Công cụ / dịch vụ khác
- Docker Compose
- SSE / StreamingResponse
- OAuth Google/GitHub
- JWT
- SMTP cho reset password
- localStorage/sessionStorage để truyền trạng thái giữa các màn hình

---

## 2) PROJECT STRUCTURE

### Top-level folders
- `backend/` — FastAPI backend, AI services, MongoDB, auth, ratings, gallery, analytics, legacy pipeline.
- `frontend/` — Next.js 14 UI, studio wizard, gallery, admin dashboard, proxy routes.
- `database/` — tài nguyên và script cho MongoDB.
- `Reference/` — bộ reference/demo cho các tính năng.
- `.claude/`, `.continue/`, `.idea/`, `.github/` — tooling, IDE, metadata.
- Các file `.md` ở root — tài liệu kiến trúc, setup, log phiên, checklist.

### Entry points chính
**Backend**
- `backend/app/main.py`
- `backend/app/routers/gemini.py`
- `backend/app/routers/text_to_comic.py`
- `backend/text_to_comic_pipeline.py`

**Frontend**
- `frontend/src/app/page.tsx`
- `frontend/src/app/studio/page.tsx`
- `frontend/src/components/TextToComicGenerator.tsx`
- `frontend/src/app/studio/story-setup/page.tsx`
- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/gallery/page.tsx`

---

## 3) SYSTEM PIPELINE / WORKFLOW

### Luồng end-to-end TEXT → COMIC
1. **Story Setup**
   - Người dùng nhập story text, genre/tone, creative direction, target pages/chapters, art style, image API URL.
   - File chính: `frontend/src/app/studio/story-setup/page.tsx`

2. **Step 1 — Story Analysis**
   - Sinh phân tích story, chia chương, cảnh, nhân vật, thống kê.
   - Backend: `POST /api/gemini/analyze-story-structured`
   - Service: `GeminiService.generate_plot_analysis()`

3. **Step 2 — Character Designs**
   - Sinh character sheets, prompt ảnh cho từng nhân vật.
   - Backend: `POST /api/gemini/character-designs-structured`
   - Service: `GeminiService.generate_step2_stream()`

4. **Step 3 — Panel Script**
   - Sinh script theo chapter/page/panel, shot type, dialogue, image prompt.
   - Backend: `POST /api/gemini/panel-script-structured`
   - Service: `GeminiService.generate_step3_stream()`

5. **Step 4 — Image Generation + Composition + Export**
   - Gọi image generation server ngoài qua `/api/image-proxy`.
   - Compose panel thành page bằng Pillow.
   - Export ZIP/PDF/JSON hoặc lưu cloud.

### Component xử lý từng bước
- `ComicGenerationContext.tsx`: state machine và orchestration toàn pipeline
- `Step0Setup`, `Step1Analysis`, `Step2Characters`, `Step3Script`, `Step4Generation`: UI cho từng bước
- `backend/app/services.py`: prompt, streaming, parsing, fallback JSON
- `backend/app/comic_composer.py`: dàn trang comic
- `backend/app/panel_splitter.py`: tách page thành panel
- `backend/app/routers/projects.py`: save/load project
- `backend/app/routers/gallery.py`: public gallery
- `backend/app/routers/admin_analytics.py`: dashboard analytics

### Pipeline batch/legacy
- `POST /api/comics/generate` chạy pipeline 4 bước trong background bằng `TextToComicPipeline`
- Lưu file kết quả:
  - `step1_result.json`
  - `step2_result.json`
  - `step3_result.json`
  - `step4_result.json`
  - `Final_Manga_Script.md`

---

## 4) KEY MODULES / COMPONENTS

| Module / File | Vai trò |
|---|---|
| `backend/app/main.py` | Khởi tạo FastAPI app, CORS, lifespan MongoDB, đăng ký routers |
| `backend/app/services.py` | Gemini/9Router text generation, streaming, prompt engineering, fallback JSON, image URL helper |
| `backend/app/routers/gemini.py` | API text analysis, script generation, image/layout endpoints |
| `backend/app/routers/text_to_comic.py` | API batch pipeline `/api/comics/*` |
| `backend/text_to_comic_pipeline.py` | Orchestrator pipeline legacy/CLI |
| `backend/app/comic_composer.py` | Ghép panel images thành comic page bằng Pillow |
| `backend/app/panel_splitter.py` | Detect gutter, split page thành panel |
| `backend/app/database.py` | Kết nối MongoDB |
| `backend/app/crud.py` | CRUD repository cho users/items/oauth |
| `backend/app/security.py` | bcrypt + JWT + OAuth state + reset token hash |
| `backend/app/rate_limit.py` | Rate limit per-user cho Gemini endpoints |
| `backend/app/emailer.py` | Gửi email reset password |
| `frontend/src/context/ComicGenerationContext.tsx` | Orchestration toàn bộ wizard/studio |
| `frontend/src/components/TextToComicGenerator.tsx` | Root shell của wizard 5 bước |
| `frontend/src/app/studio/story-setup/page.tsx` | Nhập story và cấu hình đầu vào |
| `frontend/src/components/studio-steps/Step1Analysis.tsx` | UI phân tích story |
| `frontend/src/components/studio-steps/Step2Characters.tsx` | UI character design và reference |
| `frontend/src/components/studio-steps/Step3Script.tsx` | UI panel script |
| `frontend/src/components/studio-steps/Step4Generation.tsx` | Sinh ảnh, compose, preview, export |
| `frontend/src/app/api/image-proxy/route.ts` | Proxy tới image generation server ngoài |
| `frontend/src/app/api/image-proxy/characters/route.ts` | Lưu character reference lên image server |
| `frontend/src/app/admin/page.tsx` | Dashboard analytics admin |
| `frontend/src/app/gallery/page.tsx` | Community gallery comics/characters |

---

## 5) AI MODELS & INTEGRATION DETAIL

### Mô hình dùng trong hệ thống
- **Gemini**: mô hình chính cho text generation/analysis.
- **9Router**: provider thay thế Gemini khi được cấu hình.
- **Image generation server ngoài**: nhận prompt + reference image + control image để tạo ảnh.

### Cách gọi
- **Gemini**: dùng client SDK `google-genai` trực tiếp từ backend.
- **9Router**: gọi HTTP async qua `httpx` với endpoint `/chat/completions`.
- **Streaming**: dùng SSE / `StreamingResponse`.
- **Image generation**: frontend gọi `POST /api/image-proxy`, sau đó proxy sang server ảnh thực tế.

### Fine-tuning / custom training
- Không thấy pipeline fine-tuning/training trong repo.
- Hệ thống chủ yếu dựa trên:
  - prompt engineering
  - structured JSON
  - reference image / control image
  - external image API

---

## 6) INPUT & OUTPUT

### Input formats
- Plain text story
- Structured JSON từ các step trước
- File JSON import
- Base64 data URL cho ảnh
- Form data/UI state
- localStorage/sessionStorage handoff data

### Output formats
- Streaming markdown qua SSE
- Structured JSON snapshot
- Image base64 / data URL
- Composed comic page PNG base64
- PDF comic export
- ZIP image pack export
- JSON export / cloud save
- Web UI render

### Legacy pipeline output
- `pipeline_output/<job_id>/step1_result.json`
- `step2_result.json`
- `step3_result.json`
- `step4_result.json`
- `Final_Manga_Script.md`

---

## 7) DEPENDENCIES

### `frontend/package.json`
```json
{
  "name": "mohiom-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "framer-motion": "^11.0.0",
    "jspdf": "^4.2.1",
    "jszip": "^3.10.1",
    "lucide-react": "^0.445.0",
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-markdown": "^9.0.1",
    "rehype-raw": "^7.0.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.0.0",
    "eslint-config-next": "^14.0.0",
    "postcss": "^8.4.24",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.0.0"
  }
}
```

### `backend/requirements.txt`
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.0
pydantic-settings==2.1.0
pymongo==4.6.0
python-dotenv==1.0.0
python-multipart==0.0.6
httpx==0.25.0
google-genai>=1.0.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
google-api-core==2.17.1
Pillow>=10.0.0
```

---

## 8) NOTABLE CHALLENGES OR LIMITATIONS

- `ComicGenerationContext.tsx` rất lớn và load-bearing; dễ gây regression nếu sửa state/pipeline.
- Rate limiting Gemini mặc định khá chặt: 2 req/s, queue 8, timeout 8s.
- Page images không được lưu vào MongoDB vì giới hạn kích thước document; phải regenerate sau khi load project.
- Một số chỗ còn TODO / placeholder:
  - gallery pagination backend
  - gallery auth gate cho “Add to My Library”
  - index MongoDB cho `projects`
  - `Archived` tab trong Character Manager
  - `studio/character-setup/page.tsx` còn tồn tại dù bị supersede
- `passlib[bcrypt]` vẫn nằm trong requirements nhưng `security.py` đã chuyển sang bcrypt trực tiếp.
- `backend/text_to_comic_pipeline.py` dùng model mặc định khác với backend config, dễ gây nhầm lẫn.

---

## Ghi chú ngắn
- Hệ thống hiện là **web app sinh comic end-to-end** với pipeline 5 bước ở frontend/studio, backend FastAPI làm AI orchestration, MongoDB làm persistence, và một image generation server ngoài làm phần ảnh.


