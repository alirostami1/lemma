FROM docker.io/library/debian:bookworm-slim

ENV PYTHONUNBUFFERED=1
ENV WORKBOOK_WORKER_HOST=0.0.0.0
ENV WORKBOOK_WORKER_PORT=8080
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/usr/lib/python3/dist-packages:/usr/lib/libreoffice/program"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    python3 \
    libreoffice-calc \
    libreoffice-script-provider-python \
    python3-uno \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.9.13 /uv /uvx /bin/
COPY apps/libreoffice-worker/pyproject.toml apps/libreoffice-worker/uv.lock* ./
COPY apps/libreoffice-worker/src ./src

RUN uv sync --frozen --no-dev

RUN useradd --create-home --uid 10001 worker

USER worker

CMD ["uv", "run", "--frozen", "lemma-libreoffice-worker"]
