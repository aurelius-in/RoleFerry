import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Iterable, List

from ..config import settings

logger = logging.getLogger(__name__)


def _send_sync(to_addrs: List[str], subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_username or "no-reply@localhost"
    msg["To"] = ", ".join(to_addrs)
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:  # type: ignore[arg-type]
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


async def send_email(to: Iterable[str], subject: str, body: str) -> None:
    """
    Very small, internal-only email helper.

    - In mock_mode, this is a no-op except for logging.
    - When SMTP_HOST is not configured, this is also a no-op.
    """
    to_list = [addr for addr in to if addr]
    if not to_list:
        return

    if settings.mock_mode or not settings.smtp_host:
        logger.info(
            "send_email (mock)",
            extra={
                "to": to_list,
                "subject": subject,
                "length": len(body or ""),
            },
        )
        return

    logger.info(
        "send_email (smtp)",
        extra={
            "to_count": len(to_list),
            "subject": subject,
        },
    )

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _send_sync, to_list, subject, body)


