import hashlib
import uuid
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from celery.exceptions import SoftTimeLimitExceeded
from django.http import QueryDict
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from django.contrib.admin import AdminSite

from events.admin import EventAdmin, EventEmailLogAdmin, RegistrationAdmin
from events.admin_forms import AnnouncementForm
from events.models import Event, EventEmailLog, Registration
from events.resources import RegistrationResource
from events.tasks import (
    _build_email_context,
    _event_recipients,
    _event_url,
    _send_html_email,
    queue_event_announcement,
    queue_invites_to_non_registered_users,
    queue_skyroom_credentials,
    send_event_announcement_to_user,
    send_event_reminder_task,
    send_invite_to_user,
    send_registration_cancellation_email,
    send_registration_confirmation_email,
    send_skyroom_credentials_individual_task,
    send_skyroom_credentials_to_user,
)
from users.models import User


class EventEmailLogUtilsTests(SimpleTestCase):
    def test_hash_context_returns_none_for_missing_context(self):
        # Arrange / Act
        result = EventEmailLog._hash_context(None)

        # Assert
        self.assertIsNone(result)

    def test_hash_context_normalizes_non_string_inputs(self):
        # Arrange
        value = 1234
        expected = hashlib.sha256(str(value).encode("utf-8")).hexdigest()

        # Act
        result = EventEmailLog._hash_context(value)

        # Assert
        self.assertEqual(result, expected)


class EventTasksUtilityTests(SimpleTestCase):
    def test_build_email_context_joined_values(self):
        # Arrange
        parts = ("announce", "", None, "body", "more")

        # Act
        result = _build_email_context(*parts)

        # Assert
        self.assertEqual(result, "announce|body|more")

    def test_build_email_context_returns_none_for_only_empty_parts(self):
        # Arrange
        parts = ("", None, "")

        # Act
        result = _build_email_context(*parts)

        # Assert
        self.assertIsNone(result)

    @override_settings(FRONTEND_ROOT="https://app.local/")
    def test_event_url_prefers_slug(self):
        # Arrange
        event = SimpleNamespace(slug="my-event", id=1)

        # Act
        result = _event_url(event)

        # Assert
        self.assertEqual(result, "https://app.local/events/my-event")

    @override_settings(FRONTEND_ROOT="https://app.local/")
    def test_event_url_falls_back_to_id_when_slug_missing(self):
        # Arrange
        event = SimpleNamespace(slug=None, id=42)

        # Act
        result = _event_url(event)

        # Assert
        self.assertEqual(result, "https://app.local/events/42")

    @override_settings(DEFAULT_FROM_EMAIL="noreply@example.com")
    @mock.patch("events.tasks.EmailMultiAlternatives")
    def test_send_html_email_attaches_html_body(self, mock_email_class):
        # Arrange
        html_body = "<p>Hello <strong>World</strong></p>"
        expected_text = "Hello World"
        email_instance = mock_email_class.return_value

        # Act
        _send_html_email("Subject", html_body, "target@example.com")

        # Assert
        mock_email_class.assert_called_once_with(
            subject="Subject",
            body=expected_text,
            from_email="noreply@example.com",
            to=["target@example.com"],
        )
        email_instance.attach_alternative.assert_called_once_with(html_body, "text/html")
        email_instance.send.assert_called_once()


class RegistrationResourceTests(SimpleTestCase):
    def setUp(self):
        self.resource = RegistrationResource()

    def test_dehydrate_ticket_id_truncates_to_eight_characters(self):
        # Arrange
        ticket_id = uuid.uuid4()
        record = SimpleNamespace(ticket_id=ticket_id)
        expected = str(ticket_id)[:8]

        # Act
        result = self.resource.dehydrate_ticket_id(record)

        # Assert
        self.assertEqual(result, expected)

    def test_dehydrate_ticket_id_handles_missing_values(self):
        # Arrange
        record = SimpleNamespace(ticket_id=None)

        # Act
        result = self.resource.dehydrate_ticket_id(record)

        # Assert
        self.assertEqual(result, "")


class AnnouncementFormTests(SimpleTestCase):
    def test_statuses_field_initializes_with_confirmed_and_attended(self):
        # Arrange
        form = AnnouncementForm()

        # Act
        initial = form.fields["statuses"].initial

        # Assert
        expected = [
            Registration.StatusChoices.CONFIRMED,
            Registration.StatusChoices.ATTENDED,
        ]
        self.assertEqual(initial, expected)


