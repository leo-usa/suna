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
