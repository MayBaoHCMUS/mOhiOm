import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if not settings.RESEND_API_KEY or not settings.RESEND_FROM:
        logger.warning(
            "Resend not configured; reset link for %s: %s",
            recipient,
            reset_url,
        )
        return

    payload = {
        "from": settings.RESEND_FROM,
        "to": [recipient],
        "subject": f"{settings.APP_NAME} password reset",
        "text": (
            "Use the link below to reset your password.\n\n"
            f"{reset_url}\n\n"
            "If you did not request a reset, you can ignore this email."
        ),
    }
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(RESEND_API_URL, json=payload, headers=headers)
    except Exception as exc:
        logger.error("Resend request failed for %s: %s", recipient, exc)
        return

    if response.status_code >= 400:
        logger.error(
            "Resend send failed for %s (status %s): %s",
            recipient,
            response.status_code,
            response.text.strip()[:500],
        )
        return

    logger.info("Password reset email sent to %s via Resend", recipient)
