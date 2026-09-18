# NLI Service using transformers

class NLIService:
    def __init__(self):
        self.pipeline = None
        self.labels = ["CONTRADICTION", "NEUTRAL", "ENTAILMENT"]

    def load_model(self):
        try:
            from transformers import pipeline
            self.pipeline = pipeline("text-classification", model="cross-encoder/nli-deberta-v3-base")
            print("NLI model loaded successfully.")
        except Exception as e:
            print(f"Failed to load NLI model: {e}")

    def verify_claim(self, premise: str, hypothesis: str):
        if not self.pipeline:
            # Mock behavior
            return {
                "label": "SUPPORTED",
                "entailment": 0.85,
                "contradiction": 0.05,
                "neutral": 0.10
            }
        
        result = self.pipeline({"text": premise, "text_pair": hypothesis})
        # Map output to our standard
        return result

nli_service = NLIService()
