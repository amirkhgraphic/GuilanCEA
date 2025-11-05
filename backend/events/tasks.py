from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils import timezone

from celery import shared_task, group
from celery.exceptions import SoftTimeLimitExceeded
import markdown
import logging

from users.models import User
from events.models import Event, Registration, EventEmailLog
from utils.templatetags.jalali import fa_digits, jdate


logger = logging.getLogger(__name__)
ANNOUNCEMENT_TASK_SOFT_LIMIT_SECONDS = 30
ANNOUNCEMENT_TASK_HARD_LIMIT_SECONDS = 45

@shared_task(bind=True, max_retries=3)
def send_registration_confirmation_email(self, registration_pk: str):
    """Send a registration confirmation email, loading the model lazily to avoid circular imports."""
    try:
        from .models import Registration
        reg = (
            Registration.objects
            .select_related("event", "user")
            .get(pk=registration_pk)
        )

        user_email = getattr(reg.user, "email", None)
        if not user_email:
            return

        success_md = reg.event.registration_success_markdown or ""
        success_html = markdown.markdown(
            success_md,
            extensions=["extra", "sane_lists", "toc"]
        ) if success_md else ""

        context = {
            "user": reg.user,
            "event": reg.event,
            "registration": reg,
            "success_html": success_html,
        }

        subject = f"تأیید ثبت‌نام شما در {reg.event.title}"
        html_body = render_to_string("emails/event_registration_confirmation.html", context)
        plain_body = strip_tags(html_body)

        message = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user_email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
        logger.info(f"Event Confirm Registration email sent to {reg.user.email}")

    except Exception as exc:
        logger.error(f"Failed to send event registration email: {exc}")
        raise self.retry(exc=exc, countdown=60)        


@shared_task(bind=True, max_retries=3)
def send_registration_cancellation_email(self, registration_pk: str):
    try:
        from .models import Registration
        reg = (
            Registration.objects
            .select_related("event", "user")
            .get(pk=registration_pk)
        )

        user_email = getattr(reg.user, "email", None)
        if not user_email:
            return

        context = {
            "user": reg.user,
            "event": reg.event,
            "registration": reg,
        }

        subject = f"لغو ثبت‌نام شما در {reg.event.title}"
        html_body = render_to_string("emails/event_registration_cancellation.html", context)
        plain_body = strip_tags(html_body)

        message = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user_email],
        )
        message.attach_alternative(html_body, "text/html")
        message.send(fail_silently=False)
        logger.info(f"Event Confirm Registration email sent to {reg.user.email}")

    except Exception as exc:
        logger.error(f"Failed to send event registration email: {exc}")
        raise self.retry(exc=exc, countdown=60)


def _event_recipients(event, statuses=None, only_verified=True):
    qs = Registration.objects.filter(event=event, is_deleted=False)
    if statuses:
        qs = qs.filter(status__in=statuses)
    if only_verified:
        qs = qs.filter(user__is_email_verified=True)

    qs = qs.exclude(user__email__isnull=True).exclude(user__email="")
    return qs.select_related("user")


def _send_html_email(subject, html_body, to_email):
    text_body = strip_tags(html_body)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=[to_email],
    )
    msg.attach_alternative(html_body, "text/html")
    msg.send()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3}, soft_time_limit=60)
def send_skyroom_credentials_individual_task(self, reg_id: int):
    """
    ارسال نام‌کاربری/رمز برای اسکای‌روم
    - username = user.email
    - password = registration.ticket_id[:8]
    - url = event.online_link (اگر لینک در فیلد online_link ذخیره شده باشد)
    """
    r = Registration.objects.get(pk=reg_id)
    event = r.event
    user = r.user
    sky_user = user.email.strip().split('@')[0]
    sky_pass = str(r.ticket_id)[:8]
    skyroom_url = event.online_link
    try:
        ctx = {
            "user": user,
            "event": event,
            "skyroom_url": skyroom_url,
            "sky_username": sky_user,
            "sky_password": sky_pass,
            "event_url": f"{settings.FRONTEND_ROOT}events/{event.slug}",
        }
        subject = f"اطلاعات دسترسی اسکای‌روم - {event.title}"
        html = render_to_string("emails/skyroom_credentials.html", ctx)
        text_body = strip_tags(html)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()
        logger.info(f'Skyroom Credentials for Event "{event.title}" sent to {user.email}')

    except Exception as exc:
        logger.error(f"Failed to send skyroom credentials email: {exc}")
        raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3}, soft_time_limit=60)
