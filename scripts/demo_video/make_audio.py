"""Synthesize each narration clip with the built-in Windows voice (Microsoft Zira) and save the durations."""
import json
import os
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
WORK = Path(os.environ.get("VERIFIN_VIDEO_WORK") or Path(tempfile.gettempdir()) / "verifin_demo_video")
sys.path.insert(0, str(HERE))
from demo_text import NARRATION  # noqa: E402

AUDIO = WORK / "audio"
AUDIO.mkdir(parents=True, exist_ok=True)
(AUDIO / "narration.json").write_text(json.dumps(NARRATION), encoding="utf-8")
ps = f"""
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Zira Desktop')
$s.Rate = 0
$items = Get-Content -Raw -Encoding UTF8 '{AUDIO / "narration.json"}' | ConvertFrom-Json
foreach ($k in $items.PSObject.Properties) {{
  $s.SetOutputToWaveFile('{AUDIO}\\' + $k.Name + '.wav')
  $s.Speak($k.Value)
  $s.SetOutputToNull()
}}
"""
(AUDIO / "tts.ps1").write_text(ps, encoding="utf-8")
subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(AUDIO / "tts.ps1")], check=True)
durations = {}
for name in NARRATION:
    with wave.open(str(AUDIO / f"{name}.wav")) as w:
        durations[name] = round(w.getnframes() / w.getframerate(), 2)
(AUDIO / "durations.json").write_text(json.dumps(durations), encoding="utf-8")
print(durations, "total", round(sum(durations.values()), 1))
