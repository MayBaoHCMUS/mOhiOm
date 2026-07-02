# CI/CD cho mOhiOm — thiết kế, cài đặt và cách trình bày trong khoá luận

> Cập nhật: 07/2026. Pipeline CI đã được cài đặt thật tại `.github/workflows/ci.yml`. Tài liệu này giải thích thiết kế, các bước còn lại phải làm trên GitHub/Vercel/Render, và gợi ý cách viết vào khoá luận.

## 1. Bức tranh tổng thể

```
              PUSH / PULL REQUEST lên GitHub
                          │
            ┌─────────────┴─────────────┐
            ▼        CI (GitHub Actions) ▼
   Job "frontend"                Job "backend"
   • npm ci                      • pip install -r requirements.txt
   • ESLint                      • python -m compileall app
   • tsc --noEmit                • import app.main
   • next build                  • boot smoke: uvicorn + Mongo 7
                                   (service container) + curl /health
            └─────────────┬─────────────┘
                          ▼  cả hai xanh → được merge vào main
                    (branch protection)
                          │
            ┌─────────────┴─────────────┐
            ▼         CD (tự động)      ▼
   Vercel Git integration        Render autodeploy
   build & deploy frontend       deploy backend
   mỗi lần main thay đổi         (bật "After CI checks pass")
```

Nguyên tắc thiết kế: **CI kiểm cái gì kiểm được mà không cần bí mật (secrets), CD giao cho platform làm** — Vercel và Render đều có sẵn cơ chế deploy-on-push nên không cần tự viết bước deploy bằng Actions, ít điểm hỏng hơn và không phải nhét token deploy vào repo.

## 2. Vì sao pipeline được thiết kế như vậy (ràng buộc của chính repo này)

Ba ràng buộc thực tế quyết định hình dạng pipeline:

1. **Backend không có linter/formatter** (không ruff, black, mypy — quy ước của dự án là không tự thêm). Vì vậy CI backend không chạy lint mà kiểm ba tầng tăng dần: cài được dependency → mọi module biên dịch được (`compileall` bắt lỗi cú pháp) → ứng dụng **khởi động thật** với MongoDB 7 trong service container và trả `/health` 200. Bước boot smoke này bắt được lỗi mà import tĩnh không thấy: hỏng chuỗi kết nối, lỗi tạo index `project_images` lúc lifespan, thiếu dependency lúc runtime.
2. **Các bài test tích hợp hiện có (`test_gemini_integration.py`, `test_text_to_comic_pipeline.py`, `auth_smoke.py`) cần dịch vụ AI sống và khoá API** — kết quả không quyết định (non-deterministic) và tốn tiền mỗi lần chạy. Chúng **không thuộc CI theo PR**; giữ ở chế độ chạy tay trước khi release (đúng chiến lược hai nhánh deterministic/AI đã viết ở Chương 6 khoá luận). Nếu muốn tự động hoá về sau: tách thành workflow riêng chạy `workflow_dispatch` (bấm tay) với `GEMINI_API_KEY` để trong GitHub Secrets.
3. **CI không cần secret nào**: `config.py` có default cho mọi biến môi trường nên app import và boot được với Mongo trống. Đây là lợi thế lớn — fork/PR từ ngoài vẫn chạy CI được mà không lộ khoá.

Một tiền đề đã phải xử lý: bật CI lần đầu làm lộ **toàn bộ nợ kỹ thuật tích tụ** — 1 lỗi TypeScript (TS7006 implicit any ở `AnalyticsDashboard.tsx`), 37 lỗi ESLint rải trên 15 file (biến/import không dùng, thiếu `key` prop trong iterator, `@ts-ignore` thay vì `@ts-expect-error`, biểu thức ba ngôi dùng làm câu lệnh, ký tự chưa escape trong JSX), và 2 trang auth (`/callback`, `/reset-password`) fail prerender vì gọi `useSearchParams()` không có Suspense boundary. **Tất cả đã được sửa** trong lần bật CI này: các biến không dùng đổi theo quy ước tiền tố `_` (cấu hình `varsIgnorePattern` trong `.eslintrc.json`), các lỗi thật (thiếu key, unused expression, Suspense) sửa đúng bản chất. Kết quả xác minh cục bộ: `npm run lint` 0 lỗi, `npx tsc --noEmit` 0 lỗi, `npm run build` thành công 30/30 trang, backend import + compileall sạch. Chi tiết này rất đáng kể lại trong khoá luận: *giá trị đầu tiên của CI không phải là chặn lỗi tương lai mà là phơi bày lỗi đang có*.

## 3. Các bước cài đặt (việc đã làm / việc bạn cần làm trên web)

### 3.1 ✅ Đã làm trong repo

- `.github/workflows/ci.yml` — hai job `frontend` và `backend` như sơ đồ trên, có cache npm/pip để chạy nhanh (~2–4 phút).
- Sửa lỗi TS tồn đọng để build xanh.

Chỉ cần commit + push là CI chạy ngay:

```bash
git add .github/workflows/ci.yml frontend/src/components/AnalyticsDashboard.tsx
git commit -m "ci: add GitHub Actions pipeline (frontend lint/typecheck/build, backend boot smoke)"
git push
```

### 3.2 Bật branch protection (trên GitHub — 2 phút)

