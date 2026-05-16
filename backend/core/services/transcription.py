import os
import tempfile
from typing import Optional

import openai
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger

router = APIRouter(tags=["transcription"])

_MAX_BYTES = 25 * 1024 * 1024
_WHISPER_MODEL = "gpt-4o-mini-transcribe"

ALLOWED_AUDIO_CONTENT_TYPES = frozenset(
    {
        "audio/mp3",
        "audio/mpeg",
        "audio/mp4",
        "audio/m4a",
        "audio/wav",
        "audio/webm",
        "audio/mpga",
        "audio/ogg",
        "audio/opus",
        "audio/x-m4a",
        "audio/x-mp4",
        "audio/x-wav",
        "audio/x-webm",
        "audio/x-ogg",
        "application/ogg",
        "application/octet-stream",
    }
)

_EXT_TO_MIME = {
    "mp3": "audio/mpeg",
    "mpeg": "audio/mpeg",
    "mp4": "audio/mp4",
    "m4a": "audio/mp4",
    "wav": "audio/wav",
    "webm": "audio/webm",
    "mpga": "audio/mpga",
    "ogg": "audio/ogg",
    "oga": "audio/ogg",
    "opus": "audio/opus",
}

# gpt-4o-mini-transcribe rejects ".oga" even though Telegram voice is OGG/Opus.
_OPENAI_TRANSCRIBE_EXTS = frozenset(
    {"flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "ogg", "wav", "webm"}
)
_EXT_FOR_OPENAI_UPLOAD = {
    "oga": "ogg",
    "opus": "ogg",
}


class TranscriptionResponse(BaseModel):
    text: str


def _guess_content_type(filename: str, content_type: Optional[str]) -> str:
    ct = (content_type or "").strip().lower()
    if ct and ct in ALLOWED_AUDIO_CONTENT_TYPES and ct != "application/octet-stream":
        return ct
    ext = ""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
    return _EXT_TO_MIME.get(ext, ct or "audio/ogg")


def _extension_for_filename(filename: str, content_type: str) -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    for ext, mime in _EXT_TO_MIME.items():
        if mime == content_type:
            return ext
    return "ogg"


def _openai_upload_extension(raw_ext: str) -> str:
    ext = (raw_ext or "ogg").lower()
    ext = _EXT_FOR_OPENAI_UPLOAD.get(ext, ext)
    if ext not in _OPENAI_TRANSCRIBE_EXTS:
        return "ogg"
    return ext


def _write_temp_audio_file(content: bytes, *, upload_ext: str) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{upload_ext}") as temp_file:
        temp_file.write(content)
        return temp_file.name


async def transcribe_audio_bytes(
    content: bytes,
    *,
    filename: str = "audio.ogg",
    content_type: Optional[str] = None,
) -> str:
    """Transcribe raw audio bytes with OpenAI Whisper (shared by web API and IM bridges)."""
    if len(content) > _MAX_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds 25MB limit")

    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    resolved_ct = _guess_content_type(filename, content_type)
    if resolved_ct not in ALLOWED_AUDIO_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type or 'unknown'}. "
            f"Supported types include ogg, m4a, mp3, wav, webm.",
        )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Transcription is not configured (OPENAI_API_KEY)")

    client = openai.OpenAI(api_key=api_key)
    raw_ext = _extension_for_filename(filename, resolved_ct)
    upload_ext = _openai_upload_extension(raw_ext)
    upload_name = f"audio.{upload_ext}"
    temp_file_path = _write_temp_audio_file(content, upload_ext=upload_ext)

    try:
        with open(temp_file_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                model=_WHISPER_MODEL,
                file=(upload_name, f),
                response_format="text",
            )
        text = (transcription or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail="No speech detected in audio")
        return text
    except openai.BadRequestError as e:
        logger.warning(
            f"OpenAI transcription rejected upload (raw_ext={raw_ext}, upload_ext={upload_ext}): {e}"
        )
        raise HTTPException(
            status_code=400,
            detail="Audio format not supported for transcription. Try sending text instead.",
        ) from e
    finally:
        try:
            os.unlink(temp_file_path)
        except Exception as e:
            logger.warning(f"Failed to delete temporary file {temp_file_path}: {e}")


@router.post("/transcription", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    user_id: str = Depends(verify_and_get_user_id_from_jwt),
):
    """Transcribe audio file to text using OpenAI Whisper."""
    try:
        logger.debug(
            f"Received audio file: {audio_file.filename}, content_type: {audio_file.content_type}"
        )
        content = await audio_file.read()
        text = await transcribe_audio_bytes(
            content,
            filename=audio_file.filename or "audio.webm",
            content_type=audio_file.content_type,
        )
        logger.debug(f"Successfully transcribed audio for user {user_id}")
        return TranscriptionResponse(text=text)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transcribing audio for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}") from e
