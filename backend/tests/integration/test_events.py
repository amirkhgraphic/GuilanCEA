import io
import json
import tempfile
import uuid
from datetime import timedelta
from types import SimpleNamespace

from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from api.authentication import create_jwt_token
from api.schemas.events import (
    EventSchema,
    EventGallerySchema,
    EventListSchema,
    RegistrationSchema,
    PaymentAdminSchema,
    EventAdminDetailSchema,
)
from api.views.events import list_events
from events.models import Event, Registration
from gallery.models import Gallery
from payments.models import DiscountCode
from users.models import Major, University, User

MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class EventsAPIIntegrationTests(TestCase):
    password = "TestPass123!"

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="event_user",
            email="event.user@example.com",
            password=cls.password,
        )
        cls.user.is_email_verified = True
        cls.user.save(update_fields=["is_email_verified"])

        cls.staff = User.objects.create_user(
            username="event_staff",
            email="event.staff@example.com",
            password=cls.password,
            is_staff=True,
        )
        cls.staff.is_email_verified = True
        cls.staff.save(update_fields=["is_email_verified"])
        cls.major, _ = Major.objects.get_or_create(code="CS", defaults={"name": "Computer Science"})
        cls.university, _ = University.objects.get_or_create(code="UT", defaults={"name": "University of Tehran"})
        cls.user.major = cls.major
        cls.user.university = cls.university
        cls.user.save(update_fields=["major", "university"])
        cls.staff.major = cls.major
        cls.staff.university = cls.university
        cls.staff.save(update_fields=["major", "university"])

    def setUp(self):
        super().setUp()
        self.token = create_jwt_token(self.user)
        self.staff_token = create_jwt_token(self.staff)

        self.event = self._create_event(
            title="Integration Event",
            description="Integration description.",
            status=Event.StatusChoices.PUBLISHED,
            price=0,
        )
        self.other_event = self._create_event(
            title="Other Published",
            description="Searchable",
            status=Event.StatusChoices.PUBLISHED,
            price=0,
        )

    def _auth_headers(self, token):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def _create_event(self, **overrides):
        now = timezone.now()
        defaults = {
            "title": "Event Title",
            "description": "Description",
            "start_time": now,
            "end_time": now + timedelta(hours=2),
            "registration_start_date": now - timedelta(days=1),
            "registration_end_date": now + timedelta(days=5),
            "slug": f"event-{uuid.uuid4().hex[:6]}",
            "location": "Campus",
            "online_link": "https://meet.example.com",
            "price": 0,
            "capacity": 10,
            "status": Event.StatusChoices.PUBLISHED,
        }
        defaults.update(overrides)
        return Event.objects.create(**defaults)

    def _create_gallery_image(self):
        buffer = io.BytesIO()
        Image.new("RGB", (10, 10), color="blue").save(buffer, format="PNG")
        buffer.seek(0)
        file = SimpleUploadedFile("gallery.png", buffer.read(), content_type="image/png")
        return Gallery.objects.create(
            title="Gallery image",
            description="desc",
            image=file,
            uploaded_by=self.user,
        )

    def _create_paid_event(self):
        return self._create_event(price=30000, capacity=5)

    def _create_registration(self, event, user, status=Registration.StatusChoices.PENDING):
        return Registration.objects.create(event=event, user=user, status=status, final_price=event.price)

    # Basic event endpoints ------------------------------------------------

    def test_list_events_filters_and_search(self):
        # Act
        response = self.client.get("/api/events/", {"status": "published", "search": "Searchable"})
        data = response.json()

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(item["id"] == self.other_event.id for item in data))

    def test_get_event_by_id_and_slug(self):
        response_id = self.client.get(f"/api/events/{self.event.id}")
        response_slug = self.client.get(f"/api/events/slug/{self.event.slug}")

        self.assertEqual(response_id.status_code, 200)
        self.assertEqual(response_slug.status_code, 200)
        self.assertEqual(response_id.json()["id"], self.event.id)
        self.assertEqual(response_slug.json()["slug"], self.event.slug)

    def test_create_update_and_delete_event(self):
        payload = {
            "title": "New Event",
            "description": "Desc",
            "start_time": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_time": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "event_type": Event.TypeChoices.ON_SITE,
            "status": Event.StatusChoices.DRAFT,
            "price": 5000,
        }
        created = self.client.post(
            "/api/events/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(created.status_code, 200)
        event_id = created.json()["id"]

        updated = self.client.put(
            f"/api/events/{event_id}",
            data=json.dumps({"title": "Updated Event"}),
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["title"], "Updated Event")

        deleted = self.client.delete(f"/api/events/{event_id}")
        self.assertEqual(deleted.status_code, 200)

    def test_admin_detail_and_registration_list_requires_staff(self):
        staff_headers = self._auth_headers(self.staff_token)
        user_headers = self._auth_headers(self.token)

        _ = self._create_registration(self.event, self.user, status=Registration.StatusChoices.CONFIRMED)

        # Non staff forbidden
        list_resp = self.client.get(f"/api/events/{self.event.id}/admin-registrations", **user_headers)
        self.assertEqual(list_resp.status_code, 403)

        # Staff allowed
        list_resp = self.client.get(f"/api/events/{self.event.id}/admin-registrations", **staff_headers)
        detail_resp = self.client.get(f"/api/events/{self.event.id}/admin-detail", **staff_headers)
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(detail_resp.status_code, 200)

    def test_list_events_filters_by_event_type_and_search(self):
        event = self._create_event(
            title="Special Search",
            description="Unique discovery",
            event_type=Event.TypeChoices.ONLINE,
            status=Event.StatusChoices.PUBLISHED,
        )
        response = self.client.get(
            "/api/events/",
            {
                "event_type": Event.TypeChoices.ONLINE,
                "search": "Unique discovery",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(item["id"] == event.id for item in response.json()))

    def test_list_events_handles_comma_status_parameter(self):
        event = self._create_event(
            title="Comma Event",
            status=Event.StatusChoices.PUBLISHED,
        )
        results = list_events(
            None,
            status=f"{Event.StatusChoices.PUBLISHED},{Event.StatusChoices.DRAFT}",
            event_type=None,
            search=None,
            limit=10,
            offset=0,
        )
        self.assertIn(event, list(results))

    def test_create_event_attaches_gallery_images(self):
        gallery = self._create_gallery_image()
        payload = {
            "title": "Gallery Event",
            "description": "Gallery desc",
            "start_time": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_time": (timezone.now() + timedelta(days=1, hours=1)).isoformat(),
            "event_type": Event.TypeChoices.ON_SITE,
            "status": Event.StatusChoices.DRAFT,
            "price": 5000,
            "gallery_image_ids": [gallery.id],
        }
        response = self.client.post(
            "/api/events/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        body = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["gallery_images"])

        updated = self.client.put(
            f"/api/events/{body['id']}",
            data=json.dumps(
                {
                    "title": "Gallery Event Updated",
                    "gallery_image_ids": [gallery.id],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["slug"], "gallery-event-updated")
        self.assertTrue(updated.json()["gallery_images"])

    def test_admin_registration_filters_include_university_major_and_search(self):
        event = self.event
        self._create_registration(event, self.user, status=Registration.StatusChoices.CONFIRMED)
        headers = self._auth_headers(self.staff_token)
        response = self.client.get(
            f"/api/events/{event.id}/admin-registrations",
            {
                "university": self.user.university.code,
                "major": self.user.major.code,
                "search": self.user.username,
                "status": [Registration.StatusChoices.CONFIRMED, Registration.StatusChoices.PENDING],
            },
            **headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)

    def test_register_before_start_and_after_end_dates_fail(self):
        future_event = self._create_event(registration_start_date=timezone.now() + timedelta(days=1))
        future_response = self.client.post(
            f"/api/events/{future_event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(future_response.status_code, 400)

        closed_event = self._create_event(registration_end_date=timezone.now() - timedelta(hours=1))
        closed_response = self.client.post(
            f"/api/events/{closed_event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(closed_response.status_code, 400)

    def test_register_recreates_after_cancelled_registration(self):
        event = self._create_event(price=0)
        Registration.objects.create(
            event=event,
            user=self.user,
            status=Registration.StatusChoices.CANCELLED,
            final_price=0,
        )

        response = self.client.post(
            f"/api/events/{event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Registration.StatusChoices.CONFIRMED)

    def test_register_updates_final_price_when_none(self):
        event = self._create_paid_event()
        registration = Registration.objects.create(
            event=event,
            user=self.user,
            status=Registration.StatusChoices.PENDING,
            final_price=None,
        )
        response = self.client.post(
            f"/api/events/{event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["final_price"], event.price)

    def _create_discount_code(self, event):
        code = DiscountCode.objects.create(
            code=f"CODE-{uuid.uuid4().hex[:4]}",
            value=50,
            type=DiscountCode.Type.PERCENT,
            is_active=True,
        )
        code.applicable_events.add(event)
        return code

    def test_register_for_event_with_free_price_confirms(self):
        event = self._create_event(price=0)
        response = self.client.post(
            f"/api/events/{event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Registration.StatusChoices.CONFIRMED)

    def test_register_for_event_with_discount_updates_final_price(self):
        event = self._create_paid_event()
        code = self._create_discount_code(event)
        response = self.client.post(
            f"/api/events/{event.id}/register",
            data=json.dumps({"discount_code": code.code}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

        result = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(result["discount_code"], code.code)
        self.assertEqual(result["discount_amount"], event.price // 2)
        self.assertEqual(result["final_price"], event.price // 2)

    def test_register_fails_when_capacity_full(self):
        event = self._create_event(capacity=1)
        other = self._create_event_user("other_user", "other@example.com")
        Registration.objects.create(
            event=event,
            user=other,
            status=Registration.StatusChoices.CONFIRMED,
            final_price=0,
        )

        response = self.client.post(
            f"/api/events/{event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def _create_event_user(self, username, email):
        user = User.objects.create_user(username=username, email=email, password=self.password)
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        user.major = self.user.major
        user.university = self.user.university
        user.save(update_fields=["major", "university"])
        return user

    def test_register_rejects_duplicate_confirmed(self):
        event = self._create_event(price=0)
        Registration.objects.create(
            event=event,
            user=self.user,
            status=Registration.StatusChoices.CONFIRMED,
            final_price=0,
        )

        response = self.client.post(
            f"/api/events/{event.id}/register",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_registration_status_update_and_cancel(self):
        event = self._create_event(price=0)
        registration = self._create_registration(event, self.user)

        update = self.client.put(
            f"/api/events/registrations/{registration.id}",
            data=json.dumps({"status": Registration.StatusChoices.ATTENDED}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json()["status"], Registration.StatusChoices.ATTENDED)

        cancel = self.client.delete(
            f"/api/events/registrations/{registration.id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(cancel.status_code, 200)
        self.assertEqual(cancel.json()["message"], "ثبت‌نام شما لغو شد :(")

    def test_verify_registration_and_my_registrations(self):
        event = self._create_event(price=0)
        registration = self._create_registration(event, self.user, status=Registration.StatusChoices.CONFIRMED)

        verify = self.client.get(
            f"/api/events/registerations/verify/{registration.ticket_id}",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(verify.status_code, 200)
        self.assertEqual(verify.json()["ticket_id"], str(registration.ticket_id))

        my_regs = self.client.get(
            "/api/events/my-registrations",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(my_regs.status_code, 200)
        self.assertGreater(len(my_regs.json()), 0)

        status_resp = self.client.get(
            f"/api/events/{event.id}/is-registered",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(status_resp.status_code, 200)
        self.assertTrue(status_resp.json()["is_registered"])

    def test_list_event_registrations(self):
        event = self.event
        self._create_registration(event, self.user)

        response = self.client.get(f"/api/events/{event.id}/registrations")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json())

    def test_list_event_registrations_admin_filters(self):
        event = self.event
        self._create_registration(event, self.user, status=Registration.StatusChoices.PENDING)
        headers = self._auth_headers(self.staff_token)
        response = self.client.get(
            f"/api/events/{event.id}/admin-registrations",
            {"status": [Registration.StatusChoices.PENDING]},
            **headers,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["count"], 1)


class EventSchemasIntegrationTests(TestCase):
    password = "SchemaPass!123"

    def setUp(self):
        self.user = User.objects.create_user(
            username="schema_user",
            email="schema.user@example.com",
            password=self.password,
        )
        self.user.is_email_verified = True
        self.user.save(update_fields=["is_email_verified"])

        self.event = Event.objects.create(
            title="Schema Event",
            description="**bold**",
            start_time=timezone.now(),
            end_time=timezone.now() + timedelta(hours=1),
            registration_start_date=timezone.now() - timedelta(days=1),
            registration_end_date=timezone.now() + timedelta(days=1),
            price=1000,
            slug="schema-event",
        )
        Registration.objects.create(
            event=self.event,
            user=self.user,
            status=Registration.StatusChoices.CONFIRMED,
            final_price=0,
        )
        Registration.objects.create(
            event=self.event,
            user=self.user,
            status=Registration.StatusChoices.ATTENDED,
            final_price=0,
        )

    def _mock_request(self):
        return SimpleNamespace(build_absolute_uri=lambda path: f"https://test{path}")

    def test_gallery_schema_returns_full_url(self):
        obj = SimpleNamespace(image=SimpleNamespace(url="/media/gallery.png"))
        result = EventGallerySchema.resolve_absolute_image_url(obj, {"request": self._mock_request()})
        self.assertEqual(result, "https://test/media/gallery.png")

    def test_event_schema_resolvers(self):
        context = {"request": self._mock_request()}
        event_obj = SimpleNamespace(featured_image=SimpleNamespace(url="/media/feat.png"), registrations=self.event.registrations)
        self.assertEqual(EventSchema.resolve_absolute_featured_image_url(event_obj, context), "https://test/media/feat.png")
        self.assertEqual(EventSchema.resolve_registration_count(self.event), 2)
        self.assertIn("<p>", EventSchema.resolve_description_html(self.event))

    def test_event_list_schema_resolvers(self):
        obj = SimpleNamespace(featured_image=SimpleNamespace(url="/media/feat.png"), registrations=self.event.registrations)
        context = {"request": self._mock_request()}
        self.assertEqual(EventListSchema.resolve_absolute_featured_image_url(obj, context), "https://test/media/feat.png")
        self.assertEqual(EventListSchema.resolve_registration_count(self.event), 2)

    def test_registration_schema_resolves_discount_code(self):
        discount = DiscountCode.objects.create(code="SCHEMA", type=DiscountCode.Type.FIXED, value=100, is_active=True)
        discount.applicable_events.add(self.event)
        registration = Registration.objects.create(
            event=self.event,
            user=self.user,
            status=Registration.StatusChoices.CONFIRMED,
            final_price=900,
            discount_code=discount,
        )
        self.assertEqual(RegistrationSchema.resolve_discount_code(registration), discount.code)

    def test_payment_admin_schema_normalizes_discount_code(self):
        self.assertIsNone(PaymentAdminSchema.normalize_discount_code(None))
        self.assertEqual(PaymentAdminSchema.normalize_discount_code("123"), "123")
        self.assertEqual(PaymentAdminSchema.normalize_discount_code(SimpleNamespace(code="ABC")), "ABC")

    def test_event_admin_detail_resolves_registrations(self):
        registrations = EventAdminDetailSchema.resolve_registrations(self.event)
        self.assertTrue(list(registrations))
    # TODO registration-related tests