Repo → **Settings → Branches → Add branch ruleset** cho `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → chọn `Frontend — lint, typecheck, build` và `Backend — install, import, boot smoke`

Từ đây code hỏng không vào được `main`, tức là **không bao giờ được deploy** (vì CD deploy từ `main`).

### 3.3 Nối CD (nếu đã deploy theo `DEPLOYMENT.md`)

- **Vercel:** khi import repo, Git integration đã bật sẵn — mỗi push vào `main` tự build + deploy frontend; mỗi PR còn được cấp **Preview URL** riêng (rất tiện chụp hình demo cho khoá luận).
- **Render:** service → **Settings → Build & Deploy → Auto-Deploy** chọn **"After CI checks pass"** — Render chờ CI xanh trên commit đó rồi mới deploy backend. Đây chính là mắt xích biến CI thành *gate* của CD.
- (Tuỳ chọn phương án VPS: thêm job deploy bằng SSH — `appleboy/ssh-action` chạy `git pull && docker-compose up -d --build`, cần secret `SSH_KEY`. Chỉ làm nếu dùng phương án B.)

### 3.4 Kiểm tra hoạt động

1. Tạo nhánh, cố tình phá một kiểu dữ liệu TS, mở PR → check `frontend` phải đỏ, nút merge bị khoá.
2. Sửa lại → check xanh → merge → nhìn Vercel/Render tự deploy.
3. Chụp hai màn hình này — dùng làm hình minh hoạ trong khoá luận.

## 4. Nội dung workflow (để đối chiếu / trích vào phụ lục)

Xem file đầy đủ tại `.github/workflows/ci.yml`. Điểm đáng chú ý khi trích dẫn:

| Chi tiết | Lý do |
|---|---|
| `on: push (main) + pull_request` | PR nào cũng được kiểm; main luôn ở trạng thái deploy được |
| `cache: npm` / `cache: pip` | lần chạy sau chỉ ~2 phút thay vì ~5 |
| `services: mongo:7` | MongoDB thật (đúng phiên bản production) sống trong job, không cần mock |
| Boot smoke bằng `curl /health` lặp 20 lần | chờ uvicorn khởi động, fail rõ ràng nếu app không lên trong 20s |
| `NEXT_PUBLIC_API_URL` giả lúc build | biến `NEXT_PUBLIC_*` được nướng vào bundle lúc build; giá trị thật do Vercel đặt khi deploy |

## 5. Đưa CI/CD vào khoá luận như thế nào

Gợi ý vị trí trong `thesisInformation/KhoaLuan_Draft.md`:

- **Chương 5, mục 5.1 (Môi trường phát triển và công cụ):** thêm một đoạn ngắn — quy trình phát triển dùng GitHub Actions làm CI: mỗi pull request chạy tự động kiểm tra lint + typecheck + build production cho frontend và kiểm tra biên dịch + khởi động thật với MongoDB cho backend; nhánh `main` được bảo vệ bằng required status checks nên luôn ở trạng thái triển khai được (deployable).
- **Chương 6, mục 6.1 (Chiến lược kiểm thử):** nối vào luận điểm hai nhánh sẵn có — nhánh deterministic được *tự động hoá trong CI*, nhánh AI (cần dịch vụ sống, tốn phí, kết quả không định trước) giữ ở chế độ chạy tay có chủ đích. Đây là câu trả lời trực tiếp cho câu hỏi hội đồng hay hỏi: "vì sao không đưa hết test vào CI?"
- **Chương 6/7:** hạn chế cũ *"chưa có kiểm thử tự động tích hợp CI"* (mục 7.2, điểm 3) giờ có thể viết lại thành: CI đã phủ nhánh deterministic (lint, typecheck, build, boot smoke); phần còn thiếu là bộ test tự động cho logic nghiệp vụ (unit/integration test có assert) — thu hẹp hạn chế thay vì xoá hẳn, trung thực hơn.
- **Chương 4 (tuỳ chọn):** sơ đồ pipeline ở mục 1 tài liệu này có thể vẽ lại thành hình trong mục kiến trúc triển khai.

Đoạn văn mẫu (tiếng Việt, dán thẳng vào 5.1 được):

> Quy trình phát triển được hỗ trợ bởi cơ chế tích hợp liên tục (CI) trên GitHub Actions: mỗi lần đẩy mã hoặc mở pull request, hệ thống tự động kiểm tra chất lượng frontend (ESLint, kiểm tra kiểu TypeScript ở chế độ strict, build production) và khả năng vận hành của backend (cài đặt phụ thuộc, biên dịch toàn bộ mô-đun, khởi động ứng dụng thật kết nối tới MongoDB 7 chạy trong service container và xác nhận endpoint `/health`). Nhánh `main` được bảo vệ bằng ràng buộc "required status checks", bảo đảm mã hợp nhất luôn ở trạng thái triển khai được; khâu triển khai liên tục (CD) được uỷ thác cho tầng hạ tầng — Vercel tự động dựng và phát hành frontend, Render triển khai backend sau khi CI báo xanh. Đáng chú ý, ngay lần kích hoạt đầu tiên, pipeline đã phát hiện một lỗi kiểu dữ liệu tồn đọng trong mã nguồn — minh hoạ giá trị thực tế của việc đưa kiểm tra tự động vào quy trình.

## 6. Hướng mở rộng (nếu còn thời gian / cho phần "hướng phát triển")

- **Unit test có assert:** thêm `pytest` cho các hàm thuần backend (rate limiter, crypto_utils, panel_splitter) và `vitest` cho các hàm thuần frontend (`lib/export.ts`, `lib/analytics.ts`) — chạy được trong CI vì không cần dịch vụ ngoài.
- **Workflow chạy tay cho test AI:** `workflow_dispatch` + GitHub Secrets (`GEMINI_API_KEY`) chạy `test_gemini_integration.py` trước mỗi lần release.
- **E2E Playwright trong CI:** dựng cả stack bằng docker-compose trong job, chạy kịch bản wizard 5 bước với LLM được mock.
- **Deploy preview backend:** Render cũng hỗ trợ preview environment theo PR (gói trả phí) — ghi nhận như hướng mở rộng, không cần cho đồ án.
