"""Authentication-related API schemas."""

from ninja import Schema, ModelSchema
from typing import Optional

from users.models import User


class UserRegistrationSchema(Schema):
    username: str
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    university: Optional[str] = None
    student_id: Optional[str] = None
    year_of_study: Optional[int] = None
    major: Optional[str] = None

class UserLoginSchema(Schema):
    email: str
    password: str

class UserProfileSchema(ModelSchema):
    profile_picture: Optional[str] = None
    student_id: Optional[str] = None
    major: Optional[str] = None
    university: Optional[str] = None

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'student_id',
            'year_of_study',
            'major',
            'university',
            'bio',
            'date_joined',
        'is_email_verified',
        'is_active',
        'is_staff',
        'is_superuser',
        'is_deleted',
        'deleted_at',
        ]

    @staticmethod
    def resolve_major(obj):
        return obj.get_major_display()

    @staticmethod
    def resolve_university(obj):
        return obj.get_university_display()

    @staticmethod
    def resolve_profile_picture(obj, context):
        """
        Resolves the absolute URL for the profile picture.
        `context` contains the request object, which is needed for build_absolute_uri.
        """
        request = context['request']
        if obj.profile_picture and hasattr(obj.profile_picture, 'url'):
            return request.build_absolute_uri(obj.profile_picture.url)
        return None


class UserListSchema(ModelSchema):
    full_name: Optional[str] = None

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'is_active',
            'is_staff',
            'is_superuser',
            'date_joined',
        ]

    @staticmethod
    def resolve_full_name(obj):
        return obj.get_full_name()

class UserUpdateSchema(Schema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    bio: Optional[str] = None
    year_of_study: Optional[int] = None
    major: Optional[str] = None
    university: Optional[str] = None
    student_id: Optional[str] = None

class TokenSchema(Schema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenRefreshIn(Schema):
    refresh_token: str

class PasswordResetRequestSchema(Schema):
    email: str

class PasswordResetConfirmSchema(Schema):
    token: str
    new_password: str

class UsernameCheckSchema(Schema):
    exists: bool