def send_event_reminder_task(self, event_id: int):
    """
    یادآوری رویداد (ارسال الان؛ برای ارسال خودکار یک روز قبل، یک beat job بسازید)
    """
    event = Event.objects.get(pk=event_id)
    regs = _event_recipients(event, statuses=["confirmed", "attended"])
    for r in regs:
        user = r.user
        ctx = {
            "user": user,
            "event": event,
            "event_url": f"{settings.FRONTEND_ROOT}events/{event.slug}",
        }
        try:
            subject = f"یادآوری رویداد: {event.title}"
            html = render_to_string("emails/event_reminder.html", ctx)
            text_body = strip_tags(html)
            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
                to=[user.email],
            )
            msg.attach_alternative(html, "text/html")
            msg.send()
            logger.info(f'Event reminder for "{event.title}" sent to {user.email}')

        except Exception as exc:
            logger.error(f"Failed to send event reminder email: {exc}")
            raise self.retry(exc=exc, countdown=60)


@shared_task(bind=True)
def queue_event_announcement(self, event_id: int, subject: str, body_html: str, statuses=None):
    """
    تسک مادر: ثبت‌نام‌های هدف را پیدا می‌کند و برای هر Registration یک تسک کوچک می‌سازد.
    """
    event = Event.objects.get(pk=event_id)

    # محدوده مخاطبان: اگر statuses داده نشد، همان پیش‌فرض قبلی شما
    statuses = statuses or ["confirmed", "attended", "pending"]

    regs = (
        _event_recipients(event, statuses=statuses)
        .select_related("user", "event")
        .exclude(user__email__isnull=True)
        .exclude(user__email="")
        .distinct()
    )

    reg_ids = list(regs.values_list("id", flat=True))

    # ساخت group از تسک‌های کوچک؛ هر کدام فقط یک ایمیل ارسال می‌کند
    job = group(
        send_event_announcement_to_user.s(event_id, rid, subject, body_html)
        for rid in reg_ids
    )

    # اگر نتیجه‌ها لازم نیست: CELERY_TASK_IGNORE_RESULT = True
    res = job.apply_async()
    logger.info(
        'Queued %s event-announcement emails for event "%s" (group_id=%s)',
        len(reg_ids), event.title, res.id
    )
    return {"event_id": event_id, "queued": len(reg_ids), "group_id": res.id}

@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=ANNOUNCEMENT_TASK_SOFT_LIMIT_SECONDS,
    time_limit=ANNOUNCEMENT_TASK_HARD_LIMIT_SECONDS,
)
def send_event_announcement_to_user(self, event_id: int, registration_id: int, subject: str, body_html: str):
    """
    تسک کوچک و اتمی: ارسال ایمیل اعلان رویداد برای یک Registration.
    با لاگ ایدمپوتنسی تا ارسال تکراری نداشته باشیم.
    """
    user = None
    log = None

    try:
        # از Registration می‌گیریم تا یک کوئری کمتر به Event بزنیم
        r = Registration.objects.select_related("user", "event").get(pk=registration_id)
        user = r.user
        event = r.event

        # ایدمپوتنسی: اگر قبلاً ارسال شده یا در صف/درحال ارسال است، Skip
        # توجه: مطمئن شوید این مقدار enum/ثابت را در EventEmailLog دارید
        kind = getattr(EventEmailLog, "KIND_EVENT_ANNOUNCEMENT3", "event_announcement3")

        log, created = EventEmailLog.objects.get_or_create(
            event_id=event_id,
            user_id=user.id,
            kind=kind,
            defaults={"status": EventEmailLog.STATUS_PENDING},
        )
        if not created and log.status in (
            EventEmailLog.STATUS_PENDING,
            EventEmailLog.STATUS_SENT,
        ):
            return {"skipped": True, "status": log.status}

        # کانتکست رندر ایمیل: body_html مستقیم داخل تمپلیت شما اینجکت می‌شود
        ctx = {
            "user": user,
            "event": event,
            "body_html": body_html,
            "event_url": f"{settings.FRONTEND_ROOT}events/{event.slug}",
        }

        html = render_to_string("emails/event_announcement.html", ctx)
        text_body = strip_tags(html)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()

        log.status = EventEmailLog.STATUS_SENT
        log.sent_at = timezone.now()
        log.error = ""
        # اگر فیلد updated_at دارید
        log.save(update_fields=["status", "sent_at", "error", "updated_at"] if hasattr(log, "updated_at") else ["status", "sent_at", "error"])

        logger.info('Event announcement for "%s" sent to %s', event.title, user.email)
        return f"Email sent to {user.email}"

    except SoftTimeLimitExceeded:
        if log:
            log.status = EventEmailLog.STATUS_FAILED
            log.error = "Soft time limit exceeded"
            if hasattr(log, "updated_at"):
                log.save(update_fields=["status", "error", "updated_at"])
            else:
                log.save(update_fields=["status", "error"])
        logger.warning("Soft time limit exceeded (event_id=%s, registration_id=%s)", event_id, registration_id)
        raise

    except Exception as exc:
        if log:
            log.status = EventEmailLog.STATUS_FAILED
            log.error = str(exc)
            if hasattr(log, "updated_at"):
                log.save(update_fields=["status", "error", "updated_at"])
            else:
                log.save(update_fields=["status", "error"])
        logger.error("Failed to send event announcement email: %s", exc, exc_info=True)
        raise


