# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Evita .pyc + buffering de logs (los queremos ver en tiempo real en Render)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Copio solo requirements para aprovechar el cache de Docker layer
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App
COPY app ./app

# Render inyecta $PORT en runtime; default 8000 para correr local con docker run
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
