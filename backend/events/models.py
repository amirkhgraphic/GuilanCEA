from django.db import models
from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

import hashlib
import uuid

import markdown
from location_field.models.plain import PlainLocationField as LocationField

from utils.models import BaseModel


class Event(BaseModel):
    class TypeChoices(models.TextChoices):
        ONLINE = 'online', 'آنلاین'
        ON_SITE = 'on_site', 'حضوری'
        HYBRID = 'hybrid', 'آنلاین/حضوری'

    class StatusChoices(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        CANCELLED = 'cancelled', 'Cancelled'
        COMPLETED = 'completed', 'Completed'

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    description = models.TextField(help_text="Event description in Markdown format")

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()

    address = models.CharField(max_length=255, blank=True, null=True, help_text="Physical address or venue name")
    location = LocationField(based_fields=['address'], zoom=15, blank=True, null=True,
                             help_text="Select location on map")

    event_type = models.CharField(max_length=10, choices=TypeChoices.choices, default=TypeChoices.ON_SITE)
    online_link = models.URLField(max_length=500, blank=True, null=True,
                                  help_text="Link for online events (e.g., Zoom, Google Meet)")

    status = models.CharField(max_length=10, choices=StatusChoices.choices, default=StatusChoices.DRAFT)
    capacity = models.PositiveIntegerField(null=True, blank=True,
                                           help_text="Maximum number of attendees (leave blank for unlimited)")

    price = models.IntegerField(default=0, help_text="Price of the event. Leave blank for free events.")

    registration_start_date = models.DateTimeField(null=True, blank=True)
    registration_end_date = models.DateTimeField(null=True, blank=True)
    featured_image = models.ImageField(upload_to='events/featured/', null=True, blank=True)
    gallery_images = models.ManyToManyField('gallery.Gallery', blank=True, related_name='event_galleries',
                                            help_text="Images taken during or related to the event.")

    registration_success_markdown = models.TextField(
        blank=True, null=True,
        help_text="Optional markdown shown to users after a successful registration."
    )

    class Meta:
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['status', 'start_time']),
            models.Index(fields=['event_type']),
        ]

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    @property
    def description_html(self):
        """Convert markdown description to HTML"""
        return markdown.markdown(
            self.description,
            extensions=[
                'markdown.extensions.extra',
                'markdown.extensions.toc',
            ]
        )

    @property
    def is_registration_open(self):
        now = timezone.now()
        return (self.registration_start_date is None or now >= self.registration_start_date) and \
            (self.registration_end_date is None or now <= self.registration_end_date)

    @property
    def current_attendees_count(self):
        """Count confirmed attendees"""
        return self.registrations.filter(status__in=[Registration.StatusChoices.CONFIRMED, Registration.StatusChoices.ATTENDED], is_deleted=False).count()

    @property
    def has_available_slots(self):
        """Check whether registration slots are available, treating None as unlimited capacity."""
        if self.capacity is None:
            return True
        return self.current_attendees_count < self.capacity