def _event_url(event):
    root = getattr(settings, "FRONTEND_ROOT", "/")
    slug_or_id = getattr(event, "slug", None) or event.id
    return f"{root}events/{slug_or_id}"

@shared_task(bind=True)
def queue_invites_to_non_registered_users(self, event_id: int, only_verified=True, only_active=True):
    """
    تسک مادر: فقط کاربرها را پیدا می‌کند و برای هر نفر یک تسک کوچک می‌سازد.
    """
    event = Event.objects.get(pk=event_id)

    qs = User.objects.all()
    if only_verified:
        qs = qs.filter(is_email_verified=True)
    if only_active:
        qs = qs.filter(is_active=True)

    # کسانی که برای این ایونت ثبت‌نام نکرده‌اند
    qs = qs.exclude(event_registrations__event_id=event_id) \
           .exclude(email__isnull=True).exclude(email="") \
           .distinct()

    # از ارسال‌های قبلی (موفق یا درحال انتظار) عبور کن
    qs = qs.exclude(
        email_logs__event_id=event_id,
        email_logs__kind=EventEmailLog.KIND_INVITE_NON_REGISTERED,
    )

    user_ids = list(qs.values_list("id", flat=True))

    # گَروهِ تسک‌های کوچک
    job = group(send_invite_to_user.s(event_id, uid) for uid in user_ids)
    res = job.apply_async()
    return {"event_id": event_id, "queued": len(user_ids), "group_id": res.id}

@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_jitter=True, retry_kwargs={"max_retries": 3}, time_limit=60)
def send_invite_to_user(self, event_id: int, user_id: int):
    """
    تسک کوچک و اتمی: برای هر کاربر حداکثر یک ایمیل می‌فرستد (با لاگ ایدمپوتنسی).
    """
    event = Event.objects.get(pk=event_id)
    user = User.objects.get(pk=user_id)

    # ایدمپوتنسی: اگر قبلاً این ایمیل رزرو/ارسال شده، Skip
    log, created = EventEmailLog.objects.get_or_create(
        event_id=event_id, user_id=user_id, kind=EventEmailLog.KIND_INVITE_NON_REGISTERED,
        defaults={"status": EventEmailLog.STATUS_PENDING}
    )
    if not created and log.status in (EventEmailLog.STATUS_PENDING, EventEmailLog.STATUS_SENT):
        return {"skipped": True, "status": log.status}

    # ساخت محتوا
    context = {
        "user": user,
        "event": event,
        "event_url": _event_url(event),
        "start_time": fa_digits(jdate(event.start_time))
    }
    subject = f"دعوت به شرکت در «{event.title}»"
    text_body = render_to_string("emails/event_invite_non_registered.txt", context)
    html_body = render_to_string("emails/event_invite_non_registered.html", context)

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send()

        log.status = EventEmailLog.STATUS_SENT
        log.sent_at = timezone.now()
        log.error = ""
        log.save(update_fields=["status", "sent_at", "error", "updated_at"])
        return f"Email sent to {user.email}"
    except Exception as exc:
        log.status = EventEmailLog.STATUS_FAILED
        log.error = str(exc)
        log.save(update_fields=["status", "error", "updated_at"])
        raise


