# syntax=docker/dockerfile:1.7
# VERIFIN 2.0 API: CPU-only image. Build from the repository root:  docker build -f backend/Dockerfile -t verifin-api .
# CPU-only image. Models are baked in at build time, so a container never downloads at start-up.

FROM python:3.12-slim AS builder
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY backend/requirements.txt backend/requirements.lock.txt ./
# CPU wheels of torch (the default index serves the much larger CUDA build); every other version is pinned by the lock file.
RUN python -m venv /opt/venv \
 && /opt/venv/bin/pip install --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt -c requirements.lock.txt

FROM python:3.12-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/app \
    HF_HOME=/opt/hf-cache TRANSFORMERS_OFFLINE=1 HF_HUB_OFFLINE=1 \
    ENVIRONMENT=production DEBUG=false UPLOAD_DIR=/data/uploads

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr libgomp1 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --create-home verifin \
 && mkdir -p /data/uploads /opt/hf-cache && chown -R verifin /data /opt/hf-cache

COPY --from=builder /opt/venv /opt/venv

# Fetch the three models once, with the network enabled only for this step.
RUN HF_HUB_OFFLINE=0 TRANSFORMERS_OFFLINE=0 python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
CrossEncoder('cross-encoder/nli-deberta-v3-small'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')" \
 && chown -R verifin /opt/hf-cache

WORKDIR /app
COPY --chown=verifin backend/app ./app
COPY --chown=verifin data/demo /data/demo

USER verifin
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/system/live', timeout=4).status == 200 else 1)"

# One worker: the models are held in memory, and the rate limiter and job queue are per process.
# Scale out with more containers behind a load balancer.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
