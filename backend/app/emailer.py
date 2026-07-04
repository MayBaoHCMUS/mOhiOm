import logging
import smtplib
from email.message import EmailMessage
from app.config import settings

logger = logging.getLogger(__name__)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        logger.warning(
            "SMTP not configured; reset link for %s: %s",
            recipient,
            reset_url,
        )
        return

    message = EmailMessage()
    message["Subject"] = f"{settings.APP_NAME} password reset"
    message["From"] = settings.SMTP_FROM
    message["To"] = recipient
    message.set_content(
        "Use the link below to reset your password.\n\n"
        f"{reset_url}\n\n"
        "If you did not request a reset, you can ignore this email."
    )

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)

