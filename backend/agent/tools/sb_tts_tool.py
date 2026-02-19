"""Text-to-speech tool using Replicate MiniMax Speech-02-HD with Dr. Pang voice support."""

from typing import Optional
from agentpress.tool import ToolResult, openapi_schema, xml_schema
from sandbox.tool_base import SandboxToolsBase
from agentpress.thread_manager import ThreadManager
import httpx
import uuid
import replicate
import asyncio
import os
from services.billing import calculate_speech_cost
from utils.logger import logger

def _effective_char_count(text: str) -> int:
    """Count characters for billing: Chinese/CJK = 2 each, others = 1."""
    count = 0
    for c in text:
        if "\u4e00" <= c <= "\u9fff" or "\u3400" <= c <= "\u4dbf" or "\u3000" <= c <= "\u303f":
            count += 2
        else:
            count += 1
    return count


# Voice IDs
DEFAULT_VOICE_ID = "Friendly_Person"  # Male voice
FEMALE_VOICE_ID = "Wise_Woman"
DR_PANG_VOICE_ID = "R8_S8I1HHEO"  # Dr. Pang / 庞博士 (only when user specifies)


class SandboxTTSTool(SandboxToolsBase):
    """Generate speech from text using MiniMax Speech-02-HD via Replicate."""

    def __init__(self, project_id: str, thread_manager: ThreadManager):
        super().__init__(project_id, thread_manager)

    @openapi_schema(
        {
            "type": "function",
            "function": {
                "name": "replicate_generate_speech",
                "description": "Generate high-quality speech from text using MiniMax Speech-02-HD. Default: Friendly_Person (male). Use Wise_Woman for female. Use R8_S8I1HHEO only when user asks for Dr. Pang or 庞博士. Saves MP3 to workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "description": "Text to convert to speech (up to 10,000 characters). Use Chinese for Dr. Pang style.",
                        },
                        "voice_id": {
                            "type": "string",
                            "description": "Voice ID. Default: Friendly_Person (male). Use Wise_Woman for female. Use R8_S8I1HHEO only when user asks for Dr. Pang or 庞博士.",
                            "default": DEFAULT_VOICE_ID,
                        },
                        "language_boost": {
                            "type": "string",
                            "description": "Boost recognition for language: Chinese, English, Japanese, etc. Default: English.",
                            "default": "English",
                        },
                        "speed": {
                            "type": "number",
                            "description": "Speech speed 0.5-2.0. Default: 1.",
                            "default": 1,
                        },
                        "volume": {
                            "type": "number",
                            "description": "Volume 0-10. Default: 1.5.",
                            "default": 1.5,
                        },
                        "emotion": {
                            "type": "string",
                            "description": "Emotion: auto, happy, sad, calm, fluent, neutral. Default: auto.",
                            "default": "auto",
                        },
                    },
                    "required": ["text"],
                },
            },
        }
    )
    @xml_schema(
        tag_name="replicate-generate-speech",
        mappings=[
            {"param_name": "text", "node_type": "attribute", "path": "."},
            {"param_name": "voice_id", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "language_boost", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "speed", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "volume", "node_type": "attribute", "path": ".", "required": False},
            {"param_name": "emotion", "node_type": "attribute", "path": ".", "required": False},
        ],
        example="""
        <function_calls>
        <invoke name="replicate_generate_speech">
        <parameter name="text">Welcome to our presentation. Today we will explore the latest advances in AI.</parameter>
        <parameter name="voice_id">Friendly_Person</parameter>
        <parameter name="language_boost">English</parameter>
        </invoke>
        </function_calls>
        """,
    )
    async def replicate_generate_speech(
        self,
        text: str,
        voice_id: str = DEFAULT_VOICE_ID,
        language_boost: str = "English",
        speed: float = 1.0,
        volume: float = 1.5,
        emotion: str = "auto",
    ) -> ToolResult:
        """Generate speech from text using MiniMax Speech-02-HD."""
        logger.info(f"🎤 TTS: text_len={len(text)} voice_id={voice_id}")
        try:
            await self._ensure_sandbox()

            token = os.getenv("REPLICATE_API_TOKEN")
            if not token:
                return self.fail_response("REPLICATE_API_TOKEN not configured")
            os.environ["REPLICATE_API_TOKEN"] = token

            text = (text or "").strip()
            if not text:
                return self.fail_response("Text is required")
            if len(text) > 10000:
                return self.fail_response("Text exceeds 10,000 character limit")

            input_params = {
                "text": text,
                "voice_id": voice_id or DEFAULT_VOICE_ID,
                "pitch": 0,
                "speed": float(speed) if speed else 1.0,
                "volume": float(volume) if volume else 1.5,
                "bitrate": 256000,
                "channel": "mono",
                "emotion": emotion or "auto",
                "sample_rate": 44100,
                "audio_format": "mp3",
                "language_boost": language_boost or "English",
                "subtitle_enable": False,
                "english_normalization": False,
            }

            output = await asyncio.to_thread(
                replicate.run,
                "minimax/speech-02-hd",
                input=input_params,
            )

            if output is None:
                return self.fail_response("No audio output from Replicate")

            # Replicate returns URL or file-like object
            if hasattr(output, "read"):
                result_bytes = output.read()
            elif hasattr(output, "url"):
                async with httpx.AsyncClient() as client:
                    response = await client.get(str(output.url), timeout=60.0)
                    response.raise_for_status()
                    result_bytes = response.content
            elif isinstance(output, (bytes, bytearray)):
                result_bytes = bytes(output)
            else:
                async with httpx.AsyncClient() as client:
                    response = await client.get(str(output), timeout=60.0)
                    response.raise_for_status()
                    result_bytes = response.content

            filename = f"speech_{uuid.uuid4().hex[:8]}.mp3"
            sandbox_path = f"{self.workspace_path}/{filename}"
            await self.sandbox.fs.upload_file(result_bytes, sandbox_path)

            effective_chars = _effective_char_count(text)
            speech_cost = calculate_speech_cost("speech-02-hd", effective_chars)
            logger.info(f"🎤 TTS saved: {filename} ({len(result_bytes)} bytes) | effective_chars={effective_chars} | cost=${speech_cost:.4f}")

            usage_data = {
                "speech_cost": speech_cost,
                "model": "speech-02-hd",
                "characters": effective_chars,
                "voice_id": voice_id,
            }

            return self.success_response(
                f"Successfully generated speech. Audio saved as: {filename}",
                usage_data=usage_data,
            )
        except Exception as e:
            logger.exception("TTS generation failed")
            return self.fail_response(f"Speech generation failed: {str(e)}")