class Registration(BaseModel):
    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        CANCELLED = 'cancelled', 'Cancelled'
        ATTENDED = 'attended', 'Attended'

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='event_registrations')
    registered_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=StatusChoices.choices,
                              default=StatusChoices.PENDING)
    ticket_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    confirmation_email_sent_at = models.DateTimeField(null=True, blank=True)
    cancellation_email_sent_at = models.DateTimeField(null=True, blank=True)
    discount_code = models.ForeignKey(
        "payments.DiscountCode",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="registrations",
    )
    discount_amount = models.PositiveIntegerField(default=0)
    final_price = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-registered_at']
        indexes = [
            models.Index(fields=['event', 'status']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.username} registered for {self.event.title}"

    def save(self, *args, **kwargs):
            # detect create vs update
            is_create = self._state.adding
            old_status = None

            if not is_create and self.pk:
                old_status = (
                    self.__class__.objects.only("status").get(pk=self.pk).status
                )

            # save first (so we have a pk + final values)
            super().save(*args, **kwargs)

            # 1) on create -> send confirmation if pending/confirmed (and not sent before)
            if is_create and self.status == self.StatusChoices.CONFIRMED and not self.confirmation_email_sent_at:
                # lazy import to avoid circular import
                from events.tasks import send_registration_confirmation_email
                send_registration_confirmation_email.delay(str(self.pk))
                self.confirmation_email_sent_at = timezone.now()
                super().save(update_fields=["confirmation_email_sent_at"])

            # 2) status changed -> cancelled
            if (not is_create) and (old_status != self.StatusChoices.CANCELLED) and (self.status == self.StatusChoices.CANCELLED) and (not self.cancellation_email_sent_at):
                from events.tasks import send_registration_cancellation_email
                send_registration_cancellation_email.delay(str(self.pk))
                self.cancellation_email_sent_at = timezone.now()
                super().save(update_fields=["cancellation_email_sent_at"])

            # 3) status changed -> confirmed (if not sent before)
            if (not is_create) and (old_status != self.StatusChoices.CONFIRMED) and (self.status == self.StatusChoices.CONFIRMED) and (not self.confirmation_email_sent_at):
                from events.tasks import send_registration_confirmation_email
                send_registration_confirmation_email.delay(str(self.pk))
                self.confirmation_email_sent_at = timezone.now()
                super().save(update_fields=["confirmation_email_sent_at"])


class EventEmailLog(BaseModel):
    class KindChoices(models.TextChoices):
        INVITE_NON_REGISTERED = "invite_non_registered", "Invite non-registered users"
        SKYROOM_CREDENTIALS = "send_skyroom_credentials", "Skyroom credentials"
        EVENT_ANNOUNCEMENT = "send_event_announcement", "Event announcement"
        EVENT_ANNOUNCEMENT2 = "send_event_announcement2", "Event announcement 2"
        EVENT_ANNOUNCEMENT3 = "send_event_announcement3", "Event announcement 3"

    class StatusChoices(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    KIND_INVITE_NON_REGISTERED = KindChoices.INVITE_NON_REGISTERED
    KIND_SKYROOM_CREDENTIALS = KindChoices.SKYROOM_CREDENTIALS
    KIND_EVENT_ANNOUNCEMENT = KindChoices.EVENT_ANNOUNCEMENT
    KIND_EVENT_ANNOUNCEMENT2 = KindChoices.EVENT_ANNOUNCEMENT2
    KIND_EVENT_ANNOUNCEMENT3 = KindChoices.EVENT_ANNOUNCEMENT3
    KIND_CHOICES = KindChoices.choices

    STATUS_PENDING = StatusChoices.PENDING
    STATUS_SENT = StatusChoices.SENT
    STATUS_FAILED = StatusChoices.FAILED
    STATUS_CHOICES = StatusChoices.choices

    event = models.ForeignKey('events.Event', on_delete=models.CASCADE, related_name='email_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='email_logs')
    kind = models.CharField(max_length=64, choices=KIND_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error = models.TextField(blank=True, null=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    context_hash = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        unique_together = ("event", "user", "kind", "context_hash")
        indexes = [
            models.Index(fields=["event", "kind", "status"]),
            models.Index(fields=["user", "kind", "status"]),
        ]

    def __str__(self):
        return f"{self.event.id} - {self.user.id} - {self.kind} - {self.status}"

    @staticmethod
    def _hash_context(context):
        if context is None:
            return None
        if not isinstance(context, str):
            context = str(context)
        return hashlib.sha256(context.encode("utf-8")).hexdigest()

    @classmethod
    def claim(cls, *, event_id, user_id, kind, context=None):
        context_hash = cls._hash_context(context)
        log, created = cls.objects.get_or_create(
            event_id=event_id,
            user_id=user_id,
            kind=kind,
            context_hash=context_hash,
            defaults={"status": cls.STATUS_PENDING},
        )
        if not created and log.status in (cls.STATUS_PENDING, cls.STATUS_SENT):
            return log, True
        if not created:
            log._commit_status(cls.STATUS_PENDING, error="")
        return log, False

    def _commit_status(self, status, *, error="", sent_at=None):
        self.status = status
        self.error = error
        update_fields = ["status", "error"]
        if status == self.STATUS_SENT:
            self.sent_at = sent_at or timezone.now()
            update_fields.append("sent_at")
        elif self.sent_at is not None:
            self.sent_at = None
            update_fields.append("sent_at")
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)

    def mark_sent(self):
        self._commit_status(self.STATUS_SENT)

    def mark_failed(self, error):
        self._commit_status(self.STATUS_FAILED, error=error)
