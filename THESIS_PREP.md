# THESIS PREPARATION — mOhiOm: AI-Powered Comic Generation System
> **Tài liệu chuẩn bị luận văn kỹ thuật phần mềm**
> Cập nhật: 2026-07-01 | Tác giả: Thuong Nguyen

---

## CHƯƠNG 1: GIỚI THIỆU

### 1.1 Đặt vấn đề

Truyện tranh (manga/comic) là một hình thức nghệ thuật kể chuyện trực quan, yêu cầu người tạo ra
phải đồng thời làm chủ nhiều kỹ năng: viết kịch bản, thiết kế nhân vật, bố cục trang, vẽ hình ảnh
và biên tập hội thoại. Quá trình sản xuất thủ công một tập truyện tranh ngắn (~20 trang) của một
cá nhân thường kéo dài vài tuần đến vài tháng.

Sự phát triển của các mô hình ngôn ngữ lớn (LLM) như Google Gemini và các mô hình sinh ảnh
(Stable Diffusion, IP-Adapter) đặt ra câu hỏi: **liệu có thể tự động hoá toàn bộ pipeline sản xuất
truyện tranh từ văn bản đầu vào?** Đây là bài toán tích hợp phức tạp vì nó đòi hỏi:
- Hiểu ngữ cảnh câu chuyện dài (thousands of tokens)
- Duy trì nhất quán ngoại hình nhân vật xuyên suốt nhiều panel
- Bố cục trang theo quy tắc manga chuyên nghiệp
- Giao diện người dùng đủ trực quan để người không chuyên kỹ thuật sử dụng được

### 1.2 Lý do thực hiện đề tài

Các công cụ hiện có (ComicsMaker.ai, AI Comic Factory, Komiko.ai, Lore Machine) giải quyết được
một số công đoạn nhưng chưa có hệ thống nào tích hợp đầy đủ toàn bộ pipeline từ văn bản → phân
tích → nhân vật → kịch bản → hình ảnh → xuất bản trong một giao diện thống nhất, đặc biệt là
vấn đề nhất quán nhân vật (character consistency) vẫn còn hạn chế.

Đề tài này xây dựng hệ thống **mOhiOm** giải quyết toàn bộ pipeline đó với kiến trúc web hiện đại.

### 1.3 Mục tiêu đề tài

**Mục tiêu chính:**
1. Thiết kế và triển khai hệ thống web sinh truyện tranh tự động từ văn bản đầu vào
2. Tích hợp LLM (Google Gemini) cho các bước phân tích, thiết kế và viết kịch bản
3. Tích hợp mô hình sinh ảnh (Stable Diffusion + IP-Adapter) với duy trì nhất quán nhân vật
4. Xây dựng giao diện wizard 6 bước hướng dẫn người dùng qua toàn bộ quy trình
5. Cung cấp hệ thống bố cục trang manga tự động với 14+ mẫu layout đa dạng

**Mục tiêu phụ:**
- Xác thực người dùng qua email/password và OAuth (Google, GitHub)
- Lưu trữ và chia sẻ dự án truyện tranh (cộng đồng gallery)
- Thu thập dữ liệu đánh giá chất lượng phục vụ nghiên cứu

### 1.4 Phạm vi và giới hạn

**Trong phạm vi:**
- Pipeline 6 bước: Story Setup → Story Analysis → Character Design → Panel Script → Image Generation → Export
- Backend: FastAPI + Python 3.12, MongoDB 7.0
- Frontend: Next.js 14 (App Router), TypeScript strict mode, Tailwind CSS
- LLM: Google Gemini 2.5 Flash (có fallback sang 9Router/OpenAI-compatible)
- Image Gen: Stable Diffusion 1.5 + IP-Adapter Plus Face + ControlNet (server ngoài)
- Xuất: ZIP ảnh, PDF (pdf-lib), EPUB, JSON
- Analytics: client-side dashboard (Chart.js + localStorage)

**Ngoài phạm vi:**
- Training lại mô hình AI (sử dụng API sẵn có)
- Mobile app (web-only)
- Real-time collaboration nhiều người
- Tự host mô hình Stable Diffusion (cần GPU server riêng)

### 1.5 Đóng góp của nghiên cứu

1. **Pipeline tích hợp hoàn chỉnh** — hệ thống đầu tiên tích hợp LLM text generation + image generation + dialogue editor + layout engine trong một ứng dụng web duy nhất
2. **Hệ thống bố cục manga polygon** — 14+ layout template với tọa độ phần trăm độc lập resolution, hỗ trợ panel chéo (diagonal), panel splash, procedural layout generation
3. **Cơ chế nhất quán nhân vật** — đăng ký reference image lên SD server theo tên nhân vật, inject vào mỗi lần generate; per-character reference image từ đa nguồn (file upload / library / community gallery)
4. **Streaming UX** — SSE (Server-Sent Events) cho phép người dùng thấy kết quả LLM theo thời gian thực; không cần polling
5. **Dataset đánh giá** — hệ thống thu thập rating nhân vật, rating panel, analytics events phục vụ đánh giá chất lượng và research
6. **Hai chế độ sinh ảnh** — Full Mode (một ảnh composite/trang) và Panel Mode (một ảnh/panel), người dùng chọn khi bước vào Step 4
7. **Auto-retry cơ chế** — mỗi lần gọi image API tự động retry tối đa 3 lần (delay 3s) trước khi báo lỗi; giảm thiểu ảnh hưởng của API transient failures
8. **Client-side analytics** — dashboard thống kê phiên làm việc (panels sinh, export rate, style distribution) lưu trong localStorage; không cần backend tracking
9. **"Use as character image" pathway** — cho phép người dùng dùng ảnh thực tế (từ library/gallery) trực tiếp làm pipeline character image, bypass Stable Diffusion hoàn toàn
10. **Dialogue editor SVG native** — speech bubbles, shout bubbles, SFX text render bằng pure SVG (không dùng `foreignObject`/HTML overlay), đảm bảo export quality nhất quán

### 1.6 Cấu trúc luận văn

- **Chương 2**: Cơ sở lý thuyết — LLM, Text-to-Image, IP-Adapter, FastAPI, Next.js, MongoDB, SSE
- **Chương 3**: Phân tích yêu cầu — khảo sát ứng dụng liên quan, Use Case, yêu cầu chức năng/phi chức năng
- **Chương 4**: Thiết kế hệ thống — kiến trúc, Component/Class/Sequence/State diagram, thiết kế API, thiết kế DB
- **Chương 5**: Triển khai hệ thống — chi tiết kỹ thuật, vấn đề gặp phải và hướng giải quyết
- **Chương 6**: Kiểm thử và đánh giá — test case, đánh giá chất lượng, so sánh với công cụ khác
- **Chương 7**: Kết luận — tổng kết, hạn chế, hướng phát triển

---

## CHƯƠNG 2: CƠ SỞ LÝ THUYẾT

### 2.1 Mô hình ngôn ngữ lớn (LLM) và Prompt Engineering

#### LLM được sử dụng trong hệ thống

| Thuộc tính | Giá trị |
|---|---|
| Tên mô hình | Google Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Nhà cung cấp | Google DeepMind |
| Context window | ~1,000,000 tokens |
| Output | Streaming SSE + Non-streaming JSON |
| Fallback | 9Router / OpenAI-compatible API (khi `NINE_ROUTER_URL` được set) |
| Rate limit (mặc định) | 2 req/s per user, queue 8, timeout 8s |

#### Các kỹ thuật Prompt Engineering được sử dụng

**1. Structured Output với Separator**
LLM được yêu cầu sinh markdown hiển thị cho người dùng, sau đó `===JSON===`, sau đó JSON snapshot.
```
[Hệ thống phân tích manga ở trên...]
...markdown output...
===JSON===
{"project_id": "...", "steps": {...}}
```
Backend split tại `===JSON===` để tách phần display khỏi phần data.

**2. Role Persona Prompting**
Mỗi bước dùng một persona khác nhau:
- Bước 1: "You are a professional manga scriptwriter and story analyst"
- Bước 2: "You are a manga character designer with 20 years of experience"
- Bước 3: "You are a professional manga panel script writer"
- Bước adapt-story: "You are a creative Comic Scriptwriter"

**3. Chain-of-Thought (CoT) cho layout suggestion**
```python
prompt = (
    "You are a manga layout artist. Arrange N panels into the most dynamic page.\n"
    "Panels:\n{panel_desc}\n\n"
    "Available layouts:\n{options}\n\n"
    "Rules:\n"
    "- Splash/wide shots deserve full-width rows\n"
    "- Close-ups and inserts can share a row side-by-side\n"
    'Respond ONLY with valid JSON: {"template": "<name>", "rationale": "<reason>"}'
)
```

**4. Story Preprocessing**
`GeminiService._preprocess_story_text()` xử lý văn bản trước khi gửi LLM:
- Strip bylines ("A [X] story by Author")
- Strip copyright lines
- Strip lone proper-noun sequences
- Đảm bảo LLM không bị confused bởi metadata của truyện

### 2.2 Sinh hình ảnh từ văn bản (Text-to-Image Generation)

#### Stable Diffusion 1.5

Hệ thống tích hợp với SD server ngoài qua REST API. Prompt image được xây dựng từ:
- Panel shot type (ESTABLISHING, MEDIUM, CLOSE-UP, WIDE)
- Character visual tags (trích từ Step 2 design markdown)
- Art style reference (manga, webtoon, chibi, watercolor)
- Composition hints từ panel shape và aspect ratio

#### IP-Adapter Plus Face (v2)

**Vấn đề cần giải quyết:** Sinh ảnh nhiều panel mà nhân vật phải trông giống nhau.

**Giải pháp IP-Adapter:**
1. Sau khi người dùng approve reference image của nhân vật ở Bước 2, frontend gửi reference image lên SD server:
   ```
   POST {sd_server}/characters/save
   Body: { story_id, character_name, reference_image_b64 }
   ```
2. Khi generate panel image, gọi:
   ```
   POST {sd_server}/generate-page
   Body: { scene_prompt, story_id, character_name, style }
   ```
   SD server tự inject IP-Adapter conditioning từ saved reference image.
3. Nhân vật được identify bằng `character_name` (lowercase).

**Thông số image generation:**
- Kích thước: tính từ `sd_width` × `sd_height` của từng panel slot (multiples of 8)
- Kích thước trang: 1240 × 1754 px (tỷ lệ A4 = 1:√2)
- Image proxy: Next.js route `/api/image-proxy` (tránh CORS, ẩn SD server URL)

### 2.3 Kỹ thuật duy trì nhất quán nhân vật

#### Vấn đề character consistency trong Text-to-Image

Stable Diffusion cơ bản sinh ảnh nhân vật từ text prompt. Khi prompt mô tả cùng một nhân vật ở nhiều panel khác nhau, mô hình không đảm bảo ngoại hình nhất quán vì:
- SD không có "memory" về character từ panel này sang panel khác
- Những chi tiết nhỏ (màu mắt, kiểu tóc, trang phục) dễ thay đổi giữa các inference runs
- Seed khác nhau = variance khác nhau

#### IP-Adapter (Image Prompt Adapter)

IP-Adapter (Ye et al., 2023) giải quyết vấn đề này bằng cách inject visual conditioning từ reference image vào attention layers của UNet:

```
Reference Image
      ↓
  CLIP Image Encoder (ViT-H/14)
      ↓
  Image Features (1024-d)
      ↓
  Decoupled Cross-Attention Layers
      ↓
  Injects into UNet at attention stages (không thay thế text conditioning)
```

Kỹ thuật quan trọng:
- **Decoupled cross-attention**: thêm lớp cross-attention riêng cho image features, song song với text cross-attention. Không conflict với text prompt.
- **IP-Adapter Plus Face v2**: variant được fine-tune riêng cho face consistency, inject face region features với weight cao hơn torso/background
- **Scale parameter**: kiểm soát mức độ ảnh hưởng của reference image (0.0 = bỏ qua, 1.0 = follow chặt); default 0.7 trong hệ thống

**Character Registration Flow:**
```
Step 2 (User approves reference images)
    → frontend calls /api/image-proxy/characters (POST)
    → proxy calls SD server POST /characters/save
       Body: { story_id, character_name, reference_image_b64 }
    → SD server: CLIP encode face region → store embedding
       Key: (story_id, character_name.lower())

Step 4 (Generate panel)
    → frontend calls /api/image-proxy (POST)
       Body: { scene_prompt, story_id, character_name, style }
    → proxy → SD server POST /generate-page
    → SD server: load stored embedding → IP-Adapter conditioning
    → inference: UNet với dual attention (text + character face features)
    → returns consistent-looking character
```

**Lợi ích của character name registration:**
- Payload nhỏ hơn: gửi `character_name` string thay vì image base64 mỗi lần (~40KB tiết kiệm/request)
- Embedding reuse: encode một lần, dùng nhiều lần cho tất cả panels của character
- Multi-character scenes: có thể mix nhiều character embeddings trong một inference

**IP-Adapter Scale trade-off:**

| Scale | Character likeness | Scene diversity |
|---|---|---|
| 0.4 | Thấp (~40%) | Cao — prompt dominant |
| 0.6 | Trung bình (~65%) | Trung bình |
| **0.7** | **Tốt (~75%)** | **Cân bằng — default** |
| 0.9 | Rất cao (~90%) | Thấp — ảnh trở nên "dập khuôn" |

**ControlNet:** Thêm structural conditioning (pose, depth map, Canny edges) khi `controlImageBase64` được set. Cho phép control chính xác pose nhân vật trong scene.

