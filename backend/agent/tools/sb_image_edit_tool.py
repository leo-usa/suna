from typing import Optional
from agentpress.tool import ToolResult, openapi_schema, xml_schema
from sandbox.tool_base import SandboxToolsBase
from agentpress.thread_manager import ThreadManager
import httpx
from io import BytesIO
import uuid
from litellm import aimage_generation, aimage_edit
import aiohttp  # For direct OpenRouter API calls
import replicate
import asyncio
import base64
from services.billing import calculate_image_cost, calculate_video_cost
from utils.logger import logger
import sys
import os
import json
from datetime import datetime

# Image generation log file
IMAGE_LOG_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "logs", "image_generation.log")

def _log(msg: str):
    """Force unbuffered logging to stderr AND file."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_msg = f"[{timestamp}] {msg}"
    print(log_msg, file=sys.stderr, flush=True)
    logger.info(msg)
    # Also write to file
    try:
        os.makedirs(os.path.dirname(IMAGE_LOG_FILE), exist_ok=True)
        with open(IMAGE_LOG_FILE, "a") as f:
            f.write(log_msg + "\n")
    except Exception:
        pass


class SandboxImageEditTool(SandboxToolsBase):
    """Tool for generating or editing images using GPT Image 1 or Gemini 3 Pro Image."""

    def __init__(self, project_id: str, thread_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self.thread_manager = thread_manager

    def _get_size_from_aspect_ratio(self, aspect_ratio: str) -> str:
        """Map aspect ratio to OpenAI GPT Image 1 supported sizes."""
        size_mapping = {
            "square": "1024x1024",      # 1:1 aspect ratio
            "portrait": "1024x1536",    # 2:3 aspect ratio (closest to 9:16)
            "landscape": "1536x1024",   # 3:2 aspect ratio (closest to 16:9)
        }
        return size_mapping.get(aspect_ratio, "1024x1024")  # Default to square if invalid

    async def _generate_with_gpt_image(self, prompt: str, size: str) -> dict:
        """Generate image using GPT Image 1."""
        response = await aimage_generation(
            model="gpt-image-1.5",
            prompt=prompt,
            n=1,
            size=size,
        )
        # Extract base64 from GPT response
        b64_data = response.data[0].b64_json
        return {"b64_data": b64_data, "model": "gpt-image-1.5"}

    async def _edit_with_gpt_image(self, prompt: str, image_bytes: bytes, size: str) -> dict:
        """Edit image using GPT Image 1."""
        image_io = BytesIO(image_bytes)
        image_io.name = "image.png"
        
        response = await aimage_edit(
            image=[image_io],
            prompt=prompt,
            model="gpt-image-1.5",
            n=1,
            size=size,
        )
        b64_data = response.data[0].b64_json
        return {"b64_data": b64_data, "model": "gpt-image-1.5"}

    async def _generate_with_gemini(self, prompt: str, aspect_ratio: str, image_bytes: Optional[bytes] = None) -> dict:
        """Generate or edit image using Gemini 3 Pro Image via OpenRouter (direct API call)."""
        import os
        
        # Get OpenRouter API key
        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise Exception("OPENROUTER_API_KEY environment variable not set")
        
        # Build messages
        if image_bytes:
            # Edit mode: include the image in the message
            b64_image = base64.b64encode(image_bytes).decode('utf-8')
            messages = [{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{b64_image}"
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Edit this image: {prompt}"
                    }
                ]
            }]
        else:
            # Generate mode: text prompt only with aspect ratio hint
            aspect_hint = {
                "square": "Create a square (1:1) image.",
                "portrait": "Create a portrait (9:16) vertical image.",
                "landscape": "Create a landscape (16:9) horizontal image."
            }.get(aspect_ratio, "")
            
            full_prompt = f"{prompt} {aspect_hint}".strip()
            messages = [{"role": "user", "content": full_prompt}]
        
        # Direct API call to OpenRouter (bypassing LiteLLM)
        _log(f"🔍🔍🔍 CALLING OPENROUTER DIRECTLY (no LiteLLM) 🔍🔍🔍")
        _log(f"🔍 Model: google/gemini-3-pro-image-preview")
        _log(f"🔍 Prompt: {prompt[:100]}...")
        
        payload = {
            "model": "google/gemini-3-pro-image-preview",
            "messages": messages,
            "modalities": ["image", "text"]
        }
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                result = await response.json()
        
        # Log the raw response
        _log(f"🔍 RAW OPENROUTER RESPONSE: {json.dumps(result, default=str)[:2000]}")
        
        # Check for API error
        if "error" in result:
            error_msg = result.get("error", {}).get("message", str(result["error"]))
            _log(f"❌ OPENROUTER ERROR: {error_msg}")
            raise Exception(f"OpenRouter API error: {error_msg}")
        
        # Parse the response - it's a plain JSON dict now
        if not result.get("choices"):
            _log(f"❌ OPENROUTER ERROR: No choices in response")
            raise Exception("No choices in OpenRouter response")
        
        message = result["choices"][0].get("message", {})
        _log(f"🔍 message keys: {list(message.keys())}")
        
        # Method 1: Check for 'images' array (OpenRouter's documented format)
        if message.get("images"):
            _log(f"🎨 Found images array with {len(message['images'])} image(s)")
            image_data = message["images"][0]
            image_url = image_data.get("image_url", {}).get("url", "")
            if image_url:
                _log(f"🎨 Image URL prefix: {image_url[:50]}...")
                # Extract base64 from data URL: "data:image/png;base64,..."
                if image_url.startswith("data:") and "," in image_url:
                    b64_data = image_url.split(",", 1)[1]
                    _log(f"🎨 SUCCESS: Extracted base64 image ({len(b64_data)} chars)")
                    return {"b64_data": b64_data, "model": "gemini-3-pro-image"}
                else:
                    # Might be raw base64 without data URL prefix
                    _log(f"🎨 SUCCESS: Using raw image URL as base64")
                    return {"b64_data": image_url, "model": "gemini-3-pro-image"}
        
        # Method 2: Check for 'parts' with 'inline_data' (Google native format)
        parts = message.get("parts", [])
        if parts:
            _log(f"🔍 Found parts array with {len(parts)} part(s)")
            for i, part in enumerate(parts):
                if isinstance(part, dict) and "inline_data" in part:
                    inline_data = part["inline_data"]
                    b64_data = inline_data.get("data", "")
                    if b64_data:
                        _log(f"🎨 SUCCESS: Found image in parts[{i}].inline_data ({len(b64_data)} chars)")
                        return {"b64_data": b64_data, "model": "gemini-3-pro-image"}
        
        # Method 3: Check content for text response (possible rejection)
        content = message.get("content", "")
        if content and isinstance(content, str):
            _log(f"⚠️ GEMINI returned text instead of image: {content[:200]}...")
            raise Exception(f"Gemini returned text instead of image (possible content policy rejection): {content[:200]}...")
        
        # If we get here, we couldn't find the image
        _log(f"❌ GEMINI ERROR: No image found in response. Full message: {json.dumps(message, default=str)[:500]}")
        raise Exception("No image found in Gemini response")

    @openapi_schema(
        {
            "type": "function",
            "function": {
                "name": "image_edit_or_generate",
                "description": "Generate a new image from a prompt, edit an existing image, or generate a video. REQUIRED: You MUST specify the 'model' parameter ('gemini', 'gpt-image-1.5', or 'video'). Also specify 'aspect_ratio' when user requests a specific format. Video uses Sora 2 (default) with Replicate seedance-1.5-pro fallback.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "mode": {
                            "type": "string",
                            "enum": ["generate", "edit", "video"],
                            "description": "'generate' to create a new image, 'edit' to edit an existing image, 'video' to generate a video.",
                        },
                        "prompt": {
                            "type": "string",
                            "description": "Text prompt describing the desired image, edit, or video.",
                        },
                        "image_path": {
                            "type": "string",
                            "description": "(edit/video mode) Path to an image file relative to /workspace. Required for 'edit', optional for 'video' (image-to-video).",
                        },
                        "aspect_ratio": {
                            "type": "string",
                            "enum": ["square", "portrait", "landscape"],
                            "description": "Aspect ratio. 'square' (1:1), 'portrait' (9:16), or 'landscape' (16:9). Defaults to 'square' for images, '16:9' for video.",
                            "default": "square"
                        },
                        "model": {
                            "type": "string",
                            "enum": ["gpt-image-1.5", "gemini", "video"],
                            "description": "REQUIRED: Model to use. 'gemini' (Google Gemini 3 Pro Image), 'gpt-image-1.5' (OpenAI), or 'video' (video generation via Sora 2 with Replicate fallback).",
                        },
                        "video_options": {
                            "type": "object",
                            "description": "(video mode only) Options for video generation.",
                            "properties": {
                                "provider": {"type": "string", "enum": ["sora", "replicate"], "description": "Video provider. 'sora' (Sora 2, default) or 'replicate' (Seedance 1.5 Pro). Default: sora."},
                                "duration": {"type": "integer", "description": "Video duration in seconds (2-15 for sora, 2-12 for replicate). Default: 5."},
                                "aspect_ratio": {"type": "string", "enum": ["16:9", "9:16", "4:3", "3:4", "1:1"], "description": "Video aspect ratio. Default: 16:9."},
                                "generate_audio": {"type": "boolean", "description": "Whether to generate audio. Default: false."},
                                "camera_fixed": {"type": "boolean", "description": "Keep camera fixed. Default: false."},
                            },
                        },
                    },
                    "required": ["mode", "prompt", "model"],
                },
            },
        }
    )
    @xml_schema(
        tag_name="image-edit-or-generate",
        mappings=[
            {"param_name": "mode", "node_type": "attribute", "path": "."},
            {"param_name": "prompt", "node_type": "attribute", "path": "."},
            {"param_name": "image_path", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "aspect_ratio", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "model", "node_type": "attribute", "path": ".", "required": True},
            {"param_name": "video_options", "node_type": "attribute", "path": ".", "required": False},
        ],
        example="""
        <function_calls>
        <invoke name="image_edit_or_generate">
        <parameter name="mode">generate</parameter>
        <parameter name="prompt">A futuristic cityscape at sunset with tall skyscrapers and golden light</parameter>
        <parameter name="aspect_ratio">landscape</parameter>
        <parameter name="model">gemini</parameter>
        </invoke>
        </function_calls>
        """,
    )
    async def image_edit_or_generate(
        self,
        mode: str,
        prompt: str,
        model: str,
        image_path: Optional[str] = None,
        aspect_ratio: str = "square",
        video_options: Optional[dict] = None,
    ) -> ToolResult:
        """Generate or edit images using GPT Image 1 or Gemini 3 Pro Image, or generate videos using Sora 2 / Replicate."""
        _log(f"🎨🎨🎨 MEDIA TOOL CALLED: mode={mode} | model={model} | aspect_ratio={aspect_ratio} | prompt={prompt[:50]}...")
        try:
            await self._ensure_sandbox()

            # Handle video generation
            if mode == "video" or model == "video":
                return await self._generate_video(prompt, image_path, video_options)

            # Get the appropriate size based on aspect ratio (for GPT)
            size = self._get_size_from_aspect_ratio(aspect_ratio)
            
            # Get image bytes if editing
            image_bytes = None
            if mode == "edit":
                if not image_path:
                    return self.fail_response("'image_path' is required for edit mode.")
                image_bytes = await self._get_image_bytes(image_path)
                if isinstance(image_bytes, ToolResult):  # Error occurred
                    return image_bytes

            # Route to appropriate model
            if model == "gemini":
                _log(f"🎨🎨🎨 IMAGE GENERATION: Using GEMINI 3 Pro Image | mode={mode} | aspect_ratio={aspect_ratio}")
                logger.info(f"🎨 IMAGE GENERATION: Using GEMINI 3 Pro Image | mode={mode} | aspect_ratio={aspect_ratio}")
                result = await self._generate_with_gemini(prompt, aspect_ratio, image_bytes)
                _log(f"🎨🎨🎨 IMAGE GENERATION: GEMINI completed successfully")
                logger.info(f"🎨 IMAGE GENERATION: GEMINI completed successfully")
            else:
                # GPT Image 1
                _log(f"🎨🎨🎨 IMAGE GENERATION: Using GPT Image 1 | mode={mode} | size={size} | aspect_ratio={aspect_ratio}")
                logger.info(f"🎨 IMAGE GENERATION: Using GPT Image 1 | mode={mode} | size={size} | aspect_ratio={aspect_ratio}")
                if mode == "generate":
                    result = await self._generate_with_gpt_image(prompt, size)
                elif mode == "edit":
                    result = await self._edit_with_gpt_image(prompt, image_bytes, size)
                else:
                    return self.fail_response("Invalid mode. Use 'generate', 'edit', or 'video'.")
                _log(f"🎨🎨🎨 IMAGE GENERATION: GPT Image 1 completed successfully")
                logger.info(f"🎨 IMAGE GENERATION: GPT Image 1 completed successfully")

            # Decode and save the image
            image_data = base64.b64decode(result["b64_data"])
            random_filename = f"generated_image_{uuid.uuid4().hex[:8]}.png"
            sandbox_path = f"{self.workspace_path}/{random_filename}"
            await self.sandbox.fs.upload_file(image_data, sandbox_path)

            # Calculate and store image cost
            actual_model = result["model"]
            image_cost = calculate_image_cost(actual_model, mode, size)
            _log(f"🎨🎨🎨 IMAGE GENERATION: Saved as {random_filename} | model={actual_model} | cost=${image_cost:.4f}")
            logger.info(f"🎨 IMAGE GENERATION: Saved as {random_filename} | model={actual_model} | cost=${image_cost:.4f}")
            
            # Create usage data for billing
            usage_data = {
                "image_cost": image_cost,
                "model": actual_model,
                "mode": mode,
                "size": size,
                "aspect_ratio": aspect_ratio
            }

            return self.success_response(
                f"Successfully generated image using {actual_model} in '{mode}' mode with {aspect_ratio} aspect ratio. Image saved as: {random_filename}. You can use the ask tool to display the image.",
                usage_data=usage_data
            )

        except Exception as e:
            _log(f"🎨🎨🎨 MEDIA GENERATION ERROR: model={model} | mode={mode} | error={str(e)}")
            logger.error(f"🎨 MEDIA GENERATION ERROR: model={model} | mode={mode} | error={str(e)}")
            return self.fail_response(
                f"An error occurred during media generation/editing: {str(e)}"
            )

    async def _generate_video(
        self,
        prompt: str,
        image_path: Optional[str] = None,
        video_options: Optional[dict] = None,
    ) -> ToolResult:
        """Generate video. Default: Sora 2 via laozhang.ai, fallback: Replicate."""
        opts = video_options or {}
        provider = opts.get("provider", "").lower()
        aspect = opts.get("aspect_ratio", "16:9")

        if provider == "replicate":
            duration = max(2, min(12, int(opts.get("duration", 5))))
            try:
                return await self._generate_video_replicate(prompt, image_path, opts, duration, aspect)
            except Exception as e:
                _log(f"🎬 Replicate failed, falling back to Sora 2: {str(e)}")
                logger.warning(f"Replicate failed: {str(e)}, trying Sora 2 fallback")
                return await self._generate_video_laozhang(prompt, image_path, opts, duration, aspect)

        # Default (sora / unspecified): try Sora 2 first, Replicate fallback
        duration = max(2, min(15, int(opts.get("duration", 5))))
        try:
            return await self._generate_video_laozhang(prompt, image_path, opts, duration, aspect)
        except Exception as e:
            _log(f"🎬 Sora 2 failed, trying Replicate fallback: {str(e)}")
            logger.warning(f"Sora 2 failed: {str(e)}, trying Replicate fallback")

        try:
            duration = min(duration, 12)
            return await self._generate_video_replicate(prompt, image_path, opts, duration, aspect)
        except Exception as e2:
            _log(f"🎬 VIDEO GENERATION ERROR (both providers failed): {str(e2)}")
            logger.error(f"🎬 VIDEO GENERATION ERROR: Sora 2 and Replicate both failed")
            return self.fail_response(f"Video generation failed. Sora 2: {str(e)}. Replicate: {str(e2)}")

    async def _generate_video_laozhang(
        self,
        prompt: str,
        image_path: Optional[str],
        opts: dict,
        duration: int,
        aspect: str,
    ) -> ToolResult:
        """Primary: generate video via laozhang.ai async video API (sora-2)."""
        api_key = os.getenv("LAOZHANG_API_KEY")
        if not api_key:
            raise RuntimeError("LAOZHANG_API_KEY not configured")

        base_url = "https://api.laozhang.ai/v1"
        headers = {"Authorization": f"Bearer {api_key}"}

        portrait_aspects = {"9:16", "3:4"}
        size = "720x1280" if aspect in portrait_aspects else "1280x720"
        seconds_str = str(min(duration, 15))

        _log(f"🎬 Calling laozhang.ai sora-2 (primary) | size={size} | seconds={seconds_str}")
        logger.info(f"🎬 laozhang.ai fallback: prompt='{prompt[:50]}...' size={size} seconds={seconds_str}")

        async with httpx.AsyncClient(timeout=60.0) as client:
            if image_path:
                img_bytes = await self._get_image_bytes(image_path)
                if isinstance(img_bytes, ToolResult):
                    return img_bytes
                from pathlib import Path
                ext = Path(image_path).suffix.lstrip(".") or "png"
                mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "image/png")
                _log(f"🎬 Video (laozhang): Using input image '{image_path}' ({len(img_bytes)} bytes)")

                resp = await client.post(
                    f"{base_url}/videos",
                    headers=headers,
                    data={"model": "sora-2", "prompt": prompt, "size": size, "seconds": seconds_str},
                    files={"input_reference": (f"image.{ext}", img_bytes, mime)},
                )
            else:
                resp = await client.post(
                    f"{base_url}/videos",
                    headers={**headers, "Content-Type": "application/json"},
                    json={"model": "sora-2", "prompt": prompt, "size": size, "seconds": seconds_str},
                )

            resp.raise_for_status()
            job_data = resp.json()
            video_id = job_data.get("id")
            if not video_id:
                raise RuntimeError(f"No task id in response: {job_data}")
            _log(f"🎬 laozhang.ai task submitted: {video_id}")

            # Poll for completion (5s intervals, 600s max)
            poll_start = asyncio.get_event_loop().time()
            max_poll = 600
            while True:
                elapsed = asyncio.get_event_loop().time() - poll_start
                if elapsed > max_poll:
                    raise TimeoutError(f"laozhang.ai task {video_id} timed out after {max_poll}s")

                await asyncio.sleep(5)
                status_resp = await client.get(f"{base_url}/videos/{video_id}", headers=headers)
                status_resp.raise_for_status()
                status_data = status_resp.json()
                status = status_data.get("status", "unknown")
                progress = status_data.get("progress", 0)
                _log(f"🎬 laozhang.ai task {video_id}: {status} ({progress}%)")

                if status == "completed":
                    break
                elif status == "failed":
                    error_info = status_data.get("error", {})
                    error_msg = error_info.get("message", str(error_info)) if isinstance(error_info, dict) else str(error_info)
                    raise RuntimeError(f"laozhang.ai generation failed: {error_msg}")

            # Download video
            dl_resp = await client.get(f"{base_url}/videos/{video_id}/content", headers=headers, timeout=120.0)
            dl_resp.raise_for_status()
            result_bytes = dl_resp.content

        video_filename = f"generated_video_{uuid.uuid4().hex[:8]}.mp4"
        sandbox_path = f"{self.workspace_path}/{video_filename}"
        await self.sandbox.fs.upload_file(result_bytes, sandbox_path)

        video_cost = calculate_video_cost("laozhang-sora2", duration)
        _log(f"🎬 Video saved (laozhang): {video_filename} ({len(result_bytes)} bytes) | cost=${video_cost:.4f}")
        logger.info(f"🎬 Video saved (laozhang): {video_filename} | duration={duration}s | cost=${video_cost:.4f}")

        usage_data = {
            "video_cost": video_cost,
            "model": "laozhang/sora-2",
            "mode": "video",
            "duration": duration,
        }

        return self.success_response(
            f"Successfully generated video ({duration}s). Video saved as: {video_filename}",
            usage_data=usage_data
        )

    async def _generate_video_replicate(
        self,
        prompt: str,
        image_path: Optional[str],
        opts: dict,
        duration: int,
        aspect: str,
    ) -> ToolResult:
        """Fallback: generate video using seedance-1.5-pro via Replicate."""
        token = os.getenv("REPLICATE_API_TOKEN")
        if not token:
            raise RuntimeError("REPLICATE_API_TOKEN not configured")
        os.environ["REPLICATE_API_TOKEN"] = token

        duration = min(duration, 12)

        input_params = {
            "prompt": prompt,
            "duration": duration,
            "aspect_ratio": str(aspect),
            "fps": int(opts.get("fps", 24)),
            "camera_fixed": bool(opts.get("camera_fixed", False)),
            "generate_audio": bool(opts.get("generate_audio", False)),
        }

        if "seed" in opts:
            try:
                input_params["seed"] = int(opts["seed"])
            except (ValueError, TypeError):
                pass

        if image_path:
            img_bytes = await self._get_image_bytes(image_path)
            if isinstance(img_bytes, ToolResult):
                return img_bytes
            image_b64 = base64.b64encode(img_bytes).decode("utf-8")
            input_params["image"] = f"data:image/png;base64,{image_b64}"
            _log(f"🎬 Video (Replicate): Using input image '{image_path}'")

        _log(f"🎬 Calling Replicate seedance-1.5-pro | duration={duration}s | aspect={aspect}")
        logger.info(f"🎬 Replicate: prompt='{prompt[:50]}...' duration={duration}s")

        output = await asyncio.to_thread(
            replicate.run,
            "bytedance/seedance-1.5-pro",
            input=input_params
        )

        if hasattr(output, "read"):
            result_bytes = output.read()
        elif hasattr(output, "url"):
            async with httpx.AsyncClient() as client:
                response = await client.get(str(output.url), timeout=120.0)
                response.raise_for_status()
                result_bytes = response.content
        else:
            async with httpx.AsyncClient() as client:
                response = await client.get(str(output), timeout=120.0)
                response.raise_for_status()
                result_bytes = response.content

        video_filename = f"generated_video_{uuid.uuid4().hex[:8]}.mp4"
        sandbox_path = f"{self.workspace_path}/{video_filename}"
        await self.sandbox.fs.upload_file(result_bytes, sandbox_path)

        video_cost = calculate_video_cost("seedance-1.5-pro", duration)
        _log(f"🎬 Video saved (Replicate): {video_filename} ({len(result_bytes)} bytes) | cost=${video_cost:.4f}")
        logger.info(f"🎬 Video saved (Replicate): {video_filename} | duration={duration}s | cost=${video_cost:.4f}")

        usage_data = {
            "video_cost": video_cost,
            "model": "seedance-1.5-pro",
            "mode": "video",
            "duration": duration,
        }

        return self.success_response(
            f"Successfully generated video ({duration}s). Video saved as: {video_filename}",
            usage_data=usage_data
        )

    async def _get_image_bytes(self, image_path: str) -> bytes | ToolResult:
        """Get image bytes from URL or local file path."""
        if image_path.startswith(("http://", "https://")):
            return await self._download_image_from_url(image_path)
        else:
            return await self._read_image_from_sandbox(image_path)

    async def _download_image_from_url(self, url: str) -> bytes | ToolResult:
        """Download image from URL."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except Exception:
            return self.fail_response(f"Could not download image from URL: {url}")

    async def _read_image_from_sandbox(self, image_path: str) -> bytes | ToolResult:
        """Read image from sandbox filesystem."""
        try:
            cleaned_path = self.clean_path(image_path)
            full_path = f"{self.workspace_path}/{cleaned_path}"

            # Check if file exists and is not a directory
            file_info = await self.sandbox.fs.get_file_info(full_path)
            if file_info.is_dir:
                return self.fail_response(
                    f"Path '{cleaned_path}' is a directory, not an image file."
                )

            return await self.sandbox.fs.download_file(full_path)

        except Exception as e:
            return self.fail_response(
                f"Could not read image file from sandbox: {image_path} - {str(e)}"
            )
