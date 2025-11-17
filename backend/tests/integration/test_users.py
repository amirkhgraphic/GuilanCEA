import json
import shutil
import tempfile
import uuid
from datetime import timedelta
from unittest import mock

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

import jwt

from users.models import User, Major, University


class UsersAPIIntegrationTests(TestCase):
    password = "Sup3rSecure!123"

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.major_cs, _ = Major.objects.get_or_create(
            code="CS", defaults={"name": "Computer Science"}
        )
        cls.major_gil, _ = Major.objects.get_or_create(
            code="GIL_CS", defaults={"name": "Gilan Computer Science"}
        )
        cls.university_ut, _ = University.objects.get_or_create(
            code="UT", defaults={"name": "University of Tehran"}
        )
        cls.university_gilan, _ = University.objects.get_or_create(
            code="GILAN", defaults={"name": "Gilan University"}
        )

    def setUp(self):
        super().setUp()
        patchers = [
            mock.patch("users.tasks.send_verification_email.delay"),
            mock.patch("users.signals.send_verification_email.delay"),
            mock.patch("users.tasks.send_password_reset_email.delay"),
        ]
        (
            self.mock_send_verification_task,
            self.mock_signal_verification_task,
            self.mock_password_reset_task,
        ) = [patcher.start() for patcher in patchers]
        for patcher in patchers:
            self.addCleanup(patcher.stop)

    # Helper utilities -----------------------------------------------------

    def _numeric_student_id(self) -> str:
        return str(uuid.uuid4().int)[-10:]

    def _resolve_major(self, value):
        if value is None:
            return None
        if isinstance(value, Major):
            return value
        return Major.objects.filter(code=value).first()

    def _resolve_university(self, value):
        if value is None:
            return None
        if isinstance(value, University):
            return value
        return University.objects.filter(code=value).first()

    def _create_user(self, **overrides) -> User:
        unique = uuid.uuid4().hex[:8]
        defaults = {
            "username": f"user_{unique}",
            "email": f"{unique}@example.com",
            "student_id": self._numeric_student_id(),
            "first_name": "Test",
            "last_name": "User",
            "year_of_study": 2,
            "major": self.major_cs,
            "university": self.university_ut,
        }
        defaults.update(overrides)
        if isinstance(defaults.get("major"), str):
            defaults["major"] = self._resolve_major(defaults["major"])
        if isinstance(defaults.get("university"), str):
            defaults["university"] = self._resolve_university(defaults["university"])
        password = defaults.pop("password", self.password)
        return User.objects.create_user(password=password, **defaults)

    def _auth_headers(self, token: str) -> dict:
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def _login_and_get_tokens(self, user: User, password: str | None = None) -> dict:
        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": password or self.password}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        return response.json()

    def _refresh_token_value(self, user: User | None = None, **overrides) -> str:
        now = timezone.now()
        payload = {
            "type": "refresh",
            "exp": now + timedelta(minutes=5),
            "iat": now,
        }
        if user is not None:
            payload["user_id"] = user.id
        payload.update(overrides)
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    # Registration ---------------------------------------------------------

    def test_register_creates_user_and_enqueues_signal(self):
        # Arrange
        payload = {
            "username": "integration_user",
            "email": "integration@example.com",
            "password": "RegisterPass!9",
            "student_id": "2023123456",
            "first_name": "Integration",
            "last_name": "Tester",
            "university": self.university_ut.code,
            "major": self.major_cs.code,
            "year_of_study": 3,
        }

        # Act
        response = self.client.post(
            "/api/auth/register", data=json.dumps(payload), content_type="application/json"
        )

        # Assert
        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email=payload["email"]).exists())
        self.assertTrue(self.mock_signal_verification_task.called)

    def test_register_rejects_short_student_id(self):
        # Arrange
        payload = {
            "username": "short_id",
            "email": "short@example.com",
            "password": "RegisterPass!9",
            "student_id": "123456789",  # 9 digits
        }

        # Act
        response = self.client.post(
            "/api/auth/register", data=json.dumps(payload), content_type="application/json"
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_duplicate_username(self):
        # Arrange
        existing = self._create_user(username="duplicate")
        payload = {
            "username": existing.username,
            "email": "someone@example.com",
            "password": "RegisterPass!9",
        }

        # Act
        response = self.client.post(
            "/api/auth/register", data=json.dumps(payload), content_type="application/json"
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_duplicate_email(self):
        # Arrange
        existing = self._create_user(email="duplicate@example.com")
        payload = {
            "username": "newuser",
            "email": existing.email,
            "password": "RegisterPass!9",
        }

        # Act
        response = self.client.post(
            "/api/auth/register", data=json.dumps(payload), content_type="application/json"
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_register_rejects_duplicate_student_id_in_same_university(self):
        # Arrange
        student_id = "2023012345"
        self._create_user(student_id=student_id, university=self.university_gilan)
        payload = {
            "username": "dupstudent",
            "email": "dupstudent@example.com",
            "password": "RegisterPass!9",
            "student_id": student_id,
            "university": self.university_gilan.code,
        }

        # Act
        response = self.client.post(
            "/api/auth/register", data=json.dumps(payload), content_type="application/json"
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    # Login & Refresh ------------------------------------------------------

    def test_login_returns_tokens_for_verified_user(self):
        # Arrange
        user = self._create_user()
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])

        # Act
        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": self.password}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("access_token", body)
        self.assertIn("refresh_token", body)

    def test_login_rejects_unverified_user(self):
        # Arrange
        user = self._create_user()

        # Act
        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": self.password}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_login_rejects_inactive_user(self):
        # Arrange
        user = self._create_user(is_email_verified=True, is_active=False)

        # Act
        response = self.client.post(
            "/api/auth/login",
            data=json.dumps({"email": user.email, "password": self.password}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_returns_tokens(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": tokens["refresh_token"]}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        refreshed = response.json()
        self.assertIn("access_token", refreshed)
        self.assertIn("refresh_token", refreshed)

    def test_refresh_rejects_non_refresh_token(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": tokens["access_token"]}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_missing_user_id(self):
        # Arrange
        token = self._refresh_token_value()

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": token}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_unverified_user(self):
        # Arrange
        user = self._create_user()
        token = self._refresh_token_value(user=user)

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": token}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_inactive_user(self):
        # Arrange
        user = self._create_user(is_email_verified=True, is_active=False)
        token = self._refresh_token_value(user=user)

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": token}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_expired_token(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        token = self._refresh_token_value(
            user=user,
            exp=timezone.now() - timedelta(minutes=1),
        )

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": token}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_refresh_rejects_invalid_token_string(self):
        # Arrange
        token = "not-a-valid-token"

        # Act
        response = self.client.post(
            "/api/auth/refresh",
            data=json.dumps({"refresh_token": token}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 401)

    # Email verification ---------------------------------------------------

    def test_verify_email_marks_user_verified(self):
        # Arrange
        user = self._create_user()
        token = str(user.email_verification_token)

        # Act
        response = self.client.get(f"/api/auth/verify-email/{token}")

        # Assert
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

    def test_verify_email_rejects_unknown_token(self):
        # Arrange
        token = uuid.uuid4()

        # Act
        response = self.client.get(f"/api/auth/verify-email/{token}")

        # Assert
        self.assertEqual(response.status_code, 404)

    def test_resend_verification_rejects_unknown_email(self):
        # Arrange
        payload = {"email": "missing@example.com"}

        # Act
        response = self.client.post(f"/api/auth/resend-verification?email={payload['email']}")

        # Assert
        self.assertEqual(response.status_code, 404)

    # Profiles -------------------------------------------------------------

    def test_get_profile_returns_schema_fields(self):
        # Arrange
        user = self._create_user(major=self.major_cs, university=self.university_gilan)
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.get("/api/auth/profile", **self._auth_headers(tokens["access_token"]))

        # Assert
        self.assertEqual(response.status_code, 200)
        profile = response.json()
        self.assertEqual(profile["major"], user.get_major_display())
        self.assertEqual(profile["university"], user.get_university_display())

    def test_get_profile_requires_authentication(self):
        # Arrange
        # No token supplied.

        # Act
        response = self.client.get("/api/auth/profile")

        # Assert
        self.assertEqual(response.status_code, 401)

    def test_update_profile_persists_changes(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)
        payload = {"bio": "Updated bio", "year_of_study": 4}

        # Act
        response = self.client.put(
            "/api/auth/profile",
            data=json.dumps(payload),
            content_type="application/json",
            **self._auth_headers(tokens["access_token"]),
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.bio, payload["bio"])
        self.assertEqual(user.year_of_study, payload["year_of_study"])

    @override_settings(MEDIA_URL="/media/", MEDIA_ROOT=tempfile.gettempdir())
    def test_upload_profile_picture_succeeds(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)
        image = SimpleUploadedFile(
            "avatar.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", content_type="image/png"
        )

        # Act
        response = self.client.post(
            "/api/auth/profile/picture", {"file": image}, **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        profile = self.client.get(
            "/api/auth/profile", **self._auth_headers(tokens["access_token"])
        ).json()
        self.assertIn("profile_pictures", profile["profile_picture"])

    def test_upload_profile_picture_requires_file(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.post(
            "/api/auth/profile/picture", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_upload_profile_picture_rejects_invalid_type(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)
        text_file = SimpleUploadedFile("doc.txt", b"text", content_type="text/plain")

        # Act
        response = self.client.post(
            "/api/auth/profile/picture",
            {"file": text_file},
            **self._auth_headers(tokens["access_token"]),
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_upload_profile_picture_rejects_large_files(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)
        large_content = b"x" * (5 * 1024 * 1024 + 1)
        large_file = SimpleUploadedFile("large.png", large_content, content_type="image/png")

        # Act
        response = self.client.post(
            "/api/auth/profile/picture",
            {"file": large_file},
            **self._auth_headers(tokens["access_token"]),
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_delete_profile_picture_removes_file(self):
        # Arrange
        temp_media = tempfile.mkdtemp()
        self.addCleanup(lambda: shutil.rmtree(temp_media, ignore_errors=True))
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)
        with override_settings(MEDIA_ROOT=temp_media, MEDIA_URL="/media/"):
            image = SimpleUploadedFile("avatar.png", b"data", content_type="image/png")
            self.client.post(
                "/api/auth/profile/picture",
                {"file": image},
                **self._auth_headers(tokens["access_token"]),
            )

            # Act
            response = self.client.delete(
                "/api/auth/profile/picture", **self._auth_headers(tokens["access_token"])
            )

            # Assert
            self.assertEqual(response.status_code, 200)
            user.refresh_from_db()
            self.assertFalse(bool(user.profile_picture))

    # Password reset ------------------------------------------------------

    def test_request_password_reset_enqueues_email(self):
        # Arrange
        user = self._create_user()

        # Act
        response = self.client.post(
            "/api/auth/request-password-reset",
            data=json.dumps({"email": user.email}),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertIsNotNone(user.password_reset_token)
        self.mock_password_reset_task.assert_called_once()

    def test_request_password_reset_unknown_email_returns_error(self):
        # Arrange
        payload = {"email": "missing@example.com"}

        # Act
        response = self.client.post(
            "/api/auth/request-password-reset",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_reset_password_confirm_updates_credentials(self):
        # Arrange
        user = self._create_user()
        user.set_password_reset_token()
        payload = {"token": str(user.password_reset_token), "new_password": "BrandNewPass!9"}

        # Act
        response = self.client.post(
            "/api/auth/reset-password-confirm",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertIsNone(user.password_reset_token)
        self.assertTrue(user.check_password(payload["new_password"]))

    def test_reset_password_confirm_rejects_expired_token(self):
        # Arrange
        user = self._create_user()
        user.set_password_reset_token()
        user.password_reset_token_expires_at = timezone.now() - timedelta(minutes=1)
        user.save(update_fields=["password_reset_token_expires_at"])
        payload = {"token": str(user.password_reset_token), "new_password": "New!!!Pass"}

        # Act
        response = self.client.post(
            "/api/auth/reset-password-confirm",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    def test_reset_password_confirm_rejects_unknown_token(self):
        # Arrange
        payload = {"token": str(uuid.uuid4()), "new_password": "AnotherPass!9"}

        # Act
        response = self.client.post(
            "/api/auth/reset-password-confirm",
            data=json.dumps(payload),
            content_type="application/json",
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    # Admin utilities -----------------------------------------------------

    def test_list_deleted_users_requires_privileged_user(self):
        # Arrange
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.get(
            "/api/auth/users/deleted", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_list_deleted_users_returns_payload_for_staff(self):
        # Arrange
        deleted = self._create_user(is_deleted=True, deleted_at=timezone.now())
        staff = self._create_user(is_email_verified=True, is_staff=True)
        tokens = self._login_and_get_tokens(staff)

        # Act
        response = self.client.get(
            "/api/auth/users/deleted", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(any(item["id"] == deleted.id for item in payload))

    def test_restore_user_requires_privileged_user(self):
        # Arrange
        target = self._create_user(is_deleted=True, deleted_at=timezone.now())
        user = self._create_user(is_email_verified=True)
        tokens = self._login_and_get_tokens(user)

        # Act
        response = self.client.post(
            f"/api/auth/users/{target.id}/restore", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 403)

    def test_restore_user_restores_record_for_staff(self):
        # Arrange
        target = self._create_user(is_deleted=True, deleted_at=timezone.now())
        staff = self._create_user(is_email_verified=True, is_staff=True)
        tokens = self._login_and_get_tokens(staff)

        # Act
        response = self.client.post(
            f"/api/auth/users/{target.id}/restore", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertFalse(target.is_deleted)

    def test_restore_user_missing_returns_error(self):
        # Arrange
        staff = self._create_user(is_email_verified=True, is_staff=True)
        tokens = self._login_and_get_tokens(staff)

        # Act
        response = self.client.post(
            "/api/auth/users/999/restore", **self._auth_headers(tokens["access_token"])
        )

        # Assert
        self.assertEqual(response.status_code, 400)

    # Username checks ------------------------------------------------------

    def test_check_username_reports_existing(self):
        # Arrange
        user = self._create_user()

        # Act
        response = self.client.get("/api/auth/check-username", {"username": user.username})

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["exists"])

    def test_check_username_reports_availability(self):
        # Arrange
        username = "available_user"

        # Act
        response = self.client.get("/api/auth/check-username", {"username": username})

        # Assert
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["exists"])
