"""
Utility functions for handling image operations.
"""

import base64
import uuid
from datetime import datetime
from core.utils.logger import logger
from core.services.supabase import DBConnection

async def upload_base64_image(base64_data: str, bucket_name: str = "image-uploads", content_type: str = "image/png", filename: str = None) -> str:
    """Upload a base64 encoded image to Supabase storage and return the URL.
    
    Args:
        base64_data (str): Base64 encoded image data (with or without data URL prefix)
        bucket_name (str): Name of the storage bucket to upload to
        content_type (str): MIME type stored with the object
        filename (str): Object name to write. Pass this when the caller needs the
            public URL before the upload finishes; otherwise one is generated.
        
    Returns:
        str: Public URL of the uploaded image
    """
    try:
        # Remove data URL prefix if present
        if base64_data.startswith('data:'):
            base64_data = base64_data.split(',')[1]
        
        # Decode base64 data
        image_data = base64.b64decode(base64_data)
        
        # Generate unique filename
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_id = str(uuid.uuid4())[:8]
            ext = "jpg" if content_type in ("image/jpeg", "image/jpg") else "png"
            filename = f"image_{timestamp}_{unique_id}.{ext}"
        
        # Upload to Supabase storage - use singleton, already initialized
        db = DBConnection()
        client = await db.client
        storage_response = await client.storage.from_(bucket_name).upload(
            filename,
            image_data,
            {"content-type": content_type}
        )
        
        # Get public URL
        public_url = await client.storage.from_(bucket_name).get_public_url(filename)
        
        logger.debug(f"Successfully uploaded image to {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Error uploading base64 image: {e}")
        raise RuntimeError(f"Failed to upload image: {str(e)}")

async def upload_image_bytes(image_bytes: bytes, content_type: str = "image/png", bucket_name: str = "agent-profile-images") -> str:
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        ext = "png"
        if content_type == "image/jpeg" or content_type == "image/jpg":
            ext = "jpg"
        elif content_type == "image/webp":
            ext = "webp"
        elif content_type == "image/gif":
            ext = "gif"
        filename = f"agent_profile_{timestamp}_{unique_id}.{ext}"

        # Use singleton - already initialized at startup
        db = DBConnection()
        client = await db.client
        await client.storage.from_(bucket_name).upload(
            filename,
            image_bytes,
            {"content-type": content_type}
        )

        public_url = await client.storage.from_(bucket_name).get_public_url(filename)
        logger.debug(f"Successfully uploaded agent profile image to {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"Error uploading image bytes: {e}")
        raise RuntimeError(f"Failed to upload image: {str(e)}")
