from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError

from ninja import Router
from ninja.errors import HttpError

from api.authentication import jwt_auth
from api.schemas.certificates import (
    CertificateTemplateOut,
    CertificateGenerationPayload,
    CertificateGenerationResponse,
    CertificateVerificationOut,
    SkillSchema,
    UserCertificateOut,
)
from certificates.models import CertificateTemplate, UserCertificate


certificates_router = Router(tags=["Certificates"])


def _ensure_staff(user):
    if not user or not user.is_staff:
        raise HttpError(403, "Only staff users can access certificate management.")


@certificates_router.get(
    "templates/{int:event_id}",
    response=CertificateTemplateOut,
    auth=jwt_auth,
)
def get_template(request, event_id: int):
    _ensure_staff(request.auth)
    template = get_object_or_404(
        CertificateTemplate.objects.select_related('event').prefetch_related('skills'),
        event_id=event_id,
        is_deleted=False,
    )

    skills = [
        SkillSchema(
            id=skill.id,
            name=skill.name,
            description=skill.description,
        )
        for skill in template.skills.all()
    ]

    image_url = None
    if template.image and hasattr(template.image, 'url'):
        image_url = request.build_absolute_uri(template.image.url)

    return CertificateTemplateOut(
        id=template.id,
        event_id=template.event_id,
        event_title=template.event.title,
        image_url=image_url,
        skill_ids=list(template.skills.values_list('id', flat=True)),
        skills=skills,
    )


@certificates_router.post(
    "templates/{int:event_id}/generate",
    response=CertificateGenerationResponse,
    auth=jwt_auth,
)
def generate_certificates(request, event_id: int, payload: CertificateGenerationPayload):
    _ensure_staff(request.auth)
    template = get_object_or_404(
        CertificateTemplate.objects.select_related('event').prefetch_related('skills'),
        event_id=event_id,
        is_deleted=False,
    )

    try:
        entries = [entry.model_dump() for entry in payload.entries]
        certificates = template.generate_certificates(
            entries,
            default_title=payload.default_title,
            default_description=payload.default_description,
        )
    except ValidationError as exc:
        raise HttpError(400, str(exc))

    result = []
    for certificate in certificates:
        image_url = None
        if certificate.image and hasattr(certificate.image, 'url'):
            image_url = request.build_absolute_uri(certificate.image.url)

        result.append(
            UserCertificateOut(
                id=certificate.id,
                user_id=certificate.user_id,
                user_name=certificate.user.get_full_name() or certificate.user.email,
                event_id=certificate.event_id,
                title=certificate.title,
                certificate_id=str(certificate.certificate_id),
                certificate_code=certificate.code,
                score=certificate.score,
                score_label=certificate.score_label,
                image_url=image_url,
            )
        )

    return CertificateGenerationResponse(certificates=result)


@certificates_router.get(
    "verify/{str:certificate_code}",
    response=CertificateVerificationOut,
)
def verify_certificate(request, certificate_code):
    certificate = get_object_or_404(
        UserCertificate.objects.select_related('event', 'user').prefetch_related('skills'),
        code=certificate_code,
        is_deleted=False,
    )
    image_url = None
    if certificate.image and hasattr(certificate.image, 'url'):
        image_url = request.build_absolute_uri(certificate.image.url)

    return CertificateVerificationOut(
        certificate_id=str(certificate.certificate_id),
        certificate_code=certificate.code,
        user_id=certificate.user_id,
        user_name=certificate.user.get_full_name() or certificate.user.email,
        event_id=certificate.event_id,
        event_title=certificate.event.title,
        title=certificate.title,
        score=certificate.score,
        score_label=certificate.score_label,
        issued_at=certificate.issued_at,
        expires_at=certificate.expires_at,
        image_url=image_url,
        skills=[skill.name for skill in certificate.skills.all()],
    )
