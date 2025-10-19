# Use Python base image
FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    libssl-dev \
    libffi-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt ./
# Upgrade packaging tools so pip can use prebuilt wheels when available
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY app ./app

# Copy tests and pytest configuration (for running tests inside container)
COPY ./tests ./tests
COPY ./pytest.ini ./pytest.ini

# Create storage directory
RUN mkdir -p /app/storage

# Expose port
EXPOSE 8000

# Start the app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
