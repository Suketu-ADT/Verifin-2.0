from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router

app = FastAPI(title="VERIFIN API", description="API for VERIFIN Hallucination Detection")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "Welcome to VERIFIN API"}

@app.get("/api/system/health")
def health_check():
    return {
        "status": "operational",
        "services": {
            "backend": "operational",
            "database": "operational",
            "embedding": "not_loaded",
            "nli": "not_loaded"
        }
    }
