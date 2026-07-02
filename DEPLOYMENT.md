# Hướng dẫn Deploy mOhiOm lên Internet

> Cập nhật: 07/2026. Tài liệu này khảo sát các lựa chọn hosting hiện tại, đề xuất phương án phù hợp cho đồ án, và hướng dẫn từng bước deploy.

## 0. Hệ thống gồm những gì cần deploy

| Thành phần | Công nghệ | Ghi chú deploy |
|---|---|---|
| Frontend | Next.js 14 (cổng 3000) | có 2 route proxy ảnh (`/api/manga-proxy`, `/api/image-proxy`) chạy như serverless function |
| Backend | FastAPI (cổng 8000) | có **SSE streaming** (phân tích truyện) → cần platform hỗ trợ kết nối HTTP dài |
| Database | MongoDB 7.0 | lưu cả ảnh base64 trong collection `project_images` → **tốn dung lượng nhanh** |
| Máy chủ sinh ảnh | GPU trên Kaggle + Cloudflare tunnel | **đã ở ngoài sẵn** — không cần deploy, người dùng cấu hình URL trong Settings |

---

## 1. Khảo sát lựa chọn (07/2026)

### Frontend (Next.js)

| Platform | Free tier | Nhận xét |
|---|---|---|
| **Vercel (Hobby)** ✅ | 100GB bandwidth/tháng, 100K function invocations | Làm ra Next.js nên tương thích tuyệt đối. Function mặc định timeout **10s**, bật Fluid Compute cho phép tới **60s trên gói free** — cần cho 2 route proxy ảnh (sinh 1 ảnh mất tới ~30s). Gói Hobby không cho dùng thương mại (đồ án thì OK). |
| Netlify / Cloudflare Pages | có | Chạy Next.js qua adapter, dễ lệch tính năng App Router — không đáng rủi ro khi Vercel free đủ dùng. |

### Backend (FastAPI)

| Platform | Free tier | Nhận xét |
|---|---|---|
| **Render** ✅ | 750 instance-hours/tháng (đủ chạy 24/7 một service) | Deploy thẳng từ GitHub, hỗ trợ SSE. Nhược: **ngủ sau 15 phút không có traffic, cold start ~30–60s**; **chặn cổng SMTP** (25/465/587) → email đặt lại mật khẩu không gửi được qua SMTP (xem mục 4.4). |
| Railway | ❌ hết free (chỉ $5 credit dùng thử một lần) | DX tốt nhất nhóm, tính tiền theo giây (~$5+/tháng cho app nhỏ). Đáng cân nhắc nếu chấp nhận trả phí. |
| Fly.io | ❌ hết free cho user mới, cần thẻ | Scale-to-zero tốt (cold start 300ms–2s), điều khiển Docker đầy đủ. |
| Koyeb | 1 instance free (512MB RAM, 0.1 vCPU) | Scale-to-zero bắt buộc, RAM hơi hẹp cho PyMongo + httpx nhưng chạy được. Phương án dự phòng nếu không thích Render. |

### Database (MongoDB)

| Lựa chọn | Free tier | Nhận xét |
|---|---|---|
| **MongoDB Atlas M0** ✅ | 512MB storage, 500 connections, vĩnh viễn | Đủ cho demo/bảo vệ đồ án **nếu hạn chế số dự án chứa ảnh**. Ảnh base64 ngốn dung lượng: một truyện 8 trang có thể chiếm 20–50MB → M0 chứa được khoảng 10–20 truyện đầy đủ ảnh. Nâng cấp: Atlas Flex (~$8+/tháng). |
| Mongo tự host trên VPS | — | Không giới hạn 512MB, đi kèm phương án B bên dưới. |

### Kết luận đề xuất

