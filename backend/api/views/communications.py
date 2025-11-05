from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q, Count
from ninja import Router
from ninja.pagination import paginate
from typing import List
import logging

from communications.models import (
    Announcement, NewsletterSubscription, PushNotificationDevice,
    AnnouncementType, AnnouncementPriority
)
from communications.utils import (
    send_announcement_email, send_newsletter_confirmation,
    get_announcement_recipients
)
from communications.push_notifications import push_service
from api.schemas import (
    AnnouncementSchema, AnnouncementListSchema, AnnouncementCreateSchema, AnnouncementUpdateSchema,
    NewsletterSubscriptionSchema, NewsletterSubscribeSchema, NewsletterUnsubscribeSchema,
    PushDeviceSchema, PushDeviceCreateSchema, PushDeviceUpdateSchema,
    PushNotificationSchema, MessageResponseSchema,
    AnnouncementStatsSchema, NewsletterStatsSchema
)
from api.authentication import jwt_auth

User = get_user_model()
logger = logging.getLogger(__name__)

communications_router = Router()

# Announcement endpoints
@communications_router.get("/announcements/", response=List[AnnouncementListSchema])
@paginate
def list_announcements(request, published_only: bool = True):
    """List announcements"""
    queryset = Announcement.objects.select_related('author').filter(is_deleted=False)
    
    if published_only:
        queryset = queryset.filter(is_published=True, publish_date__lte=timezone.now())
    
    return queryset.order_by('-created_at')

@communications_router.get("/announcements/{announcement_id}/", response=AnnouncementSchema)
def get_announcement(request, announcement_id: int):
    """Get single announcement"""
    announcement = get_object_or_404(
        Announcement.objects.select_related('author').filter(is_deleted=False),
        id=announcement_id
    )
    
    # Check if published or user has permission
    if not announcement.is_published:
        # Only allow access to unpublished announcements for staff/committee
        if not hasattr(request, 'auth') or not request.auth:
            return {"error": "Announcement not found"}, 404
        
        user = request.auth
        if not (user.is_staff or user.is_committee):
            return {"error": "Announcement not found"}, 404
    
    return announcement

@communications_router.post("/announcements/", response=AnnouncementSchema, auth=jwt_auth)
def create_announcement(request, payload: AnnouncementCreateSchema):
    """Create new announcement (committee/staff only)"""
    user = request.auth
    if not (user.is_staff or user.is_committee):
        return {"error": "Permission denied"}, 403
    
    announcement = Announcement.objects.create(
        author=user,
        **payload.dict()
    )
    
    # Send notifications if requested and published
    if announcement.is_published and announcement.publish_date <= timezone.now():
        if announcement.send_email:
            recipients = get_announcement_recipients(announcement)
            if recipients:
                send_announcement_email(announcement, recipients)
                announcement.email_sent = True
        
        if announcement.send_push:
            push_service.send_announcement_notification(announcement)
            announcement.push_sent = True
        
        announcement.save()
    
    return announcement

@communications_router.put("/announcements/{announcement_id}/", response=AnnouncementSchema, auth=jwt_auth)
def update_announcement(request, announcement_id: int, payload: AnnouncementUpdateSchema):
    """Update announcement (author/committee/staff only)"""
    user = request.auth
    announcement = get_object_or_404(Announcement, id=announcement_id, is_deleted=False)
    
    # Check permissions
    if not (user.is_staff or user.is_committee or announcement.author == user):
        return {"error": "Permission denied"}, 403
    
    # Update fields
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(announcement, field, value)
    
    announcement.save()
    
    # Send notifications if newly published
    if (announcement.is_published and announcement.publish_date <= timezone.now() and
        not announcement.email_sent and announcement.send_email):
        recipients = get_announcement_recipients(announcement)
        if recipients:
            send_announcement_email(announcement, recipients)
            announcement.email_sent = True
            announcement.save()
    
    if (announcement.is_published and announcement.publish_date <= timezone.now() and
        not announcement.push_sent and announcement.send_push):
        push_service.send_announcement_notification(announcement)
        announcement.push_sent = True
        announcement.save()
    
    return announcement

