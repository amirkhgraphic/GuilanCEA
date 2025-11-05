from django.shortcuts import get_object_or_404
from django.core.files.base import ContentFile

from ninja import Router, Query, File, UploadedFile
from typing import List
import uuid

from gallery.models import Gallery
from gallery.tasks import process_uploaded_image
from api.authentication import jwt_auth
from api.schemas import GallerySchema, GalleryCreateSchema, MessageSchema, ErrorSchema

gallery_router = Router()

@gallery_router.get("/images", response=List[GallerySchema])
def list_gallery_images(
    request,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    public_only: bool = Query(True)
):
    """List gallery images"""
    queryset = Gallery.objects.select_related('uploaded_by')
    
    if public_only:
        queryset = queryset.filter(is_public=True)
    
    # Pagination
    offset = (page - 1) * limit
    images = queryset[offset:offset + limit]
    
    return images

@gallery_router.get("/images/{image_id}", response=GallerySchema)
def get_gallery_image(request, image_id: int):
    """Get single gallery image"""
    image = get_object_or_404(Gallery, id=image_id, is_public=True)
    return image

@gallery_router.post("/images", response={201: GallerySchema, 400: ErrorSchema}, auth=jwt_auth)
def upload_image(request, file: UploadedFile = File(...), data: GalleryCreateSchema = None):
    """Upload image to gallery (committee members only)"""
    user = request.auth
    
    if not (user.is_superuser or user.is_staff):
        return 400, {"error": "Only committee members can upload images"}
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        return 400, {"error": "File must be an image"}
    
    # Validate file size (10MB max)
    if file.size > 10 * 1024 * 1024:
        return 400, {"error": "File size must be less than 10MB"}
    
    try:
        # Create gallery item
        gallery_item = Gallery.objects.create(
            title=data.title if data else file.name,
            description=data.description if data else "",
            uploaded_by=user,
            alt_text=data.alt_text if data else "",
            is_public=data.is_public if data else True
        )
        
        # Save image
        filename = f"gallery/{uuid.uuid4().hex}.{file.name.split('.')[-1]}"
        gallery_item.image.save(filename, ContentFile(file.read()))
        
        # Process image asynchronously
        process_uploaded_image.delay(gallery_item.id)
        
        return 201, gallery_item
        
    except Exception as e:
        return 400, {"error": "Failed to upload image", "details": str(e)}

@gallery_router.put("/images/{image_id}", response={200: GallerySchema, 400: ErrorSchema}, auth=jwt_auth)
def update_image(request, image_id: int, data: GalleryCreateSchema):
    """Update gallery image metadata"""
    user = request.auth
    image = get_object_or_404(Gallery, id=image_id)
    
    if not (image.uploaded_by == user or user.is_superuser or user.is_staff):
        return 400, {"error": "You can only edit your own images"}
    
    try:
        for field, value in data.dict(exclude_unset=True).items():
            setattr(image, field, value)
        
        image.save()
        return 200, image
        
    except Exception as e:
        return 400, {"error": "Failed to update image", "details": str(e)}

@gallery_router.delete("/images/{image_id}", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def delete_image(request, image_id: int):
    """Delete gallery image (soft delete)"""
    user = request.auth
    image = get_object_or_404(Gallery, id=image_id)
    
    if not (image.uploaded_by == user or user.is_superuser or user.is_staff):
        return 400, {"error": "You can only delete your own images"}
    
    image.delete()  # This will soft delete
    return 200, {"message": "Image deleted successfully"}

# --- Soft Delete API Endpoints for Gallery ---

@gallery_router.get("/deleted/images", response=List[GallerySchema], auth=jwt_auth)
def list_deleted_gallery_images(request):
    """List all soft-deleted gallery images (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    return Gallery.deleted_objects.all().select_related('uploaded_by')

@gallery_router.post("/deleted/images/{image_id}/restore", response={200: MessageSchema, 400: ErrorSchema}, auth=jwt_auth)
def restore_gallery_image(request, image_id: int):
    """Restore a soft-deleted gallery image (Admin/Committee only)"""
    if not (request.auth.is_staff or request.auth.is_superuser):
        return 403, {"error": "Permission denied"}
    try:
        image = Gallery.deleted_objects.get(id=image_id)
        image.restore()
        return 200, {"message": f"Gallery image '{image.title}' restored successfully."}
    except Gallery.DoesNotExist:
        return 400, {"error": "Gallery image not found or not soft-deleted."}
