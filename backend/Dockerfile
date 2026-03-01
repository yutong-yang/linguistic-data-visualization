FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    langchain \
    langchain-openai \
    langchain-text-splitters \
    numpy \
    pandas \
    pypdf2 \
    python-docx \
    python-dotenv \
    python-multipart \
    scikit-learn \
    sentence-transformers \
    httpx \
    pydantic

# Copy application code
COPY api.py knowledge_base.py database_explorer.py ./

# Copy knowledge database (pre-built vectors)
# COPY knowledge_db/ ./knowledge_db/

# HF Spaces runs on port 7860
ENV PORT=7860
ENV HOST=0.0.0.0
ENV RELOAD=false
ENV LOG_LEVEL=info

EXPOSE 7860

CMD ["python", "-c", "import uvicorn; uvicorn.run('api:app', host='0.0.0.0', port=7860, log_level='info')"]
