"""
Builds the labelled claim dataset from the cached report corpus.

Labels are correct by construction, so no human judgement is needed:

* SUPPORTED     - a sentence taken from the report itself (verbatim), or a
                  paraphrase of it whose numbers were checked to be unchanged.
* CONTRADICTED  - the same sentence with one controlled edit (number change,
                  unit swap, direction flip or period swap). Numeric edits are
                  rejected if the new value appears anywhere in the report.
* UNVERIFIABLE  - a plausible claim about a fabricated counterparty / person /
                  city / regulator whose invented name appears nowhere in the report.

Splits are assigned by (document, page) so claims from one page never straddle
the dev and test sets.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

import httpx

from app.config import settings
from eval.corpus import CorpusDoc, load_corpus

SEED = 1337
DATASET_PATH = settings.data_dir / "eval" / "dataset.json"
LLM_CACHE_DIR = settings.data_dir / "eval" / "llm_cache"
OLLAMA_URL = "http://localhost:11434/api/generate"
PARAPHRASE_MODEL = "qwen2.5:7b"

# Sources drawn per document (annual reports carry most of the numeric content).
SOURCES_PER_DOC = {"jpmorgan": 45, "reliance": 45, "sbi": 45, "tata_motors": 45, "hdfc": 15, "wipro": 10}
PARAPHRASED_SOURCES = 100
FABRICATED_CLAIMS = 100
DEV_FRACTION = 0.6

# ── Sentence mining ──────────────────────────────────────────────────────────

UNIT = r"(?:billion|million|trillion|crore|lakh|bn|mn|thousand)"
FIGURE_RE = re.compile(
    rf"(?:(?:₹|Rs\.?|US\$|\$)\s?\d[\d,]*(?:\.\d+)?(?:\s?{UNIT})?"
    rf"|\d[\d,]*(?:\.\d+)?\s?(?:%|per\s?cent|{UNIT}))",
    re.IGNORECASE,
)
NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?")
VERB_RE = re.compile(
    r"\b(rose|grew|increased|decreased|declined|fell|reported|recorded|achieved|stood|"
    r"reached|delivered|generated|crossed|was|were|totalled|totaled|amounted|stands|"
    r"has|have|had|grow|improved|expanded|reduced)\b",
    re.IGNORECASE,
)
STOP_RE = re.compile(r"\b(the|of|and|to|in|a|for|on|by|with|as|at|from)\b", re.IGNORECASE)
BAD_RE = re.compile(r"(http|www\.|©|\|\||forward-looking|safe harbo|\bnote\b|\btable\b|\bpage\b|\bfigure\b)", re.IGNORECASE)
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")

DIRECTION = {
    "increased": "decreased", "decreased": "increased", "rose": "fell", "fell": "rose",
    "grew": "declined", "declined": "grew", "higher": "lower", "lower": "higher",
    "growth": "decline", "decline": "growth",
}
DIRECTION_RE = re.compile(r"\b(" + "|".join(DIRECTION) + r")\b", re.IGNORECASE)
YEAR_RANGE_RE = re.compile(r"\b(20\d\d)-(\d\d)\b")
YEAR_RE = re.compile(r"(?<![\d,.])(FY\s?)?(20\d\d)(?![\d%]|[.,]\d|\s?(?:%|per))", re.IGNORECASE)
FY_SHORT_RE = re.compile(r"\bFY\s?(\d\d)\b")


def clean(text: str) -> str:
    return " ".join(text.replace("­", "").split())


def is_good_sentence(s: str) -> bool:
    if not (55 <= len(s) <= 260) or not s[0].isupper() or s.endswith("?"):
        return False
    if BAD_RE.search(s) or not VERB_RE.search(s) or not FIGURE_RE.search(s):
        return False
    letters = sum(c.isalpha() for c in s)
    digits = sum(c.isdigit() for c in s)
    if letters / len(s) < 0.55 or digits / len(s) > 0.18:
        return False
    words = s.split()
    if not (8 <= len(words) <= 45) or len(NUM_RE.findall(s)) > 5:
        return False
    if len(STOP_RE.findall(s)) / len(words) < 0.12:  # garbled column text has few function words
        return False
    avg = sum(len(w) for w in words) / len(words)
    return 3.5 <= avg <= 8.5


def mine_sentences(doc: CorpusDoc, rng: random.Random, want: int) -> List[Tuple[int, str]]:
    """Return up to `want` (page_number, sentence) pairs, at most two per page."""
    candidates: List[Tuple[int, str]] = []
    seen = set()
    for page_no, text in enumerate(doc.pages, start=1):
        for raw in SENT_SPLIT.split(clean(text)):
            s = raw.strip()
            key = s.lower()
            if key in seen or not is_good_sentence(s):
                continue
            seen.add(key)
            candidates.append((page_no, s))
    rng.shuffle(candidates)
    picked: List[Tuple[int, str]] = []
    per_page: Counter = Counter()
    for page_no, s in candidates:
        if per_page[page_no] >= 2:
            continue
        per_page[page_no] += 1
        picked.append((page_no, s))
        if len(picked) >= want:
            break
    return picked


# ── Controlled perturbations ─────────────────────────────────────────────────

def _to_float(token: str) -> float:
    return float(token.replace(",", ""))


def _format_like(original: str, value: float) -> str:
    decimals = len(original.split(".")[1]) if "." in original else 0
    return f"{value:,.{decimals}f}" if "," in original else f"{value:.{decimals}f}"


def doc_number_set(doc: CorpusDoc) -> set:
    out = set()
    for tok in NUM_RE.findall(doc.full_text):
        try:
            out.add(round(_to_float(tok), 6))
        except ValueError:
            pass
    return out


def perturb_number(s: str, numbers: set, rng: random.Random) -> Optional[str]:
    fig = FIGURE_RE.search(s)
    if not fig:
        return None
    m = NUM_RE.search(fig.group(0))
    if not m:
        return None
    token = m.group(0)
    value = _to_float(token)
    if 1900 <= value <= 2100 and "," not in token and "." not in token and "%" not in fig.group(0):
        return None  # looks like a year
    is_pct = "%" in fig.group(0) or "per" in fig.group(0).lower()
    for _ in range(12):
        if is_pct:
            new = value + rng.choice([-1, 1]) * rng.uniform(3, 12)
        else:
            new = value * rng.choice([0.4, 0.5, 0.6, 0.7, 1.3, 1.5, 1.8, 2.5])
        if new <= 0 or abs(new - value) / max(value, 1e-9) < 0.15:
            continue
        new_tok = _format_like(token, new)
        if round(_to_float(new_tok), 6) in numbers or new_tok == token:
            continue
        start = fig.start() + m.start()
        return s[:start] + new_tok + s[start + len(token):]
    return None


def perturb_unit(s: str, rng: random.Random) -> Optional[str]:
    swaps = {"million": "billion", "billion": "million", "crore": "lakh", "lakh": "crore", "thousand": "million"}
    matches = list(re.finditer(r"\b(million|billion|crore|lakh|thousand)\b", s, re.IGNORECASE))
    if len(matches) != 1:
        return None
    m = matches[0]
    new = swaps[m.group(1).lower()]
    if m.group(1)[0].isupper():
        new = new.capitalize()
    return s[:m.start()] + new + s[m.end():]


def perturb_direction(s: str) -> Optional[str]:
    matches = list(DIRECTION_RE.finditer(s))
    if len(matches) != 1:
        return None
    m = matches[0]
    new = DIRECTION[m.group(1).lower()]
    if m.group(1)[0].isupper():
        new = new.capitalize()
    return s[:m.start()] + new + s[m.end():]


def perturb_period(s: str, rng: random.Random) -> Optional[str]:
    rng_shift = rng.choice([-1, -2, 1])
    ranges = list(YEAR_RANGE_RE.finditer(s))
    if len(ranges) == 1 and not YEAR_RE.search(YEAR_RANGE_RE.sub("", s)):
        m = ranges[0]
        y = int(m.group(1)) + rng_shift
        return s[:m.start()] + f"{y}-{(y + 1) % 100:02d}" + s[m.end():]
    years = {m.group(2) for m in YEAR_RE.finditer(YEAR_RANGE_RE.sub("", s))}
    if len(years) == 1 and not ranges:
        m = next(YEAR_RE.finditer(s))
        return s[:m.start()] + (m.group(1) or "") + str(int(m.group(2)) + rng_shift) + s[m.end():]
    return None


PERTURBATIONS = ["number_change", "unit_swap", "direction_flip", "period_swap"]


def perturb(s: str, numbers: set, rng: random.Random, prefer: str) -> Optional[Tuple[str, str]]:
    order = [prefer] + [p for p in PERTURBATIONS if p != prefer]
    for kind in order:
        if kind == "number_change":
            out = perturb_number(s, numbers, rng)
        elif kind == "unit_swap":
            out = perturb_unit(s, rng)
        elif kind == "direction_flip":
            out = perturb_direction(s)
        else:
            out = perturb_period(s, rng)
        if out and out != s:
            return out, kind
    return None


# ── Paraphrasing (local free LLM, cached, verified) ──────────────────────────

def _llm_cache_key(model: str, prompt: str) -> str:
    return hashlib.sha256(f"{model}\n{prompt}".encode("utf-8")).hexdigest()


def ollama_generate(prompt: str, model: str = PARAPHRASE_MODEL, num_predict: int = 140) -> Optional[str]:
    LLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = LLM_CACHE_DIR / f"{_llm_cache_key(model, prompt)}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))["response"]
    try:
        r = httpx.post(
            OLLAMA_URL,
            json={"model": model, "prompt": prompt, "stream": False,
                  "options": {"temperature": 0, "num_predict": num_predict}},
            timeout=300,
        )
        r.raise_for_status()
        text = r.json()["response"].strip()
    except Exception as exc:
        print(f"  ollama call failed: {exc}", flush=True)
        return None
    cache_file.write_text(json.dumps({"model": model, "prompt": prompt, "response": text}), encoding="utf-8")
    return text


def paraphrase(sentence: str) -> Optional[str]:
    prompt = (
        "Rewrite the sentence below in different words, as an analyst summarising it. "
        "Keep every number, unit, currency and date exactly as written. Do not add new facts. "
        "Return only the rewritten sentence.\n\nSentence: " + sentence
    )
    out = ollama_generate(prompt)
    if not out:
        return None
    out = clean(out.strip().strip('"'))
    return out if _paraphrase_ok(sentence, out) else None


def _norm_numbers(s: str) -> List[str]:
    return sorted(round(_to_float(t), 6).__str__() for t in NUM_RE.findall(s))


def _paraphrase_ok(orig: str, new: str) -> bool:
    if not (0.5 <= len(new) / len(orig) <= 1.7) or "\n" in new:
        return False
    if _norm_numbers(orig) != _norm_numbers(new):
        return False
    a, b = set(orig.lower().split()), set(new.lower().split())
    if len(a & b) / max(len(a | b), 1) > 0.85:  # barely changed
        return False
    neg = re.compile(r"\b(not|no|never|without)\b", re.IGNORECASE)
    if bool(neg.search(new)) != bool(neg.search(orig)):
        return False
    # reject paraphrases that introduce the opposite of a direction word in the original
    new_words = set(re.findall(r"[a-z]+", new.lower()))
    orig_dirs = {w.lower() for w in DIRECTION_RE.findall(orig)}
    return not any(DIRECTION[w] in new_words and DIRECTION[w] not in orig.lower() for w in orig_dirs)


# ── Fabricated (unverifiable) claims ─────────────────────────────────────────

SYLLABLES = ["zen", "tro", "qui", "mar", "bren", "vox", "lur", "kad", "pel", "nor", "syl", "dra", "fen", "gal", "hux", "jor", "wex", "yal"]
SUFFIXES = ["Systems", "Holdings", "Dynamics", "Partners", "Logistics", "Labs", "Capital"]
ROLES = ["Sustainability", "Data", "Risk", "Strategy", "Technology"]
MONTHS = ["March", "June", "September", "December"]


def fake_name(rng: random.Random, text_lower: str) -> str:
    for _ in range(50):
        name = "".join(rng.choice(SYLLABLES) for _ in range(rng.choice([2, 3]))).capitalize()
        if name.lower() not in text_lower:
            return name
    raise RuntimeError("could not invent an unused name")


def fabricate_claim(doc: CorpusDoc, rng: random.Random, text_lower: str) -> Tuple[str, str]:
    company = doc.meta["company"]
    inr = doc.meta.get("currency") == "INR"
    amount = rng.choice([120, 275, 410, 640, 880, 1500, 2300])
    money = f"₹{amount:,} crore" if inr else f"${amount} million"
    a, b = fake_name(rng, text_lower), fake_name(rng, text_lower)
    year = rng.choice([2023, 2024, 2025])
    templates = [
        ("acquisition", f"{company} completed the acquisition of {a} {rng.choice(SUFFIXES)} for {money} during {year}."),
        ("appointment", f"{company} appointed {a} {b} as Chief {rng.choice(ROLES)} Officer effective {rng.choice(MONTHS)} {year}."),
        ("facility", f"{company} opened a new regional headquarters in {a}ville employing {rng.choice([850, 1200, 2400, 3100])} people."),
        ("bond", f"{company} raised {money} through green bonds underwritten by {a} {rng.choice(SUFFIXES)}."),
        ("penalty", f"{company} was fined {money} by the {a} Financial Authority for compliance violations."),
    ]
    return rng.choice(templates)


# ── Assembly ─────────────────────────────────────────────────────────────────

def split_for(key: str) -> str:
    h = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16) % 1000 / 1000
    return "dev" if h < DEV_FRACTION else "test"


def build(skip_paraphrase: bool = False) -> List[dict]:
    rng = random.Random(SEED)
    corpus = load_corpus()
    items: List[dict] = []
    sources: List[Tuple[CorpusDoc, int, str]] = []

    for key, want in SOURCES_PER_DOC.items():
        doc = corpus[key]
        mined = mine_sentences(doc, rng, want)
        print(f"[{key}] mined {len(mined)}/{want} source sentences", flush=True)
        sources.extend((doc, p, s) for p, s in mined)

    numbers_cache: Dict[str, set] = {k: doc_number_set(d) for k, d in corpus.items()}
    prefs = iter(PERTURBATIONS * 1000)

    def add(doc: CorpusDoc, claim: str, label: str, subtype: str, tier: str,
            page: Optional[int], source: Optional[str]) -> None:
        item_id = f"{doc.doc_key}-{len(items):04d}"
        split_key = f"{doc.doc_key}:{page}" if page else item_id
        items.append({
            "id": item_id, "doc_key": doc.doc_key, "claim": claim, "label": label,
            "subtype": subtype, "tier": tier, "gold_page": page,
            "source_sentence": source, "split": split_for(split_key),
        })

    # Verbatim supported + contradicted
    for doc, page, sent in sources:
        add(doc, sent, "SUPPORTED", "verbatim", "verbatim", page, sent)
        res = perturb(sent, numbers_cache[doc.doc_key], rng, next(prefs))
        if res:
            add(doc, res[0], "CONTRADICTED", res[1], "verbatim", page, sent)

    # Paraphrased supported + contradicted
    if not skip_paraphrase:
        subset = rng.sample(sources, min(PARAPHRASED_SOURCES, len(sources)))
        for n, (doc, page, sent) in enumerate(subset, start=1):
            para = paraphrase(sent)
            if n % 10 == 0:
                print(f"  paraphrased {n}/{len(subset)}", flush=True)
            if not para:
                continue
            add(doc, para, "SUPPORTED", "paraphrase", "paraphrase", page, sent)
            res = perturb(para, numbers_cache[doc.doc_key], rng, next(prefs))
            if res:
                add(doc, res[0], "CONTRADICTED", res[1], "paraphrase", page, sent)

    # Fabricated unverifiable
    docs_for_fab = [corpus[k] for k in ("jpmorgan", "reliance", "sbi", "tata_motors", "hdfc", "wipro")]
    lowers = {d.doc_key: d.full_text.lower() for d in docs_for_fab}
    for i in range(FABRICATED_CLAIMS):
        doc = docs_for_fab[i % len(docs_for_fab)]
        kind, claim = fabricate_claim(doc, rng, lowers[doc.doc_key])
        add(doc, claim, "UNVERIFIABLE", kind, "fabricated", None, None)

    return items


def summarize(items: List[dict]) -> str:
    lines = [f"total={len(items)}"]
    lines.append("label x split: " + str(dict(Counter((i["label"], i["split"]) for i in items))))
    lines.append("tier: " + str(dict(Counter(i["tier"] for i in items))))
    lines.append("subtype (contradicted): " + str(dict(Counter(i["subtype"] for i in items if i["label"] == "CONTRADICTED"))))
    lines.append("doc: " + str(dict(Counter(i["doc_key"] for i in items))))
    return "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-paraphrase", action="store_true")
    args = parser.parse_args()
    data = build(skip_paraphrase=args.skip_paraphrase)
    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    DATASET_PATH.write_text(json.dumps({"seed": SEED, "items": data}, indent=1, ensure_ascii=False), encoding="utf-8")
    print(summarize(data))
    print(f"wrote {DATASET_PATH}")
