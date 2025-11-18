from django.shortcuts import get_object_or_404
from django.db.models import Q, Case, When, IntegerField
from django.utils.text import slugify
from django.utils import timezone

from ninja import Router, Query
from ninja.errors import HttpError
from typing import List, Optional
from uuid import UUID

from api.authentication import jwt_auth
from events.models import Event, Registration
from payments.models import DiscountCode
from api.schemas import (
    EventSchema,
    EventCreateSchema,
    EventUpdateSchema,
    EventListSchema,
    RegistrationSchema,
    RegistrationStatusUpdateSchema,
    RegisterationDetailSchema,
    MyEventRegistrationOut,
    RegistrationStatusOut,
    EventBriefSchema,
    EventAdminDetailSchema,
    PaginatedRegistrationSchema,
    MessageSchema,
    ErrorSchema,
    RegistrationCreateSchema,
)

events_router = Router()

# Event endpoints
@events_router.get("/", response=List[EventListSchema])
def list_events(
    request,
    # status: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    event_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """List events with filtering and pagination"""
    queryset = Event.objects.filter(is_deleted=False).prefetch_related('gallery_images')

    if status:
        if "," in status:
            parts = [s.strip() for s in status.split(",") if s.strip()]
            queryset = queryset.filter(status__in=parts)
        else:
            queryset = queryset.filter(status__in=status)
    if event_type:
        queryset = queryset.filter(event_type=event_type)
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search) | Q(description__icontains=search)
        )

    queryset = queryset.annotate(
        published_first=Case(
            When(status='published', then=0),
            default=1,
            output_field=IntegerField()
        )
    ).order_by('published_first', '-start_time', '-id')

    events = queryset[offset:offset + limit]
    return events

@events_router.get("/{int:event_id}", response=EventSchema)
def get_event(request, event_id: int):
    """Get event details by ID"""
    event = get_object_or_404(
        Event.objects.prefetch_related('gallery_images'),
        id=event_id,
        is_deleted=False
    )
    return event

@events_router.get("/slug/{str:slug}", response=EventSchema)
def get_event_by_slug(request, slug: str):
    """Get event details by slug"""
    event = get_object_or_404(
        Event.objects.prefetch_related('gallery_images'),
        slug=slug,
        is_deleted=False
    )
    return event

@events_router.post("/", response=EventSchema)
def create_event(request, payload: EventCreateSchema):
    """Create a new event"""
    gallery_image_ids = payload.dict().pop('gallery_image_ids', [])
    event = Event.objects.create(**payload.dict(exclude={'gallery_image_ids'}))

    if gallery_image_ids:
        event.gallery_images.set(gallery_image_ids)

    return event

@events_router.put("/{int:event_id}", response=EventSchema)
def update_event(request, event_id: int, payload: EventUpdateSchema):
    """Update an existing event"""
    event = get_object_or_404(Event, id=event_id, is_deleted=False)

    update_data = payload.dict(exclude_unset=True)
    gallery_image_ids = update_data.pop('gallery_image_ids', None)

    for attr, value in update_data.items():
        setattr(event, attr, value)

    if 'title' in update_data:
        event.slug = slugify(event.title)

    event.save()

    if gallery_image_ids is not None:
        event.gallery_images.set(gallery_image_ids)

    return event

@events_router.delete("/{int:event_id}", response=MessageSchema)
def delete_event(request, event_id: int):
    """Soft delete an event"""
    event = get_object_or_404(Event, id=event_id, is_deleted=False)
    event.delete()
    return {"message": "Event deleted successfully"}

# Registration endpoints
@events_router.get("/{int:event_id}/registrations", response=List[RegistrationSchema])
def list_event_registrations(request, event_id: int, limit: int = 20, offset: int = 0):
    """List registrations for a specific event"""
    event = get_object_or_404(Event, id=event_id, is_deleted=False)
    queryset = event.registrations.filter(is_deleted=False).select_related('user')

    registrations = queryset[offset:offset + limit]
    return registrations


