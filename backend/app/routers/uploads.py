from fastapi import APIRouter, Depends, UploadFile

from ..deps import get_current_seller
from ..models import Seller
from ..storage import save_upload

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/image")
def upload_image(file: UploadFile, seller: Seller = Depends(get_current_seller)):
    url = save_upload(file)
    return {"url": url}