#### Per-character reference image từ đa nguồn (tính năng mới — 2026-07-01)

Hệ thống mở rộng hỗ trợ 3 nguồn reference image per character:

1. **File upload**: người dùng upload ảnh PNG/JPG trực tiếp từ máy tính
2. **Character Library**: chọn từ characters đã được lưu trong `user_characters` collection (MongoDB)
3. **Community Gallery**: chọn từ gallery public của cộng đồng

Flow per-character (modal target state pattern):
```typescript
// null = closed; '__all__' = tab-level (all chars); charId = specific character
libraryTargetCharId: string | null
galleryTargetCharId: string | null
```

Một CharacterLibraryModal / GalleryModal duy nhất phục vụ cả tab-level lẫn per-character, giảm số lượng modal instances từ `2 * (N_chars + 1)` xuống còn 2.

**"Use as character image"**: Khi reference image đã được set, người dùng có thể click để dùng ảnh đó trực tiếp làm pipeline character image (thêm vào candidates array, select nó). Toàn bộ xử lý client-side, bypass Stable Diffusion hoàn toàn.

### 2.4 Kiến trúc hệ thống web hiện đại

#### FastAPI (Python)
- Version: 0.109.0
- ASGI framework với async/await support
- Pydantic v2 cho schema validation và serialization
- `lifespan` context manager cho MongoDB connect/disconnect
- `CORSMiddleware` cho cross-origin requests từ Next.js frontend
- Rate limiting: custom `PerUserRateLimiter` (không dùng thư viện ngoài)

#### Next.js 14 (App Router)
- React 18 với Server/Client Component separation
- App Router: `app/` directory, `layout.tsx`, `page.tsx`
- `'use client'` directive cho interactive components
- Axios interceptor tự inject `X-User-Id` header vào mọi request
- Path alias: `@/*` → `src/*`
- Build: TypeScript strict mode, ESLint (no Prettier)

#### MongoDB 7.0
- PyMongo 4.6 (synchronous driver) — **quan trọng: không dùng Motor (async)**
- Mọi DB call chạy trong FastAPI thread pool (synchronous within async def)
- Database: `mohiom_db`
- Collections: `users`, `projects`, `user_characters`, `panel_bubbles`,
  `panel_ratings`, `comic_ratings`, `character_ratings`, `analytics_events`, `password_reset_tokens`

### 2.5 Các khái niệm liên quan

#### Server-Sent Events (SSE)
SSE là cơ chế server → client streaming dùng HTTP long-lived connection:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"token","content":"Chapter 1: ..."}\n\n
data: {"type":"token","content":"The story..."}\n\n
data: {"type":"done","analysis":"...","structured_json":{...}}\n\n
```

Hệ thống dùng SSE cho 4 endpoints:
1. `POST /api/gemini/analyze-story-structured` — Step 1 stream
2. `POST /api/gemini/character-designs-structured` — Step 2 stream
3. `POST /api/gemini/panel-script-structured` — Step 3 stream
4. `POST /api/gemini/analyze-story-lightweight` — Story Setup preview

Frontend consume bằng `EventSource` API hoặc fetch với ReadableStream.

**SSE Event format:**
| Field | Giá trị |
|---|---|
| `type: "token"` | Streaming chunk hiển thị cho user |
| `type: "done"` | Kết quả cuối với full data |
| `type: "error"` | Lỗi kèm `status_code` và `message` |
| `type: "thinking"` | Reasoning tokens (adapt-story endpoint) |

#### REST API
- Tất cả routes có prefix `/api`
- Request ID injection qua `X-User-Id` header
- Error format: `{"detail": "message"}` hoặc `{"detail": {"message": "...", "retry_after_seconds": N}}`

#### Bất đồng bộ và Rate Limiting
```
PerUserRateLimiter:
  - requests_per_second: 2 (per user)
  - max_queue_size: 8 (toàn bộ server)
  - max_wait_seconds: 8.0
  
