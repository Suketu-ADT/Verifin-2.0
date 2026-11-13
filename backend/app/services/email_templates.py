"""
HTML and plain-text bodies for the emails VERIFIN sends.

The look follows the web app: near-black page (#07080c), card surface and hairline border, amber as the single accent, emerald
and rose for "good" and "careful", Plus Jakarta Sans for text and a monospace face for anything machine-like. Two ideas are
specific to this product rather than borrowed from other mail:

* the code is shown as a row of separate cells, like entries in a ledger, because VERIFIN is about checking things one by one;
* a short audit-style footer ("request / valid for / uses") echoes the tamper-evident audit trail the product keeps.

Email clients ignore most modern CSS, so the layout is a table with inline styles and fixed colours (no dependence on the
reader's dark or light mode, no SVG or scripts). Every value placed in the HTML is escaped. A plain-text version is always sent.
"""

from __future__ import annotations

from html import escape

BRAND = "VERIFIN"
VERSION = "2.0"

# Taken from frontend/src/index.css and the Tailwind palette the pages use.
_PAGE = "#07080c"
_CARD = "#0e1016"
_INSET = "#080a10"
_BORDER = "#222633"
_TEXT = "#f1f5f9"
_MUTED = "#9aa1b2"
_AMBER = "#f59e0b"
_AMBER_SOFT = "#fbbf24"
_EMERALD = "#34d399"
_ROSE = "#fb7185"
_SANS = "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
_MONO = "'JetBrains Mono',Consolas,Menlo,'Courier New',monospace"


def _digit_cells(code: str) -> str:
    """One bordered cell per character, so the code reads as separate, checkable entries."""
    cells = []
    for ch in code:
        cells.append(
            f'<td align="center" width="44" height="58" bgcolor="{_INSET}" '
            f'style="background-color:{_INSET};border:1px solid #3a3320;border-radius:10px;'
            f'font-family:{_MONO};font-size:28px;font-weight:700;color:{_AMBER_SOFT};">{escape(ch)}</td>'
        )
    return '<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>'.join(cells)


def _audit_row(label: str, value: str, value_color: str = _TEXT) -> str:
    return (
        f'<tr><td style="padding:3px 0;font-family:{_MONO};font-size:12px;color:#6b7386;">{escape(label)}</td>'
        f'<td align="right" style="padding:3px 0;font-family:{_MONO};font-size:12px;color:{value_color};">{escape(value)}</td></tr>'
    )


def _code_email(
    code: str, ttl_minutes: int, name: str | None, *, subject: str, badge: str, heading: str, action: str, event: str,
    ignore_note: str,
) -> tuple[str, str, str]:
    """Shared layout for every message that carries a one-time code. Returns ``(subject, plain_text, html)``."""
    greeting = f"Hi {name}," if name else "Hello,"
    text = "\n".join([
        greeting,
        "",
        f"Your {BRAND} code is {code}.",
        "",
        f"{action[0].upper() + action[1:]}. It works once and expires in {ttl_minutes} minutes. Do not share it with anyone.",
        ignore_note,
        "",
        f"{BRAND} {VERSION} - we verify claims; this code verifies you.",
        "",
    ])
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
<title>{escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:{_PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{_PAGE};">Your sign-in code is {escape(code)}. It expires in {ttl_minutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_PAGE}" style="background-color:{_PAGE};">
<tr><td align="center" style="padding:36px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <tr><td style="padding:0 4px 18px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="34" height="34" align="center" bgcolor="#1a1406" style="background-color:#1a1406;border:1px solid #5b4310;border-radius:10px;font-family:{_SANS};font-size:18px;font-weight:800;color:{_AMBER};">&#10003;</td>
        <td style="padding-left:12px;font-family:{_SANS};font-size:20px;font-weight:800;letter-spacing:2px;color:{_TEXT};">{BRAND} <span style="font-family:{_MONO};font-size:12px;font-weight:700;letter-spacing:0;color:{_AMBER};">{VERSION}</span></td>
      </tr></table>
    </td></tr>

    <tr><td bgcolor="{_CARD}" style="background-color:{_CARD};border:1px solid {_BORDER};border-radius:14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background-color:{_AMBER};background-image:linear-gradient(90deg,{_AMBER},{_AMBER_SOFT},#6366f1);border-radius:14px 14px 0 0;">&nbsp;</td></tr>

        <tr><td style="padding:30px 32px 6px 32px;font-family:{_SANS};">
          <span style="display:inline-block;padding:4px 10px;border:1px solid #14523c;border-radius:999px;background-color:#08201a;font-family:{_MONO};font-size:11px;letter-spacing:1px;color:{_EMERALD};">&#9679; {escape(badge)}</span>
          <h1 style="margin:16px 0 10px 0;font-size:24px;line-height:30px;font-weight:800;color:{_TEXT};">{escape(heading)}</h1>
          <p style="margin:0;font-size:15px;line-height:24px;color:{_MUTED};">{escape(greeting)} {escape(action)}. It is valid for <strong style="color:{_AMBER_SOFT};">{ttl_minutes} minutes</strong> and can be used once.</p>
        </td></tr>

        <tr><td align="center" style="padding:24px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{_digit_cells(code)}</tr></table>
        </td></tr>

        <tr><td style="padding:0 32px 6px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_INSET}" style="background-color:{_INSET};border:1px solid {_BORDER};border-radius:10px;">
            <tr><td style="padding:12px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                {_audit_row("event", event)}
                {_audit_row("valid for", f"{ttl_minutes} min")}
                {_audit_row("uses", "1 (single use)", _EMERALD)}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:18px 32px 28px 32px;font-family:{_SANS};font-size:13px;line-height:20px;color:#7d869a;">
          <span style="color:{_ROSE};font-weight:600;">Keep it private.</span> {BRAND} will never ask you for this code.
          {escape(ignore_note)}
        </td></tr>
      </table>
    </td></tr>

    <tr><td align="center" style="padding:20px 8px 0 8px;font-family:{_SANS};font-size:12px;line-height:18px;color:#5d667c;">
      We verify claims. This code verifies you.<br>
      <span style="font-family:{_MONO};color:#475066;">{BRAND} {VERSION} &middot; financial hallucination detection</span>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>
"""
    return subject, text, html


def sign_in_code_email(code: str, ttl_minutes: int, name: str | None = None) -> tuple[str, str, str]:
    """Return ``(subject, plain_text, html)`` for a sign-in code message."""
    return _code_email(
        code, ttl_minutes, name,
        subject=f"{code} is your {BRAND} sign-in code", badge="SIGN-IN CHECK", heading="Verify it’s you",
        action="enter this code on the sign-in page", event="auth.sign_in.code",
        ignore_note="If you did not request it, ignore this email and nothing happens.",
    )


def password_reset_email(code: str, ttl_minutes: int, name: str | None = None) -> tuple[str, str, str]:
    """Return ``(subject, plain_text, html)`` for a password-reset code message."""
    return _code_email(
        code, ttl_minutes, name,
        subject=f"{code} is your {BRAND} password reset code", badge="PASSWORD RESET", heading="Reset your password",
        action="enter this code to choose a new password", event="auth.password.reset",
        ignore_note="If you did not ask to reset your password, ignore this email: your password has not changed.",
    )
