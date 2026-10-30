"""
Run one or more systems over a dataset split and append predictions to JSONL
(resumable: already-scored items are skipped).

    python -m eval.run --split dev --systems verifin,verifin:dense,number_match
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import time
from pathlib import Path

from app.config import settings
from eval.build_dataset import DATASET_PATH
from eval.corpus import load_corpus
from eval.systems import build_system

RESULTS_DIR = settings.data_dir / "eval" / "results"


def result_path(split: str, system: str, run: str = "current") -> Path:
    return RESULTS_DIR / run / split / f"{system.replace(':', '__')}.jsonl"


def load_items(split: str):
    items = json.loads(DATASET_PATH.read_text(encoding="utf-8"))["items"]
    return [i for i in items if split == "all" or i["split"] == split]


async def run_system(name: str, split: str, corpus, limit: int | None, run: str = "current") -> None:
    items = load_items(split)[: limit or None]
    out = result_path(split, name, run)
    out.parent.mkdir(parents=True, exist_ok=True)
    done = set()
    if out.exists():
        done = {json.loads(line)["id"] for line in out.read_text(encoding="utf-8").splitlines() if line.strip()}
    todo = [i for i in items if i["id"] not in done]
    print(f"[{name}] {len(done)} done, {len(todo)} to run on '{split}'", flush=True)
    if not todo:
        return

    system = build_system(name, corpus)
    start = time.time()
    with open(out, "a", encoding="utf-8") as f:
        for n, item in enumerate(todo, start=1):
            try:
                pred = await system.predict(item)
            except Exception as exc:  # record failures instead of silently dropping the item
                pred = {"label": "UNVERIFIABLE", "error": f"{type(exc).__name__}: {exc}"[:200],
                        "retrieved_pages": [], "latency_s": 0.0}
            f.write(json.dumps({"id": item["id"], **pred}, ensure_ascii=False) + "\n")
            f.flush()
            if n % 25 == 0:
                rate = (time.time() - start) / n
                print(f"  [{name}] {n}/{len(todo)}  {rate:.2f}s/claim  eta {rate * (len(todo) - n) / 60:.1f} min", flush=True)
    print(f"[{name}] finished in {(time.time() - start) / 60:.1f} min", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    parser.add_argument("--systems", required=True, help="comma-separated system names")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--run", default="current", help="results namespace, e.g. v0_original")
    args = parser.parse_args()

    logging.disable(logging.INFO)  # keep the console readable; warnings and errors still show
    corpus = load_corpus()

    async def go():
        for name in [s.strip() for s in args.systems.split(",") if s.strip()]:
            await run_system(name, args.split, corpus, args.limit, args.run)

    asyncio.run(go())


if __name__ == "__main__":
    main()