@shared_task(bind=True)
def queue_skyroom_credentials(self, event_id: int):
    """
    تسک مادر: ثبت‌نام‌های تاییدشده را پیدا می‌کند و برای هر Registration یک تسک کوچک می‌سازد.
    """
    event = Event.objects.get(pk=event_id)

    # فقط CONFIRMED ها + ایمیل معتبر
    regs = (
        _event_recipients(event, statuses=[Registration.StatusChoices.CONFIRMED])
        .select_related("user", "event")
        .exclude(user__email__isnull=True)
        .exclude(user__email="")
        .distinct()
    )

    reg_ids = list(regs.values_list("id", flat=True))

    # ساخت group از تسک‌های کوچک؛ هر کدوم فقط یک ایمیل ارسال می‌کنند
    job = group(send_skyroom_credentials_to_user.s(event_id, rid) for rid in reg_ids)

    # توصیه: اگر نتیجه‌ها را لازم ندارید، در تنظیمات CELERY_TASK_IGNORE_RESULT=True بگذارید
    res = job.apply_async()
    logger.info(
        'Queued %s Skyroom-credential emails for event "%s" (group_id=%s)',
        len(reg_ids), event.title, res.id
    )
    return {"event_id": event_id, "queued": len(reg_ids), "group_id": res.id}


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
    soft_time_limit=ANNOUNCEMENT_TASK_SOFT_LIMIT_SECONDS,
    time_limit=ANNOUNCEMENT_TASK_HARD_LIMIT_SECONDS,
)
def send_skyroom_credentials_to_user(self, event_id: int, registration_id: int):
    """
    تسک کوچک و اتمی: ارسال نام‌کاربری/رمز اسکای‌روم برای یک Registration.
    با لاگ ایدمپوتنسی تا ارسال تکراری نداشته باشیم.
    """
    user = None
    log = None

    try:
        r = Registration.objects.select_related("user", "event").get(pk=registration_id)
        user = r.user
        event = r.event

        # ایدمپوتنسی: اگر قبلاً ارسال شده یا در صف/درحال ارسال است، Skip
        log, created = EventEmailLog.objects.get_or_create(
            event_id=event_id,
            user_id=user.id,
            kind=getattr(EventEmailLog, "KIND_SKYROOM_CREDENTIALS", "skyroom_credentials"),
            defaults={"status": EventEmailLog.STATUS_PENDING},
        )
        if not created and log.status in (
            EventEmailLog.STATUS_PENDING,
            EventEmailLog.STATUS_SENT,
        ):
            return {"skipped": True, "status": log.status}

        # ساخت یوزرنیم/پسورد
        sky_username = (user.email or "").strip().split("@")[0]
        sky_password = str(r.ticket_id or "")[:8]
        skyroom_url = event.online_link

        ctx = {
            "user": user,
            "event": event,
            "skyroom_url": skyroom_url,
            "sky_username": sky_username,
            "sky_password": sky_password,
            "event_url": f"{settings.FRONTEND_ROOT}events/{event.slug}",
        }

        subject = f"اطلاعات دسترسی اسکای‌روم - {event.title}"
        html = render_to_string("emails/skyroom_credentials.html", ctx)
        text_body = strip_tags(html)

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user.email],
        )
        msg.attach_alternative(html, "text/html")
        msg.send()

        log.status = EventEmailLog.STATUS_SENT
        log.sent_at = timezone.now()
        log.error = ""
        log.save(update_fields=["status", "sent_at", "error", "updated_at"])

        logger.info('Skyroom credentials for "%s" sent to %s', event.title, user.email)
        return f"Email sent to {user.email}"

    except SoftTimeLimitExceeded as exc:
        # ثبت خطا و اجازه به Celery برای retry خودکار
        if log:
            log.status = EventEmailLog.STATUS_FAILED
            log.error = "Soft time limit exceeded"
            log.save(update_fields=["status", "error", "updated_at"])
        logger.warning(
            "Soft time limit exceeded for event_id=%s, registration_id=%s", event_id, registration_id
        )
        raise

    except Exception as exc:
        if log:
            log.status = EventEmailLog.STATUS_FAILED
            log.error = str(exc)
            log.save(update_fields=["status", "error", "updated_at"])
        logger.error("Failed to send skyroom credentials email: %s", exc, exc_info=True)
        raise
