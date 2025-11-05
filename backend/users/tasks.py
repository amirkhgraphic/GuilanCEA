from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags

from celery import shared_task
import logging

from users.models import User

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def send_verification_email(self, user_id, verification_url):
    try:
        user = User.objects.get(id=user_id)
        
        subject = 'تایید ایمیل | انجمن علمی مهندسی کامپیوتر'
        html_message = render_to_string('emails/verification_email.html', {
            'user': user,
            'verification_url': verification_url,
        })
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Verification email sent to {user.email}")
        return f"Verification email sent to {user.email}"
        
    except Exception as exc:
        logger.error(f"Failed to send verification email: {exc}")
        raise self.retry(exc=exc, countdown=60)

@shared_task(bind=True, max_retries=3)
def send_password_reset_email(self, user_id, reset_url):
    try:
        user = User.objects.get(id=user_id)
        
        subject = 'بازیابی رمز عبور | انجمن علمی مهندسی کامپیوتر'
        html_message = render_to_string('emails/password_reset_email.html', {
            'user': user,
            'reset_url': reset_url,
        })
        plain_message = strip_tags(html_message)
        
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"Password reset email sent to {user.email}")
        return f"Password reset email sent to {user.email}"
        
    except Exception as exc:
        logger.error(f"Failed to send password reset email: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, max_retries=3)
def send_email_verified_success(self, user_id: int):
    """
    ارسال ایمیل «ایمیل شما با موفقیت تأیید شد» پس از تغییر وضعیت تأیید.
    """
    try:
        user = User.objects.get(pk=user_id)

        subject = "تأیید ایمیل شما با موفقیت انجام شد"
        context = {
            "user": user,
            "home_url": getattr(settings, "FRONTEND_ROOT", "/"),
        }
        html_message = render_to_string("emails/verification_success.html", context)
        plain_message = strip_tags(html_message)

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"verified success email sent to {user.email}")
        return f"verified success email sent to {user.email}"

    except Exception as exc:
        logger.error(f"Failed to send verified success email: {exc}")
        raise self.retry(exc=exc, countdown=60)
