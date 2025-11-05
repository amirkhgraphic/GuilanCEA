from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.db import models

import uuid
from datetime import timedelta

from utils.models import BaseModel
from utils.choices import MajorChoices, UniversityChoices


class User(AbstractUser, BaseModel):
    email = models.EmailField(unique=True)
    bio = models.TextField(null=True, blank=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)

    student_id = models.CharField(max_length=20, null=True)
    year_of_study = models.IntegerField(null=True, blank=True)
    major = models.CharField(
        max_length=16,
        choices=MajorChoices.choices,
        blank=True, null=True
    )
    university = models.CharField(
        max_length=127,
        choices=UniversityChoices.choices,
        blank=True, null=True
    )
    is_email_verified = models.BooleanField(default=False)
    email_verification_token = models.UUIDField(default=uuid.uuid4, unique=True)
    email_verification_sent_at = models.DateTimeField(null=True, blank=True)

    password_reset_token = models.UUIDField(null=True, blank=True, unique=True)
    password_reset_token_expires_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def regenerate_verification_token(self):
        self.email_verification_token = uuid.uuid4()
        self.save(update_fields=['email_verification_token'])

    def set_password_reset_token(self):
        """Generates a new password reset token and sets its expiry."""
        self.password_reset_token = uuid.uuid4()
        self.password_reset_token_expires_at = timezone.now() + timedelta(hours=1)
        self.save(update_fields=['password_reset_token', 'password_reset_token_expires_at'])

    def save(self, *args, **kwargs):
        send_verified_success = False

        if self.pk is not None:
            prev = type(self).objects.filter(pk=self.pk).values_list('is_email_verified', flat=True).first()
            if prev is not None and prev is False and self.is_email_verified is True:
                send_verified_success = True

        super().save(*args, **kwargs)

        if send_verified_success:
            try:
                from users.tasks import send_email_verified_success
                send_email_verified_success.delay(self.id)
            except Exception:
                pass