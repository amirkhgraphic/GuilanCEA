from django.db import models
from django.db.models import Q, Count
from django.core.exceptions import ValidationError
from django.conf import settings
from django.utils import timezone

from utils.models import BaseModel
from events.models import Event

from ninja.errors import HttpError

User = settings.AUTH_USER_MODEL


class DiscountCode(BaseModel):
    class Type(models.TextChoices):
        PERCENT = "percent", "Percent"
        FIXED   = "fixed",   "Fixed (IRR)"

    code = models.CharField(max_length=64, unique=True)
    type = models.CharField(max_length=10, choices=Type.choices, default=Type.PERCENT)
    value = models.PositiveIntegerField()
    max_discount = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at   = models.DateTimeField(null=True, blank=True)
    usage_limit_total = models.PositiveIntegerField(null=True, blank=True)
    usage_limit_per_user = models.PositiveIntegerField(null=True, blank=True)
    min_amount = models.PositiveIntegerField(null=True, blank=True)
    applicable_events = models.ManyToManyField(Event, blank=True, related_name="discount_codes")

    def __str__(self):
        return f"{self.code} ({self.get_type_display()} {self.value})"
    
    def calculate_discount(self, event: Event, user: User):
        if not event.price:
            return (0, 0)
         
        if not self.is_active:
            raise HttpError(400, "کد تخفیف نامعتبر یا غیرفعال است.")

        n = timezone.now()
        if self.starts_at and n < self.starts_at:
            raise HttpError(400, "کد تخفیف هنوز فعال نشده است.")
        if self.ends_at and n > self.ends_at:
            raise HttpError(400, "کد تخفیف منقضی شده است.")

        if self.applicable_events.exists() and not self.applicable_events.filter(pk=event.pk).exists():
            raise HttpError(400, "کد تخفیف برای این رویداد قابل استفاده نیست.")

        if self.min_amount and event.price < self.min_amount:
            raise HttpError(400, "مبلغ سفارش کمتر از حداقل لازم برای این کد است.")

        used_qs = Payment.objects.filter(discount_code=self, status__in=[Payment.OrderStatusChoices.PAID, Payment.OrderStatusChoices.PENDING])
        if self.usage_limit_total is not None and used_qs.count() >= self.usage_limit_total:
            raise HttpError(400, "حداکثر تعداد استفاده از این کد تخفیف تکمیل شده است.")

        used_by_user = used_qs.filter(user=user).count()
        if self.usage_limit_per_user is not None and used_by_user >= self.usage_limit_per_user:
            raise HttpError(400, "شما حداکثر تعداد مجاز استفاده از این کد تخفیف را مصرف کرده‌اید.")

        if self.type == DiscountCode.Type.FIXED:
            disc = min(self.value, event.price)
        else:
            disc = (event.price * self.value) // 100
            if self.max_discount:
                disc = min(disc, self.max_discount)

        final_amount = max(event.price - disc, 0)
        if 0 < final_amount < 10_000:
            raise HttpError(400, "با این تخفیف مبلغ قابل پرداخت به کمتر از ۱۰٬۰۰۰ ریال می‌رسد.")

        return (final_amount, disc)


class Payment(BaseModel):
    class OrderStatusChoices(models.IntegerChoices):
        INIT = 0, "Initiated"
        PENDING = 1, "Pending"
        PAID = 2, "Paid"
        FAILED = 3, "Failed"
        CANCELED = 4, "Canceled"

    user  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payments', editable=False)
    event = models.ForeignKey(Event, on_delete=models.PROTECT, related_name='payments', editable=False)

    base_amount = models.PositiveIntegerField(editable=False)
    discount_code = models.ForeignKey(DiscountCode, on_delete=models.PROTECT, null=True, blank=True, editable=False, related_name="payments")
    discount_amount = models.PositiveIntegerField(default=0, editable=False)
    amount = models.PositiveIntegerField(editable=False)

    registration = models.ForeignKey(
        "events.Registration",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="payments",
        editable=False,
    )
    authority = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    status = models.IntegerField(choices=OrderStatusChoices.choices, default=OrderStatusChoices.INIT, editable=False)
    ref_id = models.CharField(max_length=64, null=True, blank=True, editable=False)
    card_pan = models.CharField(max_length=32, null=True, blank=True, editable=False)
    card_hash = models.CharField(max_length=128, null=True, blank=True, editable=False)
    verified_at = models.DateTimeField(null=True, blank=True, editable=False)

    def clean(self):
        if self.discount_amount and self.amount + self.discount_amount != self.base_amount:
            raise ValidationError({"amount": "amount + discount_amount must equal base_amount"})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def status_label(self):
        """Human-readable label for the payment status."""
        return self.get_status_display()

    def __str__(self):
        return f"{self.user.email}:{self.event} - {self.get_status_display()}"

