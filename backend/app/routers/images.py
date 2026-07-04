from fastapi import APIRouter, HTTPException
from app.schemas import ImageUploadRequest, ImageUploadResponse
from app import r2_storage

router = APIRouter(prefix="/images", tags=["images"])


@router.post("/upload", response_model=ImageUploadResponse)
def upload_image(payload: ImageUploadRequest) -> ImageUploadResponse:
    if not r2_storage.configured():
        raise HTTPException(status_code=503, detail="Image storage is not configured on the server")
    url = r2_storage.upload_image_base64(payload.image_base64, folder=payload.folder)
    if not url:
        raise HTTPException(status_code=500, detail="Failed to upload image")
    return ImageUploadResponse(image_url=url)
