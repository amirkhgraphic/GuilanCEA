from datetime import datetime
from typing import Optional, List

from ninja import Schema, ModelSchema

from api.schemas import AuthorSchema
from communications.models import (
    Announcement,
    NewsletterSubscription,
    PushNotificationDevice
)


# Communication Schemas
class AnnouncementSchema(ModelSchema):
    author: AuthorSchema
    content_html: str

    class Config:
        model = Announcement
        model_fields = [
            'id', 'title', 'content', 'announcement_type', 'priority',
            'is_published', 'publish_date', 'send_email', 'send_push',
            'target_audience', 'email_sent', 'push_sent', 'created_at', 'updated_at'
        ]

    @staticmethod
    def resolve_content_html(obj):
        return obj.content_html

class AnnouncementListSchema(Schema):
    id: int
    title: str
    content: str
    announcement_type: str
    priority: str
    author: AuthorSchema
    is_published: bool
    publish_date: Optional[datetime] = None
    target_audience: str
    created_at: datetime

class AnnouncementCreateSchema(Schema):
    title: str
    content: str
    announcement_type: str = "general"
    priority: str = "normal"
    target_audience: str = "all"
    is_published: bool = False
    publish_date: Optional[datetime] = None
    send_email: bool = False
    send_push: bool = False

class AnnouncementUpdateSchema(Schema):
    title: Optional[str] = None
    content: Optional[str] = None
    announcement_type: Optional[str] = None
    priority: Optional[str] = None
    target_audience: Optional[str] = None
    is_published: Optional[bool] = None
    publish_date: Optional[datetime] = None
    send_email: Optional[bool] = None
    send_push: Optional[bool] = None

class NewsletterSubscriptionSchema(ModelSchema):
    user: Optional[AuthorSchema] = None

    class Config:
        model = NewsletterSubscription
        model_fields = [
            'id', 'email', 'is_active', 'subscribed_categories',
            'confirmed_at', 'created_at'
        ]

class NewsletterSubscribeSchema(Schema):
    email: str
    subscribed_categories: Optional[List[str]] = []

class NewsletterUnsubscribeSchema(Schema):
    email: str

class PushDeviceSchema(ModelSchema):
    user: AuthorSchema

    class Config:
        model = PushNotificationDevice
        model_fields = [
            'id', 'device_token', 'device_type', 'is_active', 'created_at'
        ]

class PushDeviceCreateSchema(Schema):
    device_token: str
    device_type: str = "web"

class PushDeviceUpdateSchema(Schema):
    is_active: bool

class PushNotificationSchema(Schema):
    title: str
    body: str
    data: Optional[dict] = None
    target_audience: str = "all"

# Response Schemas
class MessageResponseSchema(Schema):
    message: str
    success: bool = True

class AnnouncementStatsSchema(Schema):
    total_announcements: int
    published_announcements: int
    draft_announcements: int
    urgent_announcements: int
    email_sent_count: int
    push_sent_count: int

class NewsletterStatsSchema(Schema):
    total_subscriptions: int
    active_subscriptions: int
    confirmed_subscriptions: int
    recent_subscriptions: int
