import os
import replicate
from agentpress.tool import Tool, ToolResult, openapi_schema, xml_schema
from utils.config import config
import logging
import hashlib
import time
import requests
from sandbox.sandbox import SandboxToolsBase

class ReplicateImageTool(SandboxToolsBase):
    """Tool for generating images using Replicate's black-forest-labs/flux-schnell model."""

    def __init__(self, project_id: str = None, thread_manager: 'ThreadManager' = None, api_token: str = None):
        super().__init__(project_id, thread_manager)
        self.api_token = api_token or os.getenv("REPLICATE_API_TOKEN") or getattr(config, "REPLICATE_API_TOKEN", None)
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN not found in environment or config.")
        os.environ["REPLICATE_API_TOKEN"] = self.api_token

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "replicate-generate-image",
            "description": "Generate an image using Replicate's black-forest-labs/flux-schnell model.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Prompt for image generation."},
                    "aspect_ratio": {"type": "string", "description": "Aspect ratio (e.g., '16:9').", "default": "16:9"},
                    "num_outputs": {"type": "integer", "description": "Number of images to generate.", "default": 1},
                    "output_format": {"type": "string", "description": "Output format (e.g., 'webp').", "default": "webp"},
                    "output_quality": {"type": "integer", "description": "Output quality (1-100).", "default": 80},
                    "num_inference_steps": {"type": "integer", "description": "Number of inference steps.", "default": 4},
                    "megapixels": {"type": "string", "description": "Megapixels (e.g., '1').", "default": "1"},
                    "go_fast": {"type": "boolean", "description": "Use fast mode.", "default": True}
                },
                "required": ["prompt"]
            }
        }
    })
    @xml_schema(
        tag_name="replicate-generate-image",
        mappings=[
            {"param_name": "prompt", "node_type": "attribute", "path": "."},
            {"param_name": "aspect_ratio", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "num_outputs", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "output_format", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "output_quality", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "num_inference_steps", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "megapixels", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "go_fast", "node_type": "attribute", "path": ".", "required": False}
        ],
        example='''
        <replicate-generate-image prompt="A futuristic cityscape at sunset" aspect_ratio="16:9" num_outputs="1" output_format="webp" output_quality="80" num_inference_steps="4" megapixels="1" go_fast="true" />
        '''
    )
    async def generate_image(self, prompt: str, aspect_ratio: str = "16:9", num_outputs: int = 1, output_format: str = "webp", output_quality: int = 80, num_inference_steps: int = 4, megapixels: str = "1", go_fast: bool = True) -> ToolResult:
        logger = logging.getLogger("replicate_image_tool")
        # Defensive: check for required context
        if self.thread_manager is None or self.project_id is None:
            logger.error("ReplicateImageTool requires a valid thread_manager and project_id. Got thread_manager=%s, project_id=%s", self.thread_manager, self.project_id)
            return ToolResult(success=False, output="Internal error: missing thread_manager or project_id. Please contact support.")
        # Ensure sandbox is initialized before any file operations
        await self._ensure_sandbox()
        logger.info(f"[ReplicateImageTool] Raw args: prompt={prompt}, aspect_ratio={aspect_ratio}, num_outputs={num_outputs}, output_format={output_format}, output_quality={output_quality}, num_inference_steps={num_inference_steps}, megapixels={megapixels}, go_fast={go_fast}")
        print(f"[ReplicateImageTool] Raw args: prompt={prompt}, aspect_ratio={aspect_ratio}, num_outputs={num_outputs}, output_format={output_format}, output_quality={output_quality}, num_inference_steps={num_inference_steps}, megapixels={megapixels}, go_fast={go_fast}")

        # Defensive: If prompt is accidentally passed as num_outputs, fix it
        if isinstance(prompt, int) and isinstance(num_outputs, str):
            prompt, num_outputs = num_outputs, prompt

        # --- Argument type coercion ---
        try:
            if num_outputs is None or num_outputs == "":
                num_outputs = 1
            if isinstance(num_outputs, str):
                num_outputs = int(num_outputs)
            if num_inference_steps is None or num_inference_steps == "":
                num_inference_steps = 4
            if isinstance(num_inference_steps, str):
                num_inference_steps = int(num_inference_steps)
            if output_quality is None or output_quality == "":
                output_quality = 80
            if isinstance(output_quality, str):
                output_quality = int(output_quality)
            if go_fast is None or go_fast == "":
                go_fast = True
            if isinstance(go_fast, str):
                go_fast = go_fast.lower() in ["true", "1", "yes"]
            if aspect_ratio is None or aspect_ratio == "":
                aspect_ratio = "16:9"
            if output_format is None or output_format == "":
                output_format = "webp"
            if megapixels is None or megapixels == "":
                megapixels = "1"
        except Exception as e:
            logger.error(f"[ReplicateImageTool] Argument coercion error: {str(e)}")
            return ToolResult(success=False, output=f"Error coercing arguments: {str(e)}")
        # --- End coercion ---
        try:
            output = replicate.run(
                "black-forest-labs/flux-schnell",
                input={
                    "prompt": prompt,
                    "go_fast": go_fast,
                    "megapixels": megapixels,
                    "num_outputs": num_outputs,
                    "aspect_ratio": aspect_ratio,
                    "output_format": output_format,
                    "output_quality": output_quality,
                    "num_inference_steps": num_inference_steps
                }
            )
            logger.info(f"[ReplicateImageTool] Output: {output}")
            print(f"[ReplicateImageTool] Output: {output}")

            # --- Download and save to sandbox ---
            if not output:
                return ToolResult(success=False, output="No output from Replicate API.")
            # Convert output to list of URLs
            url_list = []
            if isinstance(output, str):
                url_list = [output]
            else:
                # Try to extract .url from each item
                try:
                    url_list = [item.url if hasattr(item, 'url') else str(item) for item in output]
                except Exception as e:
                    logger.error(f"[ReplicateImageTool] Could not extract URLs from output: {e}")
                    url_list = [str(item) for item in output]

            local_paths = []
            save_dir = "/workspace"
            prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:8]
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            for idx, url in enumerate(url_list):
                try:
                    ext = url.split(".")[-1].split("?")[0]
                    fname = f"img_{timestamp}_{prompt_hash}_{idx+1}.{ext}"
                    rel_path = fname
                    resp = requests.get(url)
                    if resp.status_code == 200:
                        # Use sandbox file API if available
                        if hasattr(self, 'sandbox') and hasattr(self.sandbox, 'fs'):
                            logger.info(f"[ReplicateImageTool] self.sandbox: {self.sandbox}")
                            logger.info(f"[ReplicateImageTool] self.sandbox.fs: {getattr(self.sandbox, 'fs', None)}")
                            try:
                                self.sandbox.fs.upload_file(f"/workspace/{rel_path}", resp.content)
                                local_paths.append(f"/workspace/{rel_path}")
                                logger.info(f"[ReplicateImageTool] Successfully uploaded image to /workspace/{rel_path} via sandbox API")
                            except Exception as e:
                                logger.error(f"[ReplicateImageTool] upload_file exception: {e}")
                        else:
                            logger.warning(f"[ReplicateImageTool] Sandbox or fs not available, falling back to local file I/O")
                            local_path = os.path.join(save_dir, fname)
                            with open(local_path, "wb") as f:
                                f.write(resp.content)
                            local_paths.append(local_path)
                            logger.info(f"[ReplicateImageTool] Saved image to {local_path} (local fallback)")
                    else:
                        logger.error(f"[ReplicateImageTool] Failed to download image: {url} (status {resp.status_code})")
                except Exception as e:
                    logger.error(f"[ReplicateImageTool] Error saving image {url}: {str(e)}")
            result = {
                "replicate_urls": url_list,
                "sandbox_paths": local_paths,
                "message": f"Saved {len(local_paths)} image(s) to sandbox at /workspace/"
            }
            logger.info(f"[ReplicateImageTool] Final result: {result}")
            return ToolResult(success=True, output=result)
        except Exception as e:
            logger.error(f"[ReplicateImageTool] Error: {str(e)}", exc_info=True)
            print(f"[ReplicateImageTool] Error: {str(e)}")
            return ToolResult(success=False, output=f"Error generating image: {str(e)}") 