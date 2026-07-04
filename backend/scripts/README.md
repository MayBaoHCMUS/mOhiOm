# Auth Smoke Test

Quick check for manual register/login and session cookies using the FastAPI app and MongoDB.

## Run

```bash
python -m scripts.auth_smoke
```

## Notes

- Requires MongoDB configured in `backend/.env`.
- OAuth flows require provider credentials; they are not exercised here.
- Password reset emails require SMTP configuration.

