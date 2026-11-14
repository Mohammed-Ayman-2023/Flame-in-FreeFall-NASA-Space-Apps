# Flame in Freefall: one container = the website + its API + the three trained models.
# Build:  docker build -t flame-in-freefall .
# Run:    docker run -p 7860:7860 -e GOOGLE_API_KEY=... flame-in-freefall   (key optional)
# Works as-is on Hugging Face Spaces (Docker SDK, port 7860) and Render (reads $PORT).

# ---- 1. build the website
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ---- 2. the API, serving the built site from web/dist
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=7860
RUN useradd -m -u 1000 app
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY --chown=app . .
COPY --chown=app --from=web /web/dist web/dist
USER app
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request,os;urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\",\"7860\")}/api/health')"
CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
