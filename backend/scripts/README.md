# Auth Smoke Test

Quick check for manual register/login and session cookies using the FastAPI app and MongoDB.

## Run

```bash
python -m scripts.auth_smoke
```

## Notes

- Requires MongoDB configured in `backend/.env`.
- OAuth flows require provider credentials; they are not exercised here.
- Password reset emails require Resend configuration (`RESEND_API_KEY` / `RESEND_FROM` in `backend/.env`).

# Configure R2 CORS

Sets the CORS policy on the R2 bucket so the frontend can load panel/page
images into `<canvas>` during export. Without this, exports fail with a
browser CORS error when fetching images from the R2 public URL.

## Run

```bash
python -m scripts.configure_r2_cors
```

## Notes

- Requires `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` configured in `backend/.env`.
- Edit `ALLOWED_ORIGINS` in the script before running if you add a new frontend origin (keep it in sync with `CORS_ORIGINS` in `backend/app/config.py`).
- This modifies live bucket configuration on Cloudflare — review the origin list before running.

