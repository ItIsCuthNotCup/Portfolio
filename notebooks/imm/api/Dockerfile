# IMM Lab — Cloud Run prediction API
# Slim Python image, copy app, run gunicorn+uvicorn workers.

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Cloud Run sets $PORT; honor it. Single worker keeps memory under 512MB.
CMD exec gunicorn main:app \
    --bind :${PORT} \
    --workers 1 \
    --threads 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --timeout 30
