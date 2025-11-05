from celery import shared_task
from PIL import Image
import logging

logger = logging.getLogger(__name__)

@shared_task
def process_uploaded_image(gallery_id):
    """Process uploaded image: compress, resize, extract metadata"""
    try:
        from .models import Gallery
        gallery_item = Gallery.objects.get(id=gallery_id)
        
        if gallery_item.image:
            # This will trigger the compression and metadata extraction
            gallery_item.compress_image()
            
            logger.info(f"Processed image: {gallery_item.title}")
            return f"Processed image: {gallery_item.title}"
            
    except Exception as exc:
        logger.error(f"Failed to process image: {exc}")
        raise exc