- **Phương án A (đề xuất — miễn phí 100%, hợp demo đồ án):** Vercel (frontend) + Render free (backend) + Atlas M0 (DB). Chấp nhận cold start và trần 512MB.
- **Phương án B (ổn định hơn, ~$4–6/tháng hoặc free bằng GitHub Student Pack):** một VPS duy nhất (Hetzner/DigitalOcean) chạy `docker-compose` có sẵn của repo + Caddy làm HTTPS. Không cold start, SSE thoải mái, Mongo không giới hạn 512MB. Sinh viên có thể lấy credit DigitalOcean qua [GitHub Student Developer Pack](https://education.github.com/pack).

---

## 2. Phương án A — deploy từng bước

### Bước 1: MongoDB Atlas

1. Tạo tài khoản tại [cloud.mongodb.com](https://cloud.mongodb.com) → Create Cluster → chọn **M0 Free**, region gần Render region bạn sẽ chọn (ví dụ đều ở Singapore/US-West).
2. **Database Access** → tạo user + mật khẩu (quyền `readWriteAnyDatabase`).
3. **Network Access** → Add IP → `0.0.0.0/0` (Render free không có IP tĩnh nên phải mở; bảo vệ bằng user/password mạnh).
4. Lấy connection string dạng:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/mohiom_db?retryWrites=true&w=majority`

### Bước 2: Backend lên Render

1. Đẩy code lên GitHub (nếu chưa).
2. [dashboard.render.com](https://dashboard.render.com) → **New → Web Service** → connect repo.
3. Cấu hình:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free
4. **Environment Variables** (mục Environment):

   ```
   GEMINI_API_KEY=<khoá thật>
   JWT_SECRET_KEY=<chuỗi ngẫu nhiên dài, KHÔNG dùng giá trị dev>
   MONGODB_URL=mongodb+srv://...   (từ Bước 1)
   DATABASE_NAME=mohiom_db
   CORS_ORIGINS=https://<app>.vercel.app
   AUTH_FRONTEND_URL=https://<app>.vercel.app
   AUTH_BACKEND_URL=https://<service>.onrender.com
   AUTH_COOKIE_SECURE=true
   AUTH_COOKIE_SAMESITE=none        # bắt buộc vì frontend/backend khác domain
   OAUTH_GOOGLE_CLIENT_ID=...       # nếu dùng OAuth
   OAUTH_GOOGLE_CLIENT_SECRET=...
   OAUTH_GITHUB_CLIENT_ID=...
   OAUTH_GITHUB_CLIENT_SECRET=...
   NINE_ROUTER_URL=...              # nếu dùng, nhớ: đặt biến này sẽ THAY THẾ Gemini hoàn toàn
   ```

   > Lưu ý cookie: vì `*.vercel.app` và `*.onrender.com` là hai site khác nhau, cookie đăng nhập chỉ hoạt động khi `AUTH_COOKIE_SAMESITE=none` + `AUTH_COOKIE_SECURE=true`. Đừng đặt `AUTH_COOKIE_DOMAIN`.

5. Deploy → thử `https://<service>.onrender.com/health` phải trả `{"status":"healthy"}`.
6. **Chống ngủ (tuỳ chọn):** tạo cron ping miễn phí (ví dụ [cron-job.org](https://cron-job.org)) gọi `/health` mỗi 10 phút. 750h free/tháng ≈ 31 ngày nên một service chạy 24/7 vẫn trong hạn mức.

### Bước 3: Frontend lên Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import repo.
2. Cấu hình:
   - **Root Directory:** `frontend`
   - Framework tự nhận Next.js, build mặc định (`npm run build`).
3. **Environment Variables:**

   ```
   NEXT_PUBLIC_API_URL=https://<service>.onrender.com/api
   NEXT_PUBLIC_API_LOGGING=false
   ```

4. **Nâng timeout cho 2 route proxy ảnh** (mặc định 10s sẽ chết khi sinh ảnh ~30s): thêm vào đầu `frontend/src/app/api/manga-proxy/route.ts` và `frontend/src/app/api/image-proxy/route.ts`:

   ```ts
   export const maxDuration = 60; // Fluid Compute: tối đa 60s trên gói free
   ```

   và bật **Fluid Compute** trong Project Settings → Functions (mặc định đã bật với project mới).
5. Deploy → nhận URL `https://<app>.vercel.app`.

### Bước 4: Việc sau khi deploy

**4.1 Cập nhật OAuth redirect URI** (nếu dùng đăng nhập Google/GitHub):
- Google Cloud Console → Credentials → thêm redirect URI: `https://<service>.onrender.com/api/auth/oauth/google/callback`
- GitHub → Settings → Developer settings → OAuth Apps → callback: `https://<service>.onrender.com/api/auth/oauth/github/callback`

**4.2 Kiểm tra CORS:** mở app Vercel, đăng ký tài khoản, xem tab Network không có lỗi CORS. Nếu có, kiểm tra lại `CORS_ORIGINS` (phải khớp đúng origin, có `https://`, không có `/` cuối).

**4.3 Máy chủ sinh ảnh:** vào **Settings → Image Generation** trong app, dán URL Cloudflare tunnel của server Kaggle như khi chạy local. (Lưu ý Kaggle restart sẽ đổi URL và mất truyện đã publish — hạn chế đã ghi trong khoá luận, mục 7.2.)

**4.4 Email đặt lại mật khẩu:** Render free **chặn cổng SMTP** nên `emailer.py` sẽ không gửi được mail qua SMTP thuần. Ba lựa chọn:
- Chấp nhận không có tính năng quên mật khẩu trong bản demo (đơn giản nhất);
- Chuyển `emailer.py` sang gọi HTTP API của [Resend](https://resend.com) (free 100 mail/ngày) hoặc SendGrid;
- Dùng phương án B (VPS) — không bị chặn cổng.

**4.5 Checklist nghiệm thu:**

- [ ] `/health` backend trả healthy
- [ ] Đăng ký + đăng nhập email hoạt động (cookie giữ được sau reload)
- [ ] OAuth Google/GitHub đăng nhập được
- [ ] Phân tích truyện chạy, chữ hiện dần (SSE hoạt động qua Render)
- [ ] Sinh ảnh nhân vật qua proxy không bị 504 (đã set `maxDuration`)
- [ ] Lưu dự án → mở tab ẩn danh → load lại bằng `?project=` được
- [ ] Xuất PDF/EPUB tải về được
- [ ] Publish web reader + Publish History hiện lượt đọc

---

## 3. Phương án B — VPS duy nhất với docker-compose

Phù hợp khi cần demo ổn định trước hội đồng (không cold start) hoặc muốn giữ nguyên MongoDB local không giới hạn.

1. Thuê VPS: Hetzner CX22 (~€4/tháng) hoặc DigitalOcean Basic Droplet ($6/tháng, có thể free bằng credit GitHub Student Pack). Chọn 2GB RAM trở lên.
2. Trỏ domain (hoặc dùng free subdomain của [DuckDNS](https://www.duckdns.org)) về IP của VPS.
3. SSH vào VPS, cài Docker + Docker Compose, clone repo.
4. Tạo `backend/.env` như mục Bước 2.4 nhưng:
   - `MONGODB_URL=mongodb://mohiom_user:mohiom_password@mongodb:27017/mohiom_db` (URI Docker có sẵn — **đổi mật khẩu mặc định**);
   - `AUTH_FRONTEND_URL` / `AUTH_BACKEND_URL` cùng domain → cookie có thể để `AUTH_COOKIE_SAMESITE=lax` (an toàn hơn `none`).
5. `docker-compose up -d` — dựng đủ MongoDB + backend + frontend.
6. Cài [Caddy](https://caddyserver.com) làm reverse proxy + HTTPS tự động:

   ```
   your-domain.com {
       reverse_proxy /api/* localhost:8000
       reverse_proxy localhost:3000
   }
   ```

   (Caddy tự lấy chứng chỉ Let's Encrypt; SSE hoạt động xuyên qua reverse proxy không cần cấu hình thêm.)
7. Mở firewall cổng 80/443, đóng 3000/8000/27017 với bên ngoài.

---

## 4. Tóm tắt chi phí

| Hạng mục | Phương án A | Phương án B |
|---|---|---|
| Frontend | Vercel Hobby — $0 | trên VPS |
| Backend | Render Free — $0 | trên VPS |
| Database | Atlas M0 — $0 (trần 512MB) | trên VPS (không trần) |
| VPS | — | ~$4–6/tháng (hoặc credit sinh viên) |
| Sinh ảnh | Kaggle GPU — $0 (như hiện tại) | như hiện tại |
| Domain | dùng `*.vercel.app` — $0 | ~$1–10/năm hoặc DuckDNS free |
| **Tổng** | **$0/tháng** | **~$0–6/tháng** |

## 5. Nguồn tham khảo

- [Railway vs Render vs Fly.io 2026 (TECHSY)](https://techsy.io/en/blog/railway-vs-render-vs-fly-io)
- [Railway vs Render vs Fly.io for Solo Developers 2026](https://devtoolpicks.com/blog/railway-vs-render-vs-fly-io-solo-developers-2026)
- [Render — Free instance docs (750h/tháng, spin-down, chặn SMTP)](https://render.com/docs/free)
- [Render — Platforms with a real free tier 2026](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026)
- [Vercel Functions — Limits & Duration (Fluid Compute 60s trên free)](https://vercel.com/docs/functions/limitations)
- [Vercel Free Tier Limits 2026](https://deploywise.dev/blog/vercel-free-tier-limits-2026)
- [MongoDB Atlas Free Cluster Limits (512MB, 500 connections)](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)
- [Koyeb Free Tier 2026](https://www.srvrlss.io/provider/koyeb/)
- [Koyeb pricing FAQ](https://www.koyeb.com/docs/faqs/pricing)
