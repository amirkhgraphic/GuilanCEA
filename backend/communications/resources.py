from django.contrib.auth import get_user_model

from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget

from communications.models import Announcement, NewsletterSubscription, PushNotificationDevice

User = get_user_model()


class AnnouncementResource(resources.ModelResource):
    author = fields.Field(
        column_name='author',
        attribute='author',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = Announcement
        fields = (
            'id', 'title', 'content', 'announcement_type', 'priority',
            'author', 'is_published', 'publish_date', 'send_email', 'send_push',
            'target_audience', 'created_at', 'updated_at'
        )
        export_order = fields


class NewsletterSubscriptionResource(resources.ModelResource):
    user = fields.Field(
        column_name='user',
        attribute='user',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = NewsletterSubscription
        fields = (
            'id', 'email', 'user', 'is_active', 'subscribed_categories',
            'confirmed_at', 'created_at', 'updated_at'
        )
        export_order = fields


class PushNotificationDeviceResource(resources.ModelResource):
    user = fields.Field(
        column_name='user',
        attribute='user',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = PushNotificationDevice
        fields = (
            'id', 'user', 'device_type', 'is_active', 'created_at', 'updated_at'
        )
        export_order = fields
