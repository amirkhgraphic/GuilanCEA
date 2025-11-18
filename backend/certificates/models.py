from io import BytesIO
from typing import Optional, Sequence
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import models
from django.utils import timezone
from PIL import Image, ImageDraw, ImageFont

from events.models import Registration
from users.models import User
from utils.models import BaseModel

SHORT_CERTIFICATE_CODE_LENGTH = 10


def _generate_certificate_code() -> str:
    return uuid4().hex[:SHORT_CERTIFICATE_CODE_LENGTH]


class Skill(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class CertificateTemplate(BaseModel):
    event = models.OneToOneField(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='certificate_template',
    )
    image = models.ImageField(upload_to='certificates/templates/')
    skills = models.ManyToManyField(
        Skill,
        blank=True,
        related_name='certificate_templates',
        help_text='Skills covered by this event.',
    )

    class Meta:
        verbose_name = 'Certificate template'
        verbose_name_plural = 'Certificate templates'

    def __str__(self):
        return f'{self.event.title} template'

    def _validate_score(self, score: Optional[int]) -> int:
        """Normalize score values and ensure they stay within 0-100."""
        if score is None:
            raise ValidationError("Score is required")
        try:
            normalized = int(score)
        except (TypeError, ValueError):
            raise ValidationError("Score must be an integer between 0 and 100")
        if normalized < 0 or normalized > 100:
            raise ValidationError("Score must be between 0 and 100")
        return normalized

    def _resolve_skill_ids(self, skill_ids: Optional[Sequence[int]]) -> list[int]:
        """Return a cleaned list of skill IDs, defaulting to the template skills."""
        if skill_ids is None:
            return list(self.skills.values_list('id', flat=True))

        normalized = []
        seen = set()
        for skill_id in skill_ids:
            if skill_id is None:
                continue
            try:
                skill_int = int(skill_id)
            except (TypeError, ValueError):
                continue
            if skill_int not in seen:
                seen.add(skill_int)
                normalized.append(skill_int)

        if not normalized:
            return []

        existing = set(Skill.objects.filter(id__in=normalized).values_list('id', flat=True))
        missing = set(normalized) - existing
        if missing:
            raise ValidationError(f"Skills not found: {', '.join(str(mid) for mid in sorted(missing))}")
        return normalized

    def _ensure_user_registration(self, user: User) -> Registration:
        """Require that the user has a confirmed or attended registration for the event."""
        registration = Registration.objects.filter(
            event=self.event,
            user=user,
            status__in=[
                Registration.StatusChoices.CONFIRMED,
                Registration.StatusChoices.ATTENDED,
            ],
            is_deleted=False,
        ).order_by('-registered_at').first()
        if not registration:
            raise ValidationError("User must have a confirmed or attended registration for this event.")
        return registration

    def _load_font(self, size: int = 48):
        try:
            return ImageFont.truetype("arial.ttf", size)
        except Exception:
            return ImageFont.load_default()

    def _render_certificate_image(self, certificate: 'UserCertificate') -> None:
        """Overlay user-specific text on the template image and attach it to the certificate."""
        if not self.image:
            return
        try:
            template_path = self.image.path
        except (AttributeError, ValueError):
            return

        try:
            base_image = Image.open(template_path).convert("RGB")
        except FileNotFoundError:
            return

        draw = ImageDraw.Draw(base_image)
        font = self._load_font(size=48)
        width, height = base_image.size
        lines = [
            certificate.user.get_full_name() or certificate.user.email,
            self.event.title,
            f"Score: {certificate.score} ({certificate.score_label})",
            timezone.localtime(certificate.issued_at).strftime('%Y-%m-%d'),
        ]
        margin = 40
        total_height = 0
        measurements = []
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            line_height = bbox[3] - bbox[1]
            line_width = bbox[2] - bbox[0]
            measurements.append((line, line_width, line_height))
            total_height += line_height + 10
        y = height - margin - total_height
        for line, line_width, line_height in measurements:
            x = (width - line_width) / 2
            draw.text((x, y), line, fill='black', font=font)
            y += line_height + 10

        buffer = BytesIO()
        base_image.save(buffer, format='PNG')
        buffer.seek(0)
        filename = f"{self.event.slug}_{certificate.user_id}_{uuid4().hex}.png"
        certificate.image.save(filename, ContentFile(buffer.read()), save=False)
        certificate.save(update_fields=['image'])

    def award_certificate(
        self,
        *,
        user: User,
        title: str,
        description: str = '',
        score: Optional[int] = None,
        skill_ids: Optional[Sequence[int]] = None,
        issued_at=None,
        expires_at=None,
    ) -> 'UserCertificate':
        """
        Create or update the certificate for a single user.
        """
        self._ensure_user_registration(user)
        resolved_score = self._validate_score(score)
        resolved_skills = self._resolve_skill_ids(skill_ids)
        issued_at = issued_at or timezone.now()
        title = title or f"{self.event.title} Certificate"
        description = description or ''

        certificate, _ = UserCertificate.objects.update_or_create(
            user=user,
            event=self.event,
            defaults={
                'template': self,
                'title': title,
                'description': description,
                'score': resolved_score,
                'issued_at': issued_at,
                'expires_at': expires_at,
            },
        )

        certificate.skills.set(resolved_skills)
        self._render_certificate_image(certificate)
        return certificate

    def generate_certificates(
        self,
        entries: Sequence[dict],
        *,
        default_title: Optional[str] = None,
        default_description: Optional[str] = None,
    ) -> list['UserCertificate']:
        """
        Create certificates for a batch of users.
        Entries expect dicts with at least `user_id` and `score`.
        """
        if not entries:
            raise ValidationError("Entries payload must contain at least one item.")

        user_ids = {entry.get('user_id') for entry in entries if entry.get('user_id') is not None}
        if not user_ids:
            raise ValidationError("No valid user IDs were provided.")

        users = {user.id: user for user in User.objects.filter(id__in=user_ids)}
        missing = user_ids - users.keys()
        if missing:
            raise ValidationError(f"Users not found: {', '.join(str(uid) for uid in sorted(missing))}")

        certificates = []
        for entry in entries:
            user = users.get(entry.get('user_id'))
            if not user:
                continue
            certificate = self.award_certificate(
                user=user,
                title=entry.get('title') or default_title or f"{self.event.title} Certificate",
                description=entry.get('description') or default_description or '',
                score=entry.get('score'),
                skill_ids=entry.get('skill_ids'),
                issued_at=entry.get('issued_at'),
                expires_at=entry.get('expires_at'),
            )
            certificates.append(certificate)
        return certificates


class UserCertificate(BaseModel):
    SCORE_RANGES = [
        (0, 24, 'Fair'),
        (25, 49, 'Good'),
        (50, 74, 'Very Good'),
        (75, 100, 'Perfect'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='certificates',
    )
    event = models.ForeignKey(
        'events.Event',
        on_delete=models.CASCADE,
        related_name='user_certificates',
    )
    template = models.ForeignKey(
        CertificateTemplate,
        on_delete=models.PROTECT,
        related_name='awarded_certificates',
    )
    certificate_id = models.UUIDField(default=uuid4, unique=True, editable=False)
    code = models.CharField(
        max_length=SHORT_CERTIFICATE_CODE_LENGTH,
        unique=True,
        editable=False,
        default=_generate_certificate_code,
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    score = models.PositiveSmallIntegerField(default=0)
    issued_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    image = models.ImageField(
        upload_to='certificates/generated/',
        null=True,
        blank=True,
    )
    skills = models.ManyToManyField(
        Skill,
        blank=True,
        related_name='user_certificates',
        help_text='Skills demonstrated on this certificate.',
    )

    class Meta:
        unique_together = ('user', 'event')
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['user', 'event']),
            models.Index(fields=['event', 'score']),
        ]

    def __str__(self):
        return f'{self.user} - {self.title} ({self.certificate_id})'

    @property
    def score_label(self) -> str:
        for lower, upper, label in self.SCORE_RANGES:
            if lower <= self.score <= upper:
                return label
        return 'Unknown'

    @staticmethod
    def _make_unique_code() -> str:
        """Generate a short certificate code without collisions."""
        for _ in range(5):
            candidate = _generate_certificate_code()
            if not UserCertificate.objects.filter(code=candidate).exists():
                return candidate
        raise RuntimeError("Unable to generate a unique certificate code.")

    def save(self, *args, **kwargs):
        if not self.code or UserCertificate.objects.filter(code=self.code).exclude(pk=self.pk).exists():
            self.code = self._make_unique_code()
        super().save(*args, **kwargs)
