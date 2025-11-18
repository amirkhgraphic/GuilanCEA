"""API payloads for certificate operations."""

from datetime import datetime
from typing import List, Optional

from ninja import Schema


class SkillSchema(Schema):
    id: int
    name: str
    description: Optional[str] = None


class CertificateTemplateOut(Schema):
    id: int
    event_id: int
    event_title: str
    image_url: Optional[str]
    skill_ids: List[int]
    skills: List[SkillSchema]


class CertificateGenerationItem(Schema):
    user_id: int
    score: int
    title: Optional[str] = None
    description: Optional[str] = None
    skill_ids: Optional[List[int]] = None
    issued_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class CertificateGenerationPayload(Schema):
    entries: List[CertificateGenerationItem]
    default_title: Optional[str] = None
    default_description: Optional[str] = None


class UserCertificateOut(Schema):
    id: int
    user_id: int
    user_name: str
    event_id: int
    title: str
    certificate_id: str
    certificate_code: str
    score: int
    score_label: str
    image_url: Optional[str]


class CertificateGenerationResponse(Schema):
    certificates: List[UserCertificateOut]


class CertificateVerificationOut(Schema):
    certificate_id: str
    certificate_code: str
    user_id: int
    user_name: str
    event_id: int
    event_title: str
    title: str
    score: int
    score_label: str
    issued_at: datetime
    expires_at: Optional[datetime] = None
    image_url: Optional[str] = None
    skills: List[str]
