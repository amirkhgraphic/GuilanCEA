from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget, ManyToManyWidget

from events.models import Event, Registration
from users.models import User
from gallery.models import Gallery

class EventResource(resources.ModelResource):
    gallery_images = fields.Field(
        column_name='gallery_images',
        attribute='gallery_images',
        widget=ManyToManyWidget(Gallery, field='title', separator='|')
    )

    class Meta:
        model = Event
        fields = (
            'id', 'title', 'slug', 'description', 'start_time', 'end_time',
            'event_type', 'address', 'location', 'online_link', 'status',
            'capacity', 'price', 'registration_start_date', 'registration_end_date',
            'featured_image', 'gallery_images', 'created_at', 'updated_at',
            'is_deleted', 'deleted_at'
        )
        export_order = fields

class RegistrationResource(resources.ModelResource):
    event = fields.Field(
        column_name='event',
        attribute='event',
        widget=ForeignKeyWidget(Event, 'title')
    )

    # User-related columns
    user_username = fields.Field(
        column_name='user_username',
        attribute='user',
        widget=ForeignKeyWidget(User, 'username')
    )
    user_email = fields.Field(
        column_name='user_email',
        attribute='user',
        widget=ForeignKeyWidget(User, 'email')
    )
    user_first_name = fields.Field(
        column_name='user_first_name',
        attribute='user',
        widget=ForeignKeyWidget(User, 'first_name')
    )
    user_last_name = fields.Field(
        column_name='user_last_name',
        attribute='user',
        widget=ForeignKeyWidget(User, 'last_name')
    )

    class Meta:
        model = Registration
        fields = (
            'id',
            'event',
            'user_username',
            'user_email',
            'user_first_name',
            'user_last_name',
            'registered_at',
            'status',
            'ticket_id',        # will be truncated via dehydrate_*
            'created_at',
            'updated_at',
            'is_deleted',
            'deleted_at',
        )
        export_order = fields  # keep the same order as above

    # Trim ticket_id to 8 characters in the export
    def dehydrate_ticket_id(self, obj):
        val = getattr(obj, 'ticket_id', '')
        return str(val)[:8] if val else ''