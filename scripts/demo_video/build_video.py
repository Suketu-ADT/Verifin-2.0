"""Assemble the screencast frames into a video and mix the narration clips in at their recorded start times."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

WORK = Path(os.environ.get("VERIFIN_VIDEO_WORK") or Path(tempfile.gettempdir()) / "verifin_demo_video")
import imageio_ffmpeg  # noqa: E402

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
REC = WORK / "rec"
AUDIO = WORK / "audio"
OUT = Path(sys.argv[1])
meta = json.loads((REC / "timeline.json").read_text())
timeline, t0, total = meta["timeline"], meta["t0"], meta["total"]
times = [t - t0 for t in meta["frame_times"]]

# constant-frame-rate video: concat list with each frame held until the next one arrives
lines = []
for i, t in enumerate(times):
    nxt = times[i + 1] if i + 1 < len(times) else total
    lines.append(f"file 'frames/f{i:06d}.jpg'\nduration {max(nxt - t, 0.001):.4f}")
lines.append(f"file 'frames/f{len(times) - 1:06d}.jpg'")
(REC / "frames.txt").write_text("\n".join(lines))

video = REC / "silent.mp4"
subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(REC / "frames.txt"),
                "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20", str(video)], check=True)

names = list(timeline)
inputs, chains = [], []
for k, name in enumerate(names):
    inputs += ["-i", str(AUDIO / f"{name}.wav")]
    ms = int(timeline[name] * 1000)
    chains.append(f"[{k + 1}:a]adelay={ms}:all=1[a{k}]")
mix = "".join(f"[a{k}]" for k in range(len(names))) + f"amix=inputs={len(names)}:normalize=0:dropout_transition=0,apad[aout]"
subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(video), *inputs, "-filter_complex", ";".join(chains) + ";" + mix,
                "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.2f}", str(OUT)], check=True)
print("wrote", OUT, round(OUT.stat().st_size / 1e6, 1), "MB")
