import os
import replicate
from agentpress.tool import ToolResult, openapi_schema, xml_schema
from utils.config import config
import requests
import time
import hashlib
from sandbox.sandbox import SandboxToolsBase
import tempfile

class ReplicateTTSTool(SandboxToolsBase):
    """Tool for generating speech audio from text using Replicate's minimax/speech-02-hd model."""

    def __init__(self, project_id: str = None, thread_manager: 'ThreadManager' = None, api_token: str = None):
        super().__init__(project_id, thread_manager)
        self.api_token = api_token or os.getenv("REPLICATE_API_TOKEN") or getattr(config, "REPLICATE_API_TOKEN", None)
        if not self.api_token:
            raise ValueError("REPLICATE_API_TOKEN not found in environment or config.")
        os.environ["REPLICATE_API_TOKEN"] = self.api_token

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "replicate-generate-speech",
            "description": "Generate speech audio from text using Replicate's minimax/speech-02-hd model.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": (
                            "The full transcript to convert to speech. Always provide the entire transcript in a single call if possible. "
                            "If the transcript exceeds 5000 characters (the model's maximum input length), split it at sentence boundaries and process all parts sequentially, ensuring the full transcript is converted to speech."
                        )
                    },
                    "pitch": {"type": "integer", "description": "Speech pitch", "default": 0},
                    "speed": {"type": "number", "description": "Speech speed", "default": 1},
                    "volume": {"type": "number", "description": "Speech volume", "default": 1},
                    "bitrate": {"type": "integer", "description": "Bitrate for the generated speech", "default": 128000},
                    "channel": {"type": "string", "description": "Number of audio channels", "default": "mono"},
                    "emotion": {"type": "string", "description": "Speech emotion", "default": "auto"},
                    "voice_id": {
                        "type": "string",
                        "description": (
                            "Desired voice ID. Use a voice ID you have trained, like R8_YFFUMRXZ for Dr. Pang's voice or one of the following system voice IDs: "
                            "Wise_Woman, Friendly_Person, Inspirational_girl, Deep_Voice_Man, Calm_Woman, Casual_Guy, Lively_Girl, Patient_Man, Young_Knight, Determined_Man, Lovely_Girl, Decent_Boy, Imposing_Manner, Elegant_Man, Abbess, Sweet_Girl_2, Exuberant_Girl. "
                            "If not specified, the default will be used."
                        ),
                        "default": "R8_YFFUMRXZ"
                    },
                    "sample_rate": {"type": "integer", "description": "Sample rate for the generated speech", "default": 32000},
                    "language_boost": {"type": "string", "description": "Enhance recognition of specific languages", "default": "Chinese"},
                    "english_normalization": {"type": "boolean", "description": "Enable English text normalization", "default": True}
                },
                "required": ["text"]
            }
        }
    })
    @xml_schema(
        tag_name="replicate-generate-speech",
        mappings=[
            {"param_name": "text", "node_type": "attribute", "path": "."},
            {"param_name": "voice_id", "node_type": "attribute", "path": "."},
            # Add other params as needed
        ],
        example='''
        <replicate-generate-speech text="你好，世界！" voice_id="R8_YFFUMRXZ" />
        <!-- Other example system voices: Wise_Woman, Friendly_Person, Inspirational_girl, Deep_Voice_Man, Calm_Woman, Casual_Guy, Lively_Girl, Patient_Man, Young_Knight, Determined_Man, Lovely_Girl, Decent_Boy, Imposing_Manner, Elegant_Man, Abbess, Sweet_Girl_2, Exuberant_Girl -->
        '''
    )
    async def replicate_generate_speech(
        self,
        text: str,
        pitch: int = 0,
        speed: float = 1,
        volume: float = 1,
        bitrate: int = 128000,
        channel: str = "mono",
        emotion: str = "auto",
        voice_id: str = "R8_YFFUMRXZ",
        sample_rate: int = 32000,
        language_boost: str = "Chinese",
        english_normalization: bool = True
    ) -> ToolResult:
        await self._ensure_sandbox()
        output = replicate.run(
            "minimax/speech-02-hd",
            input={
                "text": text,
                "pitch": pitch,
                "speed": speed,
                "volume": volume,
                "bitrate": bitrate,
                "channel": channel,
                "emotion": emotion,
                "voice_id": voice_id,
                "sample_rate": sample_rate,
                "language_boost": language_boost,
                "english_normalization": english_normalization
            }
        )
        # output is a URL to the audio file
        if not output:
            return ToolResult(success=False, output="No output from Replicate API.")
        # Robustly extract the URL from output
        url = None
        if isinstance(output, str):
            url = output
        elif isinstance(output, list):
            # List of URLs or FileOutput objects
            first = output[0]
            if hasattr(first, 'url'):
                url = first.url
            else:
                url = str(first)
        elif hasattr(output, 'url'):
            url = output.url
        else:
            url = str(output)
        # Download and save to sandbox (robust version)
        min_size = 10 * 1024  # 10KB minimum for a valid audio file
        max_retries = 3
        success = False
        fname = f"tts_{hashlib.sha256(text.encode()).hexdigest()[:8]}_{int(time.time())}.mp3"
        for attempt in range(max_retries):
            resp = requests.get(url, stream=True, timeout=60)
            if resp.status_code == 200:
                with tempfile.NamedTemporaryFile(delete=False) as tmpf:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            tmpf.write(chunk)
                    tmp_path = tmpf.name
                if os.path.getsize(tmp_path) >= min_size:
                    with open(tmp_path, 'rb') as f:
                        self.sandbox.fs.upload_file(f"/workspace/{fname}", f.read())
                    os.remove(tmp_path)
                    success = True
                    break
                else:
                    os.remove(tmp_path)
            time.sleep(3)  # Wait before retry
        if success:
            return ToolResult(success=True, output={"replicate_url": url, "sandbox_path": f"/workspace/{fname}"})
        else:
            return ToolResult(success=False, output=f"Failed to download complete audio after {max_retries} attempts.") 