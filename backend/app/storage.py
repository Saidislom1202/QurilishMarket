import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image

from .config import settings

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

MAX_DIMENSION = 1000
JPEG_QUALITY = 82
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8MB raw upload cap, before re-encoding


def _process_image(raw: bytes) -> bytes:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl to'g'ri rasm emas")

    img = img.convert("RGB")
    if max(img.size) > MAX_DIMENSION:
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))

    out = io.BytesIO()
    img.save(out, format="JPEG", quality=JPEG_QUALITY)
    return out.getvalue()


def _upload_to_r2(data: bytes, filename: str) -> str:
    import boto3

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
    )
    client.put_object(Bucket=settings.r2_bucket, Key=filename, Body=data, ContentType="image/jpeg")
    return f"{settings.r2_public_url.rstrip('/')}/{filename}"


def save_upload(file: UploadFile) -> str:
    raw = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl hajmi juda katta (8MB dan oshmasin)")
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fayl bo'sh")

    processed = _process_image(raw)
    filename = f"{uuid.uuid4().hex}.jpg"

    if settings.r2_configured:
        return _upload_to_r2(processed, filename)

    (UPLOAD_DIR / filename).write_bytes(processed)
    return f"{settings.public_base_url.rstrip('/')}/uploads/{filename}"