@events_router.get("/{int:event_id}/admin-registrations", response={200: PaginatedRegistrationSchema, 403: ErrorSchema}, auth=jwt_auth)
def list_event_registrations_admin(
    request,
    event_id: int,
    status: Optional[List[str]] = Query(None),
    university: Optional[str] = Query(None),
    major: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List registrations with filters for admin dashboard"""
    user = request.auth
    if not (user.is_staff or user.is_superuser):
        return 403, {"error": "اجازه دسترسی ندارید."}

    event = get_object_or_404(Event, id=event_id, is_deleted=False)
    qs = (
        event.registrations.filter(is_deleted=False)
        .select_related("user")
        .prefetch_related("payments__discount_code")
        .order_by("-registered_at")
    )

    status_values = status or request.GET.getlist('status')
    if status_values:
        qs = qs.filter(status__in=status_values)

    if university:
        qs = qs.filter(
            Q(user__university__code__icontains=university)
            | Q(user__university__name__icontains=university)
        )

    if major:
        qs = qs.filter(
            Q(user__major__code__icontains=major)
            | Q(user__major__name__icontains=major)
        )

    if search:
        qs = qs.filter(
            Q(user__username__icontains=search)
            | Q(user__email__icontains=search)
            | Q(user__first_name__icontains=search)
            | Q(user__last_name__icontains=search)
        )

    total = qs.count()
    results = qs[offset : offset + limit]

    return PaginatedRegistrationSchema(count=total, next=None, previous=None, results=list(results))

@events_router.post(
    "/{int:event_id}/register",
    response=RegistrationSchema,
    auth=jwt_auth,
)
def register_for_event(
    request,
    event_id: int,
    payload: RegistrationCreateSchema | None = None,
):
    """Register current user for an event"""
    event = get_object_or_404(Event, id=event_id, is_deleted=False)
    user = request.auth

    if Registration.objects.filter(event=event, user=user, status=Registration.StatusChoices.CONFIRMED).exists():
        raise HttpError(400, "شما قبلا در این ایونت ثبت‌نام کرده‌اید.")

    if event.registration_end_date and event.registration_end_date < timezone.now():
        raise HttpError(400, "مهلت ثبت‌نام به پایان رسیده‌است")
    
    if event.registration_start_date and event.registration_start_date > timezone.now():
        raise HttpError(400, "زمان ثبت‌نام هنوز آغاز نشده است")

    if not event.has_available_slots:
        raise HttpError(400, "ظرفیت شرکت‌کنندگان تکمیل است")

    # Create or get existing registration
    discount_code = None
    if payload and payload.discount_code:
        discount_code = payload.discount_code
    elif request.GET.get("discount_code"):
        discount_code = request.GET.get("discount_code")

    registration, created = Registration.objects.get_or_create(
        event=event,
        user=user,
        status=Registration.StatusChoices.PENDING,
        defaults={"final_price": event.price},
    )

    if registration.status == Registration.StatusChoices.CONFIRMED:
        return HttpError(400, "شما قبلا در این ایونت ثبت‌نام کرده‌اید")

    if registration.status == Registration.StatusChoices.CANCELLED:
        registration = Registration.objects.create(
            event=event,
            user=user,
            status=Registration.StatusChoices.PENDING,
            final_price=event.price,
        )
    elif not created and registration.final_price is None:
        registration.final_price = event.price
        registration.save(update_fields=["final_price"])

    applied_code = None
    discount_amount = 0
    final_price = event.price
    fields_to_update = []

    if discount_code:
        applied_code = DiscountCode.objects.filter(
            code=discount_code,
            applicable_events=event,
            is_active=True,
        ).first()
        if not applied_code:
            raise HttpError(400, "UcO_ O�OrU?UOU? U.O1O�O\"O� U+UOO3O�")
        final_price, discount_amount = applied_code.calculate_discount(event, user)
        registration.discount_code = applied_code
        registration.discount_amount = discount_amount
        fields_to_update.extend(["discount_code", "discount_amount"])

    if registration.final_price != final_price:
        registration.final_price = final_price
        fields_to_update.append("final_price")

    if not event.price or final_price == 0:
        registration.status = Registration.StatusChoices.CONFIRMED
        fields_to_update.append("status")

    if fields_to_update:
        registration.save(update_fields=list(set(fields_to_update)))

    return registration

@events_router.put("/registrations/{int:registration_id}", response=RegistrationSchema, auth=jwt_auth)
def update_registration_status(request, registration_id: int, payload: RegistrationStatusUpdateSchema):
    """Update registration status"""
    user = request.auth

    registration = get_object_or_404(Registration, id=registration_id, user=user, is_deleted=False)
    registration.status = payload.dict(exclude_unset=True).get('status')
    registration.full_clean()
    registration.save()

    return registration

@events_router.delete("/registrations/{int:registration_id}", response=MessageSchema, auth=jwt_auth)
def cancel_registration(request, registration_id: int):
    """Cancel a registration"""
    user = request.auth

    registration = get_object_or_404(Registration, id=registration_id, user=user, is_deleted=False)
    registration.delete()
    return {"message": "ثبت‌نام شما لغو شد :("}

@events_router.get("/registerations/verify/{UUID:ticket_id}", response=RegisterationDetailSchema, auth=jwt_auth)
def verify_my_registration(request, ticket_id: UUID):
    try:
        reg = Registration.objects.select_related("event").get(ticket_id=ticket_id, user=request.auth)
        return {
            "event_image": request.build_absolute_uri(reg.event.featured_image.url) if reg.event.featured_image else None,
            "event_title": reg.event.title,
            "event_type": reg.event.get_event_type_display(),
            "ticket_id": reg.ticket_id,
            "status": reg.status,
            "registered_at": reg.registered_at,
            "success_markdown": reg.event.registration_success_markdown,
        }
    except Registration.DoesNotExist:
        raise HttpError(404, "registration not found")



@events_router.get("/my-registrations", response=List[MyEventRegistrationOut], auth=jwt_auth)
def my_registrations(request):
    qs = (
        Registration.objects
        .filter(user=request.auth)
        .select_related("event")
        .order_by("-created_at")
    )
    out: List[MyEventRegistrationOut] = []
    for r in qs:
        out.append(
            MyEventRegistrationOut(
                id=r.id,
                created_at=r.created_at,
                status=r.status,
                event=EventBriefSchema(
                    id=r.event.id,
                    title=r.event.title,
                    slug=r.event.slug,
                    start_date=r.event.start_time,
                    end_date=r.event.end_time,
                    location=r.event.location,
                    price=r.event.price,
                    absolute_image_url=request.build_absolute_uri(r.event.featured_image.url) if r.event.featured_image else None,
                ),
            )
        )
    return out

@events_router.get("/{event_id}/is-registered", response=RegistrationStatusOut, auth=jwt_auth)
def is_registered(request, event_id: int):
    exists = Registration.objects.filter(
        user=request.auth,
        event_id=event_id,
        status=Registration.StatusChoices.CONFIRMED
    ).exists()
    return {"is_registered": exists}
@events_router.get("/{int:event_id}/admin-detail", response=EventAdminDetailSchema, auth=jwt_auth)
def event_admin_detail(request, event_id: int):
    user = request.auth
    if not (user.is_staff or user.is_superuser):
        return 403, {"error": "اجازه دسترسی ندارید."}

    event = get_object_or_404(
        Event.objects.prefetch_related(
            'gallery_images',
            'registrations__user',
            'registrations__payments__discount_code'
        ),
        id=event_id,
        is_deleted=False,
    )
    return event
