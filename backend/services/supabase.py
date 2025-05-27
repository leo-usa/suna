"""
Centralized database connection management for AgentPress using Supabase.
"""

import os
from typing import Optional
from supabase import create_async_client, AsyncClient
from utils.logger import logger
from utils.config import config
from storage3._async.client import AsyncStorageClient

class DBConnection:
    """Singleton database connection manager using Supabase."""
    
    _instance: Optional['DBConnection'] = None
    _initialized = False
    _client: Optional[AsyncClient] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """No initialization needed in __init__ as it's handled in __new__"""
        pass

    async def initialize(self):
        """Initialize the database connection."""
        if self._initialized:
            return
                
        try:
            supabase_url = config.SUPABASE_URL
            # Use service role key preferentially for backend operations
            supabase_key = config.SUPABASE_SERVICE_ROLE_KEY or config.SUPABASE_ANON_KEY
            
            if not supabase_url or not supabase_key:
                logger.error("Missing required environment variables for Supabase connection")
                raise RuntimeError("SUPABASE_URL and a key (SERVICE_ROLE_KEY or ANON_KEY) environment variables must be set.")

            logger.debug("Initializing Supabase connection")
            self._client = await create_async_client(supabase_url, supabase_key)
            self._initialized = True
            key_type = "SERVICE_ROLE_KEY" if config.SUPABASE_SERVICE_ROLE_KEY else "ANON_KEY"
            logger.debug(f"Database connection initialized with Supabase using {key_type}")
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            raise RuntimeError(f"Failed to initialize database connection: {str(e)}")

    @classmethod
    async def disconnect(cls):
        """Disconnect from the database."""
        if cls._client:
            logger.info("Disconnecting from Supabase database")
            await cls._client.close()
            cls._initialized = False
            logger.info("Database disconnected successfully")

    @property
    async def client(self) -> AsyncClient:
        """Get the Supabase client instance."""
        if not self._initialized:
            logger.debug("Supabase client not initialized, initializing now")
            await self.initialize()
        if not self._client:
            logger.error("Database client is None after initialization")
            raise RuntimeError("Database not initialized")
        return self._client

# --- Supabase Storage Helpers ---
async def get_storage_client() -> AsyncStorageClient:
    """Get an async Supabase Storage client."""
    supabase_url = config.SUPABASE_URL
    supabase_key = config.SUPABASE_SERVICE_ROLE_KEY or config.SUPABASE_ANON_KEY
    storage_url = f"{supabase_url}/storage/v1"
    return AsyncStorageClient(storage_url, {"authorization": f"Bearer {supabase_key}"})

async def upload_file_to_storage(bucket: str, path: str, file_bytes: bytes, content_type: str = None) -> str:
    """Upload a file to Supabase Storage and return the public URL."""
    storage = await get_storage_client()
    # Try to delete the file if it exists (ignore errors)
    try:
        await storage.from_(bucket).remove([path])
    except Exception:
        pass
    await storage.from_(bucket).upload(
        path,
        file_bytes,
        file_options={"content-type": content_type or "application/octet-stream"}
    )
    public_url = f"{config.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"
    return public_url


