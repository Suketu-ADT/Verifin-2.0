# VERIFIN 2.0 — Backend Service (Phase 1A Foundation)

FastAPI-powered asynchronous backend foundation for **VERIFIN 2.0** — an interpretable hallucination detection platform for financial LLMs.

---

## 1. Architecture & Directory Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI entrypoint, CORS, lifespan, exception handlers
│   ├── config.py                # Pydantic Settings & environment variable configuration
│   │
│   ├── api/                     # REST API routers matching frontend contract
│   │   ├── __init__.py
│   │   ├── system.py            # /api/system/health
│   │   ├── documents.py         # /api/documents/upload
│   │   ├── verification.py      # /api/verification/start & /{id}/results
│   │   └── demo.py              # /api/demo/run
│   │
│   ├── schemas/                 # Pydantic request/response schemas (exact mirror of frontend/src/lib/api.ts)
│   │   ├── __init__.py
│   │   ├── system.py
│   │   ├── document.py
│   │   ├── verification.py
│   │   └── demo.py
│   │
│   ├── models/                  # Internal MongoDB document models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── document.py
│   │   ├── verification.py
│   │   └── claim.py
│   │
│   ├── database/                # Motor async MongoDB connection & index definitions
│   │   ├── __init__.py
│   │   ├── mongodb.py           # Client lifespan, ping check, dependency provider
│   │   └── indexes.py           # Index creation for users, documents, sessions, claims
│   │
│   ├── services/                # Business logic layer
│   │   ├── __init__.py
│   │   ├── document_service.py  # Validation, storage abstraction, metadata persistence
│   │   ├── verification_service.py # Session creation, state retrieval (no fabricated ML)
│   │   └── demo_service.py      # Canned demo dataset loader (data/demo/demo_data.json)
│   │
│   ├── repositories/            # Database access layer
│   │   ├── __init__.py
│   │   ├── document_repository.py
│   │   ├── verification_repository.py
│   │   └── user_repository.py
│   │
│   └── utils/                   # Structured logging & utility helpers
│       ├── __init__.py
│       └── logging.py
│
├── tests/                       # Pytest test suite
│   ├── __init__.py
│   ├── test_health.py           # Health endpoint and degraded state tests
│   └── test_api_structure.py    # Route registration, upload validations, demo tests
│
├── storage/
│   └── uploads/                 # Local filesystem storage abstraction (gitignored)
│       └── .gitkeep
│
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment configuration template
├── .gitignore                   # Backend-specific git ignore rules
└── README.md                    # Documentation
```

---

## 2. Prerequisites

- **Python**: 3.11+ (Python 3.14 verified)
- **MongoDB**: 6.0+ (Local or MongoDB Atlas)

---

## 3. Setup & Installation

1. Navigate to the `backend` folder:
   ```powershell
   cd backend
   ```

2. (Optional) Create and activate a virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Configure environment:
   ```powershell
   cp .env.example .env
   ```

   Key `.env` variables:
   - `MONGODB_URI`: MongoDB connection string (e.g. `mongodb://localhost:27017`)
   - `MONGODB_DATABASE`: Database name (default: `verifin`)
   - `FRONTEND_URL`: Frontend dev origin (default: `http://localhost:5173`)
   - `API_HOST`: Bind host (default: `0.0.0.0`)
   - `API_PORT`: Bind port (default: `8000`)
   - `UPLOAD_DIR`: Local storage directory (default: `./storage/uploads`)
   - `MAX_UPLOAD_SIZE_MB`: Max PDF file size (default: `25`)

---

## 4. Running the Backend Server

Start the Uvicorn server:
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive Swagger documentation is available at:
`http://localhost:8000/docs`

---

## 5. Running the Test Suite

Run pytest:
```powershell
pytest -v tests/
```

Unit tests mock external dependencies, allowing testing without a running MongoDB cluster.

---

## 6. API Endpoints & Frontend Contract Compatibility

The backend implements the exact contract required by `frontend/src/lib/api.ts`:

| Method | Endpoint | Description | Contract Schema |
|---|---|---|---|
| `GET` | `/api/system/health` | Check backend & database status | `HealthResponse` |
| `POST` | `/api/documents/upload` | Upload & validate PDF documents | `DocumentResponse` |
| `POST` | `/api/verification/start` | Queue verification session | `VerificationResultResponse` |
| `GET` | `/api/verification/{id}/results` | Fetch session & claim status | `VerificationResultResponse` |
| `POST` | `/api/demo/run` | Execute canned reference demo | `DemoRunResponse` |

---

## 7. MongoDB Collections & Indexes

- **`users`**:
  - `email` (unique, sparse)
  - `google_id` (sparse)
- **`documents`**:
  - `user_id` (ascending)
  - `created_at` (descending)
- **`verification_sessions`**:
  - `user_id` (ascending)
  - `document_id` (ascending)
  - `created_at` (descending)
- **`claims`**:
  - `session_id` (ascending)

---

## 8. Important Phase 1A Design Decisions

- **No Fabricated Data**: If verification ML pipeline is not yet executed, results return `status="queued"` with empty claims. Fake scores or hallucinated NLI probabilities are never generated.
- **Reference Demo**: `/api/demo/run` cleanly serves the canonical dataset from `data/demo/demo_data.json` without modifying or mixing with production collections.
- **Storage Abstraction**: File upload storage is separated from database metadata and isolated in `StorageBackend`, allowing transparent future migration to S3 or GCP Cloud Storage.