@communications_router.delete("/announcements/{announcement_id}/", response=MessageResponseSchema, auth=jwt_auth)
def delete_announcement(request, announcement_id: int):
    """Delete announcement (author/committee/staff only)"""
    user = request.auth
    announcement = get_object_or_404(Announcement, id=announcement_id, is_deleted=False)
    
    # Check permissions
    if not (user.is_staff or user.is_committee or announcement.author == user):
        return {"error": "Permission denied"}, 403
    
    announcement.soft_delete()
    return {"message": "Announcement deleted successfully"}

@communications_router.get("/announcements/stats/", response=AnnouncementStatsSchema, auth=jwt_auth)
def get_announcement_stats(request):
    """Get announcement statistics (committee/staff only)"""
    user = request.auth
    if not (user.is_staff or user.is_committee):
        return {"error": "Permission denied"}, 403
    
    stats = Announcement.objects.filter(is_deleted=False).aggregate(
        total_announcements=Count('id'),
        published_announcements=Count('id', filter=Q(is_published=True)),
        draft_announcements=Count('id', filter=Q(is_published=False)),
        urgent_announcements=Count('id', filter=Q(priority='urgent')),
        email_sent_count=Count('id', filter=Q(email_sent=True)),
        push_sent_count=Count('id', filter=Q(push_sent=True))
    )
    
    return stats

# Newsletter endpoints
@communications_router.post("/newsletter/subscribe/", response=MessageResponseSchema)
def subscribe_newsletter(request, payload: NewsletterSubscribeSchema):
    """Subscribe to newsletter"""
    try:
        subscription, created = NewsletterSubscription.objects.get_or_create(
            email=payload.email,
            defaults={
                'subscribed_categories': payload.subscribed_categories,
                'is_active': True
            }
        )
        
        if not created and not subscription.is_active:
            subscription.is_active = True
            subscription.subscribed_categories = payload.subscribed_categories
            subscription.save()
        
        # Send confirmation email
        send_newsletter_confirmation(subscription)
        
        message = (
            "عضویت در خبرنامه با موفقیت انجام شد! لطفاً برای تأیید، ایمیل خود را بررسی کنید."
            if created
            else "اشتراک خبرنامه به‌روزرسانی شد!"
        )
        return {"message": message}
        
    except Exception as e:
        logger.error(f"Newsletter subscription failed: {str(e)}")
        return {"message": "Subscription failed", "success": False}, 400

@communications_router.post("/newsletter/unsubscribe/", response=MessageResponseSchema)
def unsubscribe_newsletter(request, payload: NewsletterUnsubscribeSchema):
    """Unsubscribe from newsletter"""
    try:
        subscription = NewsletterSubscription.objects.get(email=payload.email)
        subscription.is_active = False
        subscription.save()
        return {"message": "Successfully unsubscribed from newsletter"}
    except NewsletterSubscription.DoesNotExist:
        return {"message": "Email not found in subscription list"}, 404

@communications_router.get("/newsletter/confirm/{token}/", response=MessageResponseSchema)
def confirm_newsletter_subscription(request, token: str):
    """Confirm newsletter subscription"""
    try:
        subscription = NewsletterSubscription.objects.get(confirmation_token=token)
        subscription.confirmed_at = timezone.now()
        subscription.is_active = True
        subscription.save()
        return {"message": "Newsletter subscription confirmed successfully!"}
    except NewsletterSubscription.DoesNotExist:
        return {"message": "Invalid confirmation token"}, 400

@communications_router.get("/newsletter/unsubscribe/{token}/", response=MessageResponseSchema)
def unsubscribe_newsletter_token(request, token: str):
    """Unsubscribe using token from email"""
    try:
        subscription = NewsletterSubscription.objects.get(unsubscribe_token=token)
        subscription.is_active = False
        subscription.save()
        return {"message": "Successfully unsubscribed from newsletter"}
    except NewsletterSubscription.DoesNotExist:
        return {"message": "Invalid unsubscribe token"}, 400

