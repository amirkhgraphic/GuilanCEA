import uuid

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.conf import settings

from users.models import User
from users.tasks import send_verification_email

@receiver(post_save, sender=User)
def send_verification_email_on_registration(sender, instance, created, **kwargs):
    if created:
        if not instance.username:
            instance.username = str(uuid.uuid4())[:10]
            instance.save(update_fields=['username'])

        if not instance.is_email_verified and instance.email:
            # Update the email verification sent timestamp
            instance.email_verification_sent_at = timezone.now()
            instance.save(update_fields=['email_verification_sent_at'])

            # Generate verification URL (you'll need to adjust this based on your frontend)
            verification_url = f"{settings.FRONTEND_ROOT}verify-email/{instance.email_verification_token}"

            # Send verification email asynchronously
            send_verification_email.delay(instance.id, verification_url)
