from api.schemas.auth import *
from api.schemas.blog import *
from api.schemas.gallery import *
from api.schemas.events import *
from api.schemas.communications import *

# Response Schemas
class MessageSchema(Schema):
    message: str


class ErrorSchema(Schema):
    error: str
    details: Optional[str] = None

# Update CommentSchema to handle self-reference
CommentSchema.model_rebuild()
