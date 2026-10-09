import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from sentence_transformers import CrossEncoder

model_name = "cross-encoder/nli-deberta-v3-small"
print("Loading model:", model_name)

tok = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)
ce = CrossEncoder(model_name)

print("config.id2label:", model.config.id2label)
print("config.label2id:", model.config.label2id)

# Test cases: Canonical SNLI/MNLI
test_pairs = [
    ("A man is playing soccer outdoors.", "A person is playing a sport.", "ENTAILMENT"),
    ("A man is playing soccer outdoors.", "A man is sleeping in his bed.", "CONTRADICTION"),
    ("A man is playing soccer outdoors.", "The man loves eating pepperoni pizza.", "NEUTRAL"),
    ("Alphabet reported revenue of $350 billion in 2024.", "Alphabet had $350 billion in revenue in 2024.", "FINANCIAL ENTAILMENT"),
    ("Alphabet reported revenue of $350 billion in 2024.", "Alphabet revenue was only $50 billion.", "FINANCIAL CONTRADICTION"),
    ("Alphabet reported revenue of $350 billion in 2024.", "Alphabet hired a new chef in Chicago.", "FINANCIAL NEUTRAL"),
]

print("\n--- Testing Premise -> Hypothesis: (premise, hypothesis) ---")
for p, h, expected in test_pairs:
    inp = tok(p, h, return_tensors="pt")
    logits = model(**inp).logits[0]
    probs = torch.softmax(logits, dim=0).tolist()
    ce_probs = ce.predict([(p, h)], apply_softmax=True)[0]
    pred_idx = int(torch.argmax(logits))
    pred_label = model.config.id2label[pred_idx]
    print(f"Expected: {expected}")
    print(f"  P: '{p}'")
    print(f"  H: '{h}'")
    print(f"  Raw Logits: {[round(x.item(), 4) for x in logits]}")
    print(f"  Probs (idx 0={model.config.id2label[0]}, 1={model.config.id2label[1]}, 2={model.config.id2label[2]}): {[round(x, 4) for x in probs]}")
    print(f"  Predicted Label: {pred_label} (argmax={pred_idx})")
    print(f"  CrossEncoder predict: {[round(x, 4) for x in ce_probs.tolist()]}")
    print()

print("\n--- Testing Hypothesis -> Premise: (hypothesis, premise) ---")
for p, h, expected in test_pairs:
    inp = tok(h, p, return_tensors="pt")
    logits = model(**inp).logits[0]
    probs = torch.softmax(logits, dim=0).tolist()
    pred_idx = int(torch.argmax(logits))
    pred_label = model.config.id2label[pred_idx]
    print(f"Expected: {expected} | Pred: {pred_label} (argmax={pred_idx}) | Probs: {[round(x, 4) for x in probs]}")
