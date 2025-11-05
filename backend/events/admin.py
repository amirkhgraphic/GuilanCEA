from django.contrib import admin, messages
from django.template.response import TemplateResponse
from django.contrib.admin.helpers import ACTION_CHECKBOX_NAME
from django.template.loader import render_to_string
from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse_lazy

from import_export.admin import ImportExportModelAdmin
from utils.templatetags.jalali import jdate
from unfold.decorators import action as unfold_action

from utils.admin import SoftDeleteListFilter, BaseModelAdmin
from events.models import Event, Registration, EventEmailLog
from events.resources import EventResource, RegistrationResource
from events.tasks import (
    queue_skyroom_credentials,
    send_skyroom_credentials_individual_task,
    send_event_reminder_task,
    queue_event_announcement,
    queue_invites_to_non_registered_users,
)
from events.admin_forms import AnnouncementForm
from events.tasks import _send_html_email


@admin.register(Event)
class EventAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = EventResource
    list_display = (
        'title', 'event_type', 'start_time_display', 'end_time_display', 'status',
        'price_display', 'capacity_display', 'attendees_display', 'is_registration_open_display'
    )
    list_filter = (
        'event_type', 'status', 'is_deleted',
        'start_time', 'end_time', 'registration_start_date', 'registration_end_date',
        SoftDeleteListFilter
    )
    search_fields = ('title', 'description', 'address')
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'start_time'
    filter_horizontal = ('gallery_images',)

    fieldsets = (
        ('Event Details', {
            'fields': ('title', 'slug', 'description', 'featured_image')
        }),
        ('Timing & Type', {
            'fields': ('start_time', 'end_time', 'event_type', 'status')
        }),
        ('Location & Online', {
            'fields': ('address', 'location', 'online_link'),
            'description': 'For On-Site or Hybrid events, provide address and select on map. For Online events, provide a link.'
        }),
        ('Registration & Pricing', {
            'fields': ('capacity', 'price', 'registration_start_date', 'registration_end_date', 'registration_success_markdown'),
            'description': 'Leave capacity blank for unlimited. Leave price blank for free events.'
        }),
        ('Gallery', {
            'fields': ('gallery_images',),
            'description': 'Add images related to this event from the Gallery app.'
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ('deleted_at',)

    actions = BaseModelAdmin.actions + [
        'make_published', 
        'make_draft', 
        'make_cancelled', 
        'make_completed',
        'restore_events',
    ]

    actions_row = [
        'action_send_announcement',
        'action_send_reminder_now',
        'action_send_skyroom_credentials',
        'action_invite_other_users',
    ]

    @admin.display(description="Price")
    def price_display(self, obj):
        return obj.price if obj.price is not None else "رایگان"

    @admin.display(description="Start")
    def start_time_display(self, obj):
        return jdate(obj.start_time)

    @admin.display(description="End")
    def end_time_display(self, obj):
        return jdate(obj.end_time)

    @admin.display(description="Capacity")
    def capacity_display(self, obj):
        return obj.capacity if obj.capacity is not None else "نامحدود"

    @admin.display(description="Attendees")
    def attendees_display(self, obj):
        return obj.current_attendees_count

    @admin.display(description="Open", boolean=True)
    def is_registration_open_display(self, obj):
        return obj.is_registration_open
    
    @admin.action(description="Mark selected events as published")
    def make_published(self, request, queryset):
        queryset.update(status=Event.StatusChoices.PUBLISHED)
        self.message_user(request, f"Published {queryset.count()} events.")

    @admin.action(description="Mark selected events as draft")
    def make_draft(self, request, queryset):
        queryset.update(status=Event.StatusChoices.DRAFT)
        self.message_user(request, f"Marked {queryset.count()} events as draft.")

    @admin.action(description="Mark selected events as cancelled")
    def make_cancelled(self, request, queryset):
        queryset.update(status=Event.StatusChoices.CANCELLED)
        self.message_user(request, f"Cancelled {queryset.count()} events.")

    @admin.action(description="Mark selected events as completed")
    def make_completed(self, request, queryset):
        queryset.update(status=Event.StatusChoices.COMPLETED)
        self.message_user(request, f"Marked {queryset.count()} events as completed.")

    @admin.action(description="Restore selected events")
    def restore_events(self, request, queryset):
        for event in queryset:
            event.restore()
        self.message_user(request, f"Restored {queryset.count()} events.")

    @unfold_action(description="Send Skyroom Credentials")
    def action_send_skyroom_credentials(self, request, object_id: int):
        event = Event.objects.get(pk=object_id)
        queue_skyroom_credentials.delay(event.pk)
        self.message_user(request, f"ارسال مشخصات اسکای‌روم برای رویداد '{event.title}' صف شد.", messages.SUCCESS)
        return redirect(reverse_lazy("admin:events_event_changelist"))

    @unfold_action(description="Send new Reminder")
    def action_send_reminder_now(self, request, object_id: int):
        event = Event.objects.get(pk=object_id)
        send_event_reminder_task.delay(event.pk)
        self.message_user(request, f"یادآوری برای رویداد '{event.title}' صف شد.", messages.SUCCESS)
        return redirect(reverse_lazy("admin:events_event_changelist"))

    @unfold_action(description="send new Announcement")
    def action_send_announcement(self, request, object_id: int):
        """
        این اکشن یک فرم می‌گیرد (عنوان/متن/وضعیت‌ها) و با تمپلیت Unfold نشان داده می‌شود.
        """
        form = AnnouncementForm(request.POST or None)
        event = Event.objects.get(pk=object_id)

        if request.method == "POST" and form.is_valid():
            subject = form.cleaned_data["subject"]
            body_html = form.cleaned_data["body_html"]
            statuses = form.cleaned_data["statuses"] or None
            queue_event_announcement.delay(event.pk, subject, body_html, statuses=statuses)
            self.message_user(request, f"اطلاعیه برای رویداد '{event.title}' صف شد.", messages.SUCCESS)
            return redirect(reverse_lazy("admin:events_event_changelist"))

        context = {
            **self.admin_site.each_context(request),
            "title": "ارسال اطلاعیه گروهی",
            "opts": self.model._meta,
            "form": form,
            "action_name": "action_send_announcement",
            "action_checkbox_name": ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, "forms/admin_announcement.html", context)

    @unfold_action(description="Invite other users")
    def action_invite_other_users(self, request, object_id: int):
        event = Event.objects.get(pk=object_id)
        queue_invites_to_non_registered_users.delay(event.pk)
        self.message_user(request, f"دعوت برای شرکت در رویداد '{event.title}' صف شد.", messages.SUCCESS)
        return redirect(reverse_lazy("admin:events_event_changelist"))


@admin.register(Registration)
class RegistrationAdmin(BaseModelAdmin, ImportExportModelAdmin):
    resource_class = RegistrationResource
    list_display = (
        'user', 'event', 'status', 'registered_at', 'ticket_id'
    )
    list_filter = (
        'status', 'event', 'user', 'is_deleted', 'registered_at',
        SoftDeleteListFilter
    )
    search_fields = ('user__username', 'user__email', 'user__first_name', 'user__last_name', 'event__title', 'ticket_id')
    readonly_fields = ('ticket_id', 'registered_at', 'confirmation_email_sent_at', 'cancellation_email_sent_at', 'deleted_at')

    fieldsets = (
        ('Registration Details', {
            'fields': ('user', 'event', 'status', 'registered_at', 'ticket_id', 'confirmation_email_sent_at', 'cancellation_email_sent_at')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    actions = BaseModelAdmin.actions + [
        'confirm_registrations', 
        'cancel_registrations', 
        'mark_attended',
        'restore_registrations',
    ]
    actions_row = [
        'action_email_selected',
        'action_send_skyroom_credentials',
    ]

    @admin.action(description="Confirm selected registrations")
    def confirm_registrations(self, request, queryset):
        queryset.update(status=Registration.StatusChoices.CONFIRMED)
        self.message_user(request, f"Confirmed {queryset.count()} registrations.")

    @admin.action(description="Cancel selected registrations")
    def cancel_registrations(self, request, queryset):
        queryset.update(status=Registration.StatusChoices.CANCELLED)
        self.message_user(request, f"Cancelled {queryset.count()} registrations.")

    @admin.action(description="Mark selected registrations as attended")
    def mark_attended(self, request, queryset):
        queryset.update(status=Registration.StatusChoices.ATTENDED)
        self.message_user(request, f"Marked {queryset.count()} registrations as attended.")

    @admin.action(description="Restore selected registrations")
    def restore_registrations(self, request, queryset):
        for registration in queryset:
            registration.restore()
        self.message_user(request, f"Restored {queryset.count()} registrations.")

    @unfold_action(description="send email to registrated user")
    def action_email_selected(self, request, object_id: int):
        """
        همان فرم اطلاعیه را می‌گیرد و به افراد انتخاب‌شده ایمیل می‌زند.
        برای نمایش فرم، از تمپلیت Unfold استفاده می‌کنیم.
        """
        form = AnnouncementForm(request.POST or None)
        registration = Registration.objects.get(id=object_id)
        
        if request.method == "POST" and form.is_valid():
            subject = form.cleaned_data["subject"]
            body_html = form.cleaned_data["body_html"]

            user = registration.user
            ctx = {
                "user": user,
                "event": registration.event,
                "body_html": body_html,
                "event_url": f"{settings.FRONTEND_ROOT}events/{registration.event.slug}",
            }
            html = render_to_string("emails/event_announcement.html", ctx)
            _send_html_email(subject, html, user.email)
            
            self.message_user(request, f"ارسال ایمیل انجام شد.", messages.SUCCESS)
            return redirect(reverse_lazy("admin:events_registration_changelist"))

        context = {
            **self.admin_site.each_context(request),
            "title": "ارسال ایمیل به ثبت‌نام‌های انتخاب‌شده",
            "form": AnnouncementForm(),
            "opts": self.model._meta,
            "action_name": "action_email_selected",
            "action_checkbox_name": ACTION_CHECKBOX_NAME,
        }
        return TemplateResponse(request, "forms/admin_announcement.html", context)

    @unfold_action(description="Send Skyroom Credentials")
    def action_send_skyroom_credentials(self, request, object_id: int):
        send_skyroom_credentials_individual_task.delay(object_id)
        self.message_user(request, f"ارسال مشخصات اسکای‌روم به کاربر مربوطه صف شد.", messages.SUCCESS)
        return redirect(reverse_lazy("admin:events_registration_changelist"))


from events.tasks import send_invite_to_user



@admin.register(EventEmailLog)
class EventEmailLogAdmin(BaseModelAdmin, ImportExportModelAdmin):
    list_display = (
        "id",
        "event",
        "user",
        "user_email",
        "kind",
        "status",
        "sent_at",
        "created_at",
    )
    list_filter = (
        "kind",
        "status",
        "event",
        ("sent_at", admin.EmptyFieldListFilter),
        ("error", admin.EmptyFieldListFilter),
        SoftDeleteListFilter,
    )
    search_fields = (
        "user__email",
        "user__username",
        "user__first_name",
        "user__last_name",
        "event__title",
    )
    autocomplete_fields = ("event", "user")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    list_per_page = 50
    list_select_related = ("event", "user")

    # چون این مدل برای ایدمپوتنسی حیاتی است، ویرایش دستی را محدود می‌کنیم
    readonly_fields = (
        "event",
        "user",
        "kind",
        "status",
        "error",
        "sent_at",
        "created_at",
        "updated_at",
    )
    fields = readonly_fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return True

    actions = BaseModelAdmin.actions + [
        'resend_selected_emails'
    ]

    @admin.display(description="Email", ordering="user__email")
    def user_email(self, obj):
        return obj.user.email or "—"

    @admin.action(description="ارسال مجدد ایمیل برای رکوردهای انتخاب‌شده")
    def resend_selected_emails(self, request, queryset):
        """
        رکوردهای SENT را اسکیپ می‌کند، بقیه را به وضعیت pending برمی‌گرداند
        و تسک ارسال تکی را در صف می‌گذارد (ایدِمپوتنت).
        """
        queued = 0
        skipped = 0

        for log in queryset.select_related("event", "user"):
            if log.status == EventEmailLog.STATUS_SENT:
                skipped += 1
                continue

            # برگرداندن به pending و پاک کردن خطا
            if log.status != EventEmailLog.STATUS_PENDING or log.error:
                log.status = EventEmailLog.STATUS_PENDING
                log.error = ""
                log.save(update_fields=["status", "error", "updated_at"])

            # صف کردن تسک اتمی
            send_invite_to_user.delay(log.event_id, log.user_id)
            queued += 1

        if queued:
            self.message_user(
                request,
                "%(n)d مورد در صف ارسال قرار گرفت." % {"n": queued},
                level=messages.SUCCESS,
            )
        if skipped:
            self.message_user(
                request,
                "%(n)d مورد قبلاً ارسال شده بود و نادیده گرفته شد." % {"n": skipped},
                level=messages.WARNING,
            )
