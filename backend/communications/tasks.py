from django.utils import timezone
from django.contrib.auth import get_user_model

import logging
from celery import shared_task
from datetime import timedelta

from events.models import Event, Registration
from communications.models import Announcement, NewsletterSubscription
from communications.utils import send_announcement_email, send_event_reminder, get_announcement_recipients
from communications.push_notifications import push_service

User = get_user_model()
logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def send_announcement_notifications(self, announcement_id):
    """Send email and push notifications for an announcement"""
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        
        # Send email notifications
        if announcement.send_email and not announcement.email_sent:
            recipients = get_announcement_recipients(announcement)
            if recipients:
                success = send_announcement_email(announcement, recipients)
                if success:
                    announcement.email_sent = True
                    announcement.save()
                    logger.info(f"Email notifications sent for announcement {announcement.id}")
        
        # Send push notifications
        if announcement.send_push and not announcement.push_sent:
            sent_count = push_service.send_announcement_notification(announcement)
            if sent_count > 0:
                announcement.push_sent = True
                announcement.save()
                logger.info(f"Push notifications sent to {sent_count} devices for announcement {announcement.id}")
        
        return f"Notifications sent for announcement: {announcement.title}"
        
    except Announcement.DoesNotExist:
        logger.error(f"Announcement {announcement_id} not found")
        return f"Announcement {announcement_id} not found"
    except Exception as exc:
        logger.error(f"Failed to send announcement notifications: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3)
def send_newsletter_confirmation_task(self, subscription_id):
    """Send newsletter confirmation email"""
    try:
        from .utils import send_newsletter_confirmation
        
        subscription = NewsletterSubscription.objects.get(id=subscription_id)
        success = send_newsletter_confirmation(subscription)
        
        if success:
            logger.info(f"Newsletter confirmation sent to {subscription.email}")
            return f"Newsletter confirmation sent to {subscription.email}"
        else:
            raise Exception("Failed to send newsletter confirmation")
            
    except NewsletterSubscription.DoesNotExist:
        logger.error(f"Newsletter subscription {subscription_id} not found")
        return f"Newsletter subscription {subscription_id} not found"
    except Exception as exc:
        logger.error(f"Failed to send newsletter confirmation: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task
def send_event_reminders():
    """Send reminders for events starting in 24 hours"""
    try:
        # Get events starting in 24 hours
        tomorrow = timezone.now() + timedelta(hours=24)
        start_range = tomorrow - timedelta(minutes=30)  # 30-minute window
        end_range = tomorrow + timedelta(minutes=30)
        
        events = Event.objects.filter(
            start_time__range=(start_range, end_range),
            status='published',
            is_deleted=False
        )
        
        total_sent = 0
        
        for event in events:
            # Get confirmed registrations
            registrations = Registration.objects.filter(
                event=event,
                status='confirmed',
                is_deleted=False
            ).select_related('user')
            
            for registration in registrations:
                try:
                    # Send email reminder
                    send_event_reminder(event, registration.user)
                    
                    # Send push notification reminder
                    push_service.send_event_reminder_notification(event, registration.user)
                    
                    total_sent += 1
                    
                except Exception as e:
                    logger.error(f"Failed to send reminder to {registration.user.email}: {str(e)}")
        
        logger.info(f"Event reminders sent to {total_sent} users")
        return f"Event reminders sent to {total_sent} users"
        
    except Exception as exc:
        logger.error(f"Failed to send event reminders: {exc}")
        raise exc


@shared_task
def send_weekly_newsletter():
    """Send weekly newsletter with recent announcements and upcoming events"""
    try:
        # Get active newsletter subscribers
        subscribers = NewsletterSubscription.objects.filter(
            is_active=True,
            confirmed_at__isnull=False,
            is_deleted=False
        )
        
        if not subscribers.exists():
            logger.info("No active newsletter subscribers found")
            return "No active newsletter subscribers found"
        
        # Get recent announcements (last 7 days)
        week_ago = timezone.now() - timedelta(days=7)
        recent_announcements = Announcement.objects.filter(
            is_published=True,
            publish_date__gte=week_ago,
            announcement_type__in=['general', 'academic', 'newsletter'],
            is_deleted=False
        ).order_by('-publish_date')[:5]
        
        # Get upcoming events (next 14 days)
        two_weeks_ahead = timezone.now() + timedelta(days=14)
        upcoming_events = Event.objects.filter(
            start_time__range=(timezone.now(), two_weeks_ahead),
            status='published',
            is_deleted=False
        ).order_by('start_time')[:5]
        
        # Create newsletter announcement
        newsletter_content = f"""
# Weekly Newsletter - {timezone.now().strftime('%B %d, %Y')}

## Recent Announcements
"""
        
        for announcement in recent_announcements:
            newsletter_content += f"- **{announcement.title}** ({announcement.publish_date.strftime('%B %d')})\n"
        
        newsletter_content += "\n## Upcoming Events\n"
        
        for event in upcoming_events:
            newsletter_content += f"- **{event.title}** - {event.start_time.strftime('%B %d, %Y at %I:%M %p')}\n"
        
        if not recent_announcements.exists() and not upcoming_events.exists():
            newsletter_content += "\nNo recent announcements or upcoming events this week."
        
        # Create newsletter announcement
        newsletter = Announcement.objects.create(
            title=f"Weekly Newsletter - {timezone.now().strftime('%B %d, %Y')}",
            content=newsletter_content,
            announcement_type='newsletter',
            priority='normal',
            author_id=1,  # System user
            is_published=True,
            publish_date=timezone.now(),
            send_email=True,
            target_audience='subscribers'
        )
        
        # Send to subscribers
        subscriber_emails = list(subscribers.values_list('email', flat=True))
        success = send_announcement_email(newsletter, subscriber_emails)
        
        if success:
            newsletter.email_sent = True
            newsletter.save()
            logger.info(f"Weekly newsletter sent to {len(subscriber_emails)} subscribers")
            return f"Weekly newsletter sent to {len(subscriber_emails)} subscribers"
        else:
            raise Exception("Failed to send weekly newsletter")
            
    except Exception as exc:
        logger.error(f"Failed to send weekly newsletter: {exc}")
        raise exc


@shared_task
def cleanup_expired_tokens():
    """Clean up expired newsletter confirmation tokens"""
    try:
        # Remove unconfirmed subscriptions older than 7 days
        week_ago = timezone.now() - timedelta(days=7)
        expired_subscriptions = NewsletterSubscription.objects.filter(
            confirmed_at__isnull=True,
            created_at__lt=week_ago
        )
        
        count = expired_subscriptions.count()
        expired_subscriptions.delete()
        
        logger.info(f"Cleaned up {count} expired newsletter subscriptions")
        return f"Cleaned up {count} expired newsletter subscriptions"
        
    except Exception as exc:
        logger.error(f"Failed to cleanup expired tokens: {exc}")
        raise exc


@shared_task
def send_bulk_announcement(announcement_id, recipient_emails):
    """Send announcement to a specific list of recipients"""
    try:
        announcement = Announcement.objects.get(id=announcement_id)
        
        # Split recipients into batches to avoid overwhelming the email server
        batch_size = 50
        total_sent = 0
        
        for i in range(0, len(recipient_emails), batch_size):
            batch = recipient_emails[i:i + batch_size]
            success = send_announcement_email(announcement, batch)
            
            if success:
                total_sent += len(batch)
                logger.info(f"Sent announcement to batch of {len(batch)} recipients")
            
            # Small delay between batches
            import time
            time.sleep(1)
        
        logger.info(f"Bulk announcement sent to {total_sent} recipients")
        return f"Bulk announcement sent to {total_sent} recipients"
        
    except Exception as exc:
        logger.error(f"Failed to send bulk announcement: {exc}")
        raise exc


@shared_task
def process_scheduled_announcements():
    """Process announcements scheduled for publication"""
    try:
        now = timezone.now()
        
        # Get announcements scheduled for publication
        scheduled_announcements = Announcement.objects.filter(
            is_published=True,
            publish_date__lte=now,
            email_sent=False,
            send_email=True,
            is_deleted=False
        )
        
        processed_count = 0
        
        for announcement in scheduled_announcements:
            # Send notifications
            send_announcement_notifications.delay(announcement.id)
            processed_count += 1
        
        logger.info(f"Processed {processed_count} scheduled announcements")
        return f"Processed {processed_count} scheduled announcements"
        
    except Exception as exc:
        logger.error(f"Failed to process scheduled announcements: {exc}")
        raise exc