class EventEmailLogFactoryMixin:
    def create_user(self):
        unique = uuid.uuid4().hex
        return User.objects.create_user(
            email=f"user_{unique}@example.com",
            username=f"user_{unique[:10]}",
            password="pass1234",
        )

    def create_event(self, **kwargs):
        now = timezone.now()
        defaults = {
            "title": f"Event {uuid.uuid4().hex[:6]}",
            "description": "Fixture event",
            "start_time": now,
            "end_time": now + timedelta(hours=1),
            "slug": f"event-{uuid.uuid4().hex[:6]}",
            "price": 0,
        }
        defaults.update(kwargs)
        return Event.objects.create(**defaults)


class EventEmailLogModelTests(EventEmailLogFactoryMixin, TestCase):
    def test_claim_creates_pending_log(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        context = "send-invite"

        # Act
        log, skipped = EventEmailLog.claim(
            event_id=event.id,
            user_id=user.id,
            kind=EventEmailLog.KIND_INVITE_NON_REGISTERED,
            context=context,
        )

        # Assert
        self.assertFalse(skipped)
        self.assertEqual(log.status, EventEmailLog.STATUS_PENDING)
        self.assertEqual(log.context_hash, EventEmailLog._hash_context(context))

    def test_claim_returns_existing_pending_log(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        context = "announcement"
        context_hash = EventEmailLog._hash_context(context)
        existing = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
            context_hash=context_hash,
            status=EventEmailLog.STATUS_PENDING,
        )

        # Act
        log, skipped = EventEmailLog.claim(
            event_id=event.id,
            user_id=user.id,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
            context=context,
        )

        # Assert
        self.assertTrue(skipped)
        self.assertEqual(log.pk, existing.pk)
        self.assertEqual(log.status, EventEmailLog.STATUS_PENDING)

    def test_claim_resets_failed_record(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        context = "retry"
        context_hash = EventEmailLog._hash_context(context)
        log = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
            context_hash=context_hash,
            status=EventEmailLog.STATUS_FAILED,
            error="boom",
            sent_at=timezone.now(),
        )

        # Act
        claimed, skipped = EventEmailLog.claim(
            event_id=event.id,
            user_id=user.id,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
            context=context,
        )

        # Assert
        self.assertFalse(skipped)
        self.assertEqual(claimed.pk, log.pk)
        self.assertEqual(claimed.status, EventEmailLog.STATUS_PENDING)
        self.assertEqual(claimed.error, "")
        self.assertIsNone(claimed.sent_at)

    def test_mark_sent_sets_sent_timestamp_and_status(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        log = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
        )

        # Act
        log.mark_sent()

        # Assert
        self.assertEqual(log.status, EventEmailLog.STATUS_SENT)
        self.assertIsNotNone(log.sent_at)

    def test_mark_failed_clears_sent_at_and_records_error(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        log = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
            sent_at=timezone.now(),
        )

        # Act
        log.mark_failed("timeout")

        # Assert
        self.assertEqual(log.status, EventEmailLog.STATUS_FAILED)
        self.assertEqual(log.error, "timeout")
        self.assertIsNone(log.sent_at)


class EventModelTests(EventEmailLogFactoryMixin, TestCase):
    def test_description_html_renders_markdown(self):
        # Arrange
        event = self.create_event(description="**bold** content")

        # Act
        rendered = event.description_html

        # Assert
        self.assertIn("<strong>bold</strong>", rendered)

    def test_is_registration_open_follows_window(self):
        # Arrange
        now = timezone.now()
        event = self.create_event(
            registration_start_date=now - timedelta(hours=2),
            registration_end_date=now + timedelta(hours=2),
        )

        # Act / Assert
        with mock.patch("events.models.timezone.now", return_value=now):
            self.assertTrue(event.is_registration_open)

    def test_is_registration_open_closed_outside_window(self):
        # Arrange
        now = timezone.now()
        event = self.create_event(
            registration_start_date=now + timedelta(hours=1),
            registration_end_date=now + timedelta(hours=2),
        )

        # Act / Assert
        with mock.patch("events.models.timezone.now", return_value=now):
            self.assertFalse(event.is_registration_open)

    def test_current_attendees_count_filters_statuses(self):
        # Arrange
        event = self.create_event()
        user_one = self.create_user()
        user_two = self.create_user()
        Registration.objects.create(
            event=event,
            user=user_one,
            status=Registration.StatusChoices.CONFIRMED,
        )
        Registration.objects.create(
            event=event,
            user=user_two,
            status=Registration.StatusChoices.CANCELLED,
        )
        Registration.objects.create(
            event=event,
            user=self.create_user(),
            status=Registration.StatusChoices.ATTENDED,
        )

        # Act
        count = event.current_attendees_count

        # Assert
        self.assertEqual(count, 2)

    def test_has_available_slots_respects_capacity(self):
        # Arrange
        event = self.create_event(capacity=2)
        for _ in range(2):
            Registration.objects.create(
                event=event,
                user=self.create_user(),
                status=Registration.StatusChoices.CONFIRMED,
            )

        # Act
        available_after_full = event.has_available_slots

        # Assert
        self.assertFalse(available_after_full)

    def test_has_available_slots_allows_unlimited_capacity(self):
        # Arrange
        event = self.create_event(capacity=None)

        # Act
        available = event.has_available_slots

        # Assert
        self.assertTrue(available)


class EventTaskBehaviorTests(EventEmailLogFactoryMixin, TestCase):
    def test_event_recipients_filters_by_status_and_email(self):
        # Arrange
        event = self.create_event()
        verified = self.create_user()
        verified.is_email_verified = True
        verified.save(update_fields=["is_email_verified"])
        Registration.objects.create(
            event=event,
            user=verified,
            status=Registration.StatusChoices.CONFIRMED,
        )
        unverified = self.create_user()
        Registration.objects.create(
            event=event,
            user=unverified,
            status=Registration.StatusChoices.CONFIRMED,
        )

        # Act
        recipients = list(_event_recipients(event, statuses=[Registration.StatusChoices.CONFIRMED]))

        # Assert
        self.assertEqual(len(recipients), 1)
        self.assertEqual(recipients[0].user_id, verified.id)

    @override_settings(DEFAULT_FROM_EMAIL="noreply@example.com")
    @mock.patch("events.tasks.EmailMultiAlternatives")
    @mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>")
    @mock.patch("events.tasks.strip_tags", side_effect=lambda html: "ok")
    @mock.patch("events.tasks.markdown.markdown", return_value="converted")
    def test_send_registration_confirmation_email_sends_message(
        self,
        mock_markdown,
        mock_strip,
        mock_render,
        mock_email_class,
    ):
        # Arrange
        registration = SimpleNamespace(
            pk=1,
            user=SimpleNamespace(email="user@example.com", username="user-one"),
            event=SimpleNamespace(
                title="Title",
                registration_success_markdown="**done**",
            ),
        )
        manager = mock.MagicMock()
        manager.select_related.return_value.get.return_value = registration

        mock_email_instance = mock_email_class.return_value

        # Act
        with mock.patch("events.tasks.Registration.objects", manager):
            send_registration_confirmation_email.run("1")

        # Assert helpers
        mock_markdown.assert_called_once_with(
            "**done**",
            extensions=["extra", "sane_lists", "toc"],
        )
        mock_render.assert_called_once_with(
            "emails/event_registration_confirmation.html",
            {
                "user": registration.user,
                "event": registration.event,
                "registration": registration,
                "success_html": "converted",
            },
        )
        mock_strip.assert_called_once_with("<p>ok</p>")

        # Assert
        mock_email_class.assert_called_once()
        mock_email_instance.attach_alternative.assert_called_once()
        mock_email_instance.send.assert_called_once()


class EventAdminTests(EventEmailLogFactoryMixin, TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.event_admin = EventAdmin(Event, self.site)
        self.registration_admin = RegistrationAdmin(Registration, self.site)
        self.event_admin.message_user = mock.Mock()
        self.registration_admin.message_user = mock.Mock()

    def test_price_display_returns_label_for_free(self):
        # Arrange
        now = timezone.now()
        event = Event(
            title="Free Event",
            description="desc",
            start_time=now,
            end_time=now + timedelta(hours=1),
            price=None,
        )

        # Act
        result = self.event_admin.price_display(event)

        # Assert
        self.assertEqual(result, "رایگان")

    @mock.patch("events.admin.jdate", return_value="JDATE")
    def test_start_time_display_calls_jdate(self, mock_jdate):
        event = self.create_event()

        result = self.event_admin.start_time_display(event)

        mock_jdate.assert_called_once_with(event.start_time)
        self.assertEqual(result, "JDATE")

    @mock.patch("events.admin.jdate", return_value="JDATE")
    def test_end_time_display_calls_jdate(self, mock_jdate):
        event = self.create_event()

        result = self.event_admin.end_time_display(event)

        mock_jdate.assert_called_once_with(event.end_time)
        self.assertEqual(result, "JDATE")

    def test_capacity_display_handles_unlimited(self):
        event = self.create_event(capacity=None)

        result = self.event_admin.capacity_display(event)

        self.assertEqual(result, "نامحدود")

    @mock.patch("events.admin.Event.current_attendees_count", new_callable=mock.PropertyMock, return_value=7)
    def test_attendees_display_returns_current_attendees(self, _mock_count):
        event = self.create_event()

        result = self.event_admin.attendees_display(event)

        self.assertEqual(result, 7)

    @mock.patch("events.admin.Event.is_registration_open", new_callable=mock.PropertyMock, return_value=True)
    def test_is_registration_open_display_returns_bool(self, _mock_open):
        event = self.create_event()

        self.assertTrue(self.event_admin.is_registration_open_display(event))

    def test_make_draft_updates_status(self):
        event = self.create_event(status=Event.StatusChoices.PUBLISHED)
        queryset = Event.all_objects.filter(pk=event.pk)

        self.event_admin.make_draft(None, queryset)

        self.assertEqual(Event.objects.get(pk=event.pk).status, Event.StatusChoices.DRAFT)

    def test_make_cancelled_updates_status(self):
        event = self.create_event(status=Event.StatusChoices.DRAFT)
        queryset = Event.all_objects.filter(pk=event.pk)

        self.event_admin.make_cancelled(None, queryset)

        self.assertEqual(Event.objects.get(pk=event.pk).status, Event.StatusChoices.CANCELLED)

    def test_make_completed_updates_status(self):
        event = self.create_event(status=Event.StatusChoices.PUBLISHED)
        queryset = Event.objects.filter(pk=event.pk)

        self.event_admin.make_completed(None, queryset)

        self.assertEqual(Event.objects.get(pk=event.pk).status, Event.StatusChoices.COMPLETED)

    def test_restore_events_marks_is_deleted_false(self):
        event = self.create_event()
        event.delete()
        queryset = Event.all_objects.filter(pk=event.pk)

        self.event_admin.restore_events(None, queryset)

        self.assertFalse(Event.all_objects.get(pk=event.pk).is_deleted)

    def test_action_send_skyroom_credentials_queues_task(self):
        event = self.create_event()

        with mock.patch("events.admin.queue_skyroom_credentials.delay") as mock_delay:
            result = self.event_admin.action_send_skyroom_credentials(mock.Mock(), event.pk)

        mock_delay.assert_called_once_with(event.pk)
        self.assertEqual(result, mock.ANY)

    def test_action_send_reminder_now_queues_task(self):
        event = self.create_event()

        with mock.patch("events.admin.send_event_reminder_task.delay") as mock_delay:
            result = self.event_admin.action_send_reminder_now(mock.Mock(), event.pk)

        mock_delay.assert_called_once_with(event.pk)
        self.assertEqual(result, mock.ANY)

    def test_action_send_announcement_dispatches_queue(self):
        event = self.create_event()
        data = QueryDict(mutable=True)
        data.update({"subject": "Hello", "body_html": "<p>hi</p>"})
        data.setlist("statuses", [Registration.StatusChoices.CONFIRMED])
        request = SimpleNamespace(method="POST", POST=data, user=self.create_user())

        with mock.patch("events.admin.queue_event_announcement") as mock_queue, \
             mock.patch("events.admin.redirect", return_value="redirected") as mock_redirect:
            result = self.event_admin.action_send_announcement(request, event.pk)

        mock_queue.delay.assert_called_once()
        mock_redirect.assert_called_once()
        self.assertEqual(result, "redirected")

    def test_action_invite_other_users_queues_task(self):
        event = self.create_event()

        with mock.patch("events.admin.queue_invites_to_non_registered_users.delay") as mock_delay:
            result = self.event_admin.action_invite_other_users(mock.Mock(), event.pk)

        mock_delay.assert_called_once_with(event.pk)
        self.assertEqual(result, mock.ANY)

    def test_make_published_updates_status(self):
        event = self.create_event(status=Event.StatusChoices.DRAFT)
        queryset = Event.objects.filter(pk=event.pk)

        self.event_admin.make_published(None, queryset)

        self.assertEqual(Event.objects.get(pk=event.pk).status, Event.StatusChoices.PUBLISHED)

    def test_confirm_registrations_sets_status(self):
        # Arrange
        event = self.create_event()
        user = self.create_user()
        user.is_email_verified = False
        user.save(update_fields=["is_email_verified"])
        registration = Registration.objects.create(
            event=event,
            user=user,
            status=Registration.StatusChoices.PENDING,
        )

        # Act
        self.registration_admin.confirm_registrations(None, Registration.objects.filter(pk=registration.pk))

        # Assert
        self.assertEqual(
            Registration.objects.get(pk=registration.pk).status,
            Registration.StatusChoices.CONFIRMED,
        )


class RegistrationAdminTests(EventEmailLogFactoryMixin, TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.admin = RegistrationAdmin(Registration, self.site)
        self.admin.message_user = mock.Mock()

    def test_cancel_registrations_sets_status(self):
        registration = Registration.objects.create(
            event=self.create_event(),
            user=self.create_user(),
            status=Registration.StatusChoices.PENDING,
        )

        self.admin.cancel_registrations(None, Registration.objects.filter(pk=registration.pk))

        self.assertEqual(
            Registration.objects.get(pk=registration.pk).status,
            Registration.StatusChoices.CANCELLED,
        )

    def test_mark_attended_updates_status(self):
        registration = Registration.objects.create(
            event=self.create_event(),
            user=self.create_user(),
            status=Registration.StatusChoices.CONFIRMED,
        )

        self.admin.mark_attended(None, Registration.objects.filter(pk=registration.pk))

        self.assertEqual(
            Registration.objects.get(pk=registration.pk).status,
            Registration.StatusChoices.ATTENDED,
        )

    def test_restore_registrations_calls_restore(self):
        registration = Registration.objects.create(
            event=self.create_event(),
            user=self.create_user(),
            status=Registration.StatusChoices.PENDING,
        )
        registration.delete()

        with mock.patch.object(Registration, "objects", Registration.all_objects):
            self.admin.restore_registrations(None, Registration.all_objects.filter(pk=registration.pk))

        self.assertFalse(Registration.all_objects.get(pk=registration.pk).is_deleted)

    def test_action_email_selected_sends_and_redirects(self):
        event = self.create_event()
        registration = Registration.objects.create(
            event=event,
            user=self.create_user(),
            status=Registration.StatusChoices.PENDING,
        )
        data = QueryDict(mutable=True)
        data.update({"subject": "Title", "body_html": "<p>body</p>"})
        request = SimpleNamespace(method="POST", POST=data, user=self.create_user())

        with mock.patch("events.admin.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.admin._send_html_email") as mock_send, \
             mock.patch("events.admin.redirect", return_value="redirected") as mock_redirect:
            self.admin.action_email_selected(request, registration.pk)

        mock_send.assert_called_once()
        mock_redirect.assert_called_once()

    def test_action_send_skyroom_credentials_queues_task(self):
        registration = Registration.objects.create(
            event=self.create_event(),
            user=self.create_user(),
            status=Registration.StatusChoices.CONFIRMED,
        )

        with mock.patch("events.admin.send_skyroom_credentials_individual_task.delay") as mock_delay:
            result = self.admin.action_send_skyroom_credentials(mock.Mock(), registration.pk)

        mock_delay.assert_called_once_with(registration.pk)
        self.assertEqual(result, mock.ANY)


class EventEmailLogAdminTests(EventEmailLogFactoryMixin, TestCase):
    def setUp(self):
        self.site = AdminSite()
        self.admin = EventEmailLogAdmin(EventEmailLog, self.site)
        self.admin.message_user = mock.Mock()

    def test_user_email_returns_dash_when_missing(self):
        event = self.create_event()
        user = self.create_user()
        user.email = ""
        log = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_EVENT_ANNOUNCEMENT,
        )

        self.assertEqual(self.admin.user_email(log), "—")

    def test_resend_selected_emails_requeues_and_clears_error(self):
        event = self.create_event()
        user = self.create_user()
        log = EventEmailLog.objects.create(
            event=event,
            user=user,
            kind=EventEmailLog.KIND_INVITE_NON_REGISTERED,
            status=EventEmailLog.STATUS_FAILED,
            error="boom",
        )

        with mock.patch("events.admin.send_invite_to_user.delay") as mock_delay:
            self.admin.resend_selected_emails(mock.Mock(), EventEmailLog.objects.filter(pk=log.pk))

        log.refresh_from_db()
        self.assertEqual(log.status, EventEmailLog.STATUS_PENDING)
        self.assertEqual(log.error, "")
        mock_delay.assert_called_once_with(log.event_id, log.user_id)


class EventTasksCoverageTests(EventEmailLogFactoryMixin, TestCase):
    def _dummy_registration(self):
        user = self.create_user()
        user.is_email_verified = True
        user.save(update_fields=["is_email_verified"])
        event = self.create_event()
        registration = Registration.objects.create(
            event=event,
            user=user,
            status=Registration.StatusChoices.CONFIRMED,
        )
        return registration

    def test_send_registration_cancellation_email_returns_when_email_missing(self):
        registration = SimpleNamespace(
            user=SimpleNamespace(email=None),
            event=SimpleNamespace(title="Title"),
        )
        manager = mock.MagicMock()
        manager.select_related.return_value.get.return_value = registration

        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives") as mock_email:
            send_registration_cancellation_email.run("1")

        mock_email.assert_not_called()

    def test_send_registration_cancellation_email_retries_on_failure(self):
        registration = SimpleNamespace(
            user=SimpleNamespace(email="user@example.com"),
            event=SimpleNamespace(title="Title"),
        )
        manager = mock.MagicMock()
        manager.select_related.return_value.get.return_value = registration
        email_instance = mock.MagicMock()
        email_instance.send.side_effect = RuntimeError("boom")
        mock_email_class = mock.MagicMock(return_value=email_instance)

        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives", mock_email_class), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch.object(send_registration_cancellation_email, "retry", side_effect=RuntimeError("retry")) as mock_retry:
            with self.assertRaises(RuntimeError):
                send_registration_cancellation_email.run("1")

        mock_retry.assert_called_once()

    def test_send_skyroom_credentials_individual_task_sends_email(self):
        user = SimpleNamespace(email="user@example.com")
        event = SimpleNamespace(
            title="E",
            slug="slug",
            online_link="https://example.com",
        )
        registration = SimpleNamespace(
            event=event,
            user=user,
            ticket_id="abcdefghijk",
        )
        manager = mock.MagicMock()
        manager.get.return_value = registration
        email_instance = mock.MagicMock()

        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives", mock.MagicMock(return_value=email_instance)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"):
            send_skyroom_credentials_individual_task.run(1)

        email_instance.send.assert_called_once()

    def test_send_event_reminder_task_sends_messages(self):
        event = SimpleNamespace(title="Ev", slug="slug")
        recipient = SimpleNamespace(user=SimpleNamespace(email="user@example.com"))
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks._event_recipients", return_value=[recipient]), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives") as mock_email:
            send_event_reminder_task.run(1)

        mock_email.assert_called_once()

    def test_queue_event_announcement_builds_group(self):
        event = self.create_event()
        class DummyQS:
            def __init__(self, ids):
                self.ids = ids
            def select_related(self, *args, **kwargs):
                return self
            def exclude(self, *args, **kwargs):
                return self
            def distinct(self):
                return self
            def values_list(self, *args, **kwargs):
                return self.ids
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks._event_recipients", return_value=DummyQS([1, 2])), \
             mock.patch("events.tasks.group") as mock_group:
            mock_job = mock.MagicMock()
            mock_group.return_value = mock_job
            result = queue_event_announcement.run(event.id, "subject", "<p>body</p>")

        mock_group.assert_called_once()
        mock_job.apply_async.assert_called_once()
        self.assertEqual(result["queued"], 2)

    def test_send_event_announcement_to_user_marks_sent(self):
        event = self.create_event()
        user = self.create_user()
        registration = SimpleNamespace(
            user=user,
            event=event,
            id=1,
        )
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=mock.MagicMock()):
            mock_select.return_value.get.return_value = registration
            send_event_announcement_to_user._orig_run(event.id, 1, "subject", "<p>body</p>")

        log.mark_sent.assert_called_once()

    def test_send_event_announcement_to_user_returns_skip(self):
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, True)):
            mock_select.return_value.get.return_value = SimpleNamespace(user=SimpleNamespace(id=1), event=SimpleNamespace(slug="slug"))
            result = send_event_announcement_to_user._orig_run(1, 1, "subject", "<p>body</p>")

        self.assertEqual(result, {"skipped": True, "status": log.status})

    def test_queue_invites_to_non_registered_users_uses_group(self):
        event = self.create_event()
        class DummyUserQS:
            def __init__(self, ids):
                self.ids = ids
            def filter(self, *args, **kwargs):
                return self
            def exclude(self, *args, **kwargs):
                return self
            def distinct(self):
                return self
            def values_list(self, *args, **kwargs):
                return self.ids
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks.User.objects.all", return_value=DummyUserQS([1])), \
             mock.patch("events.tasks.group") as mock_group:
            mock_job = mock.MagicMock()
            mock_group.return_value = mock_job
            result = queue_invites_to_non_registered_users.run(event.id)

        mock_job.apply_async.assert_called_once()
        self.assertEqual(result["queued"], 1)

    def test_send_invite_to_user_skips_when_claimed(self):
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Event.objects.get", return_value=self.create_event()), \
             mock.patch("events.tasks.User.objects.get", return_value=self.create_user()), \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, True)):
            result = send_invite_to_user._orig_run(1, 1)

        self.assertEqual(result, {"skipped": True, "status": log.status})

    def test_send_invite_to_user_sends_email(self):
        msg_instance = mock.MagicMock()
        target_user = self.create_user()
        with mock.patch("events.tasks.Event.objects.get", return_value=self.create_event()), \
             mock.patch("events.tasks.User.objects.get", return_value=target_user), \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(mock.MagicMock(), False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks._build_email_context", return_value="ctx"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=msg_instance):
            result = send_invite_to_user._orig_run(1, 1)

        msg_instance.send.assert_called_once()
        self.assertEqual(result, f"Email sent to {target_user.email}")

    def test_queue_skyroom_credentials_builds_group(self):
        event = self.create_event()
        class DummyRegQS:
            def __init__(self, ids):
                self.ids = ids
            def select_related(self, *args, **kwargs):
                return self
            def exclude(self, *args, **kwargs):
                return self
            def distinct(self):
                return self
            def values_list(self, *args, **kwargs):
                return self.ids
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks._event_recipients", return_value=DummyRegQS([1])), \
             mock.patch("events.tasks.group") as mock_group:
            mock_job = mock.MagicMock()
            mock_group.return_value = mock_job
            result = queue_skyroom_credentials.run(event.id)

        mock_job.apply_async.assert_called_once()
        self.assertEqual(result["queued"], 1)

    def test_send_skyroom_credentials_to_user_skips_when_claimed(self):
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, True)):
            mock_select.return_value.get.return_value = SimpleNamespace(
                user=SimpleNamespace(id=1, email="user@example.com"),
                event=SimpleNamespace(id=1, slug="slug", online_link="https://example.com", title="E"),
                ticket_id=uuid.uuid4(),
            )
            result = send_skyroom_credentials_to_user._orig_run(1, 1)

        self.assertEqual(result, {"skipped": True, "status": log.status})

    def test_send_skyroom_credentials_to_user_sends_email(self):
        msg_instance = mock.MagicMock()
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(mock.MagicMock(), False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=msg_instance):
            mock_select.return_value.get.return_value = SimpleNamespace(
                user=SimpleNamespace(email="user@example.com", id=1),
                event=SimpleNamespace(title="Title", slug="slug", online_link="https://example.com"),
                ticket_id=uuid.uuid4(),
            )
            send_skyroom_credentials_to_user._orig_run(1, 1)

        msg_instance.send.assert_called_once()

    def test_send_registration_confirmation_email_skips_without_email(self):
        registration = SimpleNamespace(
            user=SimpleNamespace(email=""),
            event=SimpleNamespace(title="Title", registration_success_markdown=""),
        )
        manager = mock.MagicMock()
        manager.select_related.return_value.get.return_value = registration
        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives") as mock_email:
            send_registration_confirmation_email.run("1")

        mock_email.assert_not_called()

    def test_send_registration_confirmation_email_retries_on_failure(self):
        registration = SimpleNamespace(
            user=SimpleNamespace(email="user@example.com"),
            event=SimpleNamespace(title="Title", registration_success_markdown=""),
        )
        manager = mock.MagicMock()
        manager.select_related.return_value.get.return_value = registration
        email_instance = mock.MagicMock()
        email_instance.send.side_effect = RuntimeError("boom")
        mock_email_class = mock.MagicMock(return_value=email_instance)

        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives", mock_email_class), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch.object(send_registration_confirmation_email, "retry", side_effect=RuntimeError("retry")) as mock_retry:
            with self.assertRaises(RuntimeError):
                send_registration_confirmation_email.run("1")

        mock_retry.assert_called_once()

    def test_event_recipients_disregards_verification_flag(self):
        event = self.create_event()
        user = self.create_user()
        user.is_email_verified = False
        user.save(update_fields=["is_email_verified"])
        registration = Registration.objects.create(
            event=event,
            user=user,
            status=Registration.StatusChoices.PENDING,
        )

        recipients = _event_recipients(event, only_verified=False)

        self.assertEqual(len(recipients), 1)
        self.assertEqual(recipients[0].user_id, user.id)

    def test_send_skyroom_credentials_individual_task_retries_on_failure(self):
        user = SimpleNamespace(email="user@example.com")
        event = SimpleNamespace(title="Title", slug="slug", online_link="https://example.com")
        registration = SimpleNamespace(user=user, event=event, ticket_id="abcdef")
        manager = mock.MagicMock()
        manager.get.return_value = registration

        with mock.patch("events.tasks.Registration.objects", manager), \
             mock.patch("events.tasks.EmailMultiAlternatives", mock.MagicMock(return_value=mock.MagicMock(send=mock.Mock(side_effect=RuntimeError("boom"))))), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch.object(send_skyroom_credentials_individual_task, "retry", side_effect=RuntimeError("retry")) as mock_retry:
            with self.assertRaises(RuntimeError):
                send_skyroom_credentials_individual_task.run(1)

        self.assertTrue(mock_retry.called)

    def test_send_event_reminder_task_retries_on_failure(self):
        event = SimpleNamespace(title="Ev", slug="slug")
        recipient = SimpleNamespace(user=SimpleNamespace(email="user@example.com"))
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks._event_recipients", return_value=[recipient]), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=mock.MagicMock(send=mock.Mock(side_effect=RuntimeError("boom")))), \
             mock.patch.object(send_event_reminder_task, "retry", side_effect=RuntimeError("retry")) as mock_retry:
            with self.assertRaises(RuntimeError):
                send_event_reminder_task.run(1)

        self.assertTrue(mock_retry.called)

    def test_send_event_announcement_to_user_handles_soft_time_limit(self):
        event = self.create_event()
        user = self.create_user()
        registration = SimpleNamespace(user=user, event=event, id=1)
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, False)), \
             mock.patch("events.tasks.render_to_string", side_effect=SoftTimeLimitExceeded("timeout")), \
             mock.patch("events.tasks.strip_tags") as mock_strip:
            mock_select.return_value.get.return_value = registration
            with self.assertRaises(SoftTimeLimitExceeded):
                send_event_announcement_to_user._orig_run(1, 1, "subject", "<p>body</p>")

        log.mark_failed.assert_called_once_with("Soft time limit exceeded")

    def test_send_event_announcement_to_user_handles_failure(self):
        event = self.create_event()
        user = self.create_user()
        registration = SimpleNamespace(user=user, event=event, id=1)
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=mock.MagicMock(send=mock.Mock(side_effect=RuntimeError("boom")))):
            mock_select.return_value.get.return_value = registration
            with self.assertRaises(RuntimeError):
                send_event_announcement_to_user._orig_run(1, 1, "subject", "<p>body</p>")

        log.mark_failed.assert_called_once()

    def test_send_invite_to_user_handles_failure(self):
        event = self.create_event()
        user = self.create_user()
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Event.objects.get", return_value=event), \
             mock.patch("events.tasks.User.objects.get", return_value=user), \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks._build_email_context", return_value="ctx"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=mock.MagicMock(send=mock.Mock(side_effect=RuntimeError("boom")))):
            with self.assertRaises(RuntimeError):
                send_invite_to_user._orig_run(1, 1)

        log.mark_failed.assert_called_once()

    def test_send_skyroom_credentials_to_user_handles_failure(self):
        event = self.create_event()
        user = self.create_user()
        log = mock.MagicMock(status=EventEmailLog.STATUS_PENDING)
        with mock.patch("events.tasks.Registration.objects.select_related") as mock_select, \
             mock.patch("events.tasks.EventEmailLog.claim", return_value=(log, False)), \
             mock.patch("events.tasks.render_to_string", return_value="<p>ok</p>"), \
             mock.patch("events.tasks.strip_tags", return_value="ok"), \
             mock.patch("events.tasks.EmailMultiAlternatives", return_value=mock.MagicMock(send=mock.Mock(side_effect=RuntimeError("boom")))):
            mock_select.return_value.get.return_value = SimpleNamespace(
                user=user,
                event=event,
                ticket_id=uuid.uuid4(),
            )
            with self.assertRaises(RuntimeError):
                send_skyroom_credentials_to_user._orig_run(1, 1)

        log.mark_failed.assert_called_once()

    def test_queue_invites_to_non_registered_users_respects_filters(self):
        event = self.create_event()
        verified = self.create_user()
        verified.is_email_verified = True
        verified.save(update_fields=["is_email_verified"])
        inactive = self.create_user()
        inactive.is_email_verified = True
        inactive.is_active = False
        inactive.save(update_fields=["is_email_verified", "is_active"])
        with mock.patch("events.tasks.group") as mock_group:
            mock_job = mock.MagicMock()
            mock_group.return_value = mock_job
            result = queue_invites_to_non_registered_users.run(event.id, only_verified=True, only_active=True)

        mock_job.apply_async.assert_called_once()
        self.assertEqual(result["queued"], 1)
