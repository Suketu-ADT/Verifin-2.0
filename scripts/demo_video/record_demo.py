"""Record the VERIFIN demo walkthrough on the throwaway server: video (webm) plus a timeline of when each shot's narration starts."""
import base64
import json
import os
import re
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
WORK = Path(os.environ.get("VERIFIN_VIDEO_WORK") or Path(tempfile.gettempdir()) / "verifin_demo_video")
sys.path.insert(0, str(HERE))
import pypdfium2 as pdfium  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

from demo_text import CAPTIONS  # noqa: E402

BASE = os.environ.get("VERIFIN_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
EMAIL = os.environ["VERIFIN_DEMO_EMAIL"]  # the demo account to sign in with; never hard-coded
PASSWORD = os.environ["VERIFIN_DEMO_PASSWORD"]
CHANNEL = os.environ.get("VERIFIN_BROWSER_CHANNEL", "msedge")  # a system browser: "msedge" or "chrome"
PDF = (ROOT / "frontend" / "public" / "samples" / "northstar-sample-report.pdf").read_bytes()
DUR = json.loads((WORK / "audio" / "durations.json").read_text())
OUT = WORK / "rec"
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.webm"):
    old.unlink()

INIT = r"""
(() => {
  const add = () => {
    if (document.getElementById('__vcap')) return;
    const cap = document.createElement('div'); cap.id = '__vcap';
    cap.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1200px;padding:13px 26px;background:rgba(11,18,32,.93);color:#fff;font:500 23px/1.35 Inter,Segoe UI,sans-serif;border-radius:12px;z-index:2147483647;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none;display:none';
    document.documentElement.appendChild(cap);
    const dot = document.createElement('div'); dot.id = '__vdot';
    dot.style.cssText = 'position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(245,158,11,.5);border:2px solid #f59e0b;z-index:2147483647;pointer-events:none;left:-60px;top:-60px;transition:transform .12s';
    document.documentElement.appendChild(dot);
    try {
      const t = sessionStorage.getItem('__vcap'); if (t) { cap.textContent = t; cap.style.display = 'block'; }
      const pos = sessionStorage.getItem('__vpos'); if (pos) { const [x, y] = pos.split(','); dot.style.left = x + 'px'; dot.style.top = y + 'px'; }
    } catch (e) {}
    addEventListener('mousemove', e => { dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px'; try { sessionStorage.setItem('__vpos', e.clientX + ',' + e.clientY); } catch (_) {} }, true);
    addEventListener('mousedown', () => { dot.style.transform = 'scale(.7)'; }, true);
    addEventListener('mouseup', () => { dot.style.transform = 'scale(1)'; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
})();
"""

timeline = {}
state = {"mouse": (960, 540)}


def caption(page, text):
    page.evaluate("""t => { try { sessionStorage.setItem('__vcap', t); } catch (e) {}
        const c = document.getElementById('__vcap'); if (c) { c.textContent = t; c.style.display = t ? 'block' : 'none'; } }""", text)


def move(page, x, y, steps=28):
    page.mouse.move(x, y, steps=steps)
    state["mouse"] = (x, y)


def point_at(page, locator, click=False, pause=0.35):
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    move(page, x, y)
    page.wait_for_timeout(int(pause * 1000))
    if click:
        page.mouse.click(x, y)


def scroll(page, total, seconds, x=1100, y=620):
    """Smooth wheel scroll of `total` pixels (negative = up) over `seconds`."""
    move(page, x, y, steps=10)
    steps = max(1, int(seconds * 20))
    for _ in range(steps):
        page.mouse.wheel(0, total / steps)
        page.wait_for_timeout(50)


class Shot:
    def __init__(self, page, name, t0, lead=0.5):
        self.name, self.page = name, page
        self.start = time.time()
        timeline[name] = round(self.start - t0 + lead, 2)  # narration starts a beat after the shot does
        caption(page, CAPTIONS.get(name, ""))
        self.end = self.start + lead + DUR[name] + 0.9

    def remaining(self):
        return max(0.0, self.end - time.time())

    def finish(self):
        left = self.remaining()
        if left:
            self.page.wait_for_timeout(int(left * 1000))


def card(page, title, sub):
    page.set_content(f"""<body style="margin:0;height:100vh;background:#0B1220;color:#fff;font-family:Inter,Segoe UI,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    <div style="font-size:78px;font-weight:700;letter-spacing:.02em">{title}</div>
    <div style="margin-top:22px;font-size:30px;color:#9FB3CC;max-width:1300px;line-height:1.4">{sub}</div></body>""")


with sync_playwright() as p:
    browser = p.chromium.launch(channel=CHANNEL, headless=True)
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
    ctx.add_init_script(INIT)
    page = ctx.new_page()
    # frames come from Chrome's screencast; each is saved with its own timestamp and assembled into a video afterwards
    FRAMES = OUT / "frames"
    FRAMES.mkdir(exist_ok=True)
    for old in FRAMES.glob("*.jpg"):
        old.unlink()
    frame_times = []
    cdp = ctx.new_cdp_session(page)

    def on_frame(params):
        n = len(frame_times)
        (FRAMES / f"f{n:06d}.jpg").write_bytes(base64.b64decode(params["data"]))
        frame_times.append(params["metadata"]["timestamp"])
        cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]})

    cdp.on("Page.screencastFrame", on_frame)
    t0 = time.time()
    cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 82, "maxWidth": 1920, "maxHeight": 1080, "everyNthFrame": 1})
    page.route("**/samples/northstar-sample-report.pdf", lambda r: r.fulfill(status=200, body=PDF, content_type="application/pdf"))

    # title card
    card(page, "VERIFIN 2.0", "Trust through transparency. Intelligence through evidence.<br>Checking AI-written financial statements against the source document.")
    page.wait_for_timeout(4200)

    # 1. landing page
    page.goto(BASE + "/")
    page.wait_for_timeout(600)
    s = Shot(page, "s1", t0)
    page.wait_for_timeout(3500)
    scroll(page, 900, 6)
    page.wait_for_timeout(1500)
    scroll(page, -900, 4)
    s.finish()

    # 2. sign in
    page.goto(BASE + "/login")
    page.wait_for_timeout(1200)
    s = Shot(page, "s2", t0)
    page.wait_for_timeout(1500)
    code_tab = page.get_by_role("tab", name="Email code")
    if code_tab.count():
        point_at(page, code_tab, click=True)
        page.wait_for_timeout(2200)
        google = page.get_by_role("button", name=re.compile("Google", re.I))
        if google.count():
            point_at(page, google.first)
            page.wait_for_timeout(1500)
        point_at(page, page.get_by_role("tab", name="Password"), click=True)
        page.wait_for_timeout(1200)
    point_at(page, page.locator("#login-email"), click=True)
    page.keyboard.type(EMAIL, delay=70)
    point_at(page, page.locator("#login-password"), click=True)
    page.keyboard.type(PASSWORD, delay=70)
    page.wait_for_timeout(500)
    point_at(page, page.get_by_role("button", name="Sign in").last, click=True)
    page.wait_for_url("**/dashboard", timeout=30000)
    page.wait_for_timeout(1500)
    s.finish()

    # 3. new verification with the sample
    point_at(page, page.get_by_role("link", name="New Verification", exact=True), click=True)
    page.wait_for_timeout(900)
    s = Shot(page, "s3", t0)
    page.wait_for_timeout(1200)
    point_at(page, page.get_by_role("button", name="Use sample"), click=True)
    page.get_by_text("Ready").first.wait_for(timeout=60000)
    page.wait_for_timeout(1500)
    point_at(page, page.locator("#statements"))
    page.wait_for_timeout(1500)
    s.finish()
    caption(page, "Verifying: split into claims, find evidence, check each claim")
    verify = page.get_by_role("button", name="Verify claims")
    point_at(page, verify, click=True)
    page.wait_for_url("**/verify/results/**", timeout=240000)
    session_url = page.url
    page.get_by_role("button", name=re.compile(r"^01")).wait_for(timeout=120000)
    page.wait_for_timeout(1500)

    # 4. results
    s = Shot(page, "s4", t0)
    page.wait_for_timeout(15000)  # overview and classification while the totals are described
    scroll(page, 560, 5)  # claim list
    page.wait_for_timeout(2500)
    for i in range(3):  # open the first three contradicted claims in turn
        row = page.get_by_role("button", name=re.compile(rf"^0{i + 1}"))
        point_at(page, row, click=True)
        page.wait_for_timeout(4200)
    scroll(page, 700, max(4, s.remaining() - 9))
    s.finish()

    # 5. one claim in depth
    caption(page, CAPTIONS["s5"])
    s = Shot(page, "s5", t0)
    link = page.get_by_role("link", name="Open full claim audit").nth(2)
    page.get_by_role("button", name=re.compile(r"^03")).scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    if link.is_visible():
        point_at(page, link, click=True)
    else:
        page.goto(session_url + f"/claim/{session_url.rsplit('/', 1)[-1]}_c2")
    page.wait_for_timeout(2500)
    scroll(page, 650, max(6, s.remaining() - 6))
    s.finish()

    # 6. audit trail
    page.goto(BASE + "/admin")
    page.wait_for_timeout(1500)
    s = Shot(page, "s6", t0)
    point_at(page, page.get_by_role("tab", name=re.compile("Audit trail")), click=True)
    page.wait_for_timeout(2500)
    scroll(page, 350, 3)
    page.wait_for_timeout(1500)
    point_at(page, page.get_by_role("button", name="Verify integrity"), click=True)
    page.get_by_text(re.compile(r"Chain intact")).wait_for(timeout=30000)
    page.wait_for_timeout(1500)
    s.finish()

    # 7. reports: download the PDF and show its provenance block
    point_at(page, page.get_by_role("link", name="Reports", exact=True), click=True)
    page.wait_for_timeout(2000)
    s = Shot(page, "s7", t0)
    with page.expect_download(timeout=60000) as dl:
        point_at(page, page.get_by_role("button", name="Download PDF"), click=True)
    pdf_path = OUT / "downloaded_report.pdf"
    dl.value.save_as(str(pdf_path))
    page.wait_for_timeout(1500)
    doc = pdfium.PdfDocument(str(pdf_path))
    shown = False
    for i in range(len(doc)):
        if "provenance" in doc[i].get_textpage().get_text_range().lower():
            png = OUT / "provenance_page.png"
            doc[i].render(scale=1.6).to_pil().convert("RGB").save(png)
            data = base64.b64encode(png.read_bytes()).decode()
            caption(page, "The downloaded PDF report: the provenance block")
            page.set_content(f'<body style="margin:0;background:#e2e8f0;display:flex;justify-content:center"><img style="height:100vh" src="data:image/png;base64,{data}"></body>')
            shown = True
            break
    print("provenance page shown:", shown, "pages in pdf:", len(doc))
    page.wait_for_timeout(1000)
    s.finish()

    # 8. benchmark
    page.goto(BASE + "/benchmark")
    page.wait_for_timeout(1800)
    s = Shot(page, "s8", t0)
    page.wait_for_timeout(5000)
    scroll(page, 1300, max(8, s.remaining() - 8))
    s.finish()

    # 9. analytics
    page.goto(BASE + "/analytics")
    page.wait_for_timeout(2200)
    s = Shot(page, "s9", t0)
    page.wait_for_timeout(4500)
    scroll(page, 1500, max(8, s.remaining() - 6))
    s.finish()

    # 10. limits, back on the results
    page.goto(session_url)
    page.wait_for_timeout(1500)
    s = Shot(page, "s10", t0)
    page.wait_for_timeout(2500)
    scroll(page, 500, 6)
    s.finish()

    caption(page, "")
    card(page, "VERIFIN 2.0", "Code: github.com/Suketu-ADT/Verifin-2.0<br>Full write-up: docs/report/VERIFIN_2.0_project_report.pdf")
    page.wait_for_timeout(4200)
    cdp.send("Page.stopScreencast")
    total = round(time.time() - t0, 1)
    ctx.close()
    browser.close()

(OUT / "timeline.json").write_text(json.dumps({"timeline": timeline, "frame_times": frame_times, "t0": t0, "total": total}))
print(json.dumps(timeline), "frames", len(frame_times), "total", total)
