import torch
from sentence_transformers import CrossEncoder

model_name = "cross-encoder/nli-deberta-v3-small"
ce = CrossEncoder(model_name)

# id2label: {0: 'contradiction', 1: 'entailment', 2: 'neutral'}
labels = {0: "CONTRADICTED", 1: "SUPPORTED", 2: "UNVERIFIED"}

premise = (
    "In fiscal year 2024, Alphabet reported consolidated revenues of $350.0 billion, "
    "reflecting an increase of 14% year-over-year compared to $307.4 billion in fiscal year 2023. "
    "Capital expenditures for the fourth quarter reached $13.1 billion, driven by AI technical infrastructure."
)

claims = [
    ("Alphabet generated 350 billion in consolidated revenue in 2024.", "SUPPORTED"),
    ("Alphabet 2024 revenues were lower than 2023 revenues.", "CONTRADICTED"),
    ("Alphabet reported fourth quarter capital expenditures of 13.1 billion dollars.", "SUPPORTED"),
    ("Alphabet spent $50 billion on capital expenditures in Q4.", "CONTRADICTED"),
    ("Alphabet announced a new corporate headquarters opening in Tokyo.", "UNVERIFIED"),
    ("Alphabet CEO visited customers in Paris during December.", "UNVERIFIED"),
]

print("Evaluating realistic financial premise vs claims:\n")
for claim, expected in claims:
    # Premise = Evidence passage, Hypothesis = Claim
    probs = ce.predict([(premise, claim)], apply_softmax=True)[0]
    # idx 0: contradiction, idx 1: entailment, idx 2: neutral
    p_contra = float(probs[0])
    p_supp = float(probs[1])
    p_unver = float(probs[2])
    
    pred_idx = int(probs.argmax())
    pred_label = labels[pred_idx]
    
    print(f"Claim: '{claim}'")
    print(f"  Expected: {expected} | Predicted: {pred_label} (idx={pred_idx})")
    print(f"  SUPPORTED: {p_supp:.4f} | CONTRADICTED: {p_contra:.4f} | UNVERIFIED: {p_unver:.4f}")
    print()
