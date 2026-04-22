FROM python:3.12-slim

WORKDIR /app

COPY backend/requirements.docker.txt /app/requirements.docker.txt
RUN pip install --no-cache-dir -r /app/requirements.docker.txt

COPY backend /app

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]
