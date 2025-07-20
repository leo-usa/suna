# Render Deployment Guide for Suna

This guide covers deploying Suna on Render with separate API and background worker services.

## Overview

Suna requires two main components on Render:
1. **API Service** - Handles HTTP requests and user interactions
2. **Background Worker** - Processes agent tasks using Dramatiq

## Prerequisites

Before deploying, ensure you have:
- ✅ Redis (Upstash) configured
- ✅ RabbitMQ (LavinMQ) configured
- ✅ All environment variables ready

## Step 1: Create API Service

### Service Configuration:
- **Service Type**: Web Service
- **Name**: `suna-api` (or your preferred name)
- **Repository**: Your Suna GitHub repository
- **Branch**: `render-upstream-test` (or your deployment branch)

### Build Settings:
- **Build Command**: `cd backend && uv sync`
- **Start Command**: `cd backend && uv run gunicorn api:app --bind 0.0.0.0:$PORT --workers 4 --timeout 1800`

### Environment Variables:
Add all your environment variables:
```bash
# Database
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Upstash)
REDIS_HOST=your-upstash-host
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password
REDIS_SSL=true

# RabbitMQ (LavinMQ)
RABBITMQ_URL=amqps://username:password@hostname:port/vhost

# LLM Providers
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
MODEL_TO_USE=anthropic/claude-sonnet-4-20250514

# Other APIs
TAVILY_API_KEY=your-tavily-key
FIRECRAWL_API_KEY=your-firecrawl-key
DAYTONA_API_KEY=your-daytona-key
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us

# QStash (Background Jobs)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-current-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key
WEBHOOK_BASE_URL=https://your-api-service.onrender.com

# MCP Configuration
MCP_CREDENTIAL_ENCRYPTION_KEY=your-encryption-key

# Optional
RAPID_API_KEY=your-rapidapi-key
SMITHERY_API_KEY=your-smithery-key
NEXT_PUBLIC_URL=https://your-frontend-url.com
```

## Step 2: Create Background Worker Service

### Service Configuration:
- **Service Type**: Background Worker
- **Name**: `suna-worker` (or your preferred name)
- **Repository**: Same as API service
- **Branch**: Same as API service

### Build Settings:
- **Build Command**: `cd backend && uv sync`
- **Start Command**: `cd backend && uv run dramatiq --processes 4 --threads 4 run_agent_background`

### Environment Variables:
Use **exactly the same environment variables** as the API service.

## Step 3: Configure Service Dependencies

### API Service Dependencies:
- **Depends on**: Worker service (optional, but recommended)
- **Health Check**: `/api/health` endpoint

### Worker Service Dependencies:
- **Depends on**: API service (for database access)
- **Health Check**: Custom health check script

## Step 4: Create Health Check Script

Create `backend/worker_health.py`:
```python
#!/usr/bin/env python3
"""
Health check script for the background worker.
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

def check_redis():
    """Check Redis connectivity."""
    try:
        from services import redis
        import asyncio
        
        async def test_redis():
            await redis.initialize_async()
            await redis.set("health_check", "ok", ex=60)
            result = await redis.get("health_check")
            return result == "ok"
        
        return asyncio.run(test_redis())
    except Exception as e:
        print(f"Redis health check failed: {e}")
        return False

def check_rabbitmq():
    """Check RabbitMQ connectivity."""
    try:
        from services.rabbitmq import get_rabbitmq_connection_params
        import pika
        
        parameters = get_rabbitmq_connection_params()
        connection = pika.BlockingConnection(parameters)
        connection.close()
        return True
    except Exception as e:
        print(f"RabbitMQ health check failed: {e}")
        return False

def main():
    """Run all health checks."""
    print("🔍 Running worker health checks...")
    
    redis_ok = check_redis()
    rabbitmq_ok = check_rabbitmq()
    
    if redis_ok and rabbitmq_ok:
        print("✅ All health checks passed!")
        return 0
    else:
        print("❌ Some health checks failed!")
        return 1

if __name__ == "__main__":
    exit(main())
```

## Step 5: Update Docker Configuration

If you're using Docker, update your `backend/docker-compose.yml`:

```yaml
services:
  api:
    image: ghcr.io/suna-ai/suna-backend:latest
    platform: linux/amd64
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/.venv
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      worker:
        condition: service_started
    networks:
      - app-network
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=
      - LOG_LEVEL=INFO
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  worker:
    image: ghcr.io/suna-ai/suna-backend:latest
    platform: linux/amd64
    build:
      context: .
      dockerfile: Dockerfile
    command: uv run dramatiq --skip-logging --processes 4 --threads 4 run_agent_background
    env_file:
      - .env
    volumes:
      - .:/app
      - /app/.venv
      - ./worker-logs:/app/logs
    restart: unless-stopped
    depends_on:
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - app-network
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_PASSWORD=
      - LOG_LEVEL=INFO
      - RABBITMQ_HOST=rabbitmq
      - RABBITMQ_PORT=5672
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "uv", "run", "worker_health.py"]
      timeout: 20s
      interval: 30s
      start_period: 40s

  redis:
    image: redis:8-alpine
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis_data:/data
      - ./services/docker/redis.conf:/usr/local/etc/redis/redis.conf:ro
    restart: unless-stopped
    networks:
      - app-network
    command: redis-server /usr/local/etc/redis/redis.conf --appendonly yes --bind 0.0.0.0 --protected-mode no --maxmemory 8gb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  rabbitmq:
    image: rabbitmq
    ports:
      - "127.0.0.1:5672:5672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  app-network:
    driver: bridge

volumes:
  redis_data:
  rabbitmq_data:
```

## Step 6: Deploy and Test

### Deploy Order:
1. **Deploy API service first**
2. **Deploy worker service second**
3. **Test both services**

### Testing:
1. **API Health Check**: Visit `https://your-api-service.onrender.com/api/health`
2. **Worker Health Check**: Check worker logs for health check results
3. **Create an Agent**: Test background job processing

## Troubleshooting

### Common Issues:

1. **Worker Not Starting**
   - Check environment variables match API service
   - Verify Redis and RabbitMQ connections
   - Check worker logs for errors

2. **Jobs Not Processing**
   - Verify RabbitMQ connection
   - Check worker is running
   - Monitor LavinMQ dashboard for message activity

3. **API Can't Connect to Worker**
   - Ensure both services are deployed
   - Check shared environment variables
   - Verify network connectivity

### Debug Commands:

```bash
# Check API logs
render logs --service suna-api

# Check worker logs
render logs --service suna-worker

# Test Redis connection
curl -X GET "https://your-api-service.onrender.com/api/health"

# Monitor RabbitMQ
# Check your LavinMQ dashboard for message activity
```

## Cost Optimization

### Render Pricing:
- **Web Service**: $7/month (free tier available)
- **Background Worker**: $7/month (free tier available)
- **Total**: ~$14/month for both services

### Free Tier Limits:
- **Web Service**: 750 hours/month
- **Background Worker**: 750 hours/month
- **Suitable for**: Development and small production loads

## Monitoring

### Key Metrics to Monitor:
1. **API Response Times**
2. **Worker Queue Depth**
3. **Redis Memory Usage**
4. **RabbitMQ Message Rates**
5. **Error Rates**

### Alerts to Set Up:
1. **API Service Down**
2. **Worker Service Down**
3. **High Queue Depth**
4. **High Error Rate**

## Support

- [Render Documentation](https://render.com/docs)
- [Dramatiq Documentation](https://dramatiq.io/)
- [LavinMQ Documentation](https://www.lavinmq.com/docs/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis) 