import json
from datetime import timedelta
from unittest import mock

from django.test import TestCase, override_settings
from django.utils import timezone

from api.authentication import create_jwt_token
from events.models import Event, Registration
from payments.models import Payment, DiscountCode
from users.models import User


@override_settings(
    ZARINPAL_MERCHANT_ID="MID",
    ZARINPAL_REQUEST_URL="https://zarinpal/request",
    ZARINPAL_STARTPAY="https://zarinpal/start/",
    ZARINPAL_VERIFY_URL="https://zarinpal/verify",
    ZARINPAL_CALLBACK_URL="https://frontend/callback",
)
class PaymentsAPIIntegrationTests(TestCase):
    password = "PaymentPass!123"

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="pay_user",
            email="pay.user@example.com",
            password=cls.password,
        )
        cls.user.is_email_verified = True
        cls.user.save(update_fields=["is_email_verified"])

    def setUp(self):
        super().setUp()
        self.event = Event.objects.create(
            title="Pay Event",
            description="Payment event",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=2),
            registration_start_date=timezone.now() - timedelta(days=1),
            registration_end_date=timezone.now() + timedelta(days=1),
            slug="pay-event",
            price=50000,
            capacity=10,
            status=Event.StatusChoices.PUBLISHED,
        )
        self.token = create_jwt_token(self.user)

    def _headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def _create_paid_event(self):
        return Event.objects.create(
            title="Paid Event",
            description="Paid",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            registration_start_date=timezone.now() - timedelta(days=1),
            registration_end_date=timezone.now() + timedelta(days=2),
            slug=f"paid-{timezone.now().timestamp()}",
            price=20000,
            capacity=5,
            status=Event.StatusChoices.PUBLISHED,
        )

    def _create_discount_code(self, event):
        code = DiscountCode.objects.create(
            code="DISC50",
            value=50,
            is_active=True,
        )
        code.applicable_events.add(event)
        return code

    def test_create_payment_for_free_event(self):
        free = Event.objects.create(
            title="Free",
            description="Zero",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            registration_start_date=timezone.now() - timedelta(days=1),
            registration_end_date=timezone.now() + timedelta(days=1),
            slug="free-event",
            price=0,
            capacity=10,
            status=Event.StatusChoices.PUBLISHED,
        )
        response = self.client.post(
            "/api/payments/create",
            data=json.dumps(
                {
                    "event_id": free.id,
                    "description": "Free registration",
                }
            ),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["amount"], 0)
        self.assertIsNone(data["start_pay_url"])

    @mock.patch("api.views.payments.requests.post")
    def test_create_payment_with_discount(self, mock_post):
        mock_response = mock.Mock()
        mock_response.json.return_value = {"data": {"code": 100, "authority": "AUTH"}}
        mock_post.return_value = mock_response

        code = self._create_discount_code(self.event)
        response = self.client.post(
            "/api/payments/create",
            data=json.dumps(
                {
                    "event_id": self.event.id,
                    "description": "Pay with discount",
                    "discount_code": code.code,
                }
            ),
            content_type="application/json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["discount_amount"], self.event.price // 2)
        self.assertEqual(payload["amount"], self.event.price // 2)
        self.assertIn("start_pay_url", payload)
        payment = Payment.objects.get(user=self.user, event=self.event)
        self.assertEqual(payment.discount_code, code)

    @mock.patch("api.views.payments.requests.post")
    def test_callback_success_marks_paid(self, mock_post):
        payment = Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            status=Payment.OrderStatusChoices.PENDING,
            authority="AUTH123",
        )
        mock_resp = mock.Mock()
        mock_resp.json.return_value = {"data": {"code": 100, "ref_id": "REF", "card_pan": "123", "card_hash": "ABC"}}
        mock_post.return_value = mock_resp

        response = self.client.get(
            "/api/payments/callback",
            {"Authority": "AUTH123", "Status": "OK"},
        )
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.OrderStatusChoices.PAID)
        self.assertTrue("status=success" in response.url)

    @mock.patch("api.views.payments.requests.post")
    def test_callback_failure_redirects_failed(self, mock_post):
        payment = Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            status=Payment.OrderStatusChoices.PENDING,
            authority="AUTH456",
        )
        mock_resp = mock.Mock()
        mock_resp.json.return_value = {"data": {"code": 101, "ref_id": "REF"}}
        mock_post.return_value = mock_resp

        response = self.client.get(
            "/api/payments/callback",
            {"Authority": "AUTH456", "Status": "OK"},
        )

        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.OrderStatusChoices.PAID)
        self.assertTrue("status=success" in response.url)

    def test_callback_missing_authority_returns_error(self):
        response = self.client.get("/api/payments/callback", {"Status": "OK"})
        self.assertEqual(response.status_code, 400)

    def test_callback_not_ok_cancels(self):
        payment = Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            status=Payment.OrderStatusChoices.PENDING,
            authority="AUTH789",
        )
        response = self.client.get(
            "/api/payments/callback",
            {"Authority": "AUTH789", "Status": "NOK"},
        )
        payment.refresh_from_db()
        self.assertEqual(payment.status, Payment.OrderStatusChoices.CANCELED)
        self.assertIn("status=failed", response.url)

    @mock.patch("api.views.payments.requests.post", side_effect=RuntimeError("down"))
    def test_create_payment_gateway_failure(self, mock_post):
        response = self.client.post(
            "/api/payments/create",
            data=json.dumps(
                {
                    "event_id": self.event.id,
                    "description": "Gateway fail",
                }
            ),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, 502)
        self.assertFalse(Payment.objects.filter(user=self.user).exists())

    def test_create_payment_when_already_paid(self):
        Payment.objects.create(
            user=self.user,
            event=self.event,
            base_amount=self.event.price,
            amount=self.event.price,
            status=Payment.OrderStatusChoices.PAID,
        )
        response = self.client.post(
            "/api/payments/create",
            data=json.dumps({"event_id": self.event.id, "description": "Duplicate"}),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, 400)

    @mock.patch("api.views.payments.requests.post")
    def test_registration_final_price_none_updates(self, mock_post):
        registration = Registration.objects.create(
            event=self.event,
            user=self.user,
            status=Registration.StatusChoices.PENDING,
            final_price=None,
        )
        mock_response = mock.Mock()
        mock_response.json.return_value = {"data": {"code": 100, "authority": "AUTH"}}
        mock_post.return_value = mock_response
        response = self.client.post(
            "/api/payments/create",
            data=json.dumps({"event_id": self.event.id, "description": "Update"}),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, 200)
        registration.refresh_from_db()
        if registration.final_price is None:
            self.fail("final_price should be populated")

    def test_coupon_check_success_and_errors(self):
        code = DiscountCode.objects.create(code="PAYCO", value=20, is_active=True, type=DiscountCode.Type.PERCENT)
        code.applicable_events.add(self.event)

        # missing code
        missing = self.client.post(
            "/api/payments/coupon/check",
            data=json.dumps({"event_id": self.event.id}),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(missing.status_code, 422)

        # invalid code
        invalid = self.client.post(
            "/api/payments/coupon/check",
            data=json.dumps({"event_id": self.event.id, "code": "INVALID"}),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(invalid.status_code, 404)

        success = self.client.post(
            "/api/payments/coupon/check",
            data=json.dumps({"event_id": self.event.id, "code": code.code}),
            content_type="application/json",
            **self._headers(),
        )
        self.assertEqual(success.status_code, 200)
        self.assertIn("final_price", success.json())