Khi queue full → 429 Too Many Requests
Khi timeout → 503 Service Unavailable
User key: "user:{X-User-Id}" hoặc "ip:{client_ip}"
```

#### JWT Authentication
- `python-jose[cryptography]` cho JWT encode/decode
- Token stored in HTTP-only cookie `mohiom_access_token`
- Expiry: 24 giờ
- OAuth flow: Google + GitHub với state token để CSRF protection

---

## CHƯƠNG 3: PHÂN TÍCH YÊU CẦU

### 3.1 Khảo sát các ứng dụng liên quan

#### 3.1.1 ComicsMaker.ai

| Tiêu chí | Đánh giá |
|---|---|
| Tạo nhân vật | Có (prompt-based) |
| Nhất quán nhân vật | Trung bình (style transfer, không face-lock) |
| Bố cục trang | Preset template đơn giản |
| Export | PNG, PDF |
| Hội thoại (Dialogue) | Có (text overlay) |
| Mã nguồn mở | Không |
| Pipeline liên kết | Không (từng bước độc lập) |

#### 3.1.2 AI Comic Factory

| Tiêu chí | Đánh giá |
|---|---|
| Nền tảng | Hugging Face Spaces |
| Input | Text prompt đơn giản |
| Nhất quán nhân vật | Kém (không có reference) |
| Bố cục trang | 4 layout cố định |
| Hội thoại | Không có |
| Pipeline | Single-shot (1 prompt → 1 page) |
| Mã nguồn mở | Có (AGPL) |

#### 3.1.3 Komiko.ai

| Tiêu chí | Đánh giá |
|---|---|
| Loại sản phẩm | SaaS (subscription) |
| Style | Anime/Manga |
| Nhất quán nhân vật | Tốt (character sheet + LoRA) |
| Điểm mạnh | Giao diện đẹp, UX tốt |
| Điểm yếu | Không có kịch bản panel-level, không tùy chỉnh layout |
| Pipeline tích hợp | Không (story generation riêng) |

#### 3.1.4 Lore Machine

| Tiêu chí | Đánh giá |
|---|---|
| Focus | Narrative-first (story + illustration) |
| Loại output | Illustrated story (không phải comic format) |
| Nhất quán nhân vật | Tốt |
| Bố cục | Không có panel layout |
| Pipeline | Story → Images (không có panel script) |

#### 3.1.5 Bảng so sánh tổng hợp

| Tính năng | mOhiOm | ComicsMaker | AI Comic Factory | Komiko | Lore Machine |
|---|:---:|:---:|:---:|:---:|:---:|
| Pipeline 6 bước tích hợp | ✓ | ✗ | ✗ | Một phần | ✗ |
| Phân tích câu chuyện (LLM) | ✓ | ✗ | ✗ | ✗ | ✓ |
| Kịch bản panel-by-panel | ✓ | ✗ | ✗ | ✗ | ✗ |
| Nhất quán nhân vật (IP-Adapter) | ✓ | Một phần | ✗ | ✓ | ✓ |
| Bố cục manga polygon | ✓ (14+) | ✗ | ✓ (4) | ✗ | ✗ |
| Dialogue editor (SVG bubbles) | ✓ | Một phần | ✗ | ✗ | ✗ |
| Streaming real-time | ✓ | ✗ | ✗ | ✗ | ✗ |
| Export ZIP/PDF | ✓ | ✓ | ✗ | ✓ | Một phần |
| Lưu/tải project | ✓ | ✓ | ✗ | ✓ | ✓ |
| Cộng đồng gallery | ✓ | ✓ | ✗ | ✓ | ✗ |
| Mã nguồn mở | Có | Không | Có | Không | Không |

**Nhận xét:** mOhiOm là hệ thống duy nhất tích hợp đầy đủ tất cả các công đoạn trong một pipeline liên kết,
với kịch bản panel cấp độ chi tiết và dialogue editor SVG native.

### 3.2 Xác định các bên liên quan (Stakeholders)

| Bên liên quan | Vai trò | Nhu cầu chính |
|---|---|---|
| **End User (Creator)** | Người tạo truyện tranh | Pipeline đơn giản, kết quả chất lượng cao, lưu/tải project |
| **Admin** | Quản trị viên hệ thống | Dashboard analytics, kiểm soát chất lượng |
| **AI Models** | Gemini API, SD Server | API keys, rate limits, stable endpoints |
| **Development Team** | Nhóm phát triển | Codebase maintainable, TypeScript strict, no linter conflicts |

**Primary Actor:** End User (Creator)
**Secondary Actors:** Admin, External AI Services

### 3.3 Yêu cầu chức năng

#### UC-01: Quản lý tài khoản
- Đăng ký bằng email/password
- Đăng nhập bằng email/password
- Đăng nhập bằng Google OAuth
- Đăng nhập bằng GitHub OAuth
- Đổi mật khẩu
- Quên mật khẩu (email reset)
- Xem/cập nhật hồ sơ

#### UC-02: Story Setup
- Nhập văn bản câu chuyện (manual hoặc upload file)
- Cấu hình thông số sản xuất (số chương, số trang, panels/trang, nhân vật)
- Xem preview phân tích nhẹ (lightweight analysis: nhân vật phát hiện, tone tags, scene beats)
- Lưu story setup vào localStorage

#### UC-03: Bước 1 — Phân tích câu chuyện (Story Analysis)
- Gửi câu chuyện lên LLM để phân tích
- Xem kết quả streaming theo thời gian thực
- Xem cấu trúc: Chapter outline, nhân vật chính, cấu trúc trang/panel ước tính
- Approve/Revoke kết quả phân tích
- Regenerate (reset approval + cooldown)

#### UC-04: Bước 2 — Thiết kế nhân vật (Character Design)
- Sinh character design sheets từ LLM (streaming)
- Xem design sheets theo accordion cho từng nhân vật
- Tab "Reference Images": tạo reference image qua SD server
- Upload reference image thủ công
- Chọn reference image (version filmstrip)
- Rate nhân vật (emoji reaction + chips feedback)
- Import nhân vật từ character library
- Import từ community gallery
- Approve/Revoke designs và reference images

#### UC-05: Bước 3 — Kịch bản panel (Panel Script)
- Sinh panel script từ LLM (streaming, dựa trên Step 1 + Step 2)
- Xem theo accordion: Chapter → Page → Panel
- Mỗi panel có: shot type, dialogue/SFX, AI image prompt, description
- Left nav panel: tree view với filter và status dots
- Regenerate panel cụ thể
- Approve/Revoke script

#### UC-06: Bước 4 — Sinh ảnh (Image Generation)
- Chọn layout template cho từng trang (14+ mẫu)
- Xem wireframe preview trước khi generate
- Generate từng panel hoặc tất cả
- Xem trạng thái panel: pending/generating/done/error
- Regenerate panel bị lỗi hoặc không ưng
- Pause/Resume generation queue
- Export tiến độ

#### UC-07: Bước 5 — Export
- Chỉnh sửa dialogue bubbles (SVG native)
- Drag-to-add bubble từ palette (6+ loại: speech, thought, shout, sfx, narration, none)
- Resize, reposition, rotate bubbles
- Cross-panel bubbles
- Export ZIP (các trang PNG)
- Export PDF (pdf-lib, native image dimensions, không letterbox A4)
- Export EPUB (jszip, chuẩn EPUB 3.0 cho e-reader)
- Export JSON (project snapshot)

#### UC-11: Analytics Dashboard (`/studio/analytics`)
- Xem KPI: panels generated, stories created, avg time/panel, character ref usage, export count, export rate
- Biểu đồ phân phối: style distribution (doughnut), mood distribution (bar), panels/ngày (line)
- Date range filter: 7 ngày / 30 ngày / All time
- Clear analytics data
- Dữ liệu lưu cục bộ trong localStorage (không cần backend)

#### UC-08: Quản lý project
- Lưu project lên cloud (MongoDB)
- Load project từ cloud
- Import/Export JSON
- Xem danh sách projects với step badges
- Publish project lên community gallery

#### UC-09: Community Gallery
- Xem truyện tranh công khai (comics gallery)
- Xem nhân vật công khai (characters gallery)
- Đọc comic trong reader fullscreen
- Thêm nhân vật của người khác vào library

#### UC-10: Admin Dashboard
- Xem KPI tổng quan (users, comics, images, ratings)
- Phân tích nhân vật (version quality, chip complaints)
- Phân tích regeneration patterns
- Export raw data (JSON/CSV)
- Xem thesis evaluation report

### 3.4 Yêu cầu phi chức năng

#### Hiệu năng
- **LLM response streaming**: first token < 2s sau khi gửi request
- **Image generation**: proxy timeout 120s (SD inference ~30-60s)
- **API response**: non-streaming endpoints < 500ms (trừ LLM calls)
- **Frontend bundle**: Next.js code splitting tự động theo route
- **MongoDB**: synchronous PyMongo trong thread pool — chấp nhận được với load thấp-trung bình

#### Bảo mật
- JWT HTTP-only cookie (chống XSS)
- bcrypt password hashing (direct bcrypt API, không passlib — tránh `ValueError: password cannot be longer than 72 bytes`)
- CORS policy: chỉ allow configured origins
- `X-User-Id` cho project/character endpoints (không cần JWT — đơn giản hoá internal API)
- OAuth state token (CSRF prevention)
- Admin endpoints: `X-Admin-Key` header authentication

#### Giới hạn API
- Gemini: 2 req/s per user, queue 8, timeout 8s (configurable via env)
- 429 → client phải retry sau `retry_after_seconds`
- 503 → queue full, retry sau 1s
- MongoDB document limit: 16MB → page images không lưu vào DB (tái generate sau khi load)

#### Khả dụng (Availability)
- Single-instance deployment (không HA)
- MongoDB local hoặc Docker Compose
- Graceful shutdown qua `lifespan` context manager

#### Khả năng bảo trì
- TypeScript strict mode: zero type errors
- No Prettier (ESLint only)
- No Python linter/formatter configured
- Session log (`SESSION_LOG.md`) ghi nhận mọi thay đổi

### 3.5 Đặc tả Use Case

#### 3.5.1 Use Case Diagram tổng quan

```
                        ┌─────────────────────────────────────┐
                        │          mOhiOm System              │
                        │                                     │
       ┌─────────┐      │  ┌──────────────────────────────┐   │
       │  User   │──────┼─▶│ UC-02: Story Setup           │   │
       │(Creator)│      │  └──────────────────────────────┘   │
       └─────────┘      │  ┌──────────────────────────────┐   │
            │           │  │ UC-03: Story Analysis (Step1)│   │
            ├───────────┼─▶└──────────────────────────────┘   │
            │           │  ┌──────────────────────────────┐   │
            ├───────────┼─▶│ UC-04: Character Design(Step2)│  │
            │           │  └──────────────────────────────┘   │
            ├───────────┼─▶│ UC-05: Panel Script (Step 3) │   │
            │           │  └──────────────────────────────┘   │
            ├───────────┼─▶│ UC-06: Image Generation (4) │   │
            │           │  └──────────────────────────────┘   │
            ├───────────┼─▶│ UC-07: Export (Step 5)       │   │
            │           │  └──────────────────────────────┘   │
            ├───────────┼─▶│ UC-08: Project Management    │   │
            │           │  └──────────────────────────────┘   │
            └───────────┼─▶│ UC-09: Community Gallery     │   │
                        │  └──────────────────────────────┘   │
                        │                                     │
       ┌─────────┐      │  ┌──────────────────────────────┐   │
       │  Admin  │──────┼─▶│ UC-10: Admin Dashboard       │   │
       └─────────┘      │  └──────────────────────────────┘   │
                        └─────────────────────────────────────┘
                                       │
              ┌────────────────────────┴──────────────────────┐
              │                                               │
       ┌──────────────┐                              ┌──────────────┐
       │ Google Gemini│                              │  SD Server   │
       │  (LLM API)   │                              │(Image Gen API│
       └──────────────┘                              └──────────────┘
```

#### 3.5.2 Đặc tả Use Case chính

**UC-03: Story Analysis (Step 1)**

| Trường | Nội dung |
|---|---|
| Tên | Phân tích câu chuyện |
| Actor | User (Creator) |
| Điều kiện tiên quyết | User đã hoàn thành Story Setup, có story text |
| Luồng chính | 1. User click "Generate Analysis" → 2. Frontend gửi POST /api/gemini/analyze-story-structured (stream=true) → 3. Backend tạo SSE stream → 4. Frontend hiển thị tokens theo thời gian thực → 5. Khi nhận event `done`, lưu analysis + structured_json → 6. User review 6 sections accordion → 7. User click Approve |
| Luồng thay thế | 3a. Gemini rate limit: 429 → frontend hiển thị retry countdown; 3b. Gemini error: frontend hiển thị error, cho phép retry |
| Điều kiện hậu | `step1.isApproved = true`, `step1.data.structuredJson` có chapter outline, character list, page estimates |

**UC-06: Image Generation (Step 4)**

| Trường | Nội dung |
|---|---|
| Tên | Sinh ảnh panel |
| Actor | User (Creator) |
| Điều kiện tiên quyết | Step 3 approved, có `step4PanelsByPage` (từ parsed script) |
| Luồng chính | 1. User chọn layout template → 2. Frontend gọi POST /api/comic-layout/confirm → 3. Nhận panel slot definitions (bbox, polygon, sd_width, sd_height) → 4. Canvas hiển thị wireframe → 5. User click "Generate Page N" hoặc "Generate All Pages" → 6. Frontend loop qua từng panel, gọi /api/image-proxy với prompt + character_name → 7. Panel state: idle → loading → success/error → 8. Khi all done, "Generate All Pages" button chuyển sang enabled export |
| Luồng thay thế | 6a. SD server timeout (120s): panel state → error, user có thể regenerate; 6b. User pause: stop queue, resume sau |
| Điều kiện hậu | `panelStates[panelId].imageUrl != null` cho các panel thành công |

---

## CHƯƠNG 4: THIẾT KẾ HỆ THỐNG

### 4.1 Tổng quan kiến trúc hệ thống

#### Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│                                                                 │
│   Next.js 14 App (Port 3000)                                    │
│   ┌────────────────────────────────────────────────────────┐    │
│   │  Pages: /, /studio, /studio/story-setup, /gallery,     │    │
│   │         /admin, /settings, /(auth)/login, /register    │    │
│   │                                                        │    │
│   │  Components: TextToComicGenerator (6-step wizard)      │    │
│   │    Step0Setup → Step1Analysis → Step2Characters         │    │
│   │    → Step3Script → Step4CanvasEditor → Step5Export      │    │
│   │                                                        │    │
│   │  Context: ComicGenerationContext (state management)    │    │
│   │  Services: api.ts (Axios, X-User-Id injection)         │    │
│   └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/SSE
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (Port 8000)                 │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ /api/auth   │  │ /api/gemini  │  │ /api/comic-layout      │  │
│  │  register   │  │  analyze     │  │  suggest / confirm     │  │
│  │  login      │  │  character-  │  │  compose-page          │  │
│  │  oauth      │  │  designs     │  │  auto-layout           │  │
│  │  reset-pwd  │  │  panel-script│  └────────────────────────┘  │
│  └─────────────┘  │  compose-page│  ┌────────────────────────┐  │
│  ┌─────────────┐  └──────────────┘  │ /api/projects          │  │
│  │ /api/bubbles│                    │  save/load/list        │  │
│  │  GET/PUT/   │  ┌──────────────┐  │  characters CRUD       │  │
│  │  DELETE     │  │ /api/ratings │  │  publish               │  │
│  └─────────────┘  │ /api/gallery │  └────────────────────────┘  │
│                   │ /api/admin   │                              │
│  GeminiService    │ /api/analytics│  PerUserRateLimiter         │
│  (LLM calls)      └──────────────┘  (token bucket per user)    │
└─────────────────────────────────────────────────────────────────┘
        │ PyMongo                              │ httpx
        ▼                                     ▼
┌──────────────────┐              ┌─────────────────────────────┐
│   MongoDB 7.0    │              │   External Services          │
│   (Port 27017)   │              │                             │
│                  │              │  Google Gemini API          │
│   Collections:   │              │  (gemini-2.5-flash)         │
│   - users        │              │                             │
│   - projects     │              │  Stable Diffusion Server    │
│   - user_chars   │              │  (IP-Adapter + ControlNet)  │
│   - panel_bubbles│              │  /generate-page             │
│   - panel_ratings│              │  /characters/save           │
│   - analytics    │              │                             │
│   - ...          │              │  (Optional) 9Router / OAI   │
└──────────────────┘              └─────────────────────────────┘
```

#### Sơ đồ triển khai (Deployment Diagram)

**Local Development:**
```
Developer Machine
├── MongoDB 7.0 (localhost:27017)
├── FastAPI (uvicorn, localhost:8000, --reload)
└── Next.js (npm run dev, localhost:3000)
    └── /api/image-proxy → SD Server (configured by user)
```

**Docker Compose:**
```yaml
services:
  mongodb:   image: mongo:7, port 27017
  backend:   build ./backend, port 8000, depends_on mongodb
  frontend:  build ./frontend, port 3000, depends_on backend
```

### 4.2 Thiết kế cấu trúc tĩnh

#### 4.2.1 Sơ đồ thành phần (Component Diagram)

```
Frontend Components
├── Pages (Next.js App Router)
│   ├── /studio/page.tsx              ← TextToComicGenerator mount point
│   ├── /studio/story-setup/page.tsx  ← StorySetup form + AI preview
│   ├── /studio/dashboard/page.tsx    ← Recent projects + characters
│   ├── /studio/character-manager/    ← Character CRUD
│   ├── /gallery/page.tsx             ← Community gallery (comics + chars)
│   ├── /admin/page.tsx               ← Admin analytics dashboard
│   └── /(auth)/*                     ← Login, Register, Reset Password
│
├── Studio Components
│   ├── TextToComicGenerator.tsx      ← Wizard orchestrator (6 steps)
│   ├── StudioSidebar.tsx             ← Left navigation
│   ├── StudioTopBar.tsx              ← Top bar with project name
│   └── GenerationModeModal.tsx       ← page vs panel mode selection
│
├── Wizard Step Components (studio-steps/)
│   ├── Step0Setup.tsx                ← Project ID, API URL, image style
│   ├── Step1Analysis.tsx             ← Story analysis streaming viewer
│   ├── Step2Characters.tsx           ← Design sheets + reference images
│   ├── Step3Script.tsx               ← Panel script accordion viewer
│   ├── Step4Generation.tsx           ← Canvas studio (layout + generate)
│   ├── Step5Export.tsx               ← Dialogue editor + export
│   └── DialogueEditor.tsx            ← SVG bubble editor (embedded in Step5)
│
├── Shared Components
│   ├── CharacterLibraryModal.tsx     ← Multi-select character picker
│   ├── GalleryModal.tsx              ← Community character picker
│   ├── ComicReaderModal.tsx          ← Fullscreen comic reader
│   ├── CreateCharacterModal.tsx      ← 3-method character creation
│   ├── ProjectsDrawer.tsx            ← Save/load project drawer
│   ├── PasswordStrengthMeter.tsx     ← Password strength indicator
│   └── Markdown.tsx                  ← react-markdown renderer
│
└── Context
    ├── ComicGenerationContext.tsx    ← Central state (~2400 lines)
    └── AuthContext.tsx               ← Auth state + user info

Backend Modules
├── FastAPI Application (app/)
│   ├── main.py                       ← App factory, middleware, router registration
│   ├── config.py                     ← Pydantic Settings (env vars)
│   ├── database.py                   ← MongoDatabase singleton
│   ├── services.py                   ← GeminiService (LLM calls, ~2400 lines)
│   ├── schemas.py                    ← Pydantic request/response models
│   ├── crud.py                       ← Repository pattern (ItemRepo, UserRepo)
│   ├── security.py                   ← JWT, bcrypt, OAuth state
│   ├── rate_limit.py                 ← PerUserRateLimiter (token bucket)
│   ├── emailer.py                    ← SMTP password reset email
│   ├── comic_composer.py             ← Pillow-based page compositor (grid layouts)
│   └── panel_splitter.py             ← Split full-page image into panels
│
├── Routers (app/routers/)
│   ├── gemini.py                     ← LLM text generation + SSE streaming
│   ├── comic_generation.py           ← Polygon layout + compose endpoints
│   ├── auth.py                       ← Authentication + OAuth
│   ├── projects.py                   ← Project + character CRUD
│   ├── bubbles.py                    ← Dialogue bubble persistence
│   ├── ratings.py                    ← Panel/comic/character ratings
│   ├── gallery.py                    ← Public gallery endpoints
│   ├── analytics.py                  ← Fire-and-forget event logging
│   ├── admin_analytics.py            ← Admin KPIs + aggregation pipelines
│   └── text_to_comic.py              ← Full pipeline (legacy)
│
└── Layout Engine (comic/layout/)
    ├── layout_templates.py           ← 14+ MangaLayoutTemplates (% coordinates)
    ├── panel_definition.py           ← PanelDefinition, PageLayout dataclasses
    ├── layout_selector.py            ← suggest_layout(), select_layout()
    ├── mask_renderer.py              ← MaskRenderer (Pillow polygon masking)
    ├── page_compositor.py            ← PageCompositor (full page assembly)
    ├── composition_hints.py          ← get_composition_hint() per panel shape
    └── procedural_generator.py       ← Procedural layout generation
```

#### 4.2.2 Sơ đồ gói (Package Diagram)

```
mOhiOm
├── frontend/                     [Next.js Package]
│   ├── src/app/                  ← Next.js App Router pages
│   ├── src/components/           ← React components
│   ├── src/context/              ← React Context providers
│   ├── src/services/             ← API client (api.ts)
│   ├── src/lib/                  ← Utilities (export.ts, bubbles/)
│   └── src/styles/               ← globals.css (CSS custom props)
│
└── backend/                      [Python Package]
    ├── app/                      ← FastAPI application
    │   └── routers/              ← Route handlers (11 routers)
    └── comic/                    ← Layout engine
        └── layout/               ← Template + renderer modules
```

**Dependency Graph (Backend):**
```
main.py
  └── routers/*.py
        ├── services.py        [GeminiService - LLM]
        ├── schemas.py         [Pydantic models]
        ├── database.py        [MongoDB singleton]
        ├── crud.py            [Repository pattern]
        ├── security.py        [JWT + bcrypt]
        ├── rate_limit.py      [Token bucket]
        └── comic/layout/      [Layout engine - independent]
              ├── layout_templates.py
              ├── panel_definition.py
              ├── mask_renderer.py
              └── page_compositor.py
```

#### 4.2.3 Sơ đồ lớp (Class Diagram) — các mô-đun chính

**GeminiService (services.py)**
```
GeminiService
├── __init__(model: str | None)
│     ├── _client: genai.Client | None      ← Gemini SDK client
│     └── _nine_router_config: dict | None   ← 9Router fallback config
├── generate_text(prompt, stream) → str | AsyncGenerator
├── generate_step1_stream(project_id, story_text, ...) → AsyncGenerator[tuple]
│     yields: ("token", str) | ("done", markdown, json) | ("error", msg, code)
├── generate_step2_stream(project_id, step1_json, ...) → AsyncGenerator[tuple]
├── generate_step3_stream(project_id, step1_json, step2_json, ...) → AsyncGenerator[tuple]
├── analyze_story_lightweight_stream(story_text, genre_tone) → AsyncGenerator[tuple]
├── generate_adapt_story_stream(original_story, ...) → AsyncGenerator[tuple]
├── _preprocess_story_text(story_text: str) → str  [static]
└── [many more generation methods...]
```

**PerUserRateLimiter (rate_limit.py)**
```
PerUserRateLimiter
├── __init__(requests_per_second, max_queue_size, max_wait_seconds)
├── _queue_semaphore: asyncio.Semaphore
├── _user_timestamps: dict[str, deque[float]]
├── acquire(user_key: str) → LimiterToken
│     raises: QueueFullError | RateLimitExceededError
└── _try_claim_request_slot(user_key) → float  [0=granted, >0=wait_seconds]

LimiterToken
├── _semaphore: asyncio.Semaphore
└── release() → None
```

**PanelDefinition (comic/layout/panel_definition.py)**
```
PanelDefinition
├── id: str
├── polygon: List[Tuple[float, float]]   ← % coordinates, clockwise
├── bbox: Tuple[float, float, float, float]  ← (x%, y%, w%, h%)
├── recommended_shot: str                ← MEDIUM / CLOSE-UP / WIDE / etc.
├── is_splash: bool
├── has_diagonal: bool
├── diagonal_type: str                   ← 'slash' | 'backslash' | 'none'
├── sd_width: int                        ← pixel width for SD generation
├── sd_height: int                       ← pixel height for SD generation
├── from_polygon(id, polygon, shot, **) [classmethod]
├── area_pct: float  [property]
└── aspect_ratio: float  [property]

PageLayout
├── template_name: str
├── panel_count: int
├── panels: List[PanelDefinition]
├── page_width: int = 1240
├── page_height: int = 1754
├── gutter: float = 0.8   ← % gutter
└── margin: float = 1.5   ← % margin
```

**MaskRenderer (comic/layout/mask_renderer.py)**
```
MaskRenderer
├── __init__(page_width=1240, page_height=1754)
├── W, H: int              ← page pixel dimensions
├── pct_to_px(points) → List[Tuple[int,int]]
├── get_bbox_px(polygon_pct) → Tuple[int,int,int,int]
├── _cover_crop(img, target_w, target_h) → Image   ← no stretch, center crop
├── _expand_polygon(pct_pts, expand_px) → ...       ← close hairline gaps
├── render_page(layout, panel_images) → Image        ← main compositor
└── compute_sd_dimensions(panel) → Tuple[int,int]   ← nearest multiple of 8
```

**ComicGenerationContext (frontend) — Key State**
```typescript
interface ComicGenerationContextValue {
  // Step states
  step1: StepState<Step1Result>
  step2: StepState<Step2Result>
  step2ImageReview: StepState<CharacterImageReviewResult>
  step3: StepState<Step3Result>
  step4: StepState<Step4Result>
  step5: StepState<Step5Result>

  // Step 4 panels
  step4PanelsByPage: [number, Step4Panel[]][]
  panelStates: Record<string, Step4PanelState>
  panelBubbles: Record<string, PanelBubbles>
  comicPageMode: 'page' | 'panel' | null

  // Generation
  handleStartFullGeneration: () => void
  handleRegenerateSinglePanel: (panel: Step4Panel) => Promise<void>

  // Project persistence
  saveToCloud: () => Promise<void>
  loadFromCloud: (projectId: string) => Promise<{success: boolean; error?: string}>
  listCloudProjects: () => Promise<CloudProjectListItem[]>

  // Wizard navigation
  activeStep: WizardStepKey
  setActiveStep: (step: WizardStepKey) => void
  handleApprove: (step: StepKey) => void
  handleRevokeApproval: (step: StepKey) => void
}
```

### 4.3 Thiết kế hành vi động

#### 4.3.1 Sequence Diagram — Pipeline 6 bước

```
User    Browser(Next.js)    FastAPI     GeminiAPI    SDServer    MongoDB
 │            │                │             │             │          │
 │─Story Setup─▶              │             │             │          │
 │            │─localStorage──▶             │             │          │
 │            │                │             │             │          │
 │──"Analyze"─▶               │             │             │          │
 │            │─POST /gemini/analyze-story-structured(stream=true)──▶│
 │            │                │─generateContent(stream)──▶          │
 │            │◀─SSE: token────│◀──chunk────│             │          │
 │◀─streaming─│                │             │             │          │
 │            │◀─SSE: done─────│◀──final────│             │          │
 │◀─full text─│                │             │             │          │
 │──Approve───▶               │             │             │          │
 │            │─ctx.step1.isApproved=true   │             │          │
 │            │                │             │             │          │
 │──"Gen Chars"▶              │             │             │          │
 │            │─POST /gemini/character-designs-structured(stream)───▶│
 │            │◀─SSE stream────│◀──stream───│             │          │
 │◀─streaming─│                │             │             │          │
 │──Approve───▶               │             │             │          │
 │──"Gen Images"▶             │             │             │          │
 │            │─POST /api/image-proxy/characters────────▶ │          │
 │            │◀─200 OK────────│─────────────────────────▶│          │
 │            │─POST /api/image-proxy (per character)────▶│          │
 │            │◀─{image_url}───│◀────────────────────────│          │
 │◀─previews──│                │             │             │          │
 │            │                │             │             │          │
 │──"Gen Script"▶             │             │             │          │
 │            │─POST /gemini/panel-script-structured(stream)────────▶│
 │            │◀─SSE stream────│◀──stream───│             │          │
 │──Approve───▶               │             │             │          │
 │            │                │             │             │          │
 │─Select Layout▶             │             │             │          │
 │            │─POST /comic-layout/confirm──▶             │          │
 │            │◀─{panels[{bbox,sd_w,sd_h}]}─│             │          │
 │─"Gen All"──▶               │             │             │          │
 │            │─for each panel:             │             │          │
 │            │─POST /api/image-proxy───────────────────▶│          │
 │            │◀─{image_data_url}───────────────────────│          │
 │◀─panel imgs▶               │             │             │          │
 │            │                │             │             │          │
 │─Save Project▶              │             │             │          │
 │            │─POST /api/projects/save─────────────────────────────▶│
 │            │◀─200 OK─────────────────────────────────────────────│
```

#### 4.3.2 Activity Diagram — Character Design Flow (Bước 2)

```
START
  │
  ▼
[Generate Design Sheets (LLM stream)]
  │
  ▼
{Review all 5 design sections?}──No──▶[Warning: N/5 reviewed]
  │ Yes                                       │
  │◀──────────────────────────────────────────┘
  ▼
[Approve Design Sheets]
  │
  ▼
[Switch to Reference Images tab]
  │
  ▼
{Character has reference image?}
  │ No                      │ Yes
  ▼                         ▼
[Generate via SD server] [Show existing image]
  │                         │
  ▼                         │
{Rating: good/love?}        │
  │ Yes  │ No               │
  │      ▼                  │
  │    [Show chips + feedback]
  │      │                  │
  │◀─────┘                  │
  ▼                         │
[Mark as approved]◀─────────┘
  │
  ▼
{All characters approved?}──No──▶[Return to list]
  │ Yes                           │
  │◀──────────────────────────────┘
  ▼
[Show CharacterSetRatingModal]
  │
  ▼
[handleApprove(2)] → advance to Step 3
  │
 END
```

#### 4.3.3 State Machine Diagram — Panel Generation States

```
                ┌─────────┐
                │  idle   │◀────────────────────────────┐
                └─────────┘                             │
                    │ user clicks Generate               │
                    ▼                                    │
                ┌─────────┐  attempt 1 fails             │
                │ loading │──────────────── retry 2 ────▶│ (max 3 attempts, 3s apart)
                └─────────┘  all 3 fail   SD server error│
                    │            │                        │(reset to idle)
                    │            ▼                        │
           ┌────────┘       ┌─────────┐                  │
           │                │  error  │──Retry──────────── ┘
           ▼                └─────────┘
       ┌─────────┐
       │ success │
       └─────────┘
           │
           ▼
       ┌──────────┐
       │comparing │ (when pendingUrl set for A/B compare)
       └──────────┘
           │
     Accept/Reject
           │
           ▼
       ┌─────────┐
       │ success │ (new imageUrl)
       └─────────┘
```

**Hai chế độ sinh ảnh (`comicPageMode`):**
```
null           → GenerationModeModal hiển thị (user chưa chọn)
'page'         → Full Mode: 1 ảnh composite/trang → lưu vào pageStates["page-N"]
'panel'        → Panel Mode: 1 ảnh/panel → lưu vào panelStates[panel.id]
```
`comicPageMode` reset về `null` khi Step 3 regenerate hoặc user click "Change" → modal mở lại.

**Trạng thái toàn bộ pipeline (Step State Machine):**
```
STATE 1: Initial    → data=null, locked=true, isApproved=false
STATE 2: Loading    → isLoading=true
STATE 3: Generated  → data≠null, isApproved=false
STATE 4: Approved   → isApproved=true, approvedAt≠null
STATE 5: Regen After Approval → isLoading=true, regeneratedAfterApproval=true
```

### 4.4 Thiết kế dữ liệu

#### 4.4.1 ERD (Entity-Relationship Diagram)

```
USER ──────────────── PROJECT (1:N)
│                          │
│                          ├── steps.step1 (embedded)
│                          ├── steps.step2 (embedded)
│                          ├── steps.step2_image_review (embedded)
│                          │     └── characters[] (embedded)
│                          │           └── candidates[] (embedded)
│                          ├── steps.step3 (embedded)
│                          ├── steps.step4 (embedded - no images)
│                          ├── image_gen_settings (embedded)
│                          └── user_inputs (embedded)
│
├── USER_CHARACTER (1:N) ← standalone character library
│
├── PANEL_BUBBLES (1:N)  ← keyed by panelId
│
├── PANEL_RATINGS (1:N)
├── COMIC_RATINGS (1:N)
├── CHARACTER_RATINGS (1:N)
└── ANALYTICS_EVENTS (1:N)
```

**Lưu ý kiến trúc:** Nhân vật được nhúng (embedded) trong project documents, không có collection
riêng cho project-characters. Chỉ standalone library characters có trong `user_characters` collection.
Đây là trade-off: model đơn giản hơn nhưng query character cross-project cần scan tất cả projects.

#### 4.4.2 Thiết kế Schema MongoDB

**Collection: `users`**
```json
{
  "_id": ObjectId,
  "email": "user@example.com",       // unique, sparse index
  "password_hash": "bcrypt_hash",    // null for OAuth-only users
  "first_name": "Thuong",
  "last_name": "Nguyen",
  "providers": ["manual"],           // ["manual", "google", "github"]
  "oauth": {
    "google": {"id": "...", "email": "..."},
    "github": {"id": "...", "email": "..."}
  },
  "password_reset_token": "hashed_token",
  "password_reset_expires": ISODate
}
```

**Collection: `projects`**
```json
{
  "_id": ObjectId,
  "user_id": "uuid-from-localStorage",   // X-User-Id header value
  "project_id": "my_comic_001",          // user-chosen slug
  "saved_at": ISODate,
  "is_public": false,
  "user_inputs": {
    "storyText": "...",
    "genre": "Shonen",
    "artStyleReference": "manga",
    "projectId": "my_comic_001"
  },
  "image_gen_settings": {
    "mode": 1,
    "ipAdapterScale": 0.6
  },
  "steps": {
    "step1": {
      "data": { "analysisMarkdown": "...", "structuredJson": {...} },
      "isApproved": true,
      "approvedAt": "2026-06-21T10:00:00Z"
    },
    "step2ImageReview": {
      "data": {
        "characters": [{
          "characterId": "kael",
          "name": "Kael",
          "prompt": "tall warrior...",
          "status": "success",
          "candidates": [{"id": "v1", "imageUrl": "data:image/..."}],
          "selectedCandidateId": "v1"
        }]
      },
      "isApproved": true
    },
    "step3": { "data": { "scriptMarkdown": "...", "structuredJson": {...} }, ... },
    "step4": {
      "data": {
        "panels": [{ "id": "p1-pg1", "pageNumber": 1, "panelNumber": 1, ... }],
        "panelStates": {},   // NOT saved (regenerate after load)
        "pageStates": {}     // NOT saved (too large)
      }
    }
  }
}
```

**Collection: `user_characters`**
```json
{
  "_id": ObjectId,
  "user_id": "uuid",
  "character_id": "kael_warrior",
  "name": "Kael",
  "prompt": "tall muscular warrior...",
  "selected_image_url": "data:image/png;base64,...",
  "project_id": "my_comic_001",   // source project
  "is_public": false,
  "created_at": ISODate
}
```

**Collection: `panel_bubbles`**
```json
{
  "_id": ObjectId,
  "panelId": "panel_p1_pg1",
  "comicId": "my_comic_001",
  "bubbles": [{
    "id": "bubble_uuid",
    "dialogue": "Ready for battle?",
    "bubbleType": "speech",       // speech|thought|shout|sfx|narration|none
    "tailDir": "down-right",
    "bubblePosition": {"x": 0.3, "y": 0.2},   // normalized 0-1
    "bubbleSize": {"w": 120, "h": 60},         // logical pixels
    "fontSize": 13,
    "rotation": 0,
    "character": "Kael",
    "zIndex": 1,
    "crossPanel": false
  }]
}
```

**Collection: `analytics_events`**
```json
{
  "_id": ObjectId,
  "event_type": "character_generated",   // or "character_approved" | "step3_completed"
  "user_id": "uuid",
  "comic_id": "my_comic_001",
  "character_id": "kael",
  "generation_mode": 1,
  "version": 0,                           // 0=V1, 1=V2, ...
  "timestamp": ISODate
}
```

### 4.5 Thiết kế giao tiếp client-server

#### 4.5.1 Thiết kế REST API — Endpoints chính

**Auth** (`/api/auth`)

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Đăng ký email/password | None |
| POST | `/auth/login` | Đăng nhập email/password | None |
| GET | `/auth/me` | Get current user | Cookie |
| POST | `/auth/logout` | Logout (clear cookie) | Cookie |
| POST | `/auth/forgot-password` | Gửi email reset | None |
| POST | `/auth/reset-password` | Reset password | Token |
| POST | `/auth/change-password` | Đổi password | Cookie |
| GET | `/auth/oauth/{provider}/start` | Bắt đầu OAuth flow | None |
| GET | `/auth/oauth/{provider}/callback` | OAuth callback | None |

**LLM Generation** (`/api/gemini`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/gemini/analyze-story-structured` | StoryAnalysisRequest + `stream=true` | SSE stream |
| POST | `/gemini/character-designs-structured` | Step2DesignRequest + `stream=true` | SSE stream |
| POST | `/gemini/panel-script-structured` | Step3ScriptRequest + `stream=true` | SSE stream |
| POST | `/gemini/analyze-story-lightweight` | `{story_text, genre_tone}` | SSE stream |
| POST | `/gemini/adapt-story` | AdaptStoryRequest | SSE stream |
| POST | `/gemini/generate-panel-image` | `{image_prompt, width, height}` | `{image_url, image_data_url}` |

**Layout Engine** (`/api/comic-layout`)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/comic-layout/suggest` | `{panel_count, scene_type, panels}` | `{suggested, alternatives, rationale}` |
| POST | `/comic-layout/confirm` | `{panel_count, layout_name, page_width, page_height}` | `{panels:[{id,bbox,polygon,sd_width,sd_height}]}` |
| POST | `/comic-layout/compose-page` | `{panel_images, panel_count, layout_name}` | `{page_image_b64, layout_used, panels}` |
| GET | `/comic-layout/layouts` | — | `{layouts: {name: {panel_count, has_diagonal, has_splash}}}` |

**Projects** (`/api/projects`)

| Method | Path | Description |
|---|---|---|
| POST | `/projects/save` | Upsert project state |
| GET | `/projects/` | List user's projects |
| GET | `/projects/{project_id}` | Load full project |
| DELETE | `/projects/{project_id}` | Delete project |
| PATCH | `/projects/{project_id}/publish` | Toggle gallery visibility |
| GET | `/projects/stats` | User's aggregate stats |
| GET | `/projects/characters` | All characters across projects |
| POST | `/projects/characters` | Create standalone character |
| PATCH | `/projects/characters/{character_id}` | Update standalone character |

**Bubbles** (`/api/bubbles`)

| Method | Path | Description |
|---|---|---|
| GET | `/bubbles?comicId={id}` | Load all bubbles for comic |
| PUT | `/bubbles/{panelId}` | Upsert bubbles for panel |
| DELETE | `/bubbles/{panelId}` | Clear panel's bubbles |

#### 4.5.2 Thiết kế luồng Streaming SSE

**Sơ đồ luồng SSE:**
```
Frontend                          FastAPI Backend
──────────                        ──────────────
EventSource / fetch (stream)
                                  async def sse_generator():
POST /api/gemini/analyze-story ──▶    limit_token = await limiter.acquire(user_key)
                                      async for event in gemini_service.generate_step1_stream():
                                          if event[0] == "token":
◀── data: {"type":"token","content":"..."} ──  yield SSE token event
                                          elif event[0] == "done":
◀── data: {"type":"done","analysis":"..."} ──  yield SSE done event
                                          finally: limit_token.release()

                                  return StreamingResponse(
                                      sse_generator(),
                                      media_type="text/event-stream",
                                      headers={"X-Accel-Buffering": "no"}
                                  )

Frontend xử lý:
  onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.type === "token") appendToStreamingText(data.content)
    if (data.type === "done")  { setFinalData(data); closeStream() }
    if (data.type === "error") { showError(data.message) }
  }
```

**Lưu ý quan trọng:**
- `X-Accel-Buffering: no` header để nginx không buffer SSE response
- `Cache-Control: no-cache` và `Connection: keep-alive`
- Rate limit token release trong `finally` block của generator — đảm bảo release ngay cả khi client ngắt kết nối

#### 4.5.3 Thiết kế proxy ảnh và giao tiếp SD server

```
Frontend → /api/image-proxy (Next.js route) → SD Server
```

**Lý do dùng proxy:**
1. Ẩn SD server URL khỏi browser (bảo mật)
2. Tránh CORS issue từ SD server
3. Thêm timeout 120s (SD inference thường 30-60s)
4. Convert response sang format chuẩn

**Next.js route handlers:**
```typescript
// /api/image-proxy/route.ts
POST → proxies to ${SD_SERVER_URL}/generate-page
Body: { scene_prompt, story_id, character_name, style, control_image_b64? }

// /api/image-proxy/characters/route.ts
POST → proxies to ${SD_SERVER_URL}/characters/save
Body: { story_id, character_name, reference_image_b64 }
```

### 4.6 Thiết kế giao diện người dùng

#### 4.6.1 Luồng người dùng (User Flow)

```
Landing Page (/)
      │
      ▼
Story Setup (/studio/story-setup)
  ├── Quick Start (title + story text)
  └── Full Setup (title + genre + art direction + advanced config)
      │
      ▼
[Auto-save to localStorage]
      │
      ▼
Pipeline Wizard (/studio)
  ┌───────────────────────────────────────────────────────────────┐
  │  [Setup] ──▶ [Analysis] ──▶ [Characters] ──▶ [Script]         │
  │               Step 1          Step 2         Step 3            │
  │                                                               │
  │  [Generate] ──▶ [Export]                                       │
  │   Step 4         Step 5                                        │
  └───────────────────────────────────────────────────────────────┘
      │
      ▼
Export (/studio - Step 5)
  ├── ZIP Image Pack
  ├── PDF Comic
  └── JSON Project Snapshot
      │
      ▼
[Optional] Publish to Gallery
  └── /gallery (community comics + characters)
```

#### 4.6.2 Wireframe các màn hình chính

**Step 4 — Canvas Studio (Step4Generation.tsx — Layout tab, panel mode)**
```
┌──────────────────────────────────────────────────────────────────────┐
│ STEPPER: Setup → Analysis → Characters → Script → [Generate] → Export│
├──────────────────────────────────────────────────────────────────────┤
│  [← Prev]  ● ● ○ ○   Page 2 of 4   [Next →]                        │
├─────────────────────────────────────┬────────────────────────────────┤
│                                     │  LayoutStudioSidebar (280px)   │
│   LayoutPageCanvas                  │                                │
│   (gray bg #E8E8E8, fills flex)     │  LAYOUT TEMPLATE    ✨ Suggest │
│                                     │  ┌────┬────┬────┬────┐        │
│  ┌──────────────────────┐           │  │ ▥  │ ⊞  │ ⬛ │ ⋮  │        │
│  │  White 360×480 page  │           │  │2x2 │Top │Spl.│3rw │        │
│  │                      │           │  └────┴────┴────┴────┘        │
│  │  ┌──────┬──────┐     │           │  ┌────┬────┬────┬────┐        │
│  │  │  P1  │  P2  │     │           │  │ ◫  │ ▦  │ ▥  │ ⬜ │        │
│  │  │ idle │ ✓img │     │           │  └────┴────┴────┴────┘        │
│  │  ├──────┼──────┤     │           │                                │
│  │  │  P3  │  P4  │     │           │  ──────────────────────────── │
│  │  │ spin │⚠retry│     │           │                                │
│  │  └──────┴──────┘     │           │  [⚡ Generate All Panels     ] │
│  └──────────────────────┘           │  (outlined blue, 44px height)  │
│                                     │                                │
│                                     │  ──────────────────────────── │
│                                     │                                │
│                                     │  PAGE SUMMARY                  │
│                                     │  ● Panel 1 [ESTAB. SHOT ▼]    │
│                                     │  ● Panel 2 [MEDIUM SHOT ▼]    │
│                                     │  ○ Panel 3 [CLOSE-UP    ▼]    │
│                                     │  ○ Panel 4 [WIDE SHOT   ▼]    │
└─────────────────────────────────────┴────────────────────────────────┘

Note: sidebar visual style is consistent with DialogueEditor BubbleSidebar:
- Section headers: uppercase bold 11px
- Template cards: 4-col icon grid (same style as bubble type buttons)
- Action button: transparent bg, blue 1.5px border (same as "Auto-import from script")
- PAGE SUMMARY: PanelScriptCard per panel (collapsible)
```

**Step 5 — Dialogue Editor (DialogueEditor.tsx in Step5Export)**
```
┌───────────────────────────────────────────────────────────────────┐
│ STEPPER: ... → Script → Generate → [Export]                       │
├──────────────────┬────────────────────────────────────────────────┤
│  BubbleSidebar   │                                                │
│  ┌────────────┐  │         Panel Canvas (with bubbles)            │
│  │ Drag types │  │  ┌──────────────────────────────────────────┐  │
│  │ 💬 speech  │  │  │                                          │  │
│  │ 💭 thought │  │  │    [speech bubble: "Ready?"]              │  │
│  │ 😤 shout   │  │  │       ↑ drag to move                     │  │
│  │ 💥 sfx     │  │  │                                          │  │
│  │ 📦 narr.   │  │  │  [generated panel image]                 │  │
│  └────────────┘  │  │                                          │  │
│                  │  └──────────────────────────────────────────┘  │
│  Selected:       │                                                │
│  [Speech ▼]      │  Page: ● ● ○ ○    (dots: green=done)          │
│  Size: [──●──]   │                                                │
│  Font: [──●──]   │                                                │
│  Tail: [compass] │                                                │
└──────────────────┴────────────────────────────────────────────────┤
│ ← Back            2/4 panels have dialogue      [Export ▶]       │
└───────────────────────────────────────────────────────────────────┘
```

---

## CHƯƠNG 5: TRIỂN KHAI HỆ THỐNG

### 5.1 Môi trường phát triển và công cụ sử dụng

| Công cụ | Phiên bản | Mục đích |
|---|---|---|
| Python | 3.12 | Backend runtime |
| FastAPI | 0.109.0 | Web framework |
| uvicorn | 0.27.0 | ASGI server |
| Pydantic | 2.5.0 | Schema validation |
| PyMongo | 4.6.0 | MongoDB driver |
| google-genai | ≥1.0.0 | Gemini API SDK |
| Pillow | ≥10.0.0 | Image processing (page compositor) |
| httpx | 0.25.0 | Async HTTP client (SD proxy) |
| python-jose | 3.3.0 | JWT encoding/decoding |
| bcrypt | (direct) | Password hashing |
| Node.js | 18+ | Frontend runtime |
| Next.js | 14.x | React meta-framework |
| TypeScript | 5.x | Type-safe JavaScript |
| Tailwind CSS | 3.3 | Utility-first CSS |
| Axios | 1.6.0 | HTTP client |
| Framer Motion | 11.0 | Animations |
| Lucide React | 0.445 | Icon library |
| jszip | 3.10.1 | ZIP + EPUB export |
| pdf-lib | ≥1.17.1 | PDF export (replaces jsPDF, preserves native image size) |
| chart.js | ≥4.0 | Analytics dashboard charts (doughnut, bar, line) |
| react-markdown | 9.0.1 | Markdown renderer |
| MongoDB | 7.0 | Database |
| Docker | — | Container deployment |

### 5.2 Triển khai backend

#### GeminiService — Dual Provider Architecture

```python
class GeminiService:
    def __init__(self, model=None):
        if settings.NINE_ROUTER_URL:
            # 9Router mode: OpenAI-compatible API
            self._nine_router_config = {
                "url": _normalize_nine_router_url(settings.NINE_ROUTER_URL),
                "api_key": settings.NINE_ROUTER_API_KEY,
                "model": settings.NINE_ROUTER_MODEL,
            }
        else:
            # Gemini mode: Google genai SDK
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
```

Khi `NINE_ROUTER_URL` được set trong `.env`, toàn bộ LLM calls đi qua 9Router thay vì Google.
Đây là thiết kế để dễ swap provider mà không thay đổi application code.

#### Rate Limiting Implementation

```python
# Token bucket algorithm per user
class PerUserRateLimiter:
    async def acquire(self, user_key):
        # Step 1: Try to enter global queue (limited by max_queue_size)
        await asyncio.wait_for(self._queue_semaphore.acquire(), timeout=0.01)
        # → QueueFullError if all 8 slots taken

        # Step 2: Wait for per-user rate slot
        while True:
            retry_after = await self._try_claim_request_slot(user_key)
            if retry_after <= 0:
                return LimiterToken(self._queue_semaphore)
            if waited >= max_wait_seconds:
                raise RateLimitExceededError(retry_after)
            await asyncio.sleep(min(retry_after, 0.25))
```

#### Layout Engine — Polygon Panel System

**14+ layout templates, tất cả dùng tọa độ phần trăm (0-100):**

```python
# Ví dụ: grid_2x2 (4 panels bằng nhau)
@classmethod
def grid_2x2(cls) -> List[PanelDefinition]:
    mx, my = 50.0, 50.0
    pw = mx - M - G/2   # panel width = 50% - margin - half gutter
    ph = my - M - G/2
    return [
        cls._rect("p1", M, M, pw, ph, "ESTABLISHING"),        # top-left
        cls._rect("p2", mx+G/2, M, pw, ph, "MEDIUM"),         # top-right
        cls._rect("p3", M, my+G/2, pw, ph, "CLOSE-UP"),       # bottom-left
        cls._rect("p4", mx+G/2, my+G/2, pw, ph, "MEDIUM-WIDE"), # bottom-right
    ]

# PanelDefinition stores:
# - polygon: [(x%, y%)] clockwise vertices
# - bbox: (x%, y%, w%, h%) bounding box
# - sd_width/sd_height: computed pixel dimensions for SD generation
```

**Danh sách tất cả templates:**

| Template | Panels | Đặc điểm |
|---|---|---|
| `grid_2x2` | 4 | 4 panels bằng nhau |
| `three_panels_row` | 3 | 3 panels horizontal |
| `one_large_two_small` | 3 | 1 lớn trái + 2 nhỏ phải |
| `splash_top` | 4 | 1 splash full-width + 3 panels dưới |
| `action_dynamic_4` | 4 | Bố cục action với panel kích thước khác nhau |
| `asymmetric_4` | 4 | Bất đối xứng theo tỷ lệ vàng |
| `cinematic_strips` | 3 | 3 dải ngang kiểu cinematic |
| `vertical_flow` | 4 | Flow dọc |
| `manga_classic_5` | 5 | Layout manga cổ điển 5 panels |
| `diagonal_slash_4` | 4 | 4 panels với đường chéo kiểu slash |
| `diagonal_backslash_4` | 4 | 4 panels với đường chéo ngược |
| `one_two_one` | 4 | 1 top + 2 middle + 1 bottom |
| `two_splash_bottom` | 3 | 2 nhỏ top + 1 splash bottom |
| `grid_3x2` | 6 | 6 panels lưới 3×2 |

**MaskRenderer — Pillow polygon compositing:**
```python
def render_page(self, layout: PageLayout, panel_images: Dict[str, Image.Image]) -> Image.Image:
    canvas = Image.new("RGB", (self.W, self.H), self.PAGE_BG)
    for panel in layout.panels:
        img = panel_images.get(panel.id)
        if img:
            # 1. Cover-crop image to panel bbox (no stretch, center crop)
            x, y, w, h = self.get_bbox_px(panel.polygon)
            cropped = self._cover_crop(img, w, h)
            # 2. Create polygon mask
            mask = Image.new("L", (self.W, self.H), 0)
            draw = ImageDraw.Draw(mask)
            draw.polygon(self.pct_to_px(panel.polygon), fill=255)
            # 3. Expand polygon slightly to close hairline gaps
            # 4. Composite onto canvas
            canvas.paste(cropped, (x, y), mask.crop((x, y, x+w, y+h)))
    return canvas
```

### 5.3 Triển khai frontend

#### ComicGenerationContext — State Architecture

Context là single source of truth cho toàn bộ pipeline (~2400 lines):

```typescript
// Step state machine
const emptyStepState = <T>(locked: boolean): StepState<T> => ({
  data: null, isLoading: false, isApproved: false,
  regeneratedAfterApproval: false, locked,
  error: null, lastUpdated: null, approvedAt: null, streamingText: null,
})

// Approval cascade: approving step N locks step N+1
const handleApprove = (step: StepKey) => {
  setStepMap(prev => ({
    ...prev,
    [step]: { ...prev[step], isApproved: true, approvedAt: new Date().toISOString() },
    // unlock next step
    [step + 1]: { ...prev[step + 1], locked: false },
  }))
}

// Revoking step N re-locks steps N, N+1, N+2...
const handleRevokeApproval = (step: StepKey) => {
  // cascade lock all downstream steps
}
```

#### SSE Streaming Consumer Pattern

```typescript
// Frontend consumes SSE using ReadableStream
async function analyzeStoryStructuredStream(request, callbacks) {
  const response = await fetch('/api/gemini/analyze-story-structured', {
    method: 'POST',
    body: JSON.stringify({ ...request, stream: true })
  })
  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    // Parse SSE "data: {...}\n\n" lines
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6))
        if (event.type === 'token') callbacks.onToken(event.content)
        if (event.type === 'done')  callbacks.onDone(event.analysis, event.structured_json)
        if (event.type === 'error') callbacks.onError(event.message)
      }
    }
  }
}
```

#### Canvas Editor — Panel Positioning

```typescript
// Panel slots positioned using bbox from confirmedLayouts[pageNumber]
// bbox = [x_pct, y_pct, w_pct, h_pct] in 0-100 coordinate space
// PAGE_W = 1240, PAGE_H = 1754

function DefaultWireframeSlot({ panel, confirmedLayout, zoom }) {
  const slot = confirmedLayout?.panels?.find(p => p.id === panel.id)
  if (!slot) return null

  const [xPct, yPct, wPct, hPct] = slot.bbox
  const style = {
    position: 'absolute' as const,
    left:   `${xPct}%`,
    top:    `${yPct / (PAGE_H/PAGE_W) * 100 * (PAGE_W/PAGE_H)}%`,
    width:  `${wPct}%`,
    height: `${hPct / (PAGE_H/PAGE_W) * 100 * (PAGE_W/PAGE_H)}%`,
  }
  return <div style={style}>...</div>
}
```

#### Dialogue Editor — SVG Native Rendering

```typescript
// MangaBubbleSVG - no foreignObject, pure SVG text
function MangaBubbleSVG({ bubble, displayW, displayH }) {
  const lines = wrapTextToLines(bubble.dialogue, bubble.bubbleSize.w, bubble.fontSize)

  switch (bubble.bubbleType) {
    case 'speech':
      return (
        <svg viewBox={`0 0 ${displayW} ${displayH}`} overflow="visible">
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
            fill={fillColor} stroke={strokeColor} strokeWidth={2} />
          <polygon points={tailPts()} fill={fillColor} stroke={strokeColor} strokeWidth={2} />
          <SvgText lines={lines} cx={cx} cy={cy} fontSize={bubble.fontSize} />
        </svg>
      )
    case 'shout':
      // Spiky polygon (12 spikes)
    case 'sfx':
      // paintOrder="stroke fill" for manga outline effect
      // Uses Bangers font
  }
}
```

### 5.4 Triển khai pipeline sinh truyện end-to-end

**Step 1 — Story Analysis:**
1. Frontend gửi story text + config lên `/api/gemini/analyze-story-structured`
2. Backend gọi `GeminiService.generate_step1_stream()` với prompt phân tích có chapter outline
3. Gemini stream response → backend forward từng token qua SSE
4. Sau khi full response nhận được, backend parse `===JSON===` separator
5. JSON snapshot chứa chapter outline, nhân vật, page estimates lưu vào context

**Step 2 — Character Design:**
1. Backend nhận step1 JSON, tạo prompt mô tả từng nhân vật chi tiết
2. Stream design sheets (markdown) qua SSE
3. Frontend parse thành 5 sections, hiển thị accordion
4. User review, sau đó generate reference images qua SD server
5. IP-Adapter conditioning với reference image đăng ký theo tên nhân vật

**Step 3 — Panel Script:**
1. Backend nhận step1 + step2 JSON, generate kịch bản panel-level
2. Mỗi panel có: shot_type, dialogue_sfx, ai_image_prompt, description
3. Frontend parse theo cấu trúc: Chapter → Page → Panel
4. User có thể review và regenerate từng panel

**Step 4 — Image Generation:**
1. Khi user vào Step 4 lần đầu, `GenerationModeModal` hiện (comicPageMode = null) → user chọn Full Mode hoặc Panel Mode
2. **Panel Mode:** User chọn layout template → `confirm` API trả về panel slots với bbox + sd_dimensions → Canvas hiển thị wireframe theo bbox
3. Với mỗi panel/trang: frontend build prompt từ `aiImagePrompt` + composition hints
4. Gọi `/api/image-proxy` → SD server `/generate-page` với character_name
5. Mỗi API call được wrap trong `withRetry(3 attempts, 3s delay)` — tự retry khi lỗi transient
6. **Full Mode:** 1 ảnh composite/trang lưu trong `pageStates["page-N"]`; **Panel Mode:** 1 ảnh/panel lưu trong `panelStates[panel.id]`
7. Kết quả là base64 PNG data URL

**Step 5 — Dialogue & Export:**
1. User mở dialogue editor, drag bubble từ palette vào panel
2. Bubbles lưu vào MongoDB qua `PUT /api/bubbles/{panelId}`
3. Export: jszip/jspdf bundle tất cả panel images thành ZIP hoặc PDF

### 5.5 Các vấn đề kỹ thuật gặp phải và hướng giải quyết

#### Vấn đề 1: Duy trì nhất quán nhân vật

**Vấn đề:** Stable Diffusion sinh ảnh từ text prompt không đảm bảo nhân vật trông giống nhau giữa các panel, ngay cả với detailed character description trong prompt.

**Giải pháp:**
- IP-Adapter Plus Face v2: encode face embedding từ reference image, inject vào attention layers của diffusion model
- Server-side character registration: `POST /characters/save` lưu embedding theo `(story_id, character_name)`
- Generate call gửi `character_name` thay vì gửi reference image base64 mỗi lần (giảm payload, tái dùng embedding)

**Hạn chế còn lại:** IP-Adapter scale 0.6 là trade-off — scale cao giữ face consistency nhưng giảm diversity của scene; scale thấp thì ngược lại.

#### Vấn đề 2: SSE và Cloudflare 524 Timeout

**Vấn đề:** Gemini Step 1 analysis có thể mất 2-3 phút. Khi có Cloudflare/nginx trước, connection bị close sau 60-100s → client thấy timeout dù backend đang chạy.

**Giải pháp:**
- SSE stream: first token gửi trong vài giây đầu → Cloudflare/nginx biết connection vẫn active
- `X-Accel-Buffering: no` header để nginx không buffer SSE
- `Cache-Control: no-cache` + `Connection: keep-alive`
- Single LLM call thay vì chained calls → tránh "silent gap" giữa các bước

#### Vấn đề 3: MongoDB Document Size Limit (16MB)

**Vấn đề:** Page images (base64 PNG) có thể đạt 500KB-1MB mỗi trang. 20 trang = 10-20MB > MongoDB 16MB limit.

**Giải pháp:** Page images không bao giờ được lưu vào MongoDB. Chỉ lưu:
- Character reference images (1 selected candidate per character, ~300-500KB)
- Panel metadata (text only)
- Bubble data

Sau khi load project, user phải generate lại images. Đây là trade-off đã được document rõ ràng.

#### Vấn đề 4: passlib + bcrypt incompatibility

**Vấn đề:** `passlib` với `bcrypt >= 4.0` throw `ValueError: password cannot be longer than 72 bytes` trong internal test, làm 500 Internal Server Error che mất bởi CORS error (ServerErrorMiddleware wrap CORS headers).

**Giải pháp:** Thay passlib bằng direct bcrypt API:
```python
# security.py
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False
```

#### Vấn đề 5: PyMongo Synchronous trong FastAPI Async

**Vấn đề:** FastAPI là ASGI (async), nhưng PyMongo là synchronous. Gọi PyMongo trong `async def` handler sẽ block event loop.

**Giải pháp hiện tại:** FastAPI tự động chạy synchronous code trong thread pool khi gọi từ `async def`. Đây chấp nhận được với concurrent load thấp-trung bình (< 100 concurrent users).

**Giải pháp tốt hơn (chưa triển khai):** Migrate sang Motor (async MongoDB driver) — nhưng đòi hỏi rewrite tất cả DB calls.

#### Vấn đề 6: `layout_name` vs `suggested` field naming

**Vấn đề:** API `POST /comic-layout/suggest` trả về field tên `suggested`, nhưng frontend ban đầu access `layoutSuggestion.layout_name` → undefined.

**Giải pháp:** Kiểm tra type definition trong `api.ts`:
```typescript
interface SuggestLayoutResponse {
  suggested: string;        // ← correct field name
  alternatives: string[];
  rationale: string;
}
```
Luôn đối chiếu field names với Pydantic response model trong backend.

#### Vấn đề 7: Per-character reference image từ nhiều nguồn (Library / Community / File)

**Bối cảnh:** IP-Adapter đòi hỏi `reference_image_b64` — ảnh PNG base64 gửi lên SD server cùng character name để encode face embedding. Ban đầu chỉ hỗ trợ upload file ở tab-level, áp dụng cho tất cả characters. Yêu cầu mới: mỗi character có thể chọn reference riêng từ 3 nguồn — file upload, character library, community gallery.

**Thiết kế — modal target state pattern:**

Thay vì mở 3 modal riêng lẻ, một modal duy nhất (CharacterLibraryModal / GalleryModal) phục vụ cả tab-level lẫn per-character bằng `targetId` string sentinel:

```typescript
// null = closed; '__all__' = tab-level; charId = specific character
const [libraryTargetCharId, setLibraryTargetCharId] = useState<string | null>(null);
const [galleryTargetCharId, setGalleryTargetCharId] = useState<string | null>(null);
const isLibraryOpen = libraryTargetCharId !== null;
const isGalleryOpen = galleryTargetCharId !== null;
```

- Tab toolbar buttons: `setLibraryTargetCharId('__all__')` — áp dụng cho tất cả chars chưa có reference
- Per-character buttons (trong `GenerationModePanel`): `setLibraryTargetCharId(charId)` — áp dụng chỉ cho character đó

**Handler `handleAddReferenceFromPicker`:**

```typescript
const handleAddReferenceFromPicker = useCallback(async (chars: CharacterSummary[]) => {
  const picked = chars.find((c) => !!c.selected_image_url);
  if (!picked?.selected_image_url) return;
  const targetId = libraryTargetCharId ?? galleryTargetCharId;
  try {
    const base64 = await fetchImageBase64(picked.selected_image_url);
    setCharSettings((prev) => {
      const next = { ...prev };
      const applyTo = targetId === '__all__'
        ? characters.filter((c) => !next[c.characterId]?.referenceImageBase64)
        : characters.filter((c) => c.characterId === targetId);
      for (const char of applyTo) {
        const id = char.characterId;
        const existing = next[id];
        next[id] = {
          mode: existing?.mode === 1 ? 2 : (existing?.mode ?? 2), // auto-upgrade text-only → +Ref
          referenceImageBase64: base64,
          controlImageBase64: existing?.controlImageBase64 ?? '',
          ipAdapterScale: existing?.ipAdapterScale ?? 0.7,
          controlnetScale: existing?.controlnetScale ?? 0.8,
          characterName: existing?.characterName ?? char.name,
          storyId: existing?.storyId,
          style: existing?.style,
          width: existing?.width,
          height: existing?.height,
        };
      }
      return next;
    });
  } catch { /* silently ignore fetch failures */ }
}, [libraryTargetCharId, galleryTargetCharId, characters, fetchImageBase64]);
```

**Prop threading qua 3 tầng component:**

```
Step2Characters
  └─ CharacterAccordionCard   (onPickReferenceFromLibrary, onPickReferenceFromCommunity, onUseAsCharacterImage)
       └─ ImageGenPanel       (same 3 props)
            └─ GenerationModePanel (renders buttons trong ref section khi showRef=true)
```

Prop threading qua 3-4 tầng là phù hợp ở scale này (tối đa 5 characters) — không thêm Context riêng tránh over-engineering.

**"Use as character image" — bypass AI generation hoàn toàn:**

Khi reference image đã được set, nút "Use as character image" gọi `addCandidateFromImage(charId, base64)` trong context:

```typescript
const addCandidateFromImage = (characterId: string, imageDataUrl: string) => {
  const candidateId = crypto.randomUUID();
  setStep2ImageReview((prev) => {
    if (!prev.data) return prev;
    return {
      ...prev,
      data: {
        ...prev.data,
        characters: prev.data.characters.map((c) => {
          if (c.characterId !== characterId) return c;
          const newCandidate: CharacterImageCandidate = {
            id: candidateId,
            imageUrl: imageDataUrl,  // data:image/png;base64,...
            createdAt: new Date().toISOString(),
          };
          return {
            ...c,
            status: 'success' as CharacterImageStatus,
            candidates: [...c.candidates, newCandidate],
            selectedCandidateId: candidateId,
          };
        }),
      },
    };
  });
};
```

Toàn bộ xử lý xảy ra client-side: không có API call thêm. `data:` URL hoạt động trực tiếp trong `<img src>`. Người dùng dùng ảnh thực tế từ library/gallery làm pipeline character image mà không chạy Stable Diffusion.

#### Vấn đề 8: UI Consistency — ProjectsDrawer & Publish Page

**Vấn đề:** `ProjectsDrawer` component (sidebar drawer bên phải) có visual language không nhất quán với Studio: border radius, spacing, và action buttons không match Material Design tokens của app.

**Giải pháp — ProjectsDrawer overhaul:**
- `rounded-2xl` cho cards (thống nhất với chuẩn của app)
- `bg-surface-container-lowest / border border-outline-variant/20` pattern
- `hover:shadow-md hover:translate-y-[-2px]` micro-animation (nhất quán)
- Steps badges trực quan: `has_step1` → `has_step2` → `has_step3` → `has_step4`
- 3-dot menu (⋮ MoreVertical icon) thay inline buttons → giảm visual clutter

**Publish page — portal context menu:**

Trang `/studio/publish-history` hiển thị lịch sử publish. Context menu (3-dot) dùng `ReactDOM.createPortal` để render vào `document.body`, tránh bị clip bởi parent `overflow-hidden`:

```typescript
const [menuOpen, setMenuOpen] = useState(false);
const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

const handleMenuClick = (e: React.MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  setMenuPos({ top: rect.bottom + 4, left: rect.left });
  setMenuOpen(true);
};

// Rendered via ReactDOM.createPortal(menuContent, document.body)
```

Pattern này tái sử dụng được ở bất kỳ component nào cần floating menu trong scrollable/overflow container.

---

## CHƯƠNG 6: KIỂM THỬ VÀ ĐÁNH GIÁ

### 6.1 Chiến lược kiểm thử

Hệ thống không có CI/CD pipeline. Kiểm thử thực hiện thủ công kết hợp với script test.

**Phân loại kiểm thử:**

| Loại | Công cụ | Phạm vi |
|---|---|---|
| Smoke test (Backend auth) | `backend/scripts/auth_smoke.py` | Register, login, JWT verify |
| Integration test (Gemini) | `backend/test_gemini_integration.py` | LLM API connectivity |
| Pipeline integration | `backend/test_text_to_comic_pipeline.py` | Full Step 1→4 pipeline |
| Layout test | `backend/test_layouts.py` | 14 templates + 8 procedural |
| TypeScript type check | `npx tsc --noEmit` | Zero compile errors |
| ESLint | `npm run lint` | Code style |
| Manual UI | Browser | Feature correctness |

### 6.2 Kiểm thử chức năng

#### 6.2.1 Test case chính

**TC-01: Đăng ký và đăng nhập**

| Step | Input | Expected |
|---|---|---|
| Register | `{first_name, last_name, email, password}` | 201, `{access_token, user}`, cookie set |
| Register (duplicate email) | Same email | 409 Conflict |
| Login | `{email, password}` | 200, cookie set |
| Login (wrong password) | Wrong password | 401 |
| GET /auth/me | Cookie | 200, `{user: {id, email, providers}}` |

**TC-02: Phân tích câu chuyện (Step 1)**

| Step | Input | Expected |
|---|---|---|
| POST /gemini/analyze-story-structured | Story text, stream=true | SSE stream bắt đầu < 3s |
| Receive tokens | — | `type: "token"` events liên tục |
| Stream complete | — | `type: "done"` với `analysis` và `structured_json` |
| Retry after 429 | Rapid requests | 429 với `retry_after_seconds` |

**TC-03: Layout confirm và canvas render**

| Step | Input | Expected |
|---|---|---|
| POST /comic-layout/confirm | `{panel_count: 4, layout_name: "grid_2x2"}` | `{panels: [{id, bbox, polygon, sd_width, sd_height}]}` |
| Verify bbox | — | All bbox values sum to fill page (within gutter/margin) |
| Verify sd_dimensions | — | `sd_width * sd_height` multiples of 8 |
| Unknown layout | `layout_name: "invalid"` | 400 with available layouts list |

**TC-04: Lưu và tải project**

| Step | Input | Expected |
|---|---|---|
| POST /projects/save | Full project state, `X-User-Id` header | 200, upsert success |
| GET /projects/ | `X-User-Id` | List với step badges (`has_step1`, `has_step2`, ...) |
| GET /projects/{id} | project_id | Full project JSON matching saved |
| Load in context | Loaded JSON | All steps restored, approvals intact |

#### 6.2.2 Kết quả kiểm thử chức năng

Tất cả 14 layout templates pass test (`test_layouts.py`):
```
✓ grid_2x2 (4 panels)
✓ three_panels_row (3 panels)
✓ one_large_two_small (3 panels)
✓ splash_top (4 panels)
✓ action_dynamic_4 (4 panels)
... (14/14 pass)

8 procedural layouts: 8/8 pass
```

TypeScript: `npx tsc --noEmit` → 0 errors (maintained throughout development)

### 6.3 Kiểm thử phi chức năng

#### 6.3.1 Kiểm thử hiệu năng

| Metric | Đo được | Ghi chú |
|---|---|---|
| First SSE token (Step 1) | ~1.5-3s | Gemini cold start |
| Full Step 1 stream | ~60-90s | ~20 pages story |
| Image generation (SD) | ~30-60s/panel | Phụ thuộc GPU server |
| Layout confirm API | < 50ms | Không có LLM call |
| Project save/load | < 200ms | MongoDB read/write |
| Frontend initial load | Next.js auto-split | Code splitting theo route |

#### 6.3.2 Kiểm thử bảo mật

| Test case | Kết quả |
|---|---|
| JWT invalid signature | 401 Unauthorized |
| JWT expired | 401 Unauthorized |
| Missing X-User-Id | Project endpoints return empty list (không có cross-user data leak) |
| CORS wrong origin | 403 blocked by CORSMiddleware |
| Rate limit bypass (rapid calls) | 429 sau request thứ 3 trong cùng giây |
| Admin key wrong | 403 Forbidden |
| SQL injection in project_id | PyMongo parameterized queries — safe |
| XSS via story text | React auto-escapes; bubble dialogue rendered as SVG text — safe |

#### 6.3.3 Kiểm thử khả năng chịu tải

Không có load testing tool configured. Giới hạn thiết kế:
- Rate limiter: max 8 concurrent Gemini requests (toàn server)
- PyMongo sync: thread pool có thể bị exhaust với > 50 concurrent DB users
- MongoDB: local instance, không HA, không replica set

### 6.4 Đánh giá chất lượng đầu ra

#### 6.4.1 Đánh giá tính nhất quán nhân vật

**Phương pháp thu thập:**
- Admin dashboard `GET /api/admin/characters` tổng hợp:
  - Rating per version (V1, V2, V3+)
  - Reaction distribution (love/good/neutral/bad)
  - V1→V2 improvement %
  - Character funnel (generated → rated → regenerated → approved)

**Metrics:**
- Reaction score: love=4, good=3, neutral=2, bad=1
- Version quality improvement: trung bình +X% từ V1 → V2 (cần data)
- Character chip complaints: top-N issues (hair, eyes, outfit, etc.)

#### 6.4.2 Đánh giá chất lượng bố cục trang truyện

**Phương pháp:**
- Panel ratings (`POST /api/ratings/panel`) thu thập emoji reaction per panel
- Admin analytics aggregates by page/chapter
- Pearson r correlation: char quality vs panel quality

**Layout quality metrics:**
- Panel coverage: tổng diện tích panels / tổng diện tích trang (trừ gutter/margin)
- Diagonal panel accuracy: cover-crop + polygon mask không có white borders
- SD dimension accuracy: sd_width/sd_height exact fit vào panel bbox

#### 6.4.3 So sánh với các công cụ hiện có

| Tiêu chí đánh giá | mOhiOm | AI Comic Factory | ComicsMaker |
|---|---|---|---|
| Chất lượng narrative (1-5) | 4.2 | 2.1 | 3.0 |
| Nhất quán nhân vật (1-5) | 3.8 | 1.5 | 2.8 |
| Đa dạng bố cục trang | 14+ templates | 4 fixed | ~8 templates |
| Pipeline liên kết | Đầy đủ | Không | Không |
| Thời gian tạo 1 chapter | ~15-20 phút | ~2 phút | ~5 phút |
| Kiểm soát tùy chỉnh | Cao | Thấp | Trung bình |

*Lưu ý: Điểm chất lượng narrative và nhân vật là ước tính dựa trên đánh giá chủ quan của nhóm nghiên cứu — cần bổ sung user study với N >= 10 người dùng.*

### 6.5 Nhận xét và thảo luận

**Điểm mạnh:**
1. Pipeline tích hợp đầy đủ — người dùng không cần switch giữa nhiều tool
2. SSE streaming UX — feedback real-time làm giảm perceived wait time đáng kể
3. Hệ thống bố cục polygon linh hoạt — 14+ mẫu, hỗ trợ diagonal panels
4. TypeScript strict + Pydantic v2 — type safety end-to-end
5. Auto-retry cơ chế — giảm failure rate thực tế do lỗi mạng/API tạm thời
6. Hai chế độ sinh ảnh — Full Mode (nhanh hơn, layout đồng nhất) và Panel Mode (kiểm soát từng panel)
7. Per-character reference image system — tích hợp library/community/file upload per-character; "Use as character image" bypass SD generation hoàn toàn
8. Consistent Material Design token system — toàn bộ UI dùng `var(--color-*)` tokens, dễ theming

**Hạn chế:**
1. IP-Adapter consistency vẫn còn noise — giải quyết 70-80% consistency, không 100%
2. Gemini prompt tuning cho tiếng Việt chưa được tối ưu
3. Single-threaded MongoDB access có thể là bottleneck ở scale
4. Không có automated test suite
5. Page images không persistent sau save/load — phải regenerate hoàn toàn
6. Không có mobile layout — UI chỉ optimize cho desktop (min-width ~1200px)

---

## CHƯƠNG 7: KẾT LUẬN

### 7.1 Tóm tắt kết quả đạt được

1. **Hệ thống hoạt động end-to-end**: từ văn bản → phân tích → thiết kế nhân vật → kịch bản → sinh ảnh → export, trong một giao diện web thống nhất
2. **LLM integration**: 4 streaming endpoints với SSE, fallback provider support
3. **Layout engine**: 14+ manga layout templates với polygon precision và diagonal support
4. **Character consistency**: IP-Adapter integration via character name registration
5. **Community features**: gallery, ratings, analytics
6. **Dual generation modes**: Full Mode (composite page) và Panel Mode (per-panel), với automatic 3-attempt retry
7. **Export đa dạng**: ZIP, PDF (pdf-lib, native resolution), EPUB (chuẩn EPUB 3.0)
8. **Client-side analytics**: Chart.js dashboard theo dõi panels generated, export rate, style/mood distribution
9. **Hệ thống nhập reference ảnh đa nguồn**: per-character reference image từ file upload, character library, community gallery; "Use as character image" bypass AI generation hoàn toàn
10. **Codebase chất lượng**: ~8500 LOC frontend TypeScript, ~5000 LOC backend Python, zero TS errors

### 7.2 Hạn chế của hệ thống

1. **Character consistency không hoàn hảo**: IP-Adapter giảm variance nhưng không eliminate
2. **Phụ thuộc GPU server ngoài**: không có built-in image generation — cần SD server riêng
3. **MongoDB không phù hợp HA**: single instance, không replica set, không sharding
4. **PyMongo synchronous**: potential event loop blocking với high concurrency
5. **Không có mobile layout**: UI chỉ optimize cho desktop
6. **Page images không persistent**: phải regenerate sau khi load project

### 7.3 Hướng phát triển tiếp theo

1. **Self-hosted SD server**: Docker image với SD 1.5 + IP-Adapter tích hợp sẵn, không phụ thuộc external GPU server. Sẽ giải quyết vấn đề latency và availability hiện tại.

2. **Motor (async MongoDB)**: Migrate toàn bộ PyMongo calls sang Motor driver để tránh blocking FastAPI event loop. Đây là bottleneck kiến trúc quan trọng nhất khi scale > 100 concurrent users.

3. **Panel consistency improvement**: 
   - Fine-tune IP-Adapter scale per character type (faces vs. full-body vs. objects)
   - Face detection verification sau generation — tự động retry nếu face không detect được
   - Ensemble approach: kết hợp IP-Adapter + textual inversion embedding

4. **Mobile-first responsive**: Breakpoints cho tablet (768px) và mobile (375px). StudioSidebar collapse thành bottom navigation bar trên mobile. Comic canvas pinch-to-zoom.

5. **Multi-user collaboration**: 
   - Shared project via invite link (read-only hoặc edit)
   - Conflict resolution: OT (Operational Transform) cho simultaneous edits
   - Presence indicators (who is viewing/editing which panel)

6. **Panel export quality — html2canvas composite**: 
   - Hiện tại panel images là PNG từ SD; dialogue bubbles là SVG overlay riêng
   - Export thực sự nên composite cả hai → html2canvas + canvas.toBlob → high-res PNG
   - Hoặc dùng Puppeteer server-side cho pixel-perfect export

7. **SDXL / SD 3.0 upgrade**: 
   - SDXL 1.0 (1024×1024 native) cho chất lượng cao hơn đáng kể
   - SD 3.0 với triple-text encoder (CLIP-L, CLIP-G, T5-XXL) cho prompt adherence tốt hơn

8. **Expand LLM support**: 
   - Claude Sonnet/Opus qua 9Router đã có infrastructure (NINE_ROUTER_URL env)
   - GPT-4o vision để analyze reference images và generate better character prompts
   - Multilingual prompt support (tiếng Việt → auto-translate sang English prompt cho SD)

9. **Persistent page images với cloud storage**:
   - Upload generated panel images lên S3/Cloudflare R2
   - Lưu URL thay vì base64 trong MongoDB
   - Xóa 16MB limit issue hoàn toàn

10. **Automated test suite**:
    - Vitest cho frontend unit tests
    - Playwright cho E2E UI tests (toàn bộ Step 1→4 flow)
    - pytest với fixtures cho backend integration tests

---

## PHỤ LỤC

### Phụ lục A: Đặc tả Use Case chi tiết

#### UC-01: Đăng ký tài khoản

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng mới (chưa có tài khoản) |
| Tiền điều kiện | Người dùng chưa đăng nhập; có email hợp lệ |
| Hậu điều kiện | Tài khoản được tạo; JWT cookie được set; người dùng redirect đến `/studio` |

**Main flow:**
1. Người dùng điền form: first_name, last_name, email, password
2. Frontend POST `/api/auth/register`
3. Backend validate email unique (nếu duplicate → 409)
4. Backend hash password bằng bcrypt với salt
5. Backend tạo user document trong MongoDB: `{first_name, last_name, email, hashed_password, created_at, providers: []}`
6. Backend tạo JWT access token (HS256, 24h expiry), set cookie `access_token`
7. Frontend redirect đến `/studio`

**Alternative flows:**
- Email đã tồn tại → 409 Conflict, hiển thị lỗi "Email already registered"
- Password < 8 ký tự → 422 Validation Error
- Network error → hiển thị toast "Registration failed, please try again"

#### UC-02: Đăng nhập bằng Google OAuth

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng có Google account |
| Tiền điều kiện | OAUTH_GOOGLE_CLIENT_ID/SECRET được configure |
| Hậu điều kiện | User được tạo hoặc link, JWT cookie set |

**Main flow:**
1. Người dùng click "Continue with Google" trên `/auth/login`
2. Frontend redirect đến `/api/auth/google/login`
3. Backend redirect đến Google OAuth consent screen (scope: openid, email, profile)
4. Google redirect về `/api/auth/google/callback?code=...`
5. Backend exchange code → Google access token → user info
6. Nếu email đã tồn tại: link provider vào user; nếu chưa: tạo mới
7. Backend set JWT cookie, redirect đến `AUTH_FRONTEND_URL/studio`

#### UC-03: Tạo comic từ văn bản (End-to-end flow)

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng đã đăng nhập |
| Tiền điều kiện | Đã có story text; Gemini API key hợp lệ |
| Hậu điều kiện | Comic page được tạo với layout + panel images + dialogue bubbles |

**Main flow:**
1. [Step 1] Người dùng dán story text, chọn language/tone/page count → "Analyze Story"
2. Backend stream analysis qua SSE → frontend hiển thị chapter outline, characters, page count
3. Người dùng review và approve Step 1
4. [Step 2] Frontend gọi "Generate Character References" — SD server tạo reference images
5. Người dùng review candidates, select best per character, approve Step 2
6. [Step 3] Backend generate panel script (structured JSON: Chapter→Page→Panel)
7. Người dùng review script, approve Step 3
8. [Step 4] Người dùng chọn layout template per page → confirm → generate panel images
9. [Dialogue] Người dùng drag & drop speech bubbles, nhập dialogue
10. [Export] Người dùng export ZIP/PDF/EPUB

#### UC-04: Upload reference image cho character

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng đang ở Step 2 (Characters) |
| Tiền điều kiện | Ít nhất 1 pipeline character đã được generate |
| Hậu điều kiện | `charSettings[charId].referenceImageBase64` được set; mode tự động upgrade lên +Ref nếu cần |

**Main flow (per-character):**
1. Người dùng mở accordion của character cụ thể
2. Trong GenerationModePanel, chọn tab "+Ref" hoặc "All"
3. Click "From Library" → CharacterLibraryModal mở với `targetId = charId`
4. Người dùng tìm kiếm và chọn character, click Confirm
5. `handleAddReferenceFromPicker` fetch image URL → base64 → set `charSettings[charId].referenceImageBase64`
6. Thumbnail xuất hiện trong ref section; nút "Use as character image" hiện
7. Nếu người dùng click "Use as character image": `addCandidateFromImage` tạo candidate với data URL, tự select

**Alternative: "Use as character image":**
- Reference image được set → người dùng không muốn chạy SD
- Click "Use as character image" → image trở thành selected candidate trong `step2ImageReview`
- Bỏ qua toàn bộ SD generation cho character đó

#### UC-05: Export ZIP

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng đã generate xong panel images |
| Tiền điều kiện | Ít nhất 1 page có panel image; jszip được load |
| Hậu điều kiện | File `comic-[date].zip` được download về máy |

**Main flow:**
1. Người dùng click "Export ZIP" trên ComicEditor toolbar
2. Frontend collect tất cả `panelStates[panel.id].imageDataUrl` (Panel Mode) hoặc `pageStates[page-N].imageDataUrl` (Full Mode)
3. jszip tạo zip với structure: `page-1/panel-1.png`, `page-1/panel-2.png`, ...
4. `zip.generateAsync({type: 'blob'})` → `URL.createObjectURL` → trigger download

#### UC-06: Lưu và tải project

| Thuộc tính | Giá trị |
|---|---|
| Actor | Người dùng đã đăng nhập |
| Tiền điều kiện | X-User-Id header hợp lệ |
| Hậu điều kiện | Project được upsert trong MongoDB `projects` collection |

**Main flow (Save):**
1. Người dùng click "Save" trong StudioSidebar hoặc PublishButton
2. `ComicGenerationContext.saveProject()` serialize toàn bộ state: `{step1Data, step2Data, step3Data, step4Metadata, charSettings, confirmedLayouts, bubbles}`
3. POST `/api/projects/save` với JSON payload (trừ panel images)
4. Backend upsert `{user_id, project_data, updated_at, step_badges}` trong MongoDB

**Main flow (Load):**
1. Người dùng mở ProjectsDrawer → click vào project
2. GET `/api/projects/{id}` → full JSON
3. Context restore toàn bộ state: step approvals, char settings, layouts
4. Panel images KHÔNG được restore — người dùng phải regenerate

### Phụ lục B: Danh sách API Endpoint đầy đủ

**Tổng số endpoints: ~50**

| Router | Prefix | Số endpoints |
|---|---|---|
| auth | `/api/auth` | 9 |
| gemini | `/api/gemini` | 10 |
| comic_generation | `/api/comic-layout` | 6 |
| projects | `/api/projects` | 11 |
| bubbles | `/api/bubbles` | 3 |
| ratings | `/api/ratings` | 6 |
| gallery | `/api/gallery` | 3 |
| analytics | `/api/analytics` | 1 |
| admin_analytics | `/api/admin` | 6 |
| text_to_comic | `/api/text-to-comic` | varies |
| items | `/api/items` | 5 |

### Phụ lục C: Hướng dẫn cài đặt và triển khai

#### Local Development

```bash
# 1. MongoDB (macOS với brew)
brew services start mongodb-community@7.0

# 2. Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: GEMINI_API_KEY, JWT_SECRET_KEY
uvicorn app.main:app --reload
# → http://localhost:8000

# 3. Frontend
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev
# → http://localhost:3000
```

#### Docker Compose

```bash
cd mOhiOm
docker-compose up -d
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# MongoDB:  localhost:27017
#   user: mohiom_user / pass: mohiom_password / db: mohiom_db
```

#### Environment Variables (Backend `.env`)

```bash
GEMINI_API_KEY=your_google_gemini_api_key
JWT_SECRET_KEY=your-long-random-secret-key-change-in-production
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
CORS_ORIGINS=["http://localhost:3000"]

# Optional: 9Router LLM fallback (replaces Gemini when set)
NINE_ROUTER_URL=
NINE_ROUTER_API_KEY=
NINE_ROUTER_MODEL=kr/claude-sonnet-4.5

# Optional: OAuth
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
AUTH_FRONTEND_URL=http://localhost:3000
AUTH_BACKEND_URL=http://localhost:8000

# Optional: Email (password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=app_password
SMTP_FROM=noreply@yourdomain.com

# Rate limiting
GEMINI_REQUESTS_PER_SECOND=2
GEMINI_MAX_QUEUE_SIZE=8
GEMINI_MAX_QUEUE_WAIT_SECONDS=8
```

---

## TÀI LIỆU THAM KHẢO (gợi ý)

1. **Gemini API**: Google. (2024). *Gemini API Documentation*. Google DeepMind.
2. **IP-Adapter**: Ye, H., et al. (2023). *IP-Adapter: Text Compatible Image Prompt Adapter for Text-to-Image Diffusion Models*. arXiv:2308.06721.
3. **ControlNet**: Zhang, L., et al. (2023). *Adding Conditional Control to Text-to-Image Diffusion Models*. ICCV 2023.
4. **FastAPI**: Ramírez, S. (2018-present). *FastAPI Documentation*. Tiangolo.
5. **Next.js**: Vercel. (2024). *Next.js 14 App Router Documentation*.
6. **Pydantic**: Colvin, S., et al. (2024). *Pydantic v2 Documentation*.
7. **Stable Diffusion**: Rombach, R., et al. (2022). *High-Resolution Image Synthesis with Latent Diffusion Models*. CVPR 2022.
8. **Prompt Engineering**: White, J., et al. (2023). *A Prompt Pattern Catalog to Enhance Prompt Engineering with ChatGPT*. arXiv:2302.11382.
9. **SSE specification**: W3C. (2015). *Server-Sent Events*. W3C Recommendation.
10. **MongoDB**: MongoDB Inc. (2024). *MongoDB Manual 7.0*.
11. **JWT**: Jones, M., et al. (2015). *JSON Web Token (JWT)*. RFC 7519. IETF.
12. **bcrypt**: Provos, N., Mazières, D. (1999). *A Future-Adaptable Password Scheme*. USENIX 1999.
13. **React**: Facebook. (2024). *React 18 Documentation*.
14. **Tailwind CSS**: Wathan, A. (2024). *Tailwind CSS v3 Documentation*.

---

*Tài liệu này được tạo tự động từ codebase thực tế của hệ thống mOhiOm tính đến ngày 2026-06-27.*
*Các con số về thời gian xử lý, điểm chất lượng là ước tính — cần bổ sung số liệu thực nghiệm.*
