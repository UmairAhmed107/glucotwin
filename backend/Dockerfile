# ==============================================================================
# GlucoTwin - Backend Dockerfile (Python 3.11)
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code, guidelines, metrics, and models
COPY . /app/

# Environment defaults
ENV PYTHONUNBUFFERED=1 \
    PORT=8000 \
    DATABASE_URL=sqlite:///./glucotwin.db \
    MOCK_GEMINI=true

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
