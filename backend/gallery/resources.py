from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget

from gallery.models import Gallery
from users.models import User

class GalleryResource(resources.ModelResource):
    uploaded_by = fields.Field(
        column_name='uploaded_by',
        attribute='uploaded_by',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = Gallery
        fields = ('id', 'title', 'description', 'image', 'uploaded_by', 
                 'alt_text', 'file_size', 'width', 'height', 'is_public', 'created_at')
