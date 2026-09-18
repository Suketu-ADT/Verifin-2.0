import numpy as np

# In a real scenario, this would load sentence-transformers
# from sentence_transformers import SentenceTransformer
# model = SentenceTransformer('all-MiniLM-L6-v2')

class EmbeddingService:
    def __init__(self):
        self.model = None

    def load_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer('all-MiniLM-L6-v2')
            print("Embedding model loaded successfully.")
        except Exception as e:
            print(f"Failed to load embedding model: {e}")

    def get_embedding(self, text: str):
        if not self.model:
            return np.random.rand(384).tolist() # Fallback mock
        return self.model.encode(text).tolist()

    def cosine_similarity(self, vec1, vec2):
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))

embedding_service = EmbeddingService()
