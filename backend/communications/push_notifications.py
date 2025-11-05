from django.conf import settings

import json
import logging
from typing import List, Dict, Any, Optional
from pywebpush import webpush, WebPushException

from communications.models import PushNotificationDevice
from events.models import Registration

logger = logging.getLogger(__name__)


class PushNotificationService:
    """Service for handling web push notifications"""

    def __init__(self):
        self.vapid_private_key = getattr(settings, 'VAPID_PRIVATE_KEY', None)
        self.vapid_public_key = getattr(settings, 'VAPID_PUBLIC_KEY', None)
        self.vapid_claims = getattr(settings, 'VAPID_CLAIMS', {})

    def send_notification(
            self,
            subscription_info: Dict[str, Any],
            data: Dict[str, Any],
            ttl: int = 86400
    ) -> bool:
        """
        Send a push notification to a single device

        Args:
            subscription_info: Device subscription information
            data: Notification payload
            ttl: Time to live in seconds (default 24 hours)

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(data),
                vapid_private_key=self.vapid_private_key,
                vapid_claims=self.vapid_claims,
                ttl=ttl
            )
            return True
        except WebPushException as e:
            logger.error(f"Push notification failed: {e}")
            if e.response and e.response.status_code in [410, 413]:
                # Subscription is no longer valid, should be removed
                self._remove_invalid_subscription(subscription_info)
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending push notification: {e}")
            return False

    def send_to_multiple(
            self,
            devices: List[PushNotificationDevice],
            data: Dict[str, Any],
            ttl: int = 86400
    ) -> Dict[str, int]:
        """
        Send push notification to multiple devices

        Args:
            devices: List of PushNotificationDevice objects
            data: Notification payload
            ttl: Time to live in seconds

        Returns:
            dict: Statistics of sent/failed notifications
        """
        stats = {'sent': 0, 'failed': 0}

        for device in devices:
            subscription_info = {
                'endpoint': device.endpoint,
                'keys': {
                    'p256dh': device.p256dh_key,
                    'auth': device.auth_key
                }
            }

            if self.send_notification(subscription_info, data, ttl):
                stats['sent'] += 1
            else:
                stats['failed'] += 1

        return stats

    def send_announcement_notification(
            self,
            announcement,
            devices: Optional[List[PushNotificationDevice]] = None
    ) -> Dict[str, int]:
        """
        Send push notification for an announcement

        Args:
            announcement: Announcement model instance
            devices: Optional list of specific devices to send to

        Returns:
            dict: Statistics of sent/failed notifications
        """
        if devices is None:
            # Get devices based on announcement audience
            if announcement.audience == 'all':
                devices = PushNotificationDevice.objects.filter(is_active=True)
            elif announcement.audience == 'members':
                devices = PushNotificationDevice.objects.filter(
                    user__is_member=True,
                    is_active=True
                )
            elif announcement.audience == 'committee':
                devices = PushNotificationDevice.objects.filter(
                    user__is_committee_member=True,
                    is_active=True
                )
            else:
                devices = PushNotificationDevice.objects.none()

        # Prepare notification data
        data = {
            'title': announcement.title,
            'body': announcement.content[:100] + '...' if len(announcement.content) > 100 else announcement.content,
            'icon': '/static/images/logo.png',
            'badge': '/static/images/badge.png',
            'data': {
                'type': 'announcement',
                'id': announcement.id,
                'url': f'/announcements/{announcement.id}/'
            }
        }

        return self.send_to_multiple(devices, data)

    def send_event_reminder_notification(
            self,
            event,
            devices: Optional[List[PushNotificationDevice]] = None
    ) -> Dict[str, int]:
        """
        Send push notification for event reminder

        Args:
            event: Event model instance
            devices: Optional list of specific devices to send to

        Returns:
            dict: Statistics of sent/failed notifications
        """
        if devices is None:
            # Get devices of registered users
            registered_users = Registration.objects.filter(
                event=event,
                status='confirmed'
            ).values_list('user_id', flat=True)

            devices = PushNotificationDevice.objects.filter(
                user_id__in=registered_users,
                is_active=True
            )

        # Prepare notification data
        data = {
            'title': f'Event Reminder: {event.title}',
            'body': f'Your event "{event.title}" starts in 24 hours!',
            'icon': '/static/images/logo.png',
            'badge': '/static/images/badge.png',
            'data': {
                'type': 'event_reminder',
                'id': event.id,
                'url': f'/events/{event.id}/'
            }
        }

        return self.send_to_multiple(devices, data)

    def _remove_invalid_subscription(self, subscription_info: Dict[str, Any]):
        """Remove invalid subscription from database"""
        try:
            PushNotificationDevice.objects.filter(
                endpoint=subscription_info['endpoint']
            ).delete()
            logger.info(f"Removed invalid subscription: {subscription_info['endpoint']}")
        except Exception as e:
            logger.error(f"Error removing invalid subscription: {e}")


# Create a singleton instance
push_service = PushNotificationService()
