import uuid
from datetime import timedelta
from unittest import mock

from django.db.models.signals import post_save
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from import_export.widgets import BooleanWidget

from users.models import User, Major, University
from users.resources import UserResource
from users.signals import send_verification_email_on_registration
from users.tasks import (
    send_email_verified_success,
    send_password_reset_email,
    send_verification_email,
)


class UserFactoryMixin:
    def _ensure_reference_objects(self):
        if not hasattr(self, "_default_major"):
            self._default_major, _ = Major.objects.get_or_create(
                code="CS",
                defaults={"name": "Computer Science"},
            )
            self._default_university, _ = University.objects.get_or_create(
                code="UT",
                defaults={"name": "University of Tehran"},
            )

    def _resolve_major(self, value):
        if value is None:
            return None
        if isinstance(value, Major):
            return value
        obj, _ = Major.objects.get_or_create(code=value, defaults={"name": value})
        return obj

    def _resolve_university(self, value):
        if value is None:
            return None
        if isinstance(value, University):
            return value
        obj, _ = University.objects.get_or_create(code=value, defaults={"name": value})
        return obj

    def create_user(self, **extra_fields):
        self._ensure_reference_objects()
        unique = uuid.uuid4().hex
        data = {
            "email": f"user_{unique}@example.com",
            "username": f"user_{unique[:10]}",
            "first_name": "Test",
            "last_name": "User",
        }
        password = extra_fields.pop("password", "StrongPass!123")
        major = extra_fields.pop("major", self._default_major)
        university = extra_fields.pop("university", self._default_university)
        if isinstance(major, str):
            major = self._resolve_major(major)
        if isinstance(university, str):
            university = self._resolve_university(university)
        data.update(extra_fields)
        data.setdefault("major", major)
        data.setdefault("university", university)
        return User.objects.create_user(password=password, **data)


