# ── Build frontend ──────────────────────────────────────────
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Python backend ──────────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ backend/
COPY seed_data.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Copy built frontend into static dir
COPY --from=frontend /app/frontend/dist /app/static

EXPOSE 8080
CMD ["./entrypoint.sh"]
