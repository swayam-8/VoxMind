"""Authentication and bounded request parsing for the private inference service."""
import hmac
from pathlib import Path
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from app import config


async def protect_request(request: Request, call_next):
    if request.url.path == "/health" and request.method == "GET":
        return await call_next(request)
    supplied = request.headers.get("x-ai-internal-key", "")
    if not config.AI_INTERNAL_SECRET or not hmac.compare_digest(supplied.encode("utf-8"), config.AI_INTERNAL_SECRET.encode("utf-8")):
        return JSONResponse({"detail": "Internal service authentication required"}, status_code=401)
    # Bound actual bytes, including requests without Content-Length.
    chunks = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > config.AI_MAX_REQUEST_BYTES:
            return JSONResponse({"detail": "Request body is too large"}, status_code=413)
        chunks.append(chunk)
    request._body = b"".join(chunks)
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response


def audio_path(raw: str) -> str:
    """Resolve symlinks before enforcing the shared recordings directory."""
    try:
        root = Path(config.AUDIO_STORAGE_ROOT).resolve(strict=True)
        target = Path(raw).resolve(strict=True)
        target.relative_to(root)
        if not target.is_file():
            raise ValueError("Not a file")
        return str(target)
    except (OSError, ValueError):
        raise HTTPException(status_code=400, detail="Audio file is outside recording storage or unavailable")