class UserModelTests(UserFactoryMixin, TestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch("users.signals.send_verification_email.delay")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_str_returns_full_name_with_email(self):
        # Arrange
        user = self.create_user(first_name="Ada", last_name="Lovelace")

        # Act
        result = str(user)

        # Assert
        expected = f"{user.get_full_name()} ({user.email})"
        self.assertEqual(result, expected)

    def test_get_full_name_handles_missing_names(self):
        # Arrange
        user = self.create_user(first_name="Grace", last_name="")

        # Act
        result = user.get_full_name()

        # Assert
        self.assertEqual(result, "Grace")

    def test_regenerate_verification_token_generates_new_value(self):
        # Arrange
        user = self.create_user()
        original_token = user.email_verification_token

        # Act
        user.regenerate_verification_token()

        # Assert
        self.assertNotEqual(user.email_verification_token, original_token)

    def test_set_password_reset_token_assigns_future_expiry(self):
        # Arrange
        user = self.create_user()
        frozen = timezone.now()

        # Act
        with mock.patch("users.models.timezone.now", return_value=frozen):
            user.set_password_reset_token()

        # Assert
        self.assertIsNotNone(user.password_reset_token)
        self.assertEqual(
            user.password_reset_token_expires_at,
            frozen + timedelta(hours=1),
        )

    def test_save_triggers_verified_task_on_state_change(self):
        # Arrange
        user = self.create_user()

        # Act
        with mock.patch("users.tasks.send_email_verified_success.delay") as mock_delay:
            user.is_email_verified = True
            user.save()

        # Assert
        mock_delay.assert_called_once_with(user.id)

    def test_save_skips_task_when_already_verified(self):
        # Arrange
        user = self.create_user(is_email_verified=True)

        # Act
        with mock.patch("users.tasks.send_email_verified_success.delay") as mock_delay:
            user.bio = "Updated bio"
            user.save()

        # Assert
        mock_delay.assert_not_called()


class UserSignalTests(TestCase):
    def setUp(self):
        super().setUp()
        post_save.disconnect(send_verification_email_on_registration, sender=User)
        self.addCleanup(
            post_save.connect,
            send_verification_email_on_registration,
            User,
            False,
        )

    @override_settings(FRONTEND_ROOT="https://frontend.example/")
    @mock.patch("users.signals.send_verification_email.delay")
    @mock.patch("users.signals.uuid.uuid4")
    def test_signal_sets_username_timestamp_and_dispatches_email(
        self,
        mock_uuid,
        mock_delay,
    ):
        # Arrange
        fake_uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
        mock_uuid.return_value = fake_uuid
        fake_now = timezone.now()
        user = User.objects.create(
            email="new.user@example.com",
            username="",
            password="pass",
            is_email_verified=False,
        )

        # Act
        with mock.patch("users.signals.timezone.now", return_value=fake_now):
            send_verification_email_on_registration(User, user, created=True)

        # Assert
        user.refresh_from_db()
        self.assertEqual(user.username, str(fake_uuid)[:10])
        self.assertEqual(user.email_verification_sent_at, fake_now)
        expected_url = (
            f"https://frontend.example/verify-email/{user.email_verification_token}"
        )
        mock_delay.assert_called_once_with(user.id, expected_url)

    @override_settings(FRONTEND_ROOT="https://frontend.example/")
    @mock.patch("users.signals.send_verification_email.delay")
    def test_signal_preserves_existing_username(self, mock_delay):
        # Arrange
        fake_now = timezone.now()
        user = User.objects.create(
            email="existing@example.com",
            username="existing_name",
            password="pass",
            is_email_verified=False,
        )

        # Act
        with mock.patch("users.signals.timezone.now", return_value=fake_now):
            send_verification_email_on_registration(User, user, created=True)

        # Assert
        user.refresh_from_db()
        self.assertEqual(user.username, "existing_name")
        self.assertEqual(user.email_verification_sent_at, fake_now)
        mock_delay.assert_called_once()

    @mock.patch("users.signals.send_verification_email.delay")
    def test_signal_skips_when_user_already_verified(self, mock_delay):
        # Arrange
        user = User.objects.create(
            email="verified@example.com",
            username="verified_user",
            password="pass",
            is_email_verified=True,
        )

        # Act
        send_verification_email_on_registration(User, user, created=True)

        # Assert
        self.assertIsNone(user.email_verification_sent_at)
        mock_delay.assert_not_called()

    @mock.patch("users.signals.send_verification_email.delay")
    def test_signal_skips_when_email_missing(self, mock_delay):
        # Arrange
        user = User.objects.create(
            email="",
            username="no_email",
            password="pass",
            is_email_verified=False,
        )

        # Act
        send_verification_email_on_registration(User, user, created=True)

        # Assert
        self.assertIsNone(user.email_verification_sent_at)
        mock_delay.assert_not_called()

    @mock.patch("users.signals.send_verification_email.delay")
    def test_signal_ignores_updates_to_existing_users(self, mock_delay):
        # Arrange
        user = User.objects.create(
            email="existing-update@example.com",
            username="existing_update",
            password="pass",
            is_email_verified=False,
        )

        # Act
        send_verification_email_on_registration(User, user, created=False)

        # Assert
        self.assertIsNone(user.email_verification_sent_at)
        mock_delay.assert_not_called()


class UserTaskTests(UserFactoryMixin, TestCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch("users.signals.send_verification_email.delay")
        patcher.start()
        self.addCleanup(patcher.stop)

    @override_settings(DEFAULT_FROM_EMAIL="no-reply@example.com")
    @mock.patch("users.tasks.send_mail")
    @mock.patch("users.tasks.render_to_string", return_value="<p>Hi</p>")
    def test_send_verification_email_task_sends_expected_payload(
        self,
        mock_render,
        mock_send_mail,
    ):
        # Arrange
        user = self.create_user()
        verification_url = "https://example.com/verify"

        # Act
        result = send_verification_email.run(user.id, verification_url)

        # Assert
        self.assertEqual(result, f"Verification email sent to {user.email}")
        mock_render.assert_called_once_with(
            "emails/verification_email.html",
            {"user": user, "verification_url": verification_url},
        )
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["recipient_list"], [user.email])
        self.assertEqual(kwargs["from_email"], "no-reply@example.com")
        self.assertEqual(kwargs["message"], "Hi")

    @override_settings(DEFAULT_FROM_EMAIL="support@example.com")
    @mock.patch("users.tasks.send_mail")
    @mock.patch("users.tasks.render_to_string", return_value="<p>Reset</p>")
    def test_send_password_reset_email_task_uses_reset_template(
        self,
        mock_render,
        mock_send_mail,
    ):
        # Arrange
        user = self.create_user()
        reset_url = "https://example.com/reset"

        # Act
        result = send_password_reset_email.run(user.id, reset_url)

        # Assert
        self.assertEqual(result, f"Password reset email sent to {user.email}")
        mock_render.assert_called_once_with(
            "emails/password_reset_email.html",
            {"user": user, "reset_url": reset_url},
        )
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["recipient_list"], [user.email])
        self.assertEqual(kwargs["from_email"], "support@example.com")
        self.assertEqual(kwargs["message"], "Reset")

    @override_settings(
        DEFAULT_FROM_EMAIL="success@example.com",
        FRONTEND_ROOT="https://frontend.example/",
    )
    @mock.patch("users.tasks.send_mail")
    @mock.patch("users.tasks.render_to_string", return_value="<p>Success</p>")
    def test_send_email_verified_success_task_renders_success_template(
        self,
        mock_render,
        mock_send_mail,
    ):
        # Arrange
        user = self.create_user()

        # Act
        result = send_email_verified_success.run(user.id)

        # Assert
        self.assertEqual(result, f"verified success email sent to {user.email}")
        mock_render.assert_called_once_with(
            "emails/verification_success.html",
            {"user": user, "home_url": "https://frontend.example/"},
        )
        kwargs = mock_send_mail.call_args.kwargs
        self.assertEqual(kwargs["recipient_list"], [user.email])
        self.assertEqual(kwargs["from_email"], "success@example.com")
        self.assertEqual(kwargs["message"], "Success")

    def test_send_verification_email_task_retries_on_lookup_error(self):
        # Arrange
        retry_patch = mock.patch.object(
            send_verification_email,
            "retry",
            side_effect=RuntimeError("retry"),
        )

        # Act / Assert
        with mock.patch(
            "users.tasks.User.objects.get",
            side_effect=ValueError("missing"),
        ), retry_patch as mock_retry:
            with self.assertRaises(RuntimeError):
                send_verification_email.run(999, "https://example.com/verify")

        self.assertEqual(mock_retry.call_args.kwargs.get("countdown"), 60)
        self.assertIsInstance(mock_retry.call_args.kwargs.get("exc"), ValueError)


class UserResourceTests(SimpleTestCase):
    def test_boolean_fields_use_boolean_widget(self):
        # Arrange
        resource = UserResource()

        # Act
        widgets = [
            resource.fields["is_staff"].widget,
            resource.fields["is_superuser"].widget,
            resource.fields["is_email_verified"].widget,
        ]

        # Assert
        for widget in widgets:
            self.assertIsInstance(widget, BooleanWidget)

    def test_field_order_matches_meta_definition(self):
        # Arrange
        resource = UserResource()

        # Act
        field_names = tuple(resource.fields.keys())

        # Assert
        self.assertEqual(resource._meta.export_order, resource._meta.fields)
        self.assertSetEqual(set(field_names), set(resource._meta.fields))
