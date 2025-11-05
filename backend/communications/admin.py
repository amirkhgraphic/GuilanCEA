from django import forms
from django.contrib import admin
from django.utils import timezone

from simplemde.widgets import SimpleMDEEditor
from import_export.admin import ImportExportModelAdmin

from utils.admin import SoftDeleteListFilter, BaseModelAdmin
from communications.models import Announcement, NewsletterSubscription, PushNotificationDevice


class AnnouncementAdminForm(forms.ModelForm):
    content = forms.CharField(
        widget=SimpleMDEEditor(),
        help_text="Announcement content in Markdown format with live preview"
    )

    class Meta:
        model = Announcement
        fields = '__all__'


@admin.register(Announcement)
class AnnouncementAdmin(BaseModelAdmin, ImportExportModelAdmin):
    form = AnnouncementAdminForm
    list_display = [
        'title', 'announcement_type', 'priority', 'author', 
        'is_published', 'publish_date', 'email_sent', 'push_sent', 'created_at'
    ]
    list_filter = [
        'announcement_type', 'priority', 'is_published', 
        'send_email', 'send_push', 'target_audience',
        SoftDeleteListFilter, 'created_at'
    ]
    search_fields = ['title', 'content', 'author__username']
    readonly_fields = ['email_sent', 'push_sent', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Content', {
            'fields': ('title', 'content', 'author')
        }),
        ('Settings', {
            'fields': ('announcement_type', 'priority', 'target_audience', 'is_published', 'publish_date')
        }),
        ('Notifications', {
            'fields': ('send_email', 'send_push', 'email_sent', 'push_sent')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    actions = BaseModelAdmin.actions + ['publish_announcements', 'send_notifications']

    def publish_announcements(self, request, queryset):
        queryset.update(is_published=True, publish_date=timezone.now())
        self.message_user(request, f"{queryset.count()} announcements published.")
    publish_announcements.short_description = "Publish selected announcements"

    def send_notifications(self, request, queryset):
        # This will be implemented with Celery tasks
        for announcement in queryset:
            if announcement.send_email and not announcement.email_sent:
                # Trigger email task
                pass
            if announcement.send_push and not announcement.push_sent:
                # Trigger push notification task
                pass
        self.message_user(request, f"Notifications queued for {queryset.count()} announcements.")
    send_notifications.short_description = "Send notifications for selected announcements"


@admin.register(NewsletterSubscription)
class NewsletterSubscriptionAdmin(BaseModelAdmin, ImportExportModelAdmin):
    list_display = ['email', 'user', 'is_active', 'confirmed_at', 'created_at']
    list_filter = ['is_active', SoftDeleteListFilter, 'created_at', 'confirmed_at']
    search_fields = ['email', 'user__username', 'user__email']
    readonly_fields = ['confirmation_token', 'unsubscribe_token', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Subscription', {
            'fields': ('email', 'user', 'is_active', 'subscribed_categories')
        }),
        ('Confirmation', {
            'fields': ('confirmed_at', 'confirmation_token', 'unsubscribe_token')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    actions = BaseModelAdmin.actions + ['activate_subscriptions', 'deactivate_subscriptions']

    def activate_subscriptions(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f"{queryset.count()} subscriptions activated.")
    activate_subscriptions.short_description = "Activate selected subscriptions"

    def deactivate_subscriptions(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} subscriptions deactivated.")
    deactivate_subscriptions.short_description = "Deactivate selected subscriptions"


@admin.register(PushNotificationDevice)
class PushNotificationDeviceAdmin(BaseModelAdmin, ImportExportModelAdmin):
    list_display = ['user', 'device_type', 'is_active', 'created_at']
    list_filter = ['device_type', 'is_active', SoftDeleteListFilter, 'created_at']
    search_fields = ['user__username', 'user__email', 'device_token']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Device', {
            'fields': ('user', 'device_token', 'device_type', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
