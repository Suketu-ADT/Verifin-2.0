# Demo video pipeline

Produces `docs/video/VERIFIN_demo.mp4`: a captioned 1080p screen recording of the demo with a synthetic voice-over. It drives the
real application in a browser, so every verdict on screen is one the running system produced on the bundled Northstar sample
report. Everything here is free and runs locally; nothing is uploaded.

| File | Role |
|---|---|
| `demo_text.py` | The narration (spoken) and the on-screen caption for each of the ten shots. Edit the words here. |
| `make_audio.py` | Turns each narration clip into a WAV with the built-in Windows voice (Microsoft Zira) and records its length. |
| `record_demo.py` | Walks through the app in a system browser, paced to the clip lengths, and saves the screen frames and a timeline. |
| `build_video.py` | Joins the frames into a video and mixes each clip in at its recorded start time. |
| `seed_demo_data.py` | Adds a demo account and about 35 days of **generated** sample verifications so the Analytics page has something to show. |

The shots follow [VIDEO_SHOT_LIST.md](../../docs/VIDEO_SHOT_LIST.md). The Analytics shot says aloud that its data is generated.

## Requirements

- Windows (the voice comes from the built-in `System.Speech` engine), with Microsoft Edge or Chrome installed.
- Python packages, installed anywhere you like: `pip install playwright pypdfium2 pillow imageio-ffmpeg`. Playwright is used with the
  system browser, so `playwright install` is not needed, and `imageio-ffmpeg` supplies the ffmpeg binary.
- The backend dependencies (`backend/requirements.txt`) and Node (to build the frontend).

## Record it

Run these from the repository root in PowerShell, with `python` being the backend's environment (activate `backend\.venv`, or call
`backend\.venv\Scripts\python`) plus the packages above. The recording uses a throwaway server on its own port and the **local fallback
database**: pointing `MONGODB_URI` at an unreachable address makes the server fall back to `data/fallback_db_store.json` and never
touch a real database. Keep a copy of that file first, because seeding and recording write to it.

```powershell
Copy-Item data\fallback_db_store.json $env:TEMP\fallback_db_store.backup.json

# 1. Build the frontend the way the demo script does (the page then talks to the server that serves it).
cd frontend; $env:VITE_API_BASE_URL = "/"; $env:VITE_BASE = "/"; npm run build
Remove-Item Env:VITE_API_BASE_URL, Env:VITE_BASE; cd ..

# 2. Use the local fallback database only, with sign-in turned on.
$env:MONGODB_URI = "mongodb://127.0.0.1:1"; $env:MONGODB_SERVER_SELECTION_TIMEOUT_MS = "1500"; $env:MONGODB_CONNECT_TIMEOUT_MS = "1500"
$env:AUTH_ENABLED = "true"; $env:FRONTEND_DIST = "$PWD\frontend\dist"
$env:VERIFIN_DEMO_EMAIL = "demo@example.com"; $env:VERIFIN_DEMO_PASSWORD = "<choose a throwaway password>"

# 3. Seed the demo account and sample data, then start the server (in its own window or in the background).
cd backend; $env:PYTHONPATH = "."; python ..\scripts\demo_video\seed_demo_data.py
Start-Process python -ArgumentList "-m","uvicorn","app.main:app","--port","8123" -WindowStyle Hidden; cd ..
$env:VERIFIN_BASE_URL = "http://127.0.0.1:8123"

# 4. Voice-over, recording (about 5 minutes in real time), and assembly.
python scripts\demo_video\make_audio.py
python scripts\demo_video\record_demo.py
python scripts\demo_video\build_video.py docs\video\VERIFIN_demo.mp4
```

Then stop the server and restore `data/fallback_db_store.json` from the copy you made. Working files (frames, audio, timeline) go to
`%TEMP%\verifin_demo_video` (override with `VERIFIN_VIDEO_WORK`) and are safe to delete; the frames take roughly a gigabyte.

## Things to know

- **Run the sample once first** so the models are loaded; otherwise the first verification adds dead time to the recording. A warm
  server takes a few seconds.
- **Download managers.** Internet Download Manager returns an empty body for `.pdf` requests, which breaks the sample button in a
  browser. The recorder serves the sample PDF itself (`page.route`), so it is unaffected; for a manual run, pause the manager's
  browser integration.
- **Credentials** are read from `VERIFIN_DEMO_EMAIL` and `VERIFIN_DEMO_PASSWORD` and typed on screen as dots. Use a throwaway
  account; nothing is stored in the repository.
- **Changing the interface.** The recorder finds controls by role and visible name ("Use sample", "Verify claims", "Download PDF",
  "Verify integrity", the *Audit trail* tab, claim rows by their number, "Open full claim audit"). If you rename one, update
  `record_demo.py`, and re-record, because the video shows whichever version of the interface was running.
- **The voice is synthetic.** To use your own, record the ten clips yourself, save them as `s1.wav` to `s10.wav` in the `audio`
  working folder (and write their lengths to `durations.json` in the same format `make_audio.py` produces), then run
  `record_demo.py` and `build_video.py`.
- **File size.** The finished video is about 30 MB. Decide before committing it whether it belongs in the repository or on a
  release page instead.
