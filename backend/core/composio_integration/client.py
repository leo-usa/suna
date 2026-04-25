import os
from typing import Optional
from composio_client import Composio
from core.utils.logger import logger


def resolve_composio_api_key(explicit: Optional[str] = None) -> Optional[str]:
    """Prefer explicit key, then env, then pydantic config (matches how backend loads .env)."""
    k = explicit or os.getenv("COMPOSIO_API_KEY")
    if not k:
        try:
            from core.utils.config import config

            k = getattr(config, "COMPOSIO_API_KEY", None)
        except Exception:
            k = None
    if k and str(k).strip():
        return str(k).strip()
    return None


class ComposioClient:
    _instance: Optional[Composio] = None
    
    @classmethod
    def get_client(cls, api_key: Optional[str] = None) -> Composio:
        if cls._instance is None:
            key = resolve_composio_api_key(api_key)
            if not key:
                raise ValueError("COMPOSIO_API_KEY is required")
            
            logger.debug("Initializing Composio client")
            cls._instance = Composio(api_key=key)
        
        return cls._instance
    
    @classmethod
    def reset_client(cls) -> None:
        cls._instance = None


def get_composio_client(api_key: Optional[str] = None) -> Composio:
    return ComposioClient.get_client(api_key) 