# ----- Build stage -----
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir --user -r requirements.txt

# ----- Runtime stage (non-root) -----
FROM python:3.11-slim AS runtime

WORKDIR /app
RUN useradd --uid 10001 --create-home --shell /bin/bash appuser

# Bring in the packages installed in the builder stage
COPY --from=builder /root/.local /home/appuser/.local
COPY . .

RUN chown -R appuser:appuser /app /home/appuser
USER 10001
ENV PATH=/home/appuser/.local/bin:$PATH

CMD ["python", "worker.py"]
