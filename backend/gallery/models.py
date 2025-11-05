from django.db import models
from django.conf import settings

from PIL import Image

from utils.models import BaseModel


MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024

class Gallery(BaseModel):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='gallery/')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='gallery_images')
    alt_text = models.CharField(max_length=200, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    is_public = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = "Gallery Images"

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        
        if self.image:
            # Get file size
            self.file_size = self.image.size
            
            # Get image dimensions
            with Image.open(self.image.path) as img:
                self.width, self.height = img.size
            
            # Compress image if it's too large
            self.compress_image()
            
            # Update fields without triggering save again
            Gallery.objects.filter(pk=self.pk).update(
                file_size=self.file_size,
                width=self.width,
                height=self.height
            )

    def compress_image(self):
        """Compress image if it's larger than 2MB or dimensions are too large"""
        if not self.image:
            return
            
        with Image.open(self.image.path) as img:
            # Convert to RGB if necessary
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize if too large
            max_size = (1920, 1080)
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Compress if file size is too large
            quality = 85
        if self.file_size and self.file_size > MAX_IMAGE_FILE_SIZE_BYTES:
            quality = 70
            
            img.save(self.image.path, "JPEG", quality=quality, optimize=True)

    @property
    def file_size_mb(self):
        """Return file size in MB"""
        if self.file_size:
            return round(self.file_size / (1024 * 1024), 2)
        return 0

    @property
    def markdown_url(self):
        """Return URL for use in markdown"""
        return f"![{self.alt_text or self.title}]({settings.BACKEND_ROOT}{self.image.url})"
