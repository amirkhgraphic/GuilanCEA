from ninja import Schema, ModelSchema
from typing import Optional

from api.schemas.blog import AuthorSchema
from gallery.models import Gallery


# Gallery Schemas
class GallerySchema(ModelSchema):
    uploaded_by: AuthorSchema
    file_size_mb: float
    markdown_url: str

    class Config:
        model = Gallery
        model_fields = ['id', 'title', 'description', 'image', 'alt_text',
                        'width', 'height', 'is_public', 'created_at']


class GalleryCreateSchema(Schema):
    title: str
    description: Optional[str] = None
    alt_text: Optional[str] = None
    is_public: bool = True
