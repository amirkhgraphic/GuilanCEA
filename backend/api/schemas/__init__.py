"""Aggregate exports for API schemas and shared response payloads."""

from typing import Optional

from ninja import Schema

from api.schemas.auth import *
from api.schemas.blog import *
from api.schemas.gallery import *
from api.schemas.events import *
from api.schemas.communications import *


class MessageSchema(Schema):
    """Basic success response containing a message."""
    message: str


class ErrorSchema(Schema):
    """Standard error payload with optional details."""
    error: str
    details: Optional[str] = None


def rebuild_comment_schema() -> None:
    """Ensure the self-referential CommentSchema is fully initialized."""
    CommentSchema.model_rebuild()


rebuild_comment_schema()
