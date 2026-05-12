# Password Reset Flow (Backend)

This document explains the password reset flow and how to configure SMTP
for sending reset emails.

## Flow Overview

1. User submits email via `/api/auth/forgot-password`.
2. Backend creates a short-lived reset token and stores a hash in MongoDB.
3. Backend sends a reset link to the user's email.
4. User opens the link and sets a new password on `/reset-password`.
5. Frontend posts the token + new password to `/api/auth/reset-password`.

If SMTP is not configured, the backend logs the reset link instead of
sending an email.

## Reset Link Format

```
{AUTH_FRONTEND_URL}/reset-password?token=...&email=...
```

## SMTP Configuration

Add the following to `backend/.env`:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your_smtp_user
SMTP_PASSWORD=your_smtp_password
SMTP_FROM="AI Comic Studio <no-reply@example.com>"
SMTP_USE_TLS=true
```

### Example: Gmail SMTP (App Password)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_gmail_address
SMTP_PASSWORD=your_app_password
SMTP_FROM="AI Comic Studio <your_gmail_address>"
SMTP_USE_TLS=true
```

### Example: Mailgun SMTP

```
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USERNAME=postmaster@your-domain
SMTP_PASSWORD=your_mailgun_password
SMTP_FROM="AI Comic Studio <no-reply@your-domain>"
SMTP_USE_TLS=true
```

## Notes

- Tokens expire after `PASSWORD_RESET_TOKEN_EXPIRES_MINUTES` (default 30).
- For production, set `AUTH_COOKIE_SECURE=true` and use HTTPS.
- Ensure `AUTH_FRONTEND_URL` matches your deployed frontend URL.

