def calculate_risk(nli_label: str, entailment_score: float, similarity_score: float) -> str:
    """
    Calculates the risk level of a claim based on NLI and retrieval signals.
    """
    if nli_label in ["SUPPORTED", "ENTAILMENT"]:
        if entailment_score > 0.8 and similarity_score > 0.8:
            return "LOW"
        return "MEDIUM"
        
    if nli_label == "CONTRADICTED":
        return "HIGH"
        
    if nli_label in ["UNVERIFIABLE", "NEUTRAL"]:
        if similarity_score < 0.5:
            return "MEDIUM" # High chance of hallucination / ungrounded
        return "HIGH"
        
    return "UNKNOWN"
