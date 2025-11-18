"""Event and gallery API schemas."""

from uuid import UUID
from ninja import ModelSchema, Schema
from typing import Literal, Optional, List
from datetime import datetime

from api.schemas.blog import AuthorSchema
from events.models import Event, Registration
from gallery.models import Gallery
from payments.models import Payment
from payments.models import Payment


class EventGallerySchema(ModelSchema):
    """Schema representing gallery items associated with an event."""
    uploaded_by: AuthorSchema
    file_size_mb: float
    markdown_url: str
    absolute_image_url: Optional[str] = None

    class Config:
        model = Gallery
        model_fields = ['id', 'title', 'description', 'image', 'alt_text',
                       'width', 'height', 'is_public', 'created_at']

    @staticmethod
    def resolve_absolute_image_url(obj, context):
        request = context['request']
        if obj.image and hasattr(obj.image, 'url'):
            return request.build_absolute_uri(obj.image.url)
        return None

class EventSchema(ModelSchema):
    """Schema providing full event details for API responses."""
    gallery_images: List[EventGallerySchema]
    description_html: str
    registration_count: int
    absolute_featured_image_url: Optional[str] = None

    class Config:
        model = Event
        model_fields = [
            'id', 'title', 'slug', 'description', 'featured_image', 'event_type',
            'address', 'location', 'online_link', 'start_time', 'end_time',
            'registration_start_date', 'registration_end_date', 'registration_success_markdown',
            'capacity', 'price', 'status', 'created_at', 'updated_at'
        ]

    @staticmethod
    def resolve_absolute_featured_image_url(obj, context):
        request = context['request']
        if obj.featured_image and hasattr(obj.featured_image, 'url'):
            return request.build_absolute_uri(obj.featured_image.url)
        return None

    @staticmethod
    def resolve_registration_count(obj):
        return obj.registrations.filter(status__in=[Registration.StatusChoices.CONFIRMED, Registration.StatusChoices.ATTENDED]).count()

    @staticmethod
    def resolve_description_html(obj):
        return obj.description_html


class EventListSchema(Schema):
    """Condensed event representation for list endpoints."""
    id: int
    title: str
    slug: str
    featured_image: Optional[str] = None
    absolute_featured_image_url: Optional[str] = None
    event_type: str
    start_time: datetime
    end_time: datetime
    registration_start_date: Optional[datetime] = None
    registration_end_date: Optional[datetime] = None
    capacity: Optional[int] = None
    price: Optional[float] = None
    status: str
    registration_count: int
    created_at: datetime

    @staticmethod
    def resolve_absolute_featured_image_url(obj, context):
        request = context['request']
        if obj.featured_image and hasattr(obj.featured_image, 'url'):
            return request.build_absolute_uri(obj.featured_image.url)
        return None

    @staticmethod
    def resolve_registration_count(obj):
        return obj.registrations.filter(status__in=[Registration.StatusChoices.CONFIRMED, Registration.StatusChoices.ATTENDED]).count()

class EventCreateSchema(Schema):
    """Payload for creating events via the API."""
    title: str
    description: str
    event_type: str
    address: Optional[str] = None
    location: Optional[str] = None
    online_link: Optional[str] = None
    start_time: datetime
    end_time: datetime
    registration_start_date: Optional[datetime] = None
    registration_end_date: Optional[datetime] = None
    capacity: Optional[int] = None
    price: Optional[float] = None
    status: str = "draft"
    gallery_image_ids: Optional[List[int]] = []

class EventUpdateSchema(Schema):
    """Payload for updating events via the API."""
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    address: Optional[str] = None
    location: Optional[str] = None
    online_link: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    registration_start_date: Optional[datetime] = None
    registration_end_date: Optional[datetime] = None
    capacity: Optional[int] = None
    price: Optional[float] = None
    status: Optional[str] = None
    gallery_image_ids: Optional[List[int]] = None

class RegistrationSchema(ModelSchema):
    """Schema describing a registration entry with event context."""
    user: AuthorSchema
    event: EventListSchema
    discount_code: str | None = None

    class Config:
        model = Registration
        model_fields = [
            'id',
            'status',
            'registered_at',
            'ticket_id',
            'discount_amount',
            'final_price',
            'created_at',
            'updated_at',
        ]

    @staticmethod
    def resolve_discount_code(obj):
        return obj.discount_code.code if obj.discount_code else None


class AdminUserSchema(Schema):
    id: int
    username: str
    first_name: str
    last_name: str
    email: str


class PaymentAdminSchema(Schema):
    id: int
    authority: Optional[str]
    ref_id: Optional[str]
    status: int
    status_label: str
    base_amount: int
    discount_amount: int
    amount: int
    verified_at: Optional[datetime]
    created_at: datetime
    discount_code: Optional[str]
    user: AdminUserSchema


class RegistrationAdminSchema(Schema):
    id: int
    ticket_id: UUID
    status: str
    status_label: str
    registered_at: datetime
    final_price: Optional[int]
    discount_amount: Optional[int]
    user: AdminUserSchema
    payments: List[PaymentAdminSchema]


class EventAdminDetailSchema(EventSchema):
    registrations: List[RegistrationAdminSchema] = []

    @staticmethod
    def resolve_registrations(obj):
        return obj.registrations.select_related("user").prefetch_related(
            "payments__discount_code"
        ).order_by("-registered_at")

class PaginatedRegistrationSchema(Schema):
    count: int
    next: Optional[str] = None
    previous: Optional[str] = None
    results: List[RegistrationAdminSchema]

class RegistrationStatusUpdateSchema(Schema):
    status: str

class RegisterationDetailSchema(Schema):
    """Detailed registration information with associated event metadata."""
    event_image: Optional[str]
    event_title: str
    event_type: str
    ticket_id: UUID
    status: str
    registered_at: datetime
    success_markdown: Optional[str]

class EventBriefSchema(Schema):
    """Minimal event representation used for nested responses."""
    id: int
    title: str
    slug: str
    start_date: datetime
    end_date: Optional[datetime] = None
    location: Optional[str] = None
    price: int
    absolute_image_url: Optional[str] = None

class MyEventRegistrationOut(Schema):
    """Registration information as returned to authenticated users."""
    id: int
    created_at: datetime
    status: Literal["pending", "confirmed", "cancelled", "attended"]
    event: EventBriefSchema

class RegistrationStatusOut(Schema):
    is_registered: bool


class RegistrationCreateSchema(Schema):
    discount_code: Optional[str] = None
