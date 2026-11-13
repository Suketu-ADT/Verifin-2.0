"""The sign-in email: a readable HTML body plus a plain-text one, both carrying the code and nothing unescaped."""

import smtplib

from app.config import settings
from app.services import mailer
from app.services.email_templates import sign_in_code_email


def test_template_contains_code_expiry_and_brand():
    subject, text, html = sign_in_code_email("841170", 10)
    assert "841170" in subject and "841170" in text
    assert "10 minutes" in text and "10 minutes" in html
    assert "VERIFIN" in html
    for digit in "841170":  # one cell per digit, in order
        assert f">{digit}</td>" in html
    assert html.count("border-radius:10px;font-family:'JetBrains Mono'") == 6
    assert "#07080c" in html  # the site background colour
    assert html.lstrip().startswith("<!DOCTYPE html>")


def test_template_escapes_untrusted_values():
    _, text, html = sign_in_code_email("<b>1</b>", 5, name="<script>alert(1)</script>")
    assert "<script>" not in html and "<b>1</b>" not in html
    assert "&lt;script&gt;" in html


def test_send_email_sends_text_and_html_alternatives(monkeypatch):
    sent = []

    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self, **k): pass
        def login(self, *a): pass
        def send_message(self, message): sent.append(message)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(settings, "smtp_from", "noreply@example.test")
    monkeypatch.setattr(settings, "smtp_username", None)
    subject, text, html = sign_in_code_email("123456", 10)
    assert mailer.send_email("user@example.test", subject, text, html) is True
    message = sent[0]
    assert message.is_multipart()
    assert message.get_body(("plain",)).get_content().count("123456") == 1
    assert "123456" in message.get_body(("html",)).get_content()
