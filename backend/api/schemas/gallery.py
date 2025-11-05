"""Schemas for gallery resources."""

from ninja import Schema, ModelSchema
from typing import Optional

from api.schemas.blog import AuthorSchema
from gallery.models import Gallery


class GallerySchema(ModelSchema):
    """Serialized representation of a gallery image."""
    uploaded_by: AuthorSchema
    file_size_mb: float
    markdown_url: str

    class Config:
        model = Gallery
        model_fields = ['id', 'title', 'description', 'image', 'alt_text',
                        'width', 'height', 'is_public', 'created_at']


class GalleryCreateSchema(Schema):
    """Payload for creating a gallery entry."""
    title: str
    description: Optional[str] = None
    alt_text: Optional[str] = None
    is_public: bool = True
