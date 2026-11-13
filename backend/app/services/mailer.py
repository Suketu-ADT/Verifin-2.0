"""
Outgoing email over SMTP (standard library only).

Used for sign-in codes. ``send_email`` blocks for the length of the SMTP conversation, so callers run it off the event loop
(a background task or the thread pool). Nothing here logs the message body, because bodies carry codes.
"""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings
from app.utils.logging import logger

SMTP_TIMEOUT_SECONDS = 15


def smtp_configured() -> bool:
    return bool(settings.smtp_host and (settings.smtp_from or settings.smtp_username))


def send_email(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """Send a message (plain text, plus an HTML alternative when given). Returns False (and logs why) instead of raising, so a mail outage never breaks a request."""
    if not smtp_configured():
        logger.warning("Email not sent: SMTP is not configured.")
        return False
    message = EmailMessage()
    message["From"] = settings.smtp_from or settings.smtp_username
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    if html:
        message.add_alternative(html, subtype="html")
    try:
        context = ssl.create_default_context()
        if settings.smtp_ssl:
            server: smtplib.SMTP = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT_SECONDS, context=context)
        else:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=SMTP_TIMEOUT_SECONDS)
        with server:
            if not settings.smtp_ssl:
                server.starttls(context=context)
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return True
    except (smtplib.SMTPException, OSError) as exc:
        logger.error(f"Email delivery failed: {type(exc).__name__}: {str(exc)[:200]}")
        return False
