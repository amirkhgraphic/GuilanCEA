from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

import logging

from communications.models import NewsletterSubscription

logger = logging.getLogger(__name__)


def send_announcement_email(announcement, recipients):
    """Send announcement email to recipients"""
    try:
        template_name = f'emails/announcement_email.html'

        context = {
            'announcement': announcement,
            'unsubscribe_url': f"{settings.FRONTEND_ROOT}newsletter/unsubscribe/",
            'manage_subscription_url': f"{settings.FRONTEND_ROOT}newsletter/manage-subscription",
        }

        html_message = render_to_string(template_name, context)
        plain_message = strip_tags(html_message)

        subject = f"انجمن علمی کامپیوتر گیلان | {announcement.title}"

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Announcement email sent to {len(recipients)} recipients")
        return True
            
    except Exception as e:
        logger.error(f"Failed to send announcement email: {str(e)}")
        return False


def send_newsletter_confirmation(subscription):
    """Send newsletter confirmation email"""
    try:
        template_name = f'emails/newsletter_confirmation.html'

        confirmation_url = f"{settings.FRONTEND_ROOT}confirm-subscription/{subscription.confirmation_token}"

        context = {
            'subscription': subscription,
            'confirmation_url': confirmation_url,
        }

        html_message = render_to_string(template_name, context)
        plain_message = strip_tags(html_message)

        subject = "تأیید اشتراک خبرنامه"
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[subscription.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Newsletter confirmation sent to {subscription.email}")
        return True
            
    except Exception as e:
        logger.error(f"Failed to send newsletter confirmation: {str(e)}")
        return False


def send_event_reminder(event, user):
    """Send event reminder email"""
    try:
        template_name = f'emails/event_reminder.html'

        event_url = f"{settings.FRONTEND_ROOT}events/{event.slug}"

        context = {
            'event': event,
            'user': user,
            'event_url': event_url,
        }

        html_message = render_to_string(template_name, context)
        plain_message = strip_tags(html_message)

        subject = f"یادآوری رویداد: {event.title}"

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Event reminder sent to {user.email} for event {event.title}")
        return True
            
    except Exception as e:
        logger.error(f"Failed to send event reminder: {str(e)}")
        return False


def get_announcement_recipients(announcement):
    """Get list of email addresses based on announcement target audience"""
    
    User = get_user_model()
    recipients = []
    
    if announcement.target_audience == 'all':
        # All users with email
        recipients = list(User.objects.filter(email__isnull=False).values_list('email', flat=True))
        
    elif announcement.target_audience == 'members':
        # Only members (users with is_member=True)
        recipients = list(User.objects.filter(is_member=True, email__isnull=False).values_list('email', flat=True))
        
    elif announcement.target_audience == 'committee':
        # Only committee members
        recipients = list(User.objects.filter(is_committee=True, email__isnull=False).values_list('email', flat=True))
        
    elif announcement.target_audience == 'subscribers':
        # Only newsletter subscribers
        recipients = list(NewsletterSubscription.objects.filter(
            is_active=True, 
            confirmed_at__isnull=False
        ).values_list('email', flat=True))
    
    return recipients