@communications_router.get("/newsletter/subscriptions/", response=List[NewsletterSubscriptionSchema], auth=jwt_auth)
@paginate
def list_newsletter_subscriptions(request):
    """List newsletter subscriptions (committee/staff only)"""
    user = request.auth
    if not (user.is_staff or user.is_committee):
        return {"error": "Permission denied"}, 403
    
    return NewsletterSubscription.objects.select_related('user').filter(is_deleted=False).order_by('-created_at')

@communications_router.get("/newsletter/stats/", response=NewsletterStatsSchema, auth=jwt_auth)
def get_newsletter_stats(request):
    """Get newsletter statistics (committee/staff only)"""
    user = request.auth
    if not (user.is_staff or user.is_committee):
        return {"error": "Permission denied"}, 403
    
    stats = NewsletterSubscription.objects.filter(is_deleted=False).aggregate(
        total_subscriptions=Count('id'),
        active_subscriptions=Count('id', filter=Q(is_active=True)),
        confirmed_subscriptions=Count('id', filter=Q(confirmed_at__isnull=False)),
        recent_subscriptions=Count('id', filter=Q(created_at__gte=timezone.now() - timezone.timedelta(days=30)))
    )
    
    return stats

# Push notification endpoints
@communications_router.post("/push-devices/", response=PushDeviceSchema, auth=jwt_auth)
def register_push_device(request, payload: PushDeviceCreateSchema):
    """Register push notification device"""
    user = request.auth
    
    device, created = PushNotificationDevice.objects.get_or_create(
        user=user,
        device_token=payload.device_token,
        defaults={'device_type': payload.device_type, 'is_active': True}
    )
    
    if not created:
        device.is_active = True
        device.device_type = payload.device_type
        device.save()
    
    return device

@communications_router.delete("/push-devices/", response=MessageResponseSchema, auth=jwt_auth)
def unregister_push_device(request, device_token: str):
    """Unregister push notification device"""
    user = request.auth
    
    try:
        device = PushNotificationDevice.objects.get(user=user, device_token=device_token)
        device.delete()
        return {"message": "Device unregistered successfully"}
    except PushNotificationDevice.DoesNotExist:
        return {"message": "Device not found"}, 404

@communications_router.get("/push-devices/", response=List[PushDeviceSchema], auth=jwt_auth)
def list_user_push_devices(request):
    """List user's push notification devices"""
    user = request.auth
    return PushNotificationDevice.objects.filter(user=user, is_deleted=False).order_by('-created_at')

@communications_router.put("/push-devices/{device_id}/", response=PushDeviceSchema, auth=jwt_auth)
def update_push_device(request, device_id: int, payload: PushDeviceUpdateSchema):
    """Update push notification device"""
    user = request.auth
    device = get_object_or_404(PushNotificationDevice, id=device_id, user=user, is_deleted=False)
    
    device.is_active = payload.is_active
    device.save()
    
    return device

@communications_router.post("/push-notifications/send/", response=MessageResponseSchema, auth=jwt_auth)
def send_push_notification(request, payload: PushNotificationSchema):
    """Send push notification (committee/staff only)"""
    user = request.auth
    if not (user.is_staff or user.is_committee):
        return {"error": "Permission denied"}, 403
    
    # Get target users
    users = []
    if payload.target_audience == 'all':
        users = User.objects.filter(is_active=True)
    elif payload.target_audience == 'members':
        users = User.objects.filter(is_member=True, is_active=True)
    elif payload.target_audience == 'committee':
        users = User.objects.filter(is_committee=True, is_active=True)
    
    # Send notifications
    total_sent = push_service.send_to_multiple_users(
        users, payload.title, payload.body, payload.data
    )
    
    return {"message": f"Push notification sent to {total_sent} devices"}

# Utility endpoints
@communications_router.get("/announcement-types/", response=List[dict])
def get_announcement_types(request):
    """Get available announcement types"""
    return [{"value": choice[0], "label": choice[1]} for choice in AnnouncementType.choices]

@communications_router.get("/announcement-priorities/", response=List[dict])
def get_announcement_priorities(request):
    """Get available announcement priorities"""
    return [{"value": choice[0], "label": choice[1]} for choice in AnnouncementPriority.choices]
