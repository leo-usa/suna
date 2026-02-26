import redis.asyncio as redis
import os
from dotenv import load_dotenv
import asyncio
from utils.logger import logger
from typing import List, Any
from utils.retry import retry

# Redis client and connection pool
client: redis.Redis | None = None
pool: redis.ConnectionPool | None = None
# Dedicated pubsub client with longer socket timeout (listen() blocks; agent runs can have long gaps)
pubsub_client: redis.Redis | None = None
pubsub_pool: redis.ConnectionPool | None = None
_initialized = False
_init_lock = asyncio.Lock()

# Constants
REDIS_KEY_TTL = 3600 * 24  # 24 hour TTL as safety mechanism
# Pubsub needs long timeout - agent stream listen() blocks until messages; LLM/tool gaps can exceed 15s
REDIS_PUBSUB_SOCKET_TIMEOUT = 300.0  # 5 minutes


def initialize():
    """Initialize Redis connection pool and client using environment variables."""
    global client, pool, pubsub_client, pubsub_pool

    # Load environment variables if not already loaded
    load_dotenv()

    # Get Redis configuration
    redis_host = os.getenv("REDIS_HOST", "redis")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    redis_password = os.getenv("REDIS_PASSWORD", "")
    redis_ssl = os.getenv("REDIS_SSL", "False").lower() == "true"
    
    # Connection pool - cap for provider limits (Upstash/SSL=10, Render 250 limit=80)
    max_connections = int(os.getenv("REDIS_MAX_CONNECTIONS", "10" if redis_ssl else "80"))
    socket_timeout = 15.0            # 15 seconds socket timeout
    connect_timeout = 10.0           # 10 seconds connection timeout
    # Default False/0 to avoid RecursionError when Redis rejects connections (redis-py #3745).
    # Override with REDIS_RETRY_ON_TIMEOUT=true, REDIS_HEALTH_CHECK_INTERVAL=30 if needed.
    retry_on_timeout = os.getenv("REDIS_RETRY_ON_TIMEOUT", "false").lower() == "true"
    health_check_interval = int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "0"))
    pubsub_socket_timeout = float(os.getenv("REDIS_PUBSUB_SOCKET_TIMEOUT", str(REDIS_PUBSUB_SOCKET_TIMEOUT)))

    logger.info(f"Initializing Redis connection pool to {redis_host}:{redis_port} with SSL={redis_ssl} and max {max_connections} connections")

    # Create connection pool with production-optimized settings
    connection_kwargs = {
        'host': redis_host,
        'port': redis_port,
        'password': redis_password,
        'decode_responses': True,
        'socket_timeout': socket_timeout,
        'socket_connect_timeout': connect_timeout,
        'socket_keepalive': True,
        'retry_on_timeout': retry_on_timeout,
        'health_check_interval': health_check_interval,
        'max_connections': max_connections,
    }
    
    # Add SSL configuration if enabled
    if redis_ssl:
        connection_kwargs.update({
            'ssl_cert_reqs': None,  # Don't verify SSL certificate for Upstash
        })
        pool = redis.ConnectionPool(connection_class=redis.SSLConnection, **connection_kwargs)
    else:
        pool = redis.ConnectionPool(**connection_kwargs)

    # Create Redis client from connection pool
    client = redis.Redis(connection_pool=pool)

    # Pubsub pool: longer socket_timeout for listen() - agent runs can have long gaps between messages
    pubsub_connection_kwargs = {**connection_kwargs, 'socket_timeout': pubsub_socket_timeout, 'max_connections': 10}
    if redis_ssl:
        pubsub_pool = redis.ConnectionPool(connection_class=redis.SSLConnection, **pubsub_connection_kwargs)
    else:
        pubsub_pool = redis.ConnectionPool(**pubsub_connection_kwargs)
    pubsub_client = redis.Redis(connection_pool=pubsub_pool)

    return client


async def initialize_async():
    """Initialize Redis connection asynchronously."""
    global client, _initialized

    async with _init_lock:
        if not _initialized:
            logger.info("Initializing Redis connection")
            initialize()

        try:
            # Test connection with timeout
            await asyncio.wait_for(client.ping(), timeout=5.0)
            logger.info("Successfully connected to Redis")
            _initialized = True
        except asyncio.TimeoutError:
            logger.error("Redis connection timeout during initialization")
            client = None
            _initialized = False
            raise ConnectionError("Redis connection timeout")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            client = None
            _initialized = False
            raise

    return client


async def close():
    """Close Redis connection and connection pool."""
    global client, pool, pubsub_client, pubsub_pool, _initialized
    if pubsub_client:
        try:
            await asyncio.wait_for(pubsub_client.aclose(), timeout=5.0)
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Error closing pubsub client: {e}")
        finally:
            pubsub_client = None
    if pubsub_pool:
        try:
            await asyncio.wait_for(pubsub_pool.aclose(), timeout=5.0)
        except (asyncio.TimeoutError, Exception) as e:
            logger.warning(f"Error closing pubsub pool: {e}")
        finally:
            pubsub_pool = None
    if client:
        logger.info("Closing Redis connection")
        try:
            await asyncio.wait_for(client.aclose(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Redis close timeout, forcing close")
        except Exception as e:
            logger.warning(f"Error closing Redis client: {e}")
        finally:
            client = None
    
    if pool:
        logger.info("Closing Redis connection pool")
        try:
            await asyncio.wait_for(pool.aclose(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Redis pool close timeout, forcing close")
        except Exception as e:
            logger.warning(f"Error closing Redis pool: {e}")
        finally:
            pool = None
    
    _initialized = False
    logger.info("Redis connection and pool closed")


async def get_client():
    """Get the Redis client, initializing if necessary."""
    global client, _initialized
    if client is None or not _initialized:
        await retry(lambda: initialize_async())
    return client


# Basic Redis operations
async def set(key: str, value: str, ex: int = None, nx: bool = False):
    """Set a Redis key."""
    redis_client = await get_client()
    return await redis_client.set(key, value, ex=ex, nx=nx)


async def get(key: str, default: str = None):
    """Get a Redis key."""
    redis_client = await get_client()
    result = await redis_client.get(key)
    return result if result is not None else default


async def delete(key: str):
    """Delete a Redis key."""
    redis_client = await get_client()
    return await redis_client.delete(key)


async def publish(channel: str, message: str):
    """Publish a message to a Redis channel."""
    redis_client = await get_client()
    return await redis_client.publish(channel, message)


async def create_pubsub():
    """Create a Redis pubsub object. Uses dedicated client with longer socket timeout for listen()."""
    await get_client()  # Ensure main client initialized (pubsub_pool created with it)
    return pubsub_client.pubsub()


# List operations
async def rpush(key: str, *values: Any):
    """Append one or more values to a list."""
    redis_client = await get_client()
    return await redis_client.rpush(key, *values)


async def lrange(key: str, start: int, end: int) -> List[str]:
    """Get a range of elements from a list."""
    redis_client = await get_client()
    return await redis_client.lrange(key, start, end)


# Key management


async def keys(pattern: str) -> List[str]:
    redis_client = await get_client()
    return await redis_client.keys(pattern)


async def expire(key: str, seconds: int):
    redis_client = await get_client()
    return await redis_client.expire(key, seconds)
