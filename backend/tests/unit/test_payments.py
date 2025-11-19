import uuid
from datetime import timedelta
from types import SimpleNamespace

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from django.contrib.admin import AdminSite
from payments.admin import DiscountCodeAdmin
from payments.models import DiscountCode, Payment
from payments.resources import DiscountResource, PaymentResource
from events.models import Event
from users.models import User
from ninja.errors import HttpError


class PaymentTestMixin:
    @staticmethod
    def _create_user(**overrides):
        data = {
            "username": f"user_{uuid.uuid4().hex[:6]}",
            "email": f"user_{uuid.uuid4().hex[:6]}@example.com",
            "password": "Test!1234",
        }
        data.update(overrides)
        return User.objects.create_user(**data)

    @staticmethod
    def _create_event(**overrides):
        now = timezone.now()
        defaults = {
            "title": "Sample",
            "description": "Desc",
            "start_time": now,
            "end_time": now + timedelta(hours=2),
            "registration_start_date": now - timedelta(days=1),
            "registration_end_date": now + timedelta(days=5),
            "slug": f"event-{uuid.uuid4().hex[:6]}",
            "price": 100000,
            "capacity": 10,
            "status": Event.StatusChoices.PUBLISHED,
        }
        defaults.update(overrides)
        return Event.objects.create(**defaults)

    @staticmethod
    def _discount_code(**overrides):
        defaults = {
            "code": f"CODE{uuid.uuid4().hex[:4]}",
            "value": 50,
            "is_active": True,
            "type": DiscountCode.Type.PERCENT,
        }
        defaults.update(overrides)
        return DiscountCode.objects.create(**defaults)


class DiscountCodeModelTests(TestCase, PaymentTestMixin):
    def setUp(self):
        self.event = self._create_event()
        self.user = self._create_user(is_email_verified=True)

    def test_zero_price_returns_zero_discount(self):
        event = self._create_event(price=0)
        code = self._discount_code()
        code.applicable_events.add(event)
        self.assertEqual(code.calculate_discount(event, self.user), (0, 0))

    def test_inactive_raises_error(self):
        code = self._discount_code(is_active=False)
        code.applicable_events.add(self.event)
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_start_date_validation(self):
        code = self._discount_code(starts_at=timezone.now() + timedelta(days=1))
        code.applicable_events.add(self.event)
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_end_date_validation(self):
        code = self._discount_code(ends_at=timezone.now() - timedelta(days=1))
        code.applicable_events.add(self.event)
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_applicable_events_enforcement(self):
        code = self._discount_code()
        other_event = self._create_event()
        code.applicable_events.add(other_event)
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_min_amount_guard(self):
        code = self._discount_code(min_amount=200000)
        code.applicable_events.add(self.event)
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_usage_limit_total(self):
        code = self._discount_code(usage_limit_total=1)
        code.applicable_events.add(self.event)
        Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            discount_amount=0,
            status=Payment.OrderStatusChoices.PAID,
            discount_code=code,
        )
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_usage_limit_per_user(self):
        code = self._discount_code(usage_limit_per_user=1)
        code.applicable_events.add(self.event)
        Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            discount_amount=0,
            status=Payment.OrderStatusChoices.PENDING,
            discount_code=code,
        )
        with self.assertRaises(HttpError):
            code.calculate_discount(self.event, self.user)

    def test_final_price_below_min_post_discount(self):
        event = self._create_event(price=15000)
        code = self._discount_code(value=80)
        code.applicable_events.add(event)
        with self.assertRaises(HttpError):
            code.calculate_discount(event, self.user)

    def test_fixed_discount_type(self):
        code = self._discount_code(type=DiscountCode.Type.FIXED, value=5000)
        code.applicable_events.add(self.event)
        final, disc = code.calculate_discount(self.event, self.user)
        self.assertEqual(disc, 5000)
        self.assertEqual(final, self.event.price - 5000)


class PaymentModelAndResourceTests(TestCase, PaymentTestMixin):
    def setUp(self):
        self.event = self._create_event()
        self.user = self._create_user(is_email_verified=True)

    def test_payment_clean_validates_amount(self):
        payment = Payment(
            user=self.user,
            event=self.event,
            base_amount=1000,
            amount=500,
            discount_amount=400,
            status=Payment.OrderStatusChoices.INIT,
        )
        with self.assertRaises(ValidationError):
            payment.full_clean()

    def test_payment_resource_defers_user_event(self):
        payment = Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=1000,
            amount=1000,
            discount_amount=0,
            status=Payment.OrderStatusChoices.INIT,
        )
        resource = PaymentResource()
        user_cell = resource.fields["user"].widget.clean(self.user.username, None)
        self.assertEqual(user_cell, self.user)
        event_cell = resource.fields["event"].widget.clean(self.event.title, None)
        self.assertEqual(event_cell, self.event)

    def test_discount_resource_expands_events(self):
        resource = DiscountResource()
        widget = resource.fields["event"].widget
        self.assertEqual(widget.separator, "||")


class DiscountCodeAdminTests(TestCase, PaymentTestMixin):
    def setUp(self):
        self.admin = DiscountCodeAdmin(DiscountCode, AdminSite())

    def test_deactivate_codes_action(self):
        code = self._discount_code()
        queryset = DiscountCode.objects.filter(pk=code.pk)
        request = SimpleNamespace(_messages=SimpleNamespace(add=lambda *args, **kwargs: None))
        self.admin.deactivate_codes(request, queryset)
        code.refresh_from_db()
        self.assertFalse(code.is_active)
