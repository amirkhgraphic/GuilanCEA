from django.db import models
from django.contrib.auth import get_user_model

from utils.models import BaseModel

User = get_user_model()


class AnnouncementType(models.TextChoices):
    GENERAL = 'general', 'General'
    EVENT = 'event', 'Event'
    ACADEMIC = 'academic', 'Academic'
    URGENT = 'urgent', 'Urgent'
    NEWSLETTER = 'newsletter', 'Newsletter'


class AnnouncementPriority(models.TextChoices):
    LOW = 'low', 'Low'
    NORMAL = 'normal', 'Normal'
    HIGH = 'high', 'High'
    URGENT = 'urgent', 'Urgent'


class Announcement(BaseModel):
    title = models.CharField(max_length=200, verbose_name='Title')
    content = models.TextField(verbose_name='Content')
    announcement_type = models.CharField(
        max_length=20,
        choices=AnnouncementType.choices,
        default=AnnouncementType.GENERAL,
        verbose_name='Type'
    )
    priority = models.CharField(
        max_length=10,
        choices=AnnouncementPriority.choices,
        default=AnnouncementPriority.NORMAL,
        verbose_name='Priority'
    )
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='announcements',
        verbose_name='Author'
    )
    is_published = models.BooleanField(default=False, verbose_name='Published')
    publish_date = models.DateTimeField(null=True, blank=True, verbose_name='Publish Date')
    send_email = models.BooleanField(default=False, verbose_name='Send Email Notification')
    send_push = models.BooleanField(default=False, verbose_name='Send Push Notification')
    email_sent = models.BooleanField(default=False, verbose_name='Email Sent')
    push_sent = models.BooleanField(default=False, verbose_name='Push Sent')
    target_audience = models.CharField(
        max_length=20,
        choices=[
            ('all', 'All Users'),
            ('members', 'Members Only'),
            ('committee', 'Committee Only'),
            ('subscribers', 'Newsletter Subscribers Only'),
        ],
        default='all',
        verbose_name='Target Audience'
    )

    class Meta:
        verbose_name = 'Announcement'
        verbose_name_plural = 'Announcements'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def content_html(self):
        """Convert markdown content to HTML"""
        import markdown
        return markdown.markdown(self.content)


class NewsletterSubscription(BaseModel):
    email = models.EmailField(unique=True, verbose_name='Email')
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='newsletter_subscription',
        verbose_name='User'
    )
    is_active = models.BooleanField(default=True, verbose_name='Active')
    subscribed_categories = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Subscribed Categories',
        help_text='List of announcement types to receive'
    )
    confirmation_token = models.CharField(max_length=100, blank=True, verbose_name='Confirmation Token')
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name='Confirmed At')
    unsubscribe_token = models.CharField(max_length=100, blank=True, verbose_name='Unsubscribe Token')

    class Meta:
        verbose_name = 'Newsletter Subscription'
        verbose_name_plural = 'Newsletter Subscriptions'
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.confirmation_token:
            import uuid
            self.confirmation_token = str(uuid.uuid4())
        if not self.unsubscribe_token:
            import uuid
            self.unsubscribe_token = str(uuid.uuid4())
        super().save(*args, **kwargs)


class PushNotificationDevice(BaseModel):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='push_devices',
        verbose_name='User'
    )
    device_token = models.TextField(verbose_name='Device Token')
    device_type = models.CharField(
        max_length=10,
        choices=[
            ('web', 'Web'),
            ('android', 'Android'),
            ('ios', 'iOS'),
        ],
        verbose_name='Device Type'
    )
    is_active = models.BooleanField(default=True, verbose_name='Active')

    class Meta:
        verbose_name = 'Push Notification Device'
        verbose_name_plural = 'Push Notification Devices'
        unique_together = ['user', 'device_token']

    def __str__(self):
        return f"{self.user.username} - {self.device_type}"
